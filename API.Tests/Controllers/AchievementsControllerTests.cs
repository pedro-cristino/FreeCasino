using API.Achievements;
using API.Controllers;
using API.Data;
using API.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;
using System.Collections;

namespace API.Tests.Controllers;

public class AchievementsControllerTests
{
    // ── GetAchievements ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetAchievements_NewUser_ReturnsAllAchievementsLocked()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetAchievements();

        var ok = Assert.IsType<OkObjectResult>(result);
        var achievements = ((IEnumerable)ok.Value!).Cast<dynamic>().ToList();

        // AchievementRegistry has 8 games × 4 tiers = 32 achievements
        Assert.Equal(32, achievements.Count);
        Assert.All(achievements, a => Assert.False((bool)a.Unlocked));
        Assert.All(achievements, a => Assert.Null((string?)a.UnlockedAt));
    }

    [Fact]
    public async Task GetAchievements_UnlockedAchievement_ShowsUnlocked()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        db.UserAchievements.Add(new UserAchievement
        {
            Username       = "alice",
            AchievementKey = "debutant_blackjack",
            UnlockedAt     = "2024-01-01T00:00:00Z",
        });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetAchievements();

        var ok = Assert.IsType<OkObjectResult>(result);
        var achievements = ((IEnumerable)ok.Value!).Cast<dynamic>().ToList();

        var unlocked = achievements.Where(a => (bool)a.Unlocked).ToList();
        Assert.Single(unlocked);
        Assert.Equal("debutant_blackjack", (string)unlocked[0].Key);
        Assert.Equal("2024-01-01T00:00:00Z", (string)unlocked[0].UnlockedAt);
    }

    [Fact]
    public async Task GetAchievements_ContainsExpectedFields()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetAchievements();

        var ok = Assert.IsType<OkObjectResult>(result);
        var first = ((IEnumerable)ok.Value!).Cast<dynamic>().First();
        // Verify all expected fields exist (access them — will throw if property missing)
        _ = (string)first.Key;
        _ = (string)first.Game;
        _ = (string)first.Tier;
        _ = (string)first.Name;
        _ = (string)first.Description;
        _ = (int)first.WinsRequired;
        _ = (double)first.BoostPercent;
        _ = (bool)first.Unlocked;
    }

    [Fact]
    public async Task GetAchievements_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetAchievements();

        Assert.IsType<UnauthorizedResult>(result);
    }

    // ── GetBoosts ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBoosts_NoAchievements_ReturnsEmptyDictionary()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetBoosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var boosts = Assert.IsType<Dictionary<string, double>>(ok.Value);
        Assert.Empty(boosts);
    }

    [Fact]
    public async Task GetBoosts_OneAchievementUnlocked_ReturnsCorrectBoost()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        db.UserAchievements.Add(new UserAchievement
        {
            Username       = "alice",
            AchievementKey = "debutant_blackjack",   // 10 wins, 5% boost
            UnlockedAt     = "2024-01-01T00:00:00Z",
        });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetBoosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var boosts = Assert.IsType<Dictionary<string, double>>(ok.Value);
        Assert.Single(boosts);
        Assert.True(boosts.ContainsKey("blackjack"));
        Assert.Equal(5.0, boosts["blackjack"]);
    }

    [Fact]
    public async Task GetBoosts_MultipleAchievementsSameGame_AccumulatesBoost()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        // debutant = 5%, intermediaire = 5% → total 10% for blackjack
        db.UserAchievements.AddRange(
            new UserAchievement
            {
                Username       = "alice",
                AchievementKey = "debutant_blackjack",
                UnlockedAt     = "2024-01-01T00:00:00Z",
            },
            new UserAchievement
            {
                Username       = "alice",
                AchievementKey = "intermediaire_blackjack",
                UnlockedAt     = "2024-01-02T00:00:00Z",
            }
        );
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetBoosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var boosts = Assert.IsType<Dictionary<string, double>>(ok.Value);
        Assert.True(boosts.ContainsKey("blackjack"));
        Assert.Equal(10.0, boosts["blackjack"]);
    }

    [Fact]
    public async Task GetBoosts_AchievementsAcrossGames_ReturnsBoostPerGame()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x" });
        db.UserAchievements.AddRange(
            new UserAchievement
            {
                Username       = "alice",
                AchievementKey = "debutant_blackjack",
                UnlockedAt     = "2024-01-01T00:00:00Z",
            },
            new UserAchievement
            {
                Username       = "alice",
                AchievementKey = "debutant_slots",
                UnlockedAt     = "2024-01-02T00:00:00Z",
            }
        );
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetBoosts();

        var ok = Assert.IsType<OkObjectResult>(result);
        var boosts = Assert.IsType<Dictionary<string, double>>(ok.Value);
        Assert.Equal(2, boosts.Count);
        Assert.Equal(5.0, boosts["blackjack"]);
        Assert.Equal(5.0, boosts["slots"]);
    }

    [Fact]
    public async Task GetBoosts_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AchievementsController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetBoosts();

        Assert.IsType<UnauthorizedResult>(result);
    }
}
