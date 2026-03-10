using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController(CasinoDbContext db) : BaseApiController
{
    [HttpGet("balance")]
    public async Task<IActionResult> GetBalance()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();

        return Ok(new { balance = user.Balance });
    }

    [HttpPost("balance")]
    public async Task<IActionResult> UpdateBalance([FromBody] UpdateBalanceRequest request)
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        if (request.Balance < 0)
            return BadRequest(new { message = "Balance cannot be negative." });

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();

        user.Balance = request.Balance;
        await db.SaveChangesAsync();

        return Ok(new { balance = user.Balance });
    }

    [HttpGet("level")]
    public async Task<IActionResult> GetLevel()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == username);
        if (user is null) return NotFound();

        var current = await db.LevelThresholds.FindAsync(user.Level);
        var next    = await db.LevelThresholds.FindAsync(user.Level + 1);

        var xpIntoLevel  = user.Xp - (current?.RequiredXp ?? 0);
        var xpForLevel   = next != null ? next.RequiredXp - (current?.RequiredXp ?? 0) : 0;
        var progress     = xpForLevel > 0 ? Math.Round(xpIntoLevel / xpForLevel * 100, 1) : 100.0;

        return Ok(new
        {
            level         = user.Level,
            levelName     = current?.Name ?? "Touriste",
            xp            = user.Xp,
            currentLevelXp = current?.RequiredXp ?? 0,
            nextLevelXp   = next?.RequiredXp,
            progress,
        });
    }

    [HttpPost("restart")]
    public async Task<IActionResult> Restart()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();

        user.Balance = 1000;
        await db.SaveChangesAsync();

        return Ok(new { balance = 1000 });
    }
}

public class UpdateBalanceRequest
{
    public double Balance { get; set; }
}
