using API.Data;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(CasinoDbContext db) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (request.Username == "user" && request.Password == "password")
        {
            // Upsert user in DB (creates with balance 1000 if first login)
            var user = await db.Users.FindAsync(request.Username);
            if (user is null)
            {
                db.Users.Add(new User { Username = request.Username });
                await db.SaveChangesAsync();
            }

            var token = Guid.NewGuid().ToString();
            UserStore.RegisterToken(token, request.Username);

            return Ok(new LoginResponse { Success = true, Token = token, Username = request.Username });
        }

        return Unauthorized(new LoginResponse { Success = false, Message = "Invalid username or password" });
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
