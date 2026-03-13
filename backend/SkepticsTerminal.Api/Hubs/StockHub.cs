using Microsoft.AspNetCore.SignalR;
using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Api.Hubs;

/// <summary>
/// SignalR hub that pushes real-time stock updates to connected browser clients.
/// Clients receive the full <see cref="ProcessedStock"/> object every minute.
/// </summary>
public class StockHub : Hub
{
    private static readonly HashSet<string> ConnectedClients = [];
    private readonly ILogger<StockHub> _logger;

    public StockHub(ILogger<StockHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        ConnectedClients.Add(Context.ConnectionId);
        _logger.LogInformation("Client connected: {ConnectionId}. Total: {Count}",
            Context.ConnectionId, ConnectedClients.Count);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        ConnectedClients.Remove(Context.ConnectionId);
        _logger.LogInformation("Client disconnected: {ConnectionId}. Total: {Count}",
            Context.ConnectionId, ConnectedClients.Count);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Client-callable method to subscribe to alerts for a specific ticker.
    /// Server then calls PriceAlert on that client when conditions are met.
    /// </summary>
    public Task SubscribeToTicker(string ticker)
    {
        _logger.LogDebug("Client {ConnectionId} subscribed to {Ticker}",
            Context.ConnectionId, ticker);
        return Groups.AddToGroupAsync(Context.ConnectionId, ticker.ToUpperInvariant());
    }

    public Task UnsubscribeFromTicker(string ticker)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, ticker.ToUpperInvariant());
}

/// <summary>
/// Extension for pushing stock updates from background services.
/// Typed wrapper around IHubContext for cleaner service-to-hub communication.
/// </summary>
public class StockHubPusher
{
    private readonly IHubContext<StockHub> _hubContext;

    public StockHubPusher(IHubContext<StockHub> hubContext)
    {
        _hubContext = hubContext;
    }

    /// <summary>Pushes a single stock update to all connected clients.</summary>
    public Task PushStockUpdateAsync(ProcessedStock stock, CancellationToken ct = default)
        => _hubContext.Clients.All.SendAsync("StockUpdate", stock, ct);

    /// <summary>Pushes a full batch of stocks (used for initial load + periodic refresh).</summary>
    public Task PushBatchUpdateAsync(IReadOnlyList<ProcessedStock> stocks, CancellationToken ct = default)
        => _hubContext.Clients.All.SendAsync("BatchStockUpdate", stocks, ct);

    /// <summary>Sends a price alert to clients subscribed to the specific ticker group.</summary>
    public Task PushPriceAlertAsync(string ticker, decimal price, decimal target, CancellationToken ct = default)
        => _hubContext.Clients.Group(ticker).SendAsync("PriceAlert", ticker, price, target, ct);
}
