using API.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Helpers;

/// <summary>
/// Creates a SQLite in-memory CasinoDbContext that supports raw SQL execution
/// (unlike the EF InMemory provider which does not support ExecuteSqlRawAsync).
/// The caller must dispose this wrapper to close the underlying connection.
/// </summary>
public sealed class SqliteTestDbContext : IDisposable
{
    private readonly SqliteConnection _connection;
    public CasinoDbContext Db { get; }

    public SqliteTestDbContext()
    {
        // Keep the connection open so the in-memory database persists for the lifetime of the test
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<CasinoDbContext>()
            .UseSqlite(_connection)
            .Options;

        Db = new CasinoDbContext(options);
        // EnsureCreated creates all tables defined in the EF model:
        // Users, HighScores, UserStats, UserAchievements, LevelThresholds
        Db.Database.EnsureCreated();

        SeedLevelThresholds();
    }

    private void SeedLevelThresholds()
    {
        if (Db.LevelThresholds.Any()) return;

        Db.LevelThresholds.AddRange(
            new LevelThreshold { Level = 1,  RequiredXp = 0,      Name = "Touriste"     },
            new LevelThreshold { Level = 2,  RequiredXp = 50,     Name = "Novice"       },
            new LevelThreshold { Level = 3,  RequiredXp = 150,    Name = "Habitue"      },
            new LevelThreshold { Level = 4,  RequiredXp = 350,    Name = "Joueur"       },
            new LevelThreshold { Level = 5,  RequiredXp = 700,    Name = "Amateur"      },
            new LevelThreshold { Level = 6,  RequiredXp = 1200,   Name = "Regulier"     },
            new LevelThreshold { Level = 7,  RequiredXp = 2000,   Name = "Veteran"      },
            new LevelThreshold { Level = 8,  RequiredXp = 3200,   Name = "Expert"       },
            new LevelThreshold { Level = 9,  RequiredXp = 5000,   Name = "Maitre"       },
            new LevelThreshold { Level = 10, RequiredXp = 7500,   Name = "Grand Maitre" },
            new LevelThreshold { Level = 11, RequiredXp = 11000,  Name = "Elite"        },
            new LevelThreshold { Level = 12, RequiredXp = 16000,  Name = "Champion"     },
            new LevelThreshold { Level = 13, RequiredXp = 23000,  Name = "Legende"      },
            new LevelThreshold { Level = 14, RequiredXp = 32000,  Name = "Mythique"     },
            new LevelThreshold { Level = 15, RequiredXp = 45000,  Name = "Icone"        },
            new LevelThreshold { Level = 16, RequiredXp = 62000,  Name = "Prodige"      },
            new LevelThreshold { Level = 17, RequiredXp = 85000,  Name = "Intouchable"  },
            new LevelThreshold { Level = 18, RequiredXp = 115000, Name = "Transcendant" },
            new LevelThreshold { Level = 19, RequiredXp = 155000, Name = "Omniscient"   },
            new LevelThreshold { Level = 20, RequiredXp = 200000, Name = "Casino Royale"}
        );
        Db.SaveChanges();
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}
