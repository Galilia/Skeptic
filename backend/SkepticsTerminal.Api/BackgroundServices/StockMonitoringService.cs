using SkepticsTerminal.Api.Hubs;
using SkepticsTerminal.Api.Services;

namespace SkepticsTerminal.Api.BackgroundServices;

/// <summary>
/// The core Skeptic's Engine background worker.
/// Runs on a 1-minute <see cref="PeriodicTimer"/> to fetch, process,
/// and push updated stock data to all connected SignalR clients.
/// </summary>
public sealed class StockMonitoringService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    private readonly StockProcessingService _processor;
    private readonly StockHubPusher _hubPusher;
    private readonly IPortfolioStore _portfolioStore;
    private readonly ILogger<StockMonitoringService> _logger;

    public StockMonitoringService(
        StockProcessingService processor,
        StockHubPusher hubPusher,
        IPortfolioStore portfolioStore,
        ILogger<StockMonitoringService> logger)
    {
        _processor = processor;
        _hubPusher = hubPusher;
        _portfolioStore = portfolioStore;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StockMonitoringService started. Interval: {Interval}", Interval);

        // Push an initial snapshot immediately on startup
        await RunCycleAsync(stoppingToken);

        using var timer = new PeriodicTimer(Interval);

        // PeriodicTimer is allocation-free and does not drift under load
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RunCycleAsync(stoppingToken);
        }
    }

    /// <summary>
    /// Executes a single monitoring cycle:
    /// 1. Fetch the current portfolio ticker list.
    /// 2. Batch-process all tickers through the Skeptic's Engine.
    /// 3. Push the results via SignalR.
    /// 4. Fire price alerts for tickers with notify=true that crossed their buy target.
    /// </summary>
    private async Task RunCycleAsync(CancellationToken ct)
    {
        try
        {
            var tickers = await _portfolioStore.GetTickersAsync(ct);
            if (tickers.Count == 0) return;

            _logger.LogDebug("Processing {Count} tickers", tickers.Count);

            var stocks = await _processor.ProcessBatchAsync(tickers, maxConcurrency: 5, ct);

            // Push all updates as a single batch (reduces SignalR round-trips)
            await _hubPusher.PushBatchUpdateAsync(stocks, ct);

            // Check price alerts
            foreach (var stock in stocks.Where(s => s.NotifyEnabled && s.Price <= s.BuyTarget))
            {
                _logger.LogInformation(
                    "Price alert triggered: {Ticker} @ {Price} ≤ BuyTarget {BuyTarget}",
                    stock.Ticker, stock.Price, stock.BuyTarget);

                await _hubPusher.PushPriceAlertAsync(
                    stock.Ticker, stock.Price, stock.BuyTarget, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected on shutdown
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in stock monitoring cycle");
        }
    }
}

/// <summary>Contract for persistent storage of the user's ticker portfolio.</summary>
public interface IPortfolioStore
{
    Task<IReadOnlyList<string>> GetTickersAsync(CancellationToken ct);
    Task AddTickerAsync(string ticker, CancellationToken ct);
    Task RemoveTickerAsync(string ticker, CancellationToken ct);
}
