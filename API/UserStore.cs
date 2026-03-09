namespace API;

public static class UserStore
{
    private static readonly Dictionary<string, string> _tokens = new();    // token → username
    private static readonly Dictionary<string, int> _balances = new();     // username → balance

    public static void RegisterToken(string token, string username)
    {
        _tokens[token] = username;
        _balances.TryAdd(username, 1000);
    }

    public static void RemoveToken(string token) => _tokens.Remove(token);

    public static string? GetUsername(string token) =>
        _tokens.TryGetValue(token, out var u) ? u : null;

    public static int? GetBalance(string username) =>
        _balances.TryGetValue(username, out var b) ? b : null;

    public static void SetBalance(string username, int balance) =>
        _balances[username] = balance;
}
