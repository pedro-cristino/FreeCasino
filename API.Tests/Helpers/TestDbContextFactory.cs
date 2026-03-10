using API.Data;
using Microsoft.EntityFrameworkCore;

namespace API.Tests.Helpers;

public static class TestDbContextFactory
{
    /// <summary>
    /// Creates a fresh in-memory CasinoDbContext with a unique database name
    /// (to avoid state leakage between tests) and seeds the 20 level thresholds.
    /// </summary>
    public static CasinoDbContext Create(string? dbName = null)
    {
        var options = new DbContextOptionsBuilder<CasinoDbContext>()
            .UseInMemoryDatabase(dbName ?? Guid.NewGuid().ToString())
            .Options;

        var db = new CasinoDbContext(options);
        db.Database.EnsureCreated();
        SeedLevelThresholds(db);
        return db;
    }

    private static void SeedLevelThresholds(CasinoDbContext db)
    {
        if (db.LevelThresholds.Any()) return;

        db.LevelThresholds.AddRange(
            new LevelThreshold { Level = 1,  RequiredXp = 0,      Name = "Touriste"      },
            new LevelThreshold { Level = 2,  RequiredXp = 50,     Name = "Novice"        },
            new LevelThreshold { Level = 3,  RequiredXp = 150,    Name = "Habitué"       },
            new LevelThreshold { Level = 4,  RequiredXp = 350,    Name = "Joueur"        },
            new LevelThreshold { Level = 5,  RequiredXp = 700,    Name = "Amateur"       },
            new LevelThreshold { Level = 6,  RequiredXp = 1200,   Name = "Régulier"      },
            new LevelThreshold { Level = 7,  RequiredXp = 2000,   Name = "Vétéran"       },
            new LevelThreshold { Level = 8,  RequiredXp = 3200,   Name = "Expert"        },
            new LevelThreshold { Level = 9,  RequiredXp = 5000,   Name = "Maître"        },
            new LevelThreshold { Level = 10, RequiredXp = 7500,   Name = "Grand Maître"  },
            new LevelThreshold { Level = 11, RequiredXp = 11000,  Name = "Élite"         },
            new LevelThreshold { Level = 12, RequiredXp = 16000,  Name = "Champion"      },
            new LevelThreshold { Level = 13, RequiredXp = 23000,  Name = "Légende"       },
            new LevelThreshold { Level = 14, RequiredXp = 32000,  Name = "Mythique"      },
            new LevelThreshold { Level = 15, RequiredXp = 45000,  Name = "Icône"         },
            new LevelThreshold { Level = 16, RequiredXp = 62000,  Name = "Prodige"       },
            new LevelThreshold { Level = 17, RequiredXp = 85000,  Name = "Intouchable"   },
            new LevelThreshold { Level = 18, RequiredXp = 115000, Name = "Transcendant"  },
            new LevelThreshold { Level = 19, RequiredXp = 155000, Name = "Omniscient"    },
            new LevelThreshold { Level = 20, RequiredXp = 200000, Name = "Casino Royale" }
        );
        db.SaveChanges();
    }
}
