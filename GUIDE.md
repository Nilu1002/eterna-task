# 🚀 How to Run the Order Execution Engine

This guide provides step-by-step instructions to set up and run the project locally.

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (for running Redis and PostgreSQL)
- **npm** (usually comes with Node.js)

## 🛠️ Step 1: Installation

1.  **Clone the repository** (if you haven't already):
    ```bash
    git clone <repo-url>
    cd learning-web3
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## ⚙️ Step 2: Environment Setup

1.  **Create the `.env` file**:
    ```bash
    cp env.example .env
    ```

2.  **Configure `.env`**:
    Open `.env` and ensure the following variables are set (defaults usually work with the Docker commands below):

    ```env
    PORT=4000
    REDIS_URL=redis://127.0.0.1:6379
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/order_engine?schema=public"
    
    # Mock DEX Config
    MOCK_BASE_PRICE=0.0025
    RAYDIUM_FEE_BPS=30
    METEORA_FEE_BPS=20
    ```

## 🐳 Step 3: Start Databases (Docker)

## 🐳 Step 3: Start Databases & Initialize

We've created a convenience script to start Redis/PostgreSQL (via Docker) and initialize the database schema in one go.

1.  **Start Services**:
    ```bash
    npm run services:up
    ```

    This will:
    - Start Redis and PostgreSQL in the background
    - Wait for them to be ready
    - Push the Prisma schema to the database

    > **Note**: If you prefer manual control, you can run `docker-compose up -d` followed by `npx prisma db push`.

## 🚀 Step 5: Run the Application

You need to run two processes: the **API Server** and the **Worker**.

1.  **Start the API Server** (Terminal 1):
    ```bash
    npm run dev
    ```
    *Server will start on http://localhost:4000*

2.  **Start the Order Worker** (Terminal 2):
    ```bash
    npm run worker
    ```
    *Worker will start processing jobs from the queue*

## 🧪 Step 6: Verification & Testing

### Run Automated Tests
To run the comprehensive test suite (Unit + Integration):
```bash
npm test
```

### Manual Testing
You can submit an order using `curl`:

```bash
curl -X POST http://localhost:4000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 1.5
  }'
```

You should receive a response with an `orderId`.

---

## 🔍 DEX Routing & Execution Verification

This section explains how to verify that the DEX routing and order execution process works correctly.

### 1. DEX Routing Verification

#### What to Verify
- ✅ System queries **both** Raydium and Meteora for quotes
- ✅ System compares prices and fees correctly
- ✅ System selects the DEX with the better price
- ✅ Routing decisions are logged for transparency

#### How to Verify

**Option A: Use Automated Verification Script (Recommended)**
```bash
node scripts/verify-routing.js 10
```
This will:
- Submit 10 orders automatically
- Analyze which DEX was selected for each order
- Show routing distribution (Raydium vs Meteora)
- Verify price variance is within expected range (2-5%)
- Display sample routing decisions with explanations

**Option B: Check Server Logs Manually**
When you submit an order, you should see logs like:
```
[Order abc-123] Fetching quotes from Raydium and Meteora...
[Order abc-123] Raydium quote: 1.052 SOL (fee: 0.30%)
[Order abc-123] Meteora quote: 1.048 SOL (fee: 0.20%)
[Order abc-123] Selected: Meteora (better by 0.38%)
```

**Run Unit Tests**
```bash
npm test -- --grep "routing"
```

This tests:
- Price comparison logic
- DEX selection algorithm
- Fee calculation accuracy
- Fallback when one DEX fails

### 2. WebSocket Status Updates Verification

#### Status Lifecycle
Each order goes through these states:
1. `pending` - Order received and queued
2. `routing` - Comparing DEX prices
3. `building` - Creating transaction
4. `submitted` - Transaction sent to network
5. `confirmed` - Transaction successful (includes txHash)
6. `failed` - If any step fails (includes error)

#### How to Verify

**Option A: Use Test Script (Recommended)**
```bash
# Test single order with real-time updates
node scripts/test-websocket.js

# Test 3 concurrent orders
node scripts/test-websocket.js multiple 3

# Test 5 concurrent orders
node scripts/test-websocket.js multiple 5
```

This script will:
- Submit orders via HTTP POST
- Connect to WebSocket automatically
- Show color-coded status updates in real-time
- Display routing decisions and execution results

You should see output like:
```
⏳ [0.12s] Status: PENDING
🔀 [0.45s] Status: ROUTING
   ├─ note: Comparing DEX prices
🔨 [0.89s] Status: BUILDING
   ├─ selectedDex: "meteora"
   ├─ raydiumQuote: {...}
📤 [1.23s] Status: SUBMITTED
   ├─ txHash: "abc123..."
✅ [3.45s] Status: CONFIRMED
   ├─ executedPrice: 1.048
```

**Option B: Using websocat (Alternative)**
Install: `brew install websocat` (macOS) or `cargo install websocat`

```bash
# Submit order and listen to WebSocket
websocat ws://localhost:4000/api/orders/execute -H "Content-Type: application/json" \
  --text <<< '{"tokenIn":"SOL","tokenOut":"USDC","amount":1.5}'
```

**Option C: Using Browser/Postman**
1. Open browser console at `http://localhost:4000`
2. Run:
```javascript
const ws = new WebSocket('ws://localhost:4000/api/orders/execute');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({
  tokenIn: 'SOL',
  tokenOut: 'USDC',
  amount: 1.5
}));
```

### 3. Concurrent Order Processing Verification

#### What to Verify
- ✅ System handles up to 10 concurrent orders
- ✅ Orders beyond 10 are queued (not rejected)
- ✅ Queue processes at ~100 orders/minute
- ✅ Retry logic (up to 3 attempts with exponential backoff)

#### How to Verify

**Run Concurrent Order Script**
```bash
bash scripts/test-concurrent.sh
```

This will submit 15 orders simultaneously.

**Expected Behavior**:
- First 10 orders start processing immediately
- Orders 11-15 are queued
- Check Worker logs (Terminal 2) to see queue processing
- All 15 orders complete successfully

**Run Unit Tests**
```bash
npm test -- --grep "concurrent"
```

### 4. Error Handling & Retry Verification

#### What to Verify
- ✅ Failed orders retry up to 3 times
- ✅ Exponential backoff between retries
- ✅ Failure reasons persisted to database
- ✅ WebSocket emits "failed" status with error details

#### How to Verify

**Check Database for Failed Orders**
```bash
npx prisma studio
```
Navigate to the `Order` model and look for orders with `status: "failed"`.

**Run Error Handling Tests**
```bash
npm test -- --grep "error|retry"
```

### 5. Mock DEX Behavior Verification

Since we're using **Mock Implementation**, verify these characteristics:

#### Price Variance (2-5% difference)
- Raydium prices: `basePrice * (0.98 to 1.02)`
- Meteora prices: `basePrice * (0.97 to 1.02)`
- Sometimes Raydium wins, sometimes Meteora wins

#### Realistic Delays
- Quote fetching: ~200ms per DEX
- Transaction execution: 2-3 seconds

#### Check Mock Configuration
Your `.env` should have:
```env
MOCK_BASE_PRICE=0.0025
RAYDIUM_FEE_BPS=30    # 0.30%
METEORA_FEE_BPS=20    # 0.20%
```

### 6. Complete Verification Checklist

Run through this checklist to ensure everything works:

- [ ] **Automated tests pass**: `npm test` (all green)
- [ ] **Submit single order**: Receives orderId, WebSocket shows all statuses
- [ ] **Check logs**: See routing decisions (which DEX selected and why)
- [ ] **Submit 5 concurrent orders**: All complete successfully
- [ ] **Check database**: Orders persisted with correct status
- [ ] **Worker processing**: Worker logs show jobs being processed
- [ ] **Postman collection**: All endpoints return expected responses

### 7. Video Demo Requirements

To satisfy the deliverables, your demo should show:

1. ✅ Submit 3-5 orders simultaneously
2. ✅ WebSocket streaming status updates (pending → routing → confirmed)
3. ✅ Console logs showing DEX routing decisions
4. ✅ Queue processing multiple orders (not instant)
5. ✅ Database showing completed orders

**Suggested Demo Flow**:
```bash
# Terminal 1: Server logs (routing decisions)
npm run dev

# Terminal 2: Worker logs (queue processing)
npm run worker

# Terminal 3: Run verification scripts
node scripts/test-websocket.js multiple 5
node scripts/verify-routing.js 10
bash scripts/test-concurrent.sh

# Browser: Show Prisma Studio (database persistence)
npx prisma studio
```

---

## 🚀 Quick Verification Commands

Here's a summary of all verification scripts for your mock implementation:

### 1. Test Single Order with WebSocket
```bash
node scripts/test-websocket.js
```
Shows real-time status updates for one order.

### 2. Test Multiple Concurrent Orders
```bash
node scripts/test-websocket.js multiple 5
```
Submits 5 orders and monitors all via WebSocket.

### 3. Analyze DEX Routing Decisions
```bash
node scripts/verify-routing.js 10
```
Submits 10 orders and analyzes which DEX was selected for each.

### 4. Test Queue with 15 Concurrent Orders
```bash
bash scripts/test-concurrent.sh
```
Tests the queue limit (10 concurrent, 5 queued).

### 5. Run All Automated Tests
```bash
npm test
```
Runs the full test suite (unit + integration).

### 6. View Database Orders
```bash
npx prisma studio
```
Opens a GUI to view all orders in the database.

## 🔍 Troubleshooting

- **Database Connection Error**: Ensure the Docker containers are running (`docker-compose ps`) and the `DATABASE_URL` in `.env` matches.
- **Redis Connection Error**: Ensure Redis is running on port 6379.
- **Prisma Client Error**: Run `npx prisma generate` again if you change the schema.
