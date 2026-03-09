using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HelloWorldController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var random = Random.Shared.Next(2);
        var result = random == 0 ? "pile" : "face";
        return Ok(result);
    }
}
