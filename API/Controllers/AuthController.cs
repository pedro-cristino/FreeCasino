using API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(CasinoDbContext db) : BaseApiController
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { Success = false, Message = "Username and password are required" });

        if (request.Password.Length < 6)
            return BadRequest(new { Success = false, Message = "Password must be at least 6 characters" });

        var existing = await db.Users.FindAsync(request.Username);
        if (existing is not null)
            return Conflict(new { Success = false, Message = "Username already taken" });

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new { Success = true });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await db.Users.FindAsync(request.Username);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new LoginResponse { Success = false, Message = "Invalid username or password" });

        var token = Guid.NewGuid().ToString();
        UserStore.RegisterToken(token, request.Username);

        return Ok(new LoginResponse { Success = true, Token = token, Username = request.Username });
    }

    [HttpPost("logout")]
    public IActionResult Logout([FromHeader(Name = "Authorization")] string? authorization)
    {
        if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer "))
            UserStore.RemoveToken(authorization["Bearer ".Length..]);

        return Ok(new { Success = true });
    }

    [HttpGet("verify")]
    public IActionResult Verify([FromHeader(Name = "Authorization")] string? authorization)
    {
        if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer "))
        {
            var token = authorization["Bearer ".Length..];
            if (UserStore.GetUsername(token) is not null)
                return Ok(new { Success = true, Valid = true });
        }

        return Unauthorized(new { Success = false, Valid = false });
    }
}

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public bool Success { get; set; }
    public string? Token { get; set; }
    public string? Username { get; set; }
    public string? Message { get; set; }
}
