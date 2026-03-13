using Skender.Stock.Indicators;
using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Core.Indicators;

/// <summary>
/// Encapsulates all technical indicator calculations for the Skeptic's Engine.
/// Uses the Skender.Stock.Indicators library for SMA, RSI, and ATR.
/// </summary>
public static class IndicatorEngine
{
    /// <summary>
    /// Computes all indicators for a time series of quotes.
    /// The last element represents today's computed state.
    /// </summary>
    /// <param name="quotes">Ordered list of OHLCV data (oldest first).</param>
    /// <returns>Computed indicators for the most recent period.</returns>
    public static StockIndicators Compute(IList<Quote> quotes)
    {
        if (quotes.Count < 50)
            throw new ArgumentException("Minimum 50 periods required for SMA50 computation.", nameof(quotes));

        var smaResults50 = quotes.GetSma(50).ToList();
        var smaResults200 = quotes.Count >= 200
            ? quotes.GetSma(200).ToList()
            : null;
        var rsiResults = quotes.GetRsi(14).ToList();
        var atrResults = quotes.GetAtr(14).ToList();

        var lastSma50 = (decimal)(smaResults50.Last(r => r.Sma.HasValue).Sma!.Value);
        var lastSma200 = smaResults200 != null
            ? (decimal)(smaResults200.Last(r => r.Sma.HasValue).Sma!.Value)
            : lastSma50; // fallback if insufficient history
        var lastRsi = (decimal)(rsiResults.Last(r => r.Rsi.HasValue).Rsi!.Value);
        var lastAtr = (decimal)(atrResults.Last(r => r.Atr.HasValue).Atr!.Value);

        var currentPrice = quotes.Last().Close;
        var smaProximityPct = lastSma50 != 0
            ? ((currentPrice - lastSma50) / lastSma50) * 100m
            : 0m;

        return new StockIndicators(
            Sma50: Math.Round(lastSma50, 2),
            Sma200: Math.Round(lastSma200, 2),
            Rsi14: Math.Round(lastRsi, 1),
            Atr14: Math.Round(lastAtr, 2),
            SmaProximityPct: Math.Round(smaProximityPct, 2)
        );
    }
}
