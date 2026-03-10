using System.Collections.Concurrent;

namespace API;

public static class UserStore
{
    private static readonly ConcurrentDictionary<string, string> _tokens = new(); // token → username

    public static void RegisterToken(string token, string username) =>
        _tokens[token] = username;

    public static void RemoveToken(string token) => _tokens.TryRemove(token, out _);

    public static string? GetUsername(string token) =>
        _tokens.TryGetValue(token, out var u) ? u : null;
}
