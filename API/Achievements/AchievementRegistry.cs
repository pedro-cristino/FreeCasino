namespace API.Achievements;

public record AchievementDef(
    string Key,
    string Game,
    string Tier,
    string Name,
    string Description,
    int WinsRequired,
    double BoostPercent);

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

    private static readonly (string tier, string tierLabel, int wins, double boost)[] Tiers =
    [
        ("debutant",      "Débutant",      10,   5.0),
        ("intermediaire", "Intermédiaire", 25,   5.0),
        ("confirme",      "Confirmé",      100,  5.0),
        ("degen",         "Degen",         1000, 10.0),
    ];

    public static readonly IReadOnlyList<AchievementDef> All =
    (
        from g in Games
        from t in Tiers
        select new AchievementDef(
            Key:          $"{t.tier}_{g.game}",
            Game:         g.game,
            Tier:         t.tier,
            Name:         $"{t.tierLabel} {g.label}",
            Description:  $"Gagne {t.wins} fois à {g.label}",
            WinsRequired: t.wins,
            BoostPercent: t.boost
        )
    ).ToList();

    public static readonly IReadOnlyDictionary<string, AchievementDef> ByKey =
        All.ToDictionary(a => a.Key);
}
