using API.Controllers;
using API.Data;
using API.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace API.Tests.Controllers;

public class HighScoreControllerTests
{
    // ── GetLeaderboard ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetLeaderboard_NoScores_ReturnsEmptyList()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, null);

        var result = await controller.GetLeaderboard(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var list = Assert.IsAssignableFrom<System.Collections.IEnumerable>(ok.Value);
        Assert.Empty(list.Cast<object>());
    }

    [Fact]
    public async Task GetLeaderboard_MultipleScores_ReturnsSortedByScoreDesc()
    {
        using var db = TestDbContextFactory.Create();
        db.HighScores.AddRange(
            new HighScore { Username = "alice", Score = 1500, GameType = "blackjack" },
            new HighScore { Username = "bob",   Score = 5000, GameType = "roulette"  },
            new HighScore { Username = "carol", Score = 3000, GameType = "slots"     }
        );
        await db.SaveChangesAsync();

        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, null);

        var result = await controller.GetLeaderboard(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var scores = ((System.Collections.IEnumerable)ok.Value!).Cast<dynamic>().ToList();
        Assert.Equal(3, scores.Count);
        Assert.Equal(5000.0, (double)scores[0].Score);
        Assert.Equal(3000.0, (double)scores[1].Score);
        Assert.Equal(1500.0, (double)scores[2].Score);
    }

    [Fact]
    public async Task GetLeaderboard_FilterByGame_ReturnsOnlyMatchingScores()
    {
        using var db = TestDbContextFactory.Create();
        db.HighScores.AddRange(
            new HighScore { Username = "alice", Score = 2000, GameType = "blackjack" },
            new HighScore { Username = "bob",   Score = 4000, GameType = "roulette"  },
            new HighScore { Username = "carol", Score = 3000, GameType = "blackjack" }
        );
        await db.SaveChangesAsync();

        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, null);

        var result = await controller.GetLeaderboard("blackjack");

        var ok = Assert.IsType<OkObjectResult>(result);
        var scores = ((System.Collections.IEnumerable)ok.Value!).Cast<dynamic>().ToList();
        Assert.Equal(2, scores.Count);
        Assert.All(scores, s => Assert.Equal("blackjack", (string)s.GameType));
    }

    [Fact]
    public async Task GetLeaderboard_LimitsToTop20()
    {
        using var db = TestDbContextFactory.Create();
        for (int i = 1; i <= 25; i++)
            db.HighScores.Add(new HighScore { Username = $"user{i}", Score = i * 100, GameType = "slots" });
        await db.SaveChangesAsync();

        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, null);

        var result = await controller.GetLeaderboard(null);

        var ok = Assert.IsType<OkObjectResult>(result);
        var scores = ((System.Collections.IEnumerable)ok.Value!).Cast<dynamic>().ToList();
        Assert.Equal(20, scores.Count);
    }

    // ── GetMyBest ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMyBest_NoScores_ReturnsZeroScore()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetMyBest();

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var score = (int)val.GetType().GetProperty("score")!.GetValue(val)!;
        Assert.Equal(0, score);
    }

    [Fact]
    public async Task GetMyBest_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetMyBest();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetMyBest_WithScores_ReturnsHighestScoreAndRank()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        db.Users.Add(new User { Username = "bob",   PasswordHash = "x" });
        db.HighScores.AddRange(
            new HighScore { Username = "alice", Score = 3000, GameType = "blackjack" },
            new HighScore { Username = "alice", Score = 1500, GameType = "blackjack" },
            new HighScore { Username = "bob",   Score = 5000, GameType = "blackjack" }
        );
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetMyBest();

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var score = (double)val.GetType().GetProperty("score")!.GetValue(val)!;
        var rank  = (int)val.GetType().GetProperty("rank")!.GetValue(val)!;
        Assert.Equal(3000, score);
        Assert.Equal(2, rank); // bob has a better score, so alice is rank 2
    }

    // ── SaveScore ────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveScore_BalanceAbove1000_SavesAndResetsBalance()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 5000 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.SaveScore(new SaveScoreRequest("blackjack"));

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var score   = (double)val.GetType().GetProperty("score")!.GetValue(val)!;
        var balance = (int)val.GetType().GetProperty("balance")!.GetValue(val)!;
        Assert.Equal(5000, score);
        Assert.Equal(1000, balance);

        var user = await db.Users.FindAsync("alice");
        Assert.Equal(1000, user!.Balance);

        var savedScore = db.HighScores.FirstOrDefault(s => s.Username == "alice");
        Assert.NotNull(savedScore);
        Assert.Equal(5000, savedScore!.Score);
        Assert.Equal("blackjack", savedScore.GameType);
    }

    [Fact]
    public async Task SaveScore_BalanceAt1000_ReturnsBadRequest()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1000 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.SaveScore(null);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SaveScore_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new HighScoreController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.SaveScore(null);

        Assert.IsType<UnauthorizedResult>(result);
    }
}
