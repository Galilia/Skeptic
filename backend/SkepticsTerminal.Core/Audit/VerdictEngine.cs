using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Core.Audit;

/// <summary>
/// Synthesizes all analysis signals into a single human-readable verdict.
/// This is the most important column in the terminal.
/// </summary>
public static class VerdictEngine
{
    /// <summary>
    /// Computes the verdict type and one-sentence explanation from all signals.
    /// </summary>
    /// <param name="indicators">Technical indicators.</param>
    /// <param name="audit">Skeptic's audit result.</param>
    /// <param name="wick">Wick (Ptil) analysis.</param>
    /// <param name="pattern">Pattern detection result.</param>
    /// <param name="buyTarget">Computed buy target price.</param>
    /// <param name="currentPrice">Current market price.</param>
    public static (VerdictType Type, string Text) Compute(
        StockIndicators indicators,
        SkepticsAudit audit,
        WickAnalysis wick,
        PatternDetection pattern,
        decimal buyTarget,
        decimal currentPrice)
    {
        // ── DANGER: Multiple bearish signals
        if (indicators.SmaProximityPct < -7m && audit.IsWeakMomentum)
            return (VerdictType.DANGER, "DANGER: Falling knife. Watch the floor.");

        // ── AVOID: Trend broken or distribution pattern
        if (pattern.HasDoubleTop || (indicators.SmaProximityPct < -4m && !wick.HasAggressiveBuySignal))
            return (VerdictType.AVOID, "AVOID: Trend broken. No buyers detected.");

        // ── WAIT: Overbought or overextended
        if (audit.IsOverbought || audit.IsOverextended)
        {
            var reason = audit.IsOverbought ? "Overbought RSI." : "Overextended above SMA50.";
            return (VerdictType.WAIT, $"WAIT: {reason} High risk.");
        }

        // ── BUY: Near buy target with confirming signals
        var priceDistancePct = Math.Abs((currentPrice - buyTarget) / buyTarget * 100m);
        var nearBuyTarget = priceDistancePct <= 3m;

        if (nearBuyTarget && wick.HasAggressiveBuySignal && !audit.IsWeakMomentum)
            return (VerdictType.BUY, $"BUY: Near SMA 50. Strong buyers at {buyTarget:F2}.");

        // ── ACCUMULATE: Double bottom support or near target without full confirmation
        if (pattern.HasDoubleBottom)
            return (VerdictType.ACCUMULATE, "ACCUMULATE: Solid Double Bottom support.");

        if (nearBuyTarget && Math.Abs(indicators.SmaProximityPct) < 3m)
            return (VerdictType.ACCUMULATE, "ACCUMULATE: Pullback to SMA50. Consider scaling in.");

        // ── Default WAIT
        return (VerdictType.WAIT, "WAIT: No clear signal. Monitor for setup.");
    }
}
