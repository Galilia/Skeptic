using Microsoft.AspNetCore.Mvc;
using SkepticsTerminal.Api.BackgroundServices;
using SkepticsTerminal.Api.Services;

namespace SkepticsTerminal.Api.Controllers;

[ApiController]
[Route("api/v1/portfolio")]
public class PortfolioController : ControllerBase
{
    private readonly IPortfolioStore _store;
    private readonly StockProcessingService _processor;

    public PortfolioController(IPortfolioStore store, StockProcessingService processor)
    {
        _store = store;
        _processor = processor;
    }

    /// <summary>Returns all tickers in the current portfolio.</summary>
    [HttpGet("tickers")]
    public async Task<IActionResult> GetTickers(CancellationToken ct)
    {
        var tickers = await _store.GetTickersAsync(ct);
        return Ok(tickers);
    }

    /// <summary>Adds a ticker to the monitored portfolio.</summary>
    [HttpPost("tickers")]
    public async Task<IActionResult> AddTicker([FromBody] AddTickerRequest request, CancellationToken ct)
    {
        var ticker = request.Ticker?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(ticker) || ticker.Length > 5)
            return BadRequest("Invalid ticker symbol.");

        await _store.AddTickerAsync(ticker, ct);
        return Ok(new { ticker });
    }

    /// <summary>Removes a ticker from the monitored portfolio.</summary>
    [HttpDelete("tickers/{ticker}")]
    public async Task<IActionResult> RemoveTicker(string ticker, CancellationToken ct)
    {
        await _store.RemoveTickerAsync(ticker.ToUpperInvariant(), ct);
        return NoContent();
    }

    /// <summary>Toggles price-alert notifications for a ticker.</summary>
    [HttpPatch("tickers/{ticker}/notify")]
    public IActionResult ToggleNotify(string ticker, [FromBody] ToggleNotifyRequest request)
    {
        _processor.SetNotifyPreference(ticker.ToUpperInvariant(), request.Enabled);
        return NoContent();
    }
}

public record AddTickerRequest(string Ticker);
public record ToggleNotifyRequest(bool Enabled);
