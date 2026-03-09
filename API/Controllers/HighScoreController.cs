using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HighScoreController(CasinoDbContext db) : ControllerBase
{
    private string? ResolveUsername()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Bearer ")) return null;
        return UserStore.GetUsername(auth["Bearer ".Length..]);
    }

    // GET /api/highscore — global leaderboard (top 20)
    [HttpGet]
    public async Task<IActionResult> GetLeaderboard()
    {
        var scores = await db.HighScores
            .OrderByDescending(s => s.Score)
            .Take(20)
            .Select(s => new { s.Username, s.Score, s.SavedAt })
            .ToListAsync();

        return Ok(scores);
    }

    // GET /api/highscore/me — best score + rank of the logged-in user
    [HttpGet("me")]
    public async Task<IActionResult> GetMyBest()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var best = await db.HighScores
            .Where(s => s.Username == username)
            .OrderByDescending(s => s.Score)
            .FirstOrDefaultAsync();

        if (best is null)
            return Ok(new { score = 0, rank = (int?)null });

        // Rank = number of distinct users with a better best score + 1
        var rank = await db.HighScores
            .GroupBy(s => s.Username)
            .CountAsync(g => g.Max(s => s.Score) > best.Score) + 1;

        return Ok(new { score = best.Score, rank });
    }

    // POST /api/highscore — save current balance as score, reset to 1000
    [HttpPost]
    public async Task<IActionResult> SaveScore()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();
        if (user.Balance <= 1000) return BadRequest(new { message = "La balance doit être supérieure à $1 000 pour sauvegarder." });

        var savedScore = user.Balance;
        db.HighScores.Add(new HighScore { Username = username, Score = savedScore });
        user.Balance = 1000;
        await db.SaveChangesAsync();

        return Ok(new { score = savedScore, balance = 1000 });
    }
}
