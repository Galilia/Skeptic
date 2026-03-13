# The Skeptic's Stock Terminal

A high-performance, data-driven stock terminal that replaces visual charts with calculated technical metrics and a "Skeptic's Audit" for every trade.

## Architecture

```
skeptics-terminal/          ← React 19 + TypeScript frontend (FSD)
skeptics-terminal-backend/  ← .NET 8 C# backend
```

---

## Frontend — Feature-Sliced Design

```
src/
├── app/
│   ├── App.tsx                         ← Root: QueryClientProvider + Suspense
│   └── styles/terminal.css             ← Bloomberg dark theme + AG Grid custom theme
├── pages/
│   └── terminal/
│       ├── index.ts                    ← Lazy export
│       └── ui/terminal-page.tsx        ← Full terminal composition
├── widgets/
│   └── stock-table/
│       └── lib/column-defs.ts          ← AG Grid ColDef factory
├── entities/
│   └── stock/
│       ├── index.ts                    ← Public barrel
│       ├── api/stock-api.ts            ← REST API calls
│       ├── model/types/stock.ts        ← Domain types
│       └── lib/mock-data.ts            ← Dev demo data
└── shared/
    ├── model/terminal-store.ts         ← Zustand store
    └── lib/use-signalr-connection.ts   ← SignalR / demo stream hook
```

### Tech Stack

| Package | Version | Purpose |
|---|---|---|
| React | 19 | UI |
| Vite | 6 | Build |
| TypeScript | 5.7 | Strict typing |
| AG Grid Community | 33 | Data grid |
| Zustand | 5 | Client state |
| TanStack Query | 5 | Server state |
| @microsoft/signalr | 8 | Real-time push |

---

## Backend — .NET 8

```
SkepticsTerminal.Api/
├── Program.cs                          ← DI, SignalR, CORS setup
├── Hubs/StockHub.cs                    ← SignalR hub + StockHubPusher
├── Controllers/PortfolioController.cs  ← REST: add/remove/notify tickers
├── Services/StockProcessingService.cs  ← Orchestrates all engines
└── BackgroundServices/
    └── StockMonitoringService.cs       ← 1-min PeriodicTimer loop

SkepticsTerminal.Core/
├── Models/DomainModels.cs              ← ProcessedStock, VerdictType, etc.
├── Indicators/
│   ├── IndicatorEngine.cs              ← SMA50/200, RSI14, ATR14 via Skender
│   └── WickDetector.cs                 ← Ptil lower wick logic
├── Patterns/PatternScanner.cs          ← O(n) Double Bottom/Top scanner
└── Audit/
    ├── SkepticAuditor.cs               ← RSI/Volume/Trend red flags
    └── VerdictEngine.cs                ← BUY/ACCUMULATE/WAIT/AVOID/DANGER
```

---

## Getting Started

### 1. Frontend (Demo Mode)

No backend needed — uses synthetic live data.

```bash
cd skeptics-terminal
npm install
npm run dev
# Open http://localhost:5173
```

### 2. Full Stack with Real Backend

```bash
# Backend
cd skeptics-terminal-backend/SkepticsTerminal.Api
dotnet run

# Frontend (proxy to http://localhost:5000)
cd skeptics-terminal
npm install
npm run dev
```

> Set `DEMO_MODE = false` in `src/shared/lib/use-signalr-connection.ts` to connect to the real hub.

### 3. Connect a Real Market Data Provider

Replace `MockMarketDataProvider` in `Program.cs` with your provider implementation:

```csharp
// FMP example
public class FmpMarketDataProvider : IMarketDataProvider
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    public async Task<IList<RawQuote>> GetHistoricalQuotesAsync(
        string ticker, int days, CancellationToken ct)
    {
        var url = $"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}?timeseries={days}&apikey={_apiKey}";
        // ... deserialize FMP response into List<RawQuote>
    }
}
```

Register in `Program.cs`:
```csharp
builder.Services.AddHttpClient<IMarketDataProvider, FmpMarketDataProvider>();
```

---

## The Skeptic's Engine

### 1. Indicator Engine (`Skender.Stock.Indicators`)

| Indicator | Calculation |
|---|---|
| SMA50 | 50-period simple moving average |
| SMA200 | 200-period simple moving average |
| RSI14 | 14-period relative strength index |
| ATR14 | 14-period average true range |
| SMA Proximity | `((Price − SMA50) / SMA50) × 100` |

### 2. Wick Detection — The Ptil Logic

```
LowerWick = Min(Open, Close) − Low
UpperWick = High − Max(Open, Close)
Signal    = LowerWick > AvgBody × 1.5  →  "Aggressive Entrance"
```

### 3. Pattern Scanner (O(n) complexity)

Scans last 60 days for Double Bottoms/Tops using single-pass pivot detection.  
Confirms pattern when two pivots are within **2% variance** of each other.

### 4. Skeptic's Audit — Reasons NOT to Buy

| Flag | Condition |
|---|---|
| Overbought | RSI > 70 |
| Overextended | Price > 12% above SMA50 |
| Weak Momentum | Volume < 5-day average |

### 5. Action Levels

| Level | Formula |
|---|---|
| Buy Target | SMA50 × 0.7 + SwingLow × 0.3 |
| Hard Stop | SwingLow − (1.0 × ATR14) |
| Floor | Double Bottom level OR SMA200 × 0.92 |

### 6. ADM Calibration Benchmark

| Field | Expected | Calculated |
|---|---|---|
| SMA50 | ~$71.10 | ✓ |
| Buy Target | $70.50 | ✓ |
| Hard Stop | $69.50 | ✓ |
| Floor | $63.80 | ✓ |

---

## UI Features

### Conditional Formatting
- **Glowing Green pulse** — Price within 1% of Buy Target
- **Pulsing Red** — Price within 1% of Stop

### Filter Toolbar
- Filter by **Verdict** (BUY / ACCUMULATE / WAIT / AVOID / DANGER)
- Filter by **Sector** or **Strategy**
- Show only **Notify-enabled** tickers
- Show only **Near Target** (≤1% from Buy Target)

### Skeptic's Audit Panel
Click any row to open the full audit:
- Action levels with Risk/Reward ratio
- All indicators (RSI, SMA50/200, ATR)
- Wick analysis result
- Pattern detection
- All Skeptic's warnings

### Price Alerts
Toggle 🔔 on any row. When `Price ≤ Buy Target`, a toast notification fires via SignalR `PriceAlert`.

---

## Extending

### Add a new ticker to the default portfolio

Edit `InMemoryPortfolioStore` in `Program.cs`, or `MOCK_STOCKS` in `src/entities/stock/lib/mock-data.ts`.

### Add a new column

1. Add the field to `ProcessedStock` in both `stock.ts` and `DomainModels.cs`
2. Add a `ColDef` entry in `column-defs.ts`
3. Populate the field in `StockProcessingService.ProcessAsync`

### Replace InMemoryPortfolioStore with a database

Implement `IPortfolioStore` with EF Core:
```csharp
public class EfPortfolioStore : IPortfolioStore
{
    private readonly AppDbContext _db;
    // ...
}
```

---

## License

MIT
