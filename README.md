# Mock Order Execution Engine

This project implements the **mock** option of the order execution engine described in `Backend Task 2_ Order Execution Engine.txt`. It focuses on the architecture (API → queue → worker) and real-time status streaming while simulating DEX routing logic.

## Why Market Orders?

Market orders provide the clearest demo path for the execution engine because they skip order book persistence and execute immediately at the best available price. The same architecture can support:

- **Limit orders** by holding jobs in a scheduler until the router reports a target price.
- **Sniper orders** by watching new pools and only enqueuing jobs when a mint/pool address appears.

## Architecture

- **Fastify API + WebSocket** (`src/server.ts`, `src/routes/orderRoutes.ts`)
  - `POST /api/orders/execute` accepts an order and enqueues it.
  - `GET /api/orders/:id/status` upgrades to a WebSocket for streaming lifecycle events.
- **BullMQ queue + worker** (`src/queue/orderQueue.ts`, `src/worker/orderWorker.ts`)
  - Processes jobs concurrently (configurable) with exponential backoff.
  - Emits `pending → routing → building → submitted → confirmed/failed`.
- **Mock DEX Router** (`src/dex/mockDexRouter.ts`)
  - Simulates Raydium vs Meteora quotes with randomised latency, pricing variance (2‑5%), and execution delay (2‑3s).
- **Status bus & in-memory store** (`src/events/statusBus.ts`, `src/store/orderStore.ts`)
  - Persists status history for HTTP retrieval and WebSocket replay.

> **Note**: BullMQ requires `maxRetriesPerRequest: null` in Redis connection options for blocking operations. This is configured in `orderQueue.ts` and `orderWorker.ts`.

> Swapping the mock router with real SDK calls (Raydium/Meteora) is isolated to `MockDexRouter`, the worker, and the environment config.

## Prerequisites

- Node.js 18+
- Docker (for Redis and PostgreSQL)

## Quick Start

For a detailed step-by-step guide, please see [GUIDE.md](./GUIDE.md).

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Setup Environment**:
    ```bash
    cp env.example .env
    # Start Databases & Initialize
    npm run services:up
    ```
3.  **Start the API server and worker**:
    ```bash
    npm run dev
    npm run worker
    ```

Build artifacts are produced with `npm run build`, and production processes can use `npm run start` / `npm run start:worker`.

## API Reference

### `POST /api/orders/execute`

```json
{
  "tokenIn": "USDC",
  "tokenOut": "SOL",
  "amount": 100
}
```

Response:

```json
{
  "orderId": "a609c5d4-...",
  "statusEndpoint": "/api/orders/a609c5d4-.../status",
  "createdAt": "2025-11-19T19:30:00.000Z"
}
```

### `GET /api/orders/:id/status` (WebSocket upgrade)

Connect using any WebSocket client to receive:

```json
{ "type": "history", "data": [ ...previous updates ] }
{ "type": "update", "data": { "status": "routing", ... } }
```

Status order:

`pending → routing → building → submitted → confirmed | failed`

### `GET /api/orders/:id/history`

Returns the same status timeline as JSON (useful for logs or dashboards).

## Extending to Real DEX Execution

- Replace `MockDexRouter` with adapters that call Raydium/Meteora SDKs for quotes & swaps.
- Persist orders in PostgreSQL and load-balancing metadata in Redis.
- Add authentication + rate limiting in Fastify.
- Implement retry-aware error classification in the worker (`network`, `insufficient_funds`, etc.).

## Testing & Next Steps

- Add unit tests around `MockDexRouter`, the queue handler, and WebSocket lifecycle.
- Provide a Postman collection + automated tests (per task requirements).
- Deploy API/worker to a free host (e.g., Fly.io) once Redis connectivity is available.

This mock implementation unblocks frontend/backoffice integration while you explore real devnet pool creation separately.

