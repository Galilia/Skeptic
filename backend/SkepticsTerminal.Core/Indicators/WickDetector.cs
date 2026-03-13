using Skender.Stock.Indicators;
using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Core.Indicators;

/// <summary>
/// Implements the "Ptil" (wick) detection logic.
/// An aggressive buy signal fires when the lower wick exceeds
/// 1.5× the average candle body, suggesting strong buying pressure at support.
/// </summary>
public static class WickDetector
{
    private const int LookbackPeriods = 20;

    /// <summary>
    /// Analyzes the most recent candle's wick structure.
    /// </summary>
    /// <param name="quotes">OHLCV history (oldest first). Uses last N candles.</param>
    /// <returns>Wick analysis for the most recent candle.</returns>
    public static WickAnalysis Analyze(IList<Quote> quotes)
    {
        if (quotes.Count < 2)
            return new WickAnalysis(0m, 0m, false);

        var current = quotes.Last();
        var window = quotes.TakeLast(LookbackPeriods).ToList();

        // Lower wick = distance from candle body bottom to the low
        var bodyBottom = Math.Min(current.Open, current.Close);
        var bodyTop = Math.Max(current.Open, current.Close);

        var lowerWick = bodyBottom - current.Low;
        var upperWick = current.High - bodyTop;

        // Average body size over lookback window (O(n) single pass)
        var avgBody = window
            .Select(q => (decimal)Math.Abs((double)(q.Close - q.Open)))
            .DefaultIfEmpty(0m)
            .Average();

        // Aggressive signal: lower wick is at least 1.5× the average body
        var hasAggressiveSignal = avgBody > 0m && lowerWick > avgBody * 1.5m;

        return new WickAnalysis(
            LowerWick: Math.Round(lowerWick, 2),
            UpperWick: Math.Round(upperWick, 2),
            HasAggressiveBuySignal: hasAggressiveSignal
        );
    }
}
