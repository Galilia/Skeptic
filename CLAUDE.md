# Skeptic's Terminal

A full-stack stock trading analysis platform combining real-time technical indicators with skeptical audit/risk signals. No charts — only calculated metrics and a data-dense AG Grid terminal UI.

## Architecture

**Monorepo** with separate frontend and backend:
- `src/` — React 19 + TypeScript + Vite frontend (Feature-Sliced Design)
- `backend-node/` — Node.js + Express + Socket.io backend

## Stack

### Frontend
- React 19, TypeScript 5.7, Vite 6
- AG Grid Community 33 (main data grid)
- Zustand 5 (client state), TanStack Query 5 (server state)
- Socket.io Client 4.8 + @microsoft/signalr (real-time updates)
- Framer Motion 12, custom Bloomberg dark theme CSS

### Backend
- Express 4, Socket.io 4.7, TypeScript 5.5
- yahoo-finance2 3.13 (market data)
- node-cache (24h historical data, 1m quotes)

## Key Directories

```
src/
  app/           # Root component, global styles
  pages/terminal # Main terminal page
  widgets/       # stock-table (AG Grid column defs)
  entities/stock # API calls, domain types, mock data
  features/      # stock-swiper (mobile view)
  shared/        # Zustand store, SignalR hook, utilities

backend-node/src/
  index.ts           # Express server + Socket.io setup
  types.ts           # Shared TypeScript types
  indicators/        # SMA50/200, RSI14, ATR14, pattern detection
  services/          # stock-processor.ts (orchestrator), fmp-provider.ts (Yahoo Finance)
```

## Dev Commands

```bash
# Frontend (root)
npm run dev        # Vite dev server on :5173
npm run build      # Production build to dist/
npm run preview    # Preview built app

# Backend
cd backend-node
npm run dev        # ts-node with --esm, port 5000
npm run build      # tsc output
npm start          # Run compiled JS
```

## Key Features

1. **Technical Indicators** — SMA50/200, RSI14, ATR14, Wick Detection
2. **Pattern Recognition** — Double Bottom/Top (O(n))
3. **Skeptic's Audit** — Red flags: overbought, overextended, weak momentum
4. **Action Levels** — Buy Target, Hard Stop, Floor with Risk/Reward ratios
5. **Real-time** — Socket.io streaming + polling fallback
6. **Mobile** — Swiper-based responsive view

## Deployment

- Frontend → Vercel (`vercel.json`)
- Backend → Fly.io (`backend-node/fly.toml`, Dockerfile)
- Vite proxies `/api` and `/stockHub` to backend in dev

## Demo Mode

Set `VITE_USE_MOCK_DATA=true` or similar to use `src/entities/stock/lib/mock-data.ts` (150+ synthetic stocks) without a backend.
