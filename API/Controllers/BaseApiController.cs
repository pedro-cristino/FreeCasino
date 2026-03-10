using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
public abstract class BaseApiController : ControllerBase
{
    /// <summary>
    /// Resolves the authenticated username from the Bearer token in the Authorization header.
    /// Returns null if the header is missing, malformed, or the token is not recognized.
    /// </summary>
    protected string? ResolveUsername()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Bearer ")) return null;
        return UserStore.GetUsername(auth["Bearer ".Length..]);
    }
}
