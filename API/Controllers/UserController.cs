using API.Data;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController(CasinoDbContext db) : ControllerBase
{
    private string? ResolveUsername()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Bearer ")) return null;
        return UserStore.GetUsername(auth["Bearer ".Length..]);
    }

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

        var user = await db.Users.FindAsync(username);
        if (user is null) return NotFound();

        user.Balance = request.Balance;
        await db.SaveChangesAsync();

        return Ok(new { balance = user.Balance });
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
