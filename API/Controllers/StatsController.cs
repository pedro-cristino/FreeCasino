using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatsController(CasinoDbContext db) : ControllerBase
{
    private string? ResolveUsername()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Bearer ")) return null;
        return UserStore.GetUsername(auth["Bearer ".Length..]);
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        var stats = await db.UserStats.FindAsync(username);
        return Ok(stats ?? new UserStats { Username = username });
    }

    [HttpPost("game")]
    public async Task<IActionResult> RecordGame([FromBody] GameResultDto dto)
    {
        var username = ResolveUsername();
        if (username is null) return Unauthorized();

        // Ensure the row exists atomically (safe with concurrent inserts)
        await db.Database.ExecuteSqlRawAsync(
            "INSERT OR IGNORE INTO UserStats (Username) VALUES ({0})", username);

        int won     = dto.Won ? 1 : 0;
        int lost    = dto.Won ? 0 : 1;
        int allIn   = dto.WasAllIn ? 1 : 0;
        int bj      = dto.WasBlackjack ? 1 : 0;
        int split   = dto.WasSplit ? 1 : 0;
        double pct  = dto.AmountBet > 0 ? Math.Round(dto.AmountWon / dto.AmountBet * 100, 2) : 0;
        double cm   = dto.CrashMultiplier ?? 0.0;
        double hs   = dto.HiloStreak ?? 0;

        // Single atomic UPDATE — no read-modify-write, no lost updates
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE UserStats SET
                TotalGamesPlayed    = TotalGamesPlayed + 1,
                TotalWins           = TotalWins + {1},
                TotalLosses         = TotalLosses + {2},
                TotalAmountWon      = ROUND(TotalAmountWon + {3}, 2),
                TotalAmountLost     = ROUND(TotalAmountLost + {4}, 2),
                MaxWinAmount        = MAX(MaxWinAmount, {3}),
                MaxWinPercent       = MAX(MaxWinPercent, {5}),
                MaxLossAmount       = MAX(MaxLossAmount, {4}),
                CurrentWinStreak    = CASE WHEN {1} = 1 THEN CurrentWinStreak + 1 ELSE 0 END,
                CurrentLossStreak   = CASE WHEN {2} = 1 THEN CurrentLossStreak + 1 ELSE 0 END,
                MaxWinStreak        = MAX(MaxWinStreak,  CASE WHEN {1} = 1 THEN CurrentWinStreak + 1 ELSE 0 END),
                MaxLossStreak       = MAX(MaxLossStreak, CASE WHEN {2} = 1 THEN CurrentLossStreak + 1 ELSE 0 END),
                TotalAllIns              = TotalAllIns + {6},
                CurrentConsecutiveAllIns = CASE WHEN {6} = 1 THEN CurrentConsecutiveAllIns + 1 ELSE 0 END,
                MaxConsecutiveAllIns     = MAX(MaxConsecutiveAllIns, CASE WHEN {6} = 1 THEN CurrentConsecutiveAllIns + 1 ELSE 0 END),
                HighestBalance      = MAX(HighestBalance, {7}),
                BlackjackHandsPlayed = BlackjackHandsPlayed + CASE WHEN {8} = 'blackjack' THEN 1 ELSE 0 END,
                BaccaratGamesPlayed  = BaccaratGamesPlayed  + CASE WHEN {8} = 'baccarat'  THEN 1 ELSE 0 END,
                RouletteGamesPlayed  = RouletteGamesPlayed  + CASE WHEN {8} = 'roulette'  THEN 1 ELSE 0 END,
                SlotsGamesPlayed     = SlotsGamesPlayed     + CASE WHEN {8} = 'slots'     THEN 1 ELSE 0 END,
                MinesGamesPlayed     = MinesGamesPlayed     + CASE WHEN {8} = 'mines'     THEN 1 ELSE 0 END,
                PlinkoGamesPlayed    = PlinkoGamesPlayed    + CASE WHEN {8} = 'plinko'    THEN 1 ELSE 0 END,
                CrashGamesPlayed     = CrashGamesPlayed     + CASE WHEN {8} = 'crash'     THEN 1 ELSE 0 END,
                HiloGamesPlayed      = HiloGamesPlayed      + CASE WHEN {8} = 'hilo'      THEN 1 ELSE 0 END,
                BlackjackWins = BlackjackWins + CASE WHEN {8} = 'blackjack' AND {1} = 1 THEN 1 ELSE 0 END,
                BaccaratWins  = BaccaratWins  + CASE WHEN {8} = 'baccarat'  AND {1} = 1 THEN 1 ELSE 0 END,
                RouletteWins  = RouletteWins  + CASE WHEN {8} = 'roulette'  AND {1} = 1 THEN 1 ELSE 0 END,
                SlotsWins     = SlotsWins     + CASE WHEN {8} = 'slots'     AND {1} = 1 THEN 1 ELSE 0 END,
                MinesWins     = MinesWins     + CASE WHEN {8} = 'mines'     AND {1} = 1 THEN 1 ELSE 0 END,
                PlinkoWins    = PlinkoWins    + CASE WHEN {8} = 'plinko'    AND {1} = 1 THEN 1 ELSE 0 END,
                CrashWins     = CrashWins     + CASE WHEN {8} = 'crash'     AND {1} = 1 THEN 1 ELSE 0 END,
                HiloWins      = HiloWins      + CASE WHEN {8} = 'hilo'      AND {1} = 1 THEN 1 ELSE 0 END,
                BlackjackBlackjacks = BlackjackBlackjacks + {9},
                BlackjackSplits     = BlackjackSplits     + {10},
                CrashMaxMultiplier  = MAX(CrashMaxMultiplier, {11}),
                HiloMaxStreak       = MAX(HiloMaxStreak, {12})
            WHERE Username = {0}
            """,
            username, won, lost, dto.AmountWon, dto.AmountLost,
            pct, allIn, dto.CurrentBalance, dto.Game,
            bj, split, cm, hs);

        return Ok(new { success = true });
    }
}

public class GameResultDto
{
    public string Game { get; set; } = string.Empty;
    public bool Won { get; set; }
    public double AmountWon { get; set; }
    public double AmountLost { get; set; }
    public double AmountBet { get; set; }
    public bool WasAllIn { get; set; }
    public double CurrentBalance { get; set; }
    public bool WasBlackjack { get; set; }
    public bool WasSplit { get; set; }
    public double? CrashMultiplier { get; set; }
    public int? HiloStreak { get; set; }
}
