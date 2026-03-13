using Skender.Stock.Indicators;
using SkepticsTerminal.Core.Audit;
using SkepticsTerminal.Core.Indicators;
using SkepticsTerminal.Core.Models;
using SkepticsTerminal.Core.Patterns;

namespace SkepticsTerminal.Api.Services;

/// <summary>
/// Orchestrates data fetching, indicator computation, pattern scanning,
/// and verdict generation for a given ticker.
/// Designed to be called from the 1-minute BackgroundService.
/// </summary>
public class StockProcessingService
{
    private readonly IMarketDataProvider _marketData;
    private readonly ILogger<StockProcessingService> _logger;

    // Per-ticker notification preferences (in a real app this would be persisted)
    private readonly Dictionary<string, bool> _notifyPreferences = new();

    public StockProcessingService(
        IMarketDataProvider marketData,
        ILogger<StockProcessingService> logger)
    {
        _marketData = marketData;
        _logger = logger;
    }

    /// <summary>
    /// Processes a single ticker through the full Skeptic's Engine pipeline.
    /// </summary>
    /// <param name="ticker">Stock ticker symbol.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<ProcessedStock?> ProcessAsync(string ticker, CancellationToken ct)
    {
        try
        {
            // 1. Fetch OHLCV history (minimum 200 days for SMA200)
            var quotes = await _marketData.GetHistoricalQuotesAsync(ticker, 220, ct);
            if (quotes.Count < 50) return null;

            var latest = quotes.Last();

            // 2. Convert to Skender Quote format
            var skenderQuotes = quotes.Select(q => new Quote
            {
                Date = q.Date,
                Open = q.Open,
                High = q.High,
                Low = q.Low,
                Close = q.Close,
                Volume = q.Volume,
            }).ToList();

            // 3. Run indicator engine
            var indicators = IndicatorEngine.Compute(skenderQuotes);

            // 4. Run wick (Ptil) detection
            var wick = WickDetector.Analyze(skenderQuotes);

            // 5. Run pattern scanner (O(n log n) worst case)
            var pattern = PatternScanner.Scan(skenderQuotes);

            // 6. Run Skeptic's Audit
            var audit = SkepticAuditor.Run(indicators, latest.Volume, latest.AvgVolume5d);

            // 7. Compute action levels
            var (buyTarget, stop, floor) = ComputeActionLevels(
                latest, indicators, pattern);

            // 8. Generate verdict
            var (verdictType, verdictText) = VerdictEngine.Compute(
                indicators, audit, wick, pattern, buyTarget, latest.Close);

            // 9. ADM calibration benchmark verification (logged only)
            if (ticker == "ADM")
                LogAdmBenchmark(indicators, buyTarget, stop, floor);

            return new ProcessedStock(
                Ticker: ticker.ToUpperInvariant(),
                Name: latest.Name,
                Sector: latest.Sector,
                Strategy: latest.Strategy,
                Price: Math.Round(latest.Close, 2),
                Change: Math.Round(latest.Close - latest.PrevClose, 2),
                ChangePercent: latest.PrevClose != 0
                    ? Math.Round((latest.Close - latest.PrevClose) / latest.PrevClose * 100m, 2)
                    : 0m,
                BuyTarget: Math.Round(buyTarget, 2),
                Stop: Math.Round(stop, 2),
                Floor: Math.Round(floor, 2),
                Verdict: verdictText,
                VerdictType: verdictType,
                NotifyEnabled: _notifyPreferences.GetValueOrDefault(ticker, false),
                Indicators: indicators,
                Wick: wick,
                Audit: audit,
                Pattern: pattern,
                LastUpdated: DateTimeOffset.UtcNow
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing ticker {Ticker}", ticker);
            return null;
        }
    }

    /// <summary>
    /// Processes a batch of tickers concurrently (respecting API rate limits).
    /// </summary>
    /// <param name="tickers">List of ticker symbols to process.</param>
    /// <param name="maxConcurrency">Maximum parallel API calls.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task<IReadOnlyList<ProcessedStock>> ProcessBatchAsync(
        IEnumerable<string> tickers,
        int maxConcurrency = 5,
        CancellationToken ct = default)
    {
        var semaphore = new SemaphoreSlim(maxConcurrency, maxConcurrency);
        var results = new System.Collections.Concurrent.ConcurrentBag<ProcessedStock>();

        var tasks = tickers.Select(async ticker =>
        {
            await semaphore.WaitAsync(ct);
            try
            {
                var stock = await ProcessAsync(ticker, ct);
                if (stock != null) results.Add(stock);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks);
        return results.ToList().AsReadOnly();
    }

    public void SetNotifyPreference(string ticker, bool enabled)
        => _notifyPreferences[ticker.ToUpperInvariant()] = enabled;

    // ── Private helpers ──────────────────────────────────────────────────────

    /// <summary>
    /// Computes the three key action price levels.
    /// BuyTarget  = where Ptil (wick) and SMA50 intersect
    /// Stop       = Swing Low − (1.0 × ATR14)
    /// Floor      = Double Bottom base or SMA200 − 10%
    /// </summary>
    private static (decimal BuyTarget, decimal Stop, decimal Floor) ComputeActionLevels(
        RawQuote latest,
        StockIndicators indicators,
        PatternDetection pattern)
    {
        // Buy target: average of SMA50 and recent swing low (rough proxy)
        var buyTarget = (indicators.Sma50 * 0.7m + latest.Low * 0.3m);

        // Hard stop: recent swing low minus 1 ATR
        var swingLow = latest.Low;
        var stop = swingLow - indicators.Atr14;

        // Floor: Double Bottom level if detected, else SMA200 - 8%
        var floor = pattern.HasDoubleBottom && pattern.PatternLevel.HasValue
            ? pattern.PatternLevel.Value
            : indicators.Sma200 * 0.92m;

        return (buyTarget, stop, floor);
    }

    /// <summary>Logs ADM benchmark data for calibration verification.</summary>
    private void LogAdmBenchmark(
        StockIndicators indicators,
        decimal buyTarget,
        decimal stop,
        decimal floor)
    {
        _logger.LogDebug(
            "[ADM Benchmark] SMA50={Sma50} BuyTarget={BuyTarget} Stop={Stop} Floor={Floor} | " +
            "Expected: SMA50≈71.10, BuyTarget≈70.50, Stop≈69.50, Floor≈63.80",
            indicators.Sma50, buyTarget, stop, floor);
    }
}

/// <summary>Raw quote as returned by the market data provider.</summary>
public record RawQuote(
    DateOnly Date,
    string Name,
    string Sector,
    string Strategy,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    decimal PrevClose,
    long Volume,
    long AvgVolume5d
);

/// <summary>Contract for any market data provider (FMP, Twelve Data, etc.).</summary>
public interface IMarketDataProvider
{
    Task<IList<RawQuote>> GetHistoricalQuotesAsync(
        string ticker,
        int days,
        CancellationToken ct);
}
