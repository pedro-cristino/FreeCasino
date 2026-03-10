using API.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace API.Tests.Helpers;

/// <summary>
/// Utility methods for setting up controller instances with a fake HttpContext
/// so that Request.Headers.Authorization is available.
/// </summary>
public static class ControllerTestHelper
{
    /// <summary>
    /// Attaches a fake HttpContext to the given controller with an optional Bearer token
    /// in the Authorization header.
    /// </summary>
    public static void SetAuthToken(ControllerBase controller, string? token)
    {
        var httpContext = new DefaultHttpContext();
        if (token is not null)
            httpContext.Request.Headers.Authorization = $"Bearer {token}";
        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
    }

    /// <summary>
    /// Registers a user in UserStore and returns the token.
    /// </summary>
    public static string RegisterToken(string username)
    {
        var token = Guid.NewGuid().ToString();
        UserStore.RegisterToken(token, username);
        return token;
    }
}
