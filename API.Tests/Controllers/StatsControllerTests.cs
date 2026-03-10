using API.Controllers;
using API.Data;
using API.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Controllers;

public class StatsControllerTests
{
    // ── GetStats ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStats_NoStatsYet_ReturnsEmptyStats()
    {
        // GetStats uses EF FindAsync — works with InMemory provider
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetStats();

        var ok = Assert.IsType<OkObjectResult>(result);
        var stats = Assert.IsType<UserStats>(ok.Value);
        Assert.Equal("alice", stats.Username);
        Assert.Equal(0, stats.TotalGamesPlayed);
        Assert.Equal(0, stats.TotalWins);
        Assert.Equal(0, stats.TotalLosses);
    }

    [Fact]
    public async Task GetStats_WithExistingStats_ReturnsCorrectData()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        db.UserStats.Add(new UserStats
        {
            Username         = "alice",
            TotalGamesPlayed = 10,
            TotalWins        = 6,
            TotalLosses      = 4,
            BlackjackWins    = 3,
        });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetStats();

        var ok = Assert.IsType<OkObjectResult>(result);
        var stats = Assert.IsType<UserStats>(ok.Value);
        Assert.Equal(10, stats.TotalGamesPlayed);
        Assert.Equal(6, stats.TotalWins);
        Assert.Equal(4, stats.TotalLosses);
        Assert.Equal(3, stats.BlackjackWins);
    }

    [Fact]
    public async Task GetStats_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new StatsController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetStats();

        Assert.IsType<UnauthorizedResult>(result);
    }

    // ── RecordGame ────────────────────────────────────────────────────────────
    // RecordGame uses raw SQL (INSERT OR IGNORE, UPDATE), which requires a real
    // SQLite database (not the in-memory EF provider).

    [Fact]
    public async Task RecordGame_Win_UpdatesGamesPlayedAndWins()
    {
        using var ctx = new SqliteTestDbContext();
        ctx.Db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1500 });
        await ctx.Db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, token);

        await controller.RecordGame(new GameResultDto
        {
            Game           = "blackjack",
            Won            = true,
            AmountWon      = 500,
            AmountLost     = 0,
            AmountBet      = 500,
            CurrentBalance = 1500,
        });

        var stats = await ctx.Db.UserStats.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Username == "alice");
        Assert.NotNull(stats);
        Assert.Equal(1, stats!.TotalGamesPlayed);
        Assert.Equal(1, stats.TotalWins);
        Assert.Equal(0, stats.TotalLosses);
        Assert.Equal(1, stats.BlackjackWins);
        Assert.Equal(1, stats.BlackjackHandsPlayed);
    }

    [Fact]
    public async Task RecordGame_Loss_UpdatesGamesPlayedAndLosses()
    {
        using var ctx = new SqliteTestDbContext();
        ctx.Db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 500 });
        await ctx.Db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, token);

        await controller.RecordGame(new GameResultDto
        {
            Game           = "roulette",
            Won            = false,
            AmountWon      = 0,
            AmountLost     = 500,
            AmountBet      = 500,
            CurrentBalance = 500,
        });

        var stats = await ctx.Db.UserStats.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Username == "alice");
        Assert.NotNull(stats);
        Assert.Equal(1, stats!.TotalGamesPlayed);
        Assert.Equal(0, stats.TotalWins);
        Assert.Equal(1, stats.TotalLosses);
        Assert.Equal(0, stats.RouletteWins);
        Assert.Equal(1, stats.RouletteGamesPlayed);
    }

    [Fact]
    public async Task RecordGame_AwardsXpToUser()
    {
        using var ctx = new SqliteTestDbContext();
        ctx.Db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1000, Xp = 0, Level = 1 });
        await ctx.Db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.RecordGame(new GameResultDto
        {
            Game           = "slots",
            Won            = true,
            AmountWon      = 200,
            AmountLost     = 0,
            AmountBet      = 200,   // 200 * 0.1 = 20 XP
            CurrentBalance = 1200,
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var xpGained = (double)val.GetType().GetProperty("xpGained")!.GetValue(val)!;
        Assert.Equal(20.0, xpGained);

        var user = await ctx.Db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username == "alice");
        Assert.NotNull(user);
        Assert.Equal(20.0, user!.Xp);
    }

    [Fact]
    public async Task RecordGame_InvalidToken_ReturnsUnauthorized()
    {
        using var ctx = new SqliteTestDbContext();
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.RecordGame(new GameResultDto
        {
            Game = "blackjack", Won = true, AmountBet = 100,
        });

        Assert.IsType<UnauthorizedResult>(result);
    }

    // ── ResetStats ───────────────────────────────────────────────────────────

    [Fact]
    public async Task ResetStats_DeletesUserStatsRow()
    {
        using var ctx = new SqliteTestDbContext();
        ctx.Db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        ctx.Db.UserStats.Add(new UserStats
        {
            Username         = "alice",
            TotalGamesPlayed = 5,
            TotalWins        = 3,
        });
        await ctx.Db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.ResetStats();

        Assert.IsType<OkObjectResult>(result);
        var stats = await ctx.Db.UserStats.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Username == "alice");
        Assert.Null(stats);
    }

    [Fact]
    public async Task ResetStats_InvalidToken_ReturnsUnauthorized()
    {
        using var ctx = new SqliteTestDbContext();
        var controller = new StatsController(ctx.Db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.ResetStats();

        Assert.IsType<UnauthorizedResult>(result);
    }
}
