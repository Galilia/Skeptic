# Skeptic's Terminal — Node.js Backend

Полный порт C# бэкенда на Node.js + TypeScript.
Деплоится на Vercel, Railway, Render — всё что угодно.

## Запуск локально

```bash
npm install
npm run dev
# http://localhost:5000
```

## Деплой на Vercel

```bash
# В папке skeptics-backend-node:
vercel
```

Или через GitHub → Vercel dashboard → New Project → выбери папку `skeptics-backend-node`.

## Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт сервера | `5000` |
| `FRONTEND_URL` | URL фронтенда для CORS | — |
| `UPDATE_INTERVAL_MS` | Интервал обновления данных | `60000` |

## API

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/v1/stocks/snapshot` | Все акции (первоначальная загрузка) |
| GET | `/api/v1/portfolio/tickers` | Список тикеров |
| POST | `/api/v1/portfolio/tickers` | Добавить тикер |
| DELETE | `/api/v1/portfolio/tickers/:ticker` | Удалить тикер |
| PATCH | `/api/v1/portfolio/tickers/:ticker/notify` | Включить алерт |
| GET | `/health` | Проверка статуса |

## WebSocket (Socket.io)

Путь: `/stockHub` (совместим с фронтендом)

События от сервера:
- `BatchStockUpdate` — массив всех акций каждую минуту
- `StockUpdate` — одна акция
- `PriceAlert` — алерт когда цена ≤ buyTarget

## Структура

```
src/
├── index.ts                    ← Express + Socket.io сервер
├── types.ts                    ← Все TypeScript типы
├── routes/portfolio.ts         ← REST эндпоинты
├── services/stock-processor.ts ← Оркестратор всех движков
├── indicators/
│   ├── indicator-engine.ts     ← SMA, RSI, ATR
│   └── wick-detector.ts        ← Ptil логика
├── patterns/pattern-scanner.ts ← Double Bottom/Top O(n)
└── audit/skeptic-auditor.ts    ← Аудит + Вердикт
```
