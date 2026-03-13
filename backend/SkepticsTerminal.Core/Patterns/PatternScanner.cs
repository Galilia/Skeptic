using Skender.Stock.Indicators;
using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Core.Patterns;

/// <summary>
/// Scans the last 60 trading days for Double Bottom and Double Top patterns.
/// A pattern is confirmed when two pivot lows/highs are within 2% of each other.
/// Algorithm complexity: O(n) with a single-pass pivot detection.
/// </summary>
public static class PatternScanner
{
    private const int ScanDays = 60;
    private const double VarianceThreshold = 0.02; // 2%
    private const int MinPeriodsBetweenPivots = 5;

    /// <summary>
    /// Scans recent price history for Double Bottom and Double Top formations.
    /// </summary>
    /// <param name="quotes">Full OHLCV history. Only last 60 days are examined.</param>
    public static PatternDetection Scan(IList<Quote> quotes)
    {
        var window = quotes.TakeLast(ScanDays).ToList();
        if (window.Count < MinPeriodsBetweenPivots * 2 + 1)
            return new PatternDetection(false, false, null, null);

        // Detect pivot lows (local minima)
        var pivotLows = FindPivots(window, isPivotLow: true);
        // Detect pivot highs (local maxima)
        var pivotHighs = FindPivots(window, isPivotLow: false);

        // Check for Double Bottom
        var doubleBottom = FindMatchingPair(pivotLows, isPivotLow: true);
        if (doubleBottom.HasValue)
        {
            return new PatternDetection(
                HasDoubleBottom: true,
                HasDoubleTop: false,
                PatternLevel: Math.Round(doubleBottom.Value, 2),
                PatternDescription: $"Double Bottom at {doubleBottom.Value:F2} — confirmed buyers zone"
            );
        }

        // Check for Double Top
        var doubleTop = FindMatchingPair(pivotHighs, isPivotLow: false);
        if (doubleTop.HasValue)
        {
            return new PatternDetection(
                HasDoubleBottom: false,
                HasDoubleTop: true,
                PatternLevel: Math.Round(doubleTop.Value, 2),
                PatternDescription: $"Double Top at {doubleTop.Value:F2} — distribution pattern"
            );
        }

        return new PatternDetection(false, false, null, null);
    }

    /// <summary>
    /// Single-pass O(n) pivot detection using a 3-bar comparison window.
    /// </summary>
    private static List<(int Index, decimal Price)> FindPivots(
        IList<Quote> window,
        bool isPivotLow)
    {
        var pivots = new List<(int, decimal)>();
        for (int i = 1; i < window.Count - 1; i++)
        {
            var prev = window[i - 1];
            var curr = window[i];
            var next = window[i + 1];

            if (isPivotLow)
            {
                if (curr.Low < prev.Low && curr.Low < next.Low)
                    pivots.Add((i, curr.Low));
            }
            else
            {
                if (curr.High > prev.High && curr.High > next.High)
                    pivots.Add((i, curr.High));
            }
        }
        return pivots;
    }

    /// <summary>
    /// Finds two pivots at similar price levels (within variance threshold)
    /// separated by at least MinPeriodsBetweenPivots candles.
    /// Returns the average level if found; null otherwise.
    /// </summary>
    private static decimal? FindMatchingPair(
        List<(int Index, decimal Price)> pivots,
        bool isPivotLow)
    {
        for (int i = 0; i < pivots.Count - 1; i++)
        {
            for (int j = i + 1; j < pivots.Count; j++)
            {
                var (idxA, priceA) = pivots[i];
                var (idxB, priceB) = pivots[j];

                if (idxB - idxA < MinPeriodsBetweenPivots)
                    continue;

                var avg = (priceA + priceB) / 2m;
                if (avg == 0m) continue;

                var variance = (double)Math.Abs(priceA - priceB) / (double)avg;
                if (variance < VarianceThreshold)
                    return avg;
            }
        }
        return null;
    }
}
