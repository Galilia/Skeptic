using SkepticsTerminal.Core.Models;

namespace SkepticsTerminal.Core.Audit;

/// <summary>
/// The Skeptic's counter-argument engine.
/// Evaluates RSI, volume, and trend extension to surface reasons NOT to buy.
/// </summary>
public static class SkepticAuditor
{
    private const decimal RsiOverboughtThreshold = 70m;
    private const decimal SmaExtensionThreshold = 12m; // % above SMA50
    private const decimal VolumeWeaknessRatio = 1.0m;   // below 1× = weak

    /// <summary>
    /// Runs the Skeptic's Audit for the current state of a stock.
    /// </summary>
    /// <param name="indicators">Computed technical indicators.</param>
    /// <param name="currentVolume">Today's volume.</param>
    /// <param name="avgVolume5d">5-day average volume.</param>
    /// <returns>The audit result with all red flags listed.</returns>
    public static SkepticsAudit Run(
        StockIndicators indicators,
        long currentVolume,
        long avgVolume5d)
    {
        var warnings = new List<string>();

        var isOverbought = indicators.Rsi14 > RsiOverboughtThreshold;
        if (isOverbought)
            warnings.Add($"RSI {indicators.Rsi14:F1} > 70 — Overbought");

        var isOverextended = indicators.SmaProximityPct > SmaExtensionThreshold;
        if (isOverextended)
            warnings.Add($"Price +{indicators.SmaProximityPct:F1}% above SMA50 — Overextended");

        var isWeakMomentum = avgVolume5d > 0 &&
            currentVolume < (long)(avgVolume5d * VolumeWeaknessRatio);
        if (isWeakMomentum)
            warnings.Add("Volume < 5-day avg — Weak Momentum");

        // Below both moving averages = bearish trend context
        if (indicators.SmaProximityPct < -5m)
            warnings.Add($"Price {indicators.SmaProximityPct:F1}% below SMA50 — Bearish trend");

        return new SkepticsAudit(
            IsOverbought: isOverbought,
            IsOverextended: isOverextended,
            IsWeakMomentum: isWeakMomentum,
            Warnings: warnings.AsReadOnly()
        );
    }
}
