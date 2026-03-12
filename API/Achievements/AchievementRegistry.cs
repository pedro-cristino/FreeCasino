using API.Data;

namespace API.Achievements;

public record AchievementDef(
    string Key,
    string Game,
    string Tier,
    string Name,
    string Description,
    int WinsRequired,
    double BoostPercent)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public Func<UserStats, double> GetValue { get; init; } = _ => 0;
}

public static class AchievementRegistry
{
    private static readonly (string game, string label)[] Games =
    [
        ("blackjack", "Blackjack"),
        ("baccarat",  "Baccarat"),
        ("roulette",  "Roulette"),
        ("slots",     "Slots"),
        ("mines",     "Mines"),
        ("plinko",    "Plinko"),
        ("crash",     "Crash"),
        ("hilo",      "Hi-Lo"),
    ];

    private static readonly Dictionary<string, Func<UserStats, double>> WinGetters = new()
    {
        ["blackjack"] = s => s.BlackjackWins,
        ["baccarat"]  = s => s.BaccaratWins,
        ["roulette"]  = s => s.RouletteWins,
        ["slots"]     = s => s.SlotsWins,
        ["mines"]     = s => s.MinesWins,
        ["plinko"]    = s => s.PlinkoWins,
        ["crash"]     = s => s.CrashWins,
        ["hilo"]      = s => s.HiloWins,
    };

    private static readonly Dictionary<string, Func<UserStats, double>> LossGetters = new()
    {
        ["blackjack"] = s => s.BlackjackHandsPlayed - s.BlackjackWins,
        ["baccarat"]  = s => s.BaccaratGamesPlayed  - s.BaccaratWins,
        ["roulette"]  = s => s.RouletteGamesPlayed  - s.RouletteWins,
        ["slots"]     = s => s.SlotsGamesPlayed     - s.SlotsWins,
        ["mines"]     = s => s.MinesGamesPlayed     - s.MinesWins,
        ["plinko"]    = s => s.PlinkoGamesPlayed    - s.PlinkoWins,
        ["crash"]     = s => s.CrashGamesPlayed     - s.CrashWins,
        ["hilo"]      = s => s.HiloGamesPlayed      - s.HiloWins,
    };

    private static readonly (string tier, string tierLabel, int count, double boost)[] ProgressionTiers =
    [
        ("debutant",      "Débutant",      10,   5.0),
        ("intermediaire", "Intermédiaire", 25,   5.0),
        ("confirme",      "Confirmé",      100,  5.0),
        ("degen",         "Degen",         1000, 10.0),
    ];

    public static readonly IReadOnlyList<AchievementDef> All;
    public static readonly IReadOnlyDictionary<string, AchievementDef> ByKey;

    static AchievementRegistry()
    {
        var list = new List<AchievementDef>();

        // ── Victoires par jeu (32) ────────────────────────────────────────────
        foreach (var (game, label) in Games)
        foreach (var (tier, tierLabel, wins, boost) in ProgressionTiers)
            list.Add(new AchievementDef(
                Key:          $"{tier}_{game}",
                Game:         game,
                Tier:         tier,
                Name:         $"{tierLabel} {label}",
                Description:  $"Gagne {wins} fois à {label}",
                WinsRequired: wins,
                BoostPercent: boost)
            { GetValue = WinGetters[game] });

        // ── Défaites par jeu (32) ─────────────────────────────────────────────
        foreach (var (game, label) in Games)
        foreach (var (tier, tierLabel, losses, boost) in ProgressionTiers)
            list.Add(new AchievementDef(
                Key:          $"{tier}_pertes_{game}",
                Game:         game,
                Tier:         $"{tier}_pertes",
                Name:         $"Poissard {label} {tierLabel}",
                Description:  $"Perds {losses} fois à {label}",
                WinsRequired: losses,
                BoostPercent: boost)
            { GetValue = LossGetters[game] });

        // ── Séries de victoires (4) ───────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (3,  "bronze",  2.0),
            (5,  "argent",  3.0),
            (10, "or",      5.0),
            (25, "platine", 10.0) })
            list.Add(new AchievementDef(
                Key:          $"serie_victoires_{n}",
                Game:         "global",
                Tier:         tier,
                Name:         $"En feu ! ({n}x)",
                Description:  $"Atteins une série de {n} victoires consécutives",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.MaxWinStreak });

        // ── Séries de défaites (4) ────────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (3,  "bronze",  2.0),
            (5,  "argent",  3.0),
            (10, "or",      5.0),
            (25, "platine", 10.0) })
            list.Add(new AchievementDef(
                Key:          $"serie_defaites_{n}",
                Game:         "global",
                Tier:         tier,
                Name:         $"En PLS ({n}x)",
                Description:  $"Atteins une série de {n} défaites consécutives",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.MaxLossStreak });

        // ── All-in gagnés (4) ─────────────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (1,  "bronze",  3.0),
            (5,  "argent",  5.0),
            (10, "or",      8.0),
            (25, "platine", 15.0) })
            list.Add(new AchievementDef(
                Key:          $"allin_gagnant_{n}",
                Game:         "global",
                Tier:         tier,
                Name:         $"Tout ou rien ({n})",
                Description:  $"Gagne {n} all-in{(n > 1 ? "s" : "")}",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.AllInWins });

        // ── Blackjacks naturels (3) ───────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (1,  "bronze",  3.0),
            (5,  "argent",  5.0),
            (25, "platine", 10.0) })
            list.Add(new AchievementDef(
                Key:          $"bj_natural_{n}",
                Game:         "blackjack",
                Tier:         tier,
                Name:         $"Natural ! ({n})",
                Description:  $"Fais {n} blackjack{(n > 1 ? "s" : "")} naturel{(n > 1 ? "s" : "")}",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.BlackjackBlackjacks });

        // ── Doubles (2) ───────────────────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (5,  "bronze", 3.0),
            (25, "argent", 5.0) })
            list.Add(new AchievementDef(
                Key:          $"bj_double_{n}",
                Game:         "blackjack",
                Tier:         tier,
                Name:         $"Double Down ({n})",
                Description:  $"Double down {n} fois",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.BlackjackDoubles });

        // ── Splits (2) ────────────────────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (5,  "bronze", 3.0),
            (25, "argent", 5.0) })
            list.Add(new AchievementDef(
                Key:          $"bj_split_{n}",
                Game:         "blackjack",
                Tier:         tier,
                Name:         $"Split ({n})",
                Description:  $"Joue {n} mains splittées",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.BlackjackSplits });

        // ── Mines multiplicateurs (3) ─────────────────────────────────────────
        foreach (var (x, tier, boost) in new (int, string, double)[] {
            (3,  "bronze", 5.0),
            (5,  "argent", 10.0),
            (10, "or",     20.0) })
            list.Add(new AchievementDef(
                Key:          $"mines_x{x}",
                Game:         "mines",
                Tier:         tier,
                Name:         $"Démineur ×{x}",
                Description:  $"Encaisse avec un multiplicateur ≥ ×{x} aux Mines",
                WinsRequired: x,
                BoostPercent: boost)
            { GetValue = s => s.MinesMaxMultiplier });

        // ── Crash multiplicateurs (3) ─────────────────────────────────────────
        foreach (var (x, tier, boost) in new (int, string, double)[] {
            (5,  "bronze", 5.0),
            (10, "argent", 10.0),
            (50, "or",     20.0) })
            list.Add(new AchievementDef(
                Key:          $"crash_x{x}",
                Game:         "crash",
                Tier:         tier,
                Name:         $"Moon ×{x}",
                Description:  $"Encaisse à ×{x} ou plus au Crash",
                WinsRequired: x,
                BoostPercent: boost)
            { GetValue = s => s.CrashMaxMultiplier });

        // ── Hi-Lo séries (3) ──────────────────────────────────────────────────
        foreach (var (n, tier, boost) in new (int, string, double)[] {
            (5,  "bronze", 5.0),
            (10, "argent", 10.0),
            (20, "or",     20.0) })
            list.Add(new AchievementDef(
                Key:          $"hilo_streak_{n}",
                Game:         "hilo",
                Tier:         tier,
                Name:         $"Oracle ×{n}",
                Description:  $"Atteins une série de {n} au Hi-Lo",
                WinsRequired: n,
                BoostPercent: boost)
            { GetValue = s => s.HiloMaxStreak });

        // ── Plus grosse perte en un coup — global (6) ────────────────────────
        foreach (var (amount, tier, boost) in new (int, string, double)[] {
            (5_000,     "bronze",  5.0),
            (10_000,    "argent",  8.0),
            (20_000,    "or",     12.0),
            (50_000,    "platine", 20.0),
            (100_000,   "degen",  35.0),
            (1_000_000, "legende", 75.0) })
            list.Add(new AchievementDef(
                Key:          $"perte_coup_{amount}",
                Game:         "global",
                Tier:         tier,
                Name:         $"Massacre à -{amount / 1000}k",
                Description:  $"Perds {amount:#,0}$ en une seule mise",
                WinsRequired: amount,
                BoostPercent: boost)
            { GetValue = s => s.MaxLossAmount });

        All    = list.AsReadOnly();
        ByKey  = list.ToDictionary(a => a.Key);
    }
}
