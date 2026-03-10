using API.Controllers;
using API.Data;
using API.Tests.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace API.Tests.Controllers;

public class AuthControllerTests
{
    // ── Register ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_NewUser_ReturnsOk()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = await controller.Register(new RegisterRequest
        {
            Username = "alice",
            Password = "secret123",
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.True((bool)ok.Value!.GetType().GetProperty("Success")!.GetValue(ok.Value)!);
        Assert.NotNull(await db.Users.FindAsync("alice"));
    }

    [Fact]
    public async Task Register_DuplicateUsername_ReturnsConflict()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            Username     = "alice",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret123"),
        });
        await db.SaveChangesAsync();

        var controller = new AuthController(db);
        var result = await controller.Register(new RegisterRequest
        {
            Username = "alice",
            Password = "secret123",
        });

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Register_PasswordTooShort_ReturnsBadRequest()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = await controller.Register(new RegisterRequest
        {
            Username = "bob",
            Password = "abc",
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Register_EmptyUsername_ReturnsBadRequest()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = await controller.Register(new RegisterRequest
        {
            Username = "",
            Password = "secret123",
        });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    // ── Login ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_ReturnsToken()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            Username     = "alice",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret123"),
        });
        await db.SaveChangesAsync();

        var controller = new AuthController(db);
        var result = await controller.Login(new LoginRequest
        {
            Username = "alice",
            Password = "secret123",
        });

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<LoginResponse>(ok.Value);
        Assert.True(response.Success);
        Assert.NotNull(response.Token);
        Assert.Equal("alice", response.Username);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        db.Users.Add(new User
        {
            Username     = "alice",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("secret123"),
        });
        await db.SaveChangesAsync();

        var controller = new AuthController(db);
        var result = await controller.Login(new LoginRequest
        {
            Username = "alice",
            Password = "wrongpassword",
        });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = await controller.Login(new LoginRequest
        {
            Username = "nobody",
            Password = "secret123",
        });

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    // ── Logout ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Logout_ValidToken_RemovesTokenAndReturnsOk()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        // Register a token
        var token = Guid.NewGuid().ToString();
        UserStore.RegisterToken(token, "alice");

        var result = controller.Logout($"Bearer {token}");

        // Token should now be gone
        Assert.Null(UserStore.GetUsername(token));
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void Logout_InvalidToken_StillReturnsOk()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        // Pass a token that was never registered
        var result = controller.Logout("Bearer nonexistent-token-xyz");

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void Logout_NullHeader_StillReturnsOk()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = controller.Logout(null);

        Assert.IsType<OkObjectResult>(result);
    }

    // ── Verify ───────────────────────────────────────────────────────────────

    [Fact]
    public void Verify_ValidToken_ReturnsOk()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var token = Guid.NewGuid().ToString();
        UserStore.RegisterToken(token, "alice");

        var result = controller.Verify($"Bearer {token}");

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void Verify_InvalidToken_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = controller.Verify("Bearer totally-fake-token");

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public void Verify_MissingHeader_ReturnsUnauthorized()
    {
        using var db = TestDbContextFactory.Create();
        var controller = new AuthController(db);

        var result = controller.Verify(null);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }
}
