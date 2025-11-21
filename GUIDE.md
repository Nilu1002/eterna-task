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

## 🔍 Troubleshooting

- **Database Connection Error**: Ensure the Docker containers are running (`docker-compose ps`) and the `DATABASE_URL` in `.env` matches.
- **Redis Connection Error**: Ensure Redis is running on port 6379.
- **Prisma Client Error**: Run `npx prisma generate` again if you change the schema.
