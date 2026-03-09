using Microsoft.EntityFrameworkCore;

namespace API.Data;

public class CasinoDbContext(DbContextOptions<CasinoDbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<HighScore> HighScores { get; set; }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>().HasKey(u => u.Username);
    }
}

public class User
{
    public string Username { get; set; } = string.Empty;
    public double Balance { get; set; } = 1000;
}

public class HighScore
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public double Score { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
