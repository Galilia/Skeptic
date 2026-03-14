# Skeptic's Terminal — Backend for Fly.io

Node.js + Socket.io бэкенд с реальными данными от FMP.

## Быстрый старт

```bash
npm install
npm run dev
# http://localhost:8080
```

## Деплой на Fly.io

```bash
# 1. Установи Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Войди в аккаунт
fly auth login

# 3. Создай приложение (один раз)
fly launch --name skeptics-terminal-backend --region iad

# 4. Добавь секреты
fly secrets set FMP_API_KEY=твой_ключ
fly secrets set FRONTEND_URL=https://skeptic-six.vercel.app

# 5. Задеплой
fly deploy
```

## После деплоя

Обнови на фронте переменную:
```
VITE_API_URL = https://skeptics-terminal-backend.fly.dev
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `FMP_API_KEY` | Ключ от financialmodelingprep.com | — |
| `FRONTEND_URL` | URL фронтенда для CORS | `*` |
| `PORT` | Порт сервера | `8080` |
| `UPDATE_INTERVAL_MS` | Интервал обновления данных | `60000` |

## API

| Метод | URL | Описание |
|---|---|---|
| GET | `/health` | Статус сервера |
| GET | `/snapshot` | Все акции (для polling) |
| GET | `/tickers` | Список тикеров |
| POST | `/tickers` | Добавить тикер |
| DELETE | `/tickers/:ticker` | Удалить тикер |
| PATCH | `/tickers/:ticker/notify` | Включить алерт |

## Socket.io события

Путь: `/stockHub`

От сервера:
- `BatchStockUpdate` — все акции каждую минуту
- `StockUpdate` — одна акция
- `PriceAlert` — алерт когда цена ≤ buyTarget

От клиента:
- `SubscribeToTicker` — подписаться на алерты тикера
- `UnsubscribeFromTicker` — отписаться

## Что кэшируется

| Данные | TTL | Зачем |
|---|---|---|
| История (220 дней OHLCV) | 24 часа | Дорогой запрос, данные не меняются |
| Live quotes (batch) | 1 минута | Обновляется каждую минуту |
