using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HighScoreController(CasinoDbContext db) : BaseApiController
{
    // GET /api/highscore?game=blackjack — global leaderboard (top 20, optional game filter)
    [HttpGet]
    public async Task<IActionResult> GetLeaderboard([FromQuery] string? game)
    {
        var query = db.HighScores.AsQueryable();

        if (!string.IsNullOrWhiteSpace(game))
            query = query.Where(s => s.GameType == game);

        var scores = await query
            .OrderByDescending(s => (double)s.Score)
            .Take(20)
            .Select(s => new { s.Username, s.Score, s.GameType, s.SavedAt })
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

    // GET /api/highscore/levels — top 10 by level then XP
    [HttpGet("levels")]
    public async Task<IActionResult> GetLevelLeaderboard()
    {
        var top = await db.Users
            .OrderByDescending(u => u.Level)
            .ThenByDescending(u => u.Xp)
            .Take(10)
            .Select(u => new { u.Username, u.Level, u.Xp })
            .ToListAsync();

        var thresholds = await db.LevelThresholds.ToDictionaryAsync(l => l.Level, l => l.Name);

        var result = top.Select(u => new
        {
            u.Username,
            u.Level,
            LevelName = thresholds.TryGetValue(u.Level, out var n) ? n : "Touriste",
            u.Xp,
        });

        return Ok(result);
    }

    // POST /api/highscore — save current balance as score, reset to 1000
    [HttpPost]
    public async Task<IActionResult> SaveScore([FromBody] SaveScoreRequest? body)
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();
        if (user.Balance <= 1000) return BadRequest(new { message = "La balance doit être supérieure à $1 000 pour sauvegarder." });

        var gameType = body?.GameType ?? "multiple";
        var savedScore = user.Balance;
        db.HighScores.Add(new HighScore { Username = username, Score = savedScore, GameType = gameType });
        user.Balance = 1000;
        await db.SaveChangesAsync();

        return Ok(new { score = savedScore, balance = 1000 });
    }
}

public record SaveScoreRequest(string GameType);
