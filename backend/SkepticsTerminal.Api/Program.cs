using SkepticsTerminal.Api.BackgroundServices;
using SkepticsTerminal.Api.Hubs;
using SkepticsTerminal.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────────────────

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// SignalR with JSON serialization using camelCase for React compatibility
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Core services
builder.Services.AddScoped<StockProcessingService>();
builder.Services.AddSingleton<StockHubPusher>();

// Background worker (1-minute PeriodicTimer)
builder.Services.AddHostedService<StockMonitoringService>();

// Portfolio store — replace InMemoryPortfolioStore with a DB-backed implementation
// in production (EF Core + SQLite or PostgreSQL)
builder.Services.AddSingleton<IPortfolioStore, InMemoryPortfolioStore>();

// Market data — swap out for FmpMarketDataProvider or TwelveDataProvider
builder.Services.AddSingleton<IMarketDataProvider, MockMarketDataProvider>();

// CORS for local dev (Vite dev server)
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials()); // Required for SignalR
});

// ── App pipeline ──────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseCors("DevCors");
app.UseStaticFiles();
app.MapControllers();
app.MapHub<StockHub>("/stockHub");

// Serve React SPA from wwwroot in production
app.MapFallbackToFile("index.html");

app.Run();

// ── In-memory implementations (replace in production) ────────────────────────

/// <summary>Thread-safe in-memory portfolio store. Replace with DB in production.</summary>
public class InMemoryPortfolioStore : IPortfolioStore
{
    private readonly List<string> _tickers =
    [
        "ADM", "NVDA", "GE", "GOOGL", "INTC",
        "MSFT", "JPM", "XOM", "TSLA", "META"
    ];
    private readonly SemaphoreSlim _lock = new(1, 1);

    public async Task<IReadOnlyList<string>> GetTickersAsync(CancellationToken ct)
    {
        await _lock.WaitAsync(ct);
        try { return _tickers.AsReadOnly(); }
        finally { _lock.Release(); }
    }

    public async Task AddTickerAsync(string ticker, CancellationToken ct)
    {
        await _lock.WaitAsync(ct);
        try { if (!_tickers.Contains(ticker)) _tickers.Add(ticker); }
        finally { _lock.Release(); }
    }

    public async Task RemoveTickerAsync(string ticker, CancellationToken ct)
    {
        await _lock.WaitAsync(ct);
        try { _tickers.Remove(ticker); }
        finally { _lock.Release(); }
    }
}

/// <summary>
/// Mock market data provider — generates synthetic OHLCV history.
/// Replace with FmpMarketDataProvider or TwelveDataProvider for production.
/// </summary>
public class MockMarketDataProvider : IMarketDataProvider
{
    private static readonly Dictionary<string, (string Name, string Sector, string Strategy, decimal BasePrice)> Metadata = new()
    {
        ["ADM"]   = ("Archer-Daniels-Midland", "Consumer Staples",       "Value",    71.80m),
        ["NVDA"]  = ("NVIDIA Corporation",      "Technology",             "Momentum", 183.04m),
        ["GE"]    = ("GE Aerospace",            "Industrials",            "Growth",   304.72m),
        ["GOOGL"] = ("Alphabet Inc.",           "Technology",             "Growth",   303.73m),
        ["INTC"]  = ("Intel Corporation",       "Technology",             "Value",    45.52m),
        ["MSFT"]  = ("Microsoft Corporation",   "Technology",             "Growth",   415.30m),
        ["JPM"]   = ("JPMorgan Chase",          "Financials",             "Dividend", 218.45m),
        ["XOM"]   = ("Exxon Mobil",             "Energy",                 "Dividend", 108.20m),
        ["TSLA"]  = ("Tesla Inc.",              "Consumer Discretionary", "Momentum", 242.80m),
        ["META"]  = ("Meta Platforms",          "Technology",             "Growth",   558.90m),
    };

    public Task<IList<RawQuote>> GetHistoricalQuotesAsync(
        string ticker, int days, CancellationToken ct)
    {
        var meta = Metadata.GetValueOrDefault(ticker,
            ($"{ticker} Inc.", "Unknown", "Unknown", 100m));

        var quotes = GenerateSyntheticHistory(meta.BasePrice, meta.Name, meta.Sector, meta.Strategy, days);
        return Task.FromResult<IList<RawQuote>>(quotes);
    }

    private static List<RawQuote> GenerateSyntheticHistory(
        decimal basePrice, string name, string sector, string strategy, int days)
    {
        var rng = new Random(basePrice.GetHashCode());
        var quotes = new List<RawQuote>(days);
        var price = basePrice * 0.88m; // Start 12% below current for trending up

        for (int i = days - 1; i >= 0; i--)
        {
            var date = DateOnly.FromDateTime(DateTime.Today.AddDays(-i));
            var dailyReturn = (decimal)(rng.NextDouble() * 0.04 - 0.018); // ±2% daily
            var open = price;
            var close = price * (1 + dailyReturn);
            var high = Math.Max(open, close) * (1 + (decimal)(rng.NextDouble() * 0.01));
            var low = Math.Min(open, close) * (1 - (decimal)(rng.NextDouble() * 0.01));
            var volume = (long)(rng.Next(8_000_000, 25_000_000));

            quotes.Add(new RawQuote(
                Date: date,
                Name: name,
                Sector: sector,
                Strategy: strategy,
                Open: Math.Round(open, 2),
                High: Math.Round(high, 2),
                Low: Math.Round(low, 2),
                Close: Math.Round(close, 2),
                PrevClose: Math.Round(open, 2),
                Volume: volume,
                AvgVolume5d: volume
            ));

            price = close;
        }
        return quotes;
    }
}
