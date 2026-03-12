using API.Achievements;
using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AchievementsController(CasinoDbContext db) : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetAchievements()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var unlocked = await db.UserAchievements
            .Where(a => a.Username == username)
            .ToDictionaryAsync(a => a.AchievementKey, a => a.UnlockedAt);

        var result = AchievementRegistry.All.Select(a => new
        {
            a.Key,
            a.Game,
            a.Tier,
            a.Name,
            a.Description,
            a.WinsRequired,
            a.BoostPercent,
            Unlocked   = unlocked.ContainsKey(a.Key),
            UnlockedAt = unlocked.TryGetValue(a.Key, out var dt) ? dt : null,
        });

        return Ok(result);
    }

    [HttpGet("boosts")]
    public async Task<IActionResult> GetBoosts()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var unlockedKeys = await db.UserAchievements
            .Where(a => a.Username == username)
            .Select(a => a.AchievementKey)
            .ToListAsync();

        string[] allGames = ["blackjack", "baccarat", "roulette", "slots", "mines", "plinko", "crash", "hilo"];
        var boosts = new Dictionary<string, double>();
        foreach (var key in unlockedKeys)
        {
            if (!AchievementRegistry.ByKey.TryGetValue(key, out var def)) continue;
            var targets = def.Game == "global" ? allGames : (IEnumerable<string>)[def.Game];
            foreach (var g in targets)
            {
                boosts.TryGetValue(g, out var current);
                boosts[g] = current + def.BoostPercent;
            }
        }

        return Ok(boosts);
    }
}
