using API.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<CasinoDbContext>(options =>
    options.UseSqlite("Data Source=casino.db"));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        else
            policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// Create DB and tables on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CasinoDbContext>();
    db.Database.EnsureCreated();
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS HighScores (
            Id INTEGER PRIMARY KEY AUTOINCREMENT,
            Username TEXT NOT NULL,
            Score REAL NOT NULL,
            GameType TEXT NOT NULL DEFAULT 'multiple',
            SavedAt TEXT NOT NULL
        )
    """);
    try { db.Database.ExecuteSqlRaw("ALTER TABLE HighScores ADD COLUMN GameType TEXT NOT NULL DEFAULT 'multiple'"); }
    catch { /* Column already exists */ }
    // Add PasswordHash column to existing Users table if missing
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN PasswordHash TEXT NOT NULL DEFAULT ''"); }
    catch { /* Column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Xp REAL NOT NULL DEFAULT 0"); }
    catch { /* Column already exists */ }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Level INTEGER NOT NULL DEFAULT 1"); }
    catch { /* Column already exists */ }

    // Create LevelThresholds table and seed if empty
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS LevelThresholds (
            Level      INTEGER PRIMARY KEY,
            RequiredXp REAL    NOT NULL,
            Name       TEXT    NOT NULL
        )
    """);
    db.Database.ExecuteSqlRaw("""
        INSERT OR IGNORE INTO LevelThresholds (Level, RequiredXp, Name) VALUES
            (1,  0,       'Touriste'),
            (2,  50,      'Novice'),
            (3,  150,     'Habitué'),
            (4,  350,     'Joueur'),
            (5,  700,     'Amateur'),
            (6,  1200,    'Régulier'),
            (7,  2000,    'Vétéran'),
            (8,  3200,    'Expert'),
            (9,  5000,    'Maître'),
            (10, 7500,    'Grand Maître'),
            (11, 11000,   'Élite'),
            (12, 16000,   'Champion'),
            (13, 23000,   'Légende'),
            (14, 32000,   'Mythique'),
            (15, 45000,   'Icône'),
            (16, 62000,   'Prodige'),
            (17, 85000,   'Intouchable'),
            (18, 115000,  'Transcendant'),
            (19, 155000,  'Omniscient'),
            (20, 200000,  'Casino Royale')
    """);

    // Create UserAchievements table if missing
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS UserAchievements (
            Username       TEXT NOT NULL,
            AchievementKey TEXT NOT NULL,
            UnlockedAt     TEXT NOT NULL,
            PRIMARY KEY (Username, AchievementKey)
        )
    """);

    // Create UserStats table if missing
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS UserStats (
            Username TEXT PRIMARY KEY,
            TotalGamesPlayed INTEGER NOT NULL DEFAULT 0,
            TotalWins INTEGER NOT NULL DEFAULT 0,
            TotalLosses INTEGER NOT NULL DEFAULT 0,
            TotalAmountWon REAL NOT NULL DEFAULT 0,
            TotalAmountLost REAL NOT NULL DEFAULT 0,
            MaxWinAmount REAL NOT NULL DEFAULT 0,
            MaxWinPercent REAL NOT NULL DEFAULT 0,
            MaxLossAmount REAL NOT NULL DEFAULT 0,
            MaxWinStreak INTEGER NOT NULL DEFAULT 0,
            MaxLossStreak INTEGER NOT NULL DEFAULT 0,
            CurrentWinStreak INTEGER NOT NULL DEFAULT 0,
            CurrentLossStreak INTEGER NOT NULL DEFAULT 0,
            MaxConsecutiveAllIns INTEGER NOT NULL DEFAULT 0,
            CurrentConsecutiveAllIns INTEGER NOT NULL DEFAULT 0,
            TotalAllIns INTEGER NOT NULL DEFAULT 0,
            HighestBalance REAL NOT NULL DEFAULT 0,
            BlackjackHandsPlayed INTEGER NOT NULL DEFAULT 0,
            BaccaratGamesPlayed INTEGER NOT NULL DEFAULT 0,
            RouletteGamesPlayed INTEGER NOT NULL DEFAULT 0,
            SlotsGamesPlayed INTEGER NOT NULL DEFAULT 0,
            MinesGamesPlayed INTEGER NOT NULL DEFAULT 0,
            PlinkoGamesPlayed INTEGER NOT NULL DEFAULT 0,
            CrashGamesPlayed INTEGER NOT NULL DEFAULT 0,
            HiloGamesPlayed INTEGER NOT NULL DEFAULT 0,
            BlackjackWins INTEGER NOT NULL DEFAULT 0,
            BaccaratWins INTEGER NOT NULL DEFAULT 0,
            RouletteWins INTEGER NOT NULL DEFAULT 0,
            SlotsWins INTEGER NOT NULL DEFAULT 0,
            MinesWins INTEGER NOT NULL DEFAULT 0,
            PlinkoWins INTEGER NOT NULL DEFAULT 0,
            CrashWins INTEGER NOT NULL DEFAULT 0,
            HiloWins INTEGER NOT NULL DEFAULT 0,
            BlackjackBlackjacks INTEGER NOT NULL DEFAULT 0,
            BlackjackSplits INTEGER NOT NULL DEFAULT 0,
            CrashMaxMultiplier REAL NOT NULL DEFAULT 0,
            HiloMaxStreak INTEGER NOT NULL DEFAULT 0
        )
    """);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAngular");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
