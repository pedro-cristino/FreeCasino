using API.Controllers;
using API.Data;
using API.Tests.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace API.Tests.Controllers;

public class UserControllerTests
{
    // ── GetBalance ───────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBalance_AuthenticatedUser_ReturnsBalance()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 2500 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetBalance();

        var ok = Assert.IsType<OkObjectResult>(result);
        var balance = (double)ok.Value!.GetType().GetProperty("balance")!.GetValue(ok.Value)!;
        Assert.Equal(2500, balance);
    }

    [Fact]
    public async Task GetBalance_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetBalance();

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task GetBalance_NoToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, null);

        var result = await controller.GetBalance();

        Assert.IsType<UnauthorizedResult>(result);
    }

    // ── UpdateBalance ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateBalance_ValidAmount_SetsBalance()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1000 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.UpdateBalance(new UpdateBalanceRequest { Balance = 3500 });

        var ok = Assert.IsType<OkObjectResult>(result);
        var balance = (double)ok.Value!.GetType().GetProperty("balance")!.GetValue(ok.Value)!;
        Assert.Equal(3500, balance);

        var user = await db.Users.FindAsync("alice");
        Assert.Equal(3500, user!.Balance);
    }

    [Fact]
    public async Task UpdateBalance_NegativeAmount_ReturnsBadRequest()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1000 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.UpdateBalance(new UpdateBalanceRequest { Balance = -100 });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UpdateBalance_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.UpdateBalance(new UpdateBalanceRequest { Balance = 500 });

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task UpdateBalance_ZeroBalance_IsAllowed()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 1000 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.UpdateBalance(new UpdateBalanceRequest { Balance = 0 });

        Assert.IsType<OkObjectResult>(result);
    }

    // ── GetLevel ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetLevel_NewUser_ReturnsLevel1()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Xp = 0, Level = 1 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetLevel();

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var level = (int)val.GetType().GetProperty("level")!.GetValue(val)!;
        var levelName = (string)val.GetType().GetProperty("levelName")!.GetValue(val)!;
        Assert.Equal(1, level);
        Assert.Equal("Touriste", levelName);
    }

    [Fact]
    public async Task GetLevel_UserWithHighXp_ReturnsCorrectLevel()
    {
        using var db = TestDbContextFactory.Create();
        // 700 XP puts user at level 5 (Amateur)
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Xp = 700, Level = 5 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.GetLevel();

        var ok = Assert.IsType<OkObjectResult>(result);
        var val = ok.Value!;
        var level = (int)val.GetType().GetProperty("level")!.GetValue(val)!;
        var levelName = (string)val.GetType().GetProperty("levelName")!.GetValue(val)!;
        Assert.Equal(5, level);
        Assert.Equal("Amateur", levelName);
    }

    [Fact]
    public async Task GetLevel_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.GetLevel();

        Assert.IsType<UnauthorizedResult>(result);
    }

    // ── Restart ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Restart_AuthenticatedUser_ResetsBalanceTo1000()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User { Username = "alice", PasswordHash = "x", Balance = 50 });
        await db.SaveChangesAsync();

        var token = ControllerTestHelper.RegisterToken("alice");
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, token);

        var result = await controller.Restart();

        var ok = Assert.IsType<OkObjectResult>(result);
        var balance = (int)ok.Value!.GetType().GetProperty("balance")!.GetValue(ok.Value)!;
        Assert.Equal(1000, balance);

        var user = await db.Users.FindAsync("alice");
        Assert.Equal(1000, user!.Balance);
    }

    [Fact]
    public async Task Restart_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new UserController(db);
        ControllerTestHelper.SetAuthToken(controller, "fake-token");

        var result = await controller.Restart();

        Assert.IsType<UnauthorizedResult>(result);
    }
}
