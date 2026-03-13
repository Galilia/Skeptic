namespace SkepticsTerminal.Core.Models;

/// <summary>Verdict classification for a stock's current posture.</summary>
public enum VerdictType { BUY, ACCUMULATE, WAIT, AVOID, DANGER }

/// <summary>Raw OHLCV quote used as input to the indicator engine.</summary>
public record StockQuote(
    string Ticker,
    string Name,
    string Sector,
    string Strategy,
    decimal Price,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    long Volume,
    long AvgVolume5d,
    decimal Change,
    decimal ChangePercent
);

/// <summary>Computed technical indicators.</summary>
public record StockIndicators(
    decimal Sma50,
    decimal Sma200,
    decimal Rsi14,
    decimal Atr14,
    /// <summary>% Distance: ((Price - SMA50) / SMA50) * 100</summary>
    decimal SmaProximityPct
);

/// <summary>
/// Ptil (wick) logic results.
/// Lower wick = Min(Open, Close) - Low
/// Upper wick = High - Max(Open, Close)
/// Signal fires when LowerWick > AverageBody * 1.5 near support.
/// </summary>
public record WickAnalysis(
    decimal LowerWick,
    decimal UpperWick,
    bool HasAggressiveBuySignal
);

/// <summary>Reasons NOT to buy — the Skeptic's counter-argument.</summary>
public record SkepticsAudit(
    bool IsOverbought,        // RSI > 70
    bool IsOverextended,      // Price > 12% above SMA50
    bool IsWeakMomentum,      // Volume < 5-day average
    IReadOnlyList<string> Warnings
);

/// <summary>60-day pattern detection result (variance &lt; 2%).</summary>
public record PatternDetection(
    bool HasDoubleBottom,
    bool HasDoubleTop,
    decimal? PatternLevel,
    string? PatternDescription
);

/// <summary>
/// The fully enriched stock object pushed via SignalR every minute.
/// This is the single source of truth for each AG-Grid row.
/// </summary>
public record ProcessedStock(
    string Ticker,
    string Name,
    string Sector,
    string Strategy,
    decimal Price,
    decimal Change,
    decimal ChangePercent,

    /// <summary>Action Zone — where Ptil and SMA50 intersect.</summary>
    decimal BuyTarget,

    /// <summary>Hard Stop = Swing Low − (1.0 × ATR14).</summary>
    decimal Stop,

    /// <summary>Structural floor = Double Bottom base.</summary>
    decimal Floor,

    /// <summary>One-sentence RSI + Volume + Trend verdict.</summary>
    string Verdict,
    VerdictType VerdictType,

    bool NotifyEnabled,
    StockIndicators Indicators,
    WickAnalysis Wick,
    SkepticsAudit Audit,
    PatternDetection Pattern,
    DateTimeOffset LastUpdated
);
