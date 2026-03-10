using Microsoft.EntityFrameworkCore;

namespace API.Data;

public class CasinoDbContext(DbContextOptions<CasinoDbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<HighScore> HighScores { get; set; }
    public DbSet<UserStats> UserStats { get; set; }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>().HasKey(u => u.Username);
        mb.Entity<UserStats>().HasKey(s => s.Username);
    }
}

public class User
{
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public double Balance { get; set; } = 1000;
}

public class UserStats
{
    public string Username { get; set; } = string.Empty;

    // Global
    public int TotalGamesPlayed { get; set; }
    public int TotalWins { get; set; }
    public int TotalLosses { get; set; }
    public double TotalAmountWon { get; set; }
    public double TotalAmountLost { get; set; }
    public double MaxWinAmount { get; set; }
    public double MaxWinPercent { get; set; }
    public double MaxLossAmount { get; set; }
    public int MaxWinStreak { get; set; }
    public int MaxLossStreak { get; set; }
    public int CurrentWinStreak { get; set; }
    public int CurrentLossStreak { get; set; }
    public int MaxConsecutiveAllIns { get; set; }
    public int CurrentConsecutiveAllIns { get; set; }
    public int TotalAllIns { get; set; }
    public double HighestBalance { get; set; }

    // Per-game plays
    public int BlackjackHandsPlayed { get; set; }
    public int BaccaratGamesPlayed { get; set; }
    public int RouletteGamesPlayed { get; set; }
    public int SlotsGamesPlayed { get; set; }
    public int MinesGamesPlayed { get; set; }
    public int PlinkoGamesPlayed { get; set; }
    public int CrashGamesPlayed { get; set; }
    public int HiloGamesPlayed { get; set; }

    // Per-game wins
    public int BlackjackWins { get; set; }
    public int BaccaratWins { get; set; }
    public int RouletteWins { get; set; }
    public int SlotsWins { get; set; }
    public int MinesWins { get; set; }
    public int PlinkoWins { get; set; }
    public int CrashWins { get; set; }
    public int HiloWins { get; set; }

    // Game-specific extras
    public int BlackjackBlackjacks { get; set; }
    public int BlackjackSplits { get; set; }
    public double CrashMaxMultiplier { get; set; }
    public int HiloMaxStreak { get; set; }
}

public class HighScore
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public double Score { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
