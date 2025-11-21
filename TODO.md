# Project Roadmap: Real Devnet Order Execution Engine

## Phase 0: Environment Setup (Prerequisite)
- [ ] **0.1. Wallet Setup**:
    - Install Solana CLI: `sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`
    - Create devnet wallet: `solana-keygen new --outfile ./devnet-wallet.json`
    - Fund wallet: `solana airdrop 2` (run multiple times if needed)
- [ ] **0.2. Create Custom Token (Mint)**:
    - Create token: `spl-token create-token` -> Save `<MINT_ADDRESS>`
    - Create account: `spl-token create-account <MINT_ADDRESS>`
    - Mint tokens: `spl-token mint <MINT_ADDRESS> 1000000`
- [ ] **0.3. Create Liquidity Pool**:
    - Go to **[Meteora Devnet App](https://app.meteora.ag/)**
    - Select "Pools" -> "Create Pool" -> "Dynamic Pool"
    - Pair: SOL + `<MINT_ADDRESS>`
    - Add Liquidity: e.g., 0.5 SOL + 50,000 Tokens
    - **Save the Pool Address** for testing.

## Phase 1: Setup & Infrastructure
- [ ] **1.1. Docker Compose Setup**: 
    - Spin up Redis (for BullMQ & PubSub)
    - Spin up PostgreSQL (for persistent order history)
- [ ] **1.2. Project Initialization**: 
    - `npm init`, TypeScript config (`tsconfig.json`)
    - Install core deps: `fastify`, `bullmq`, `ioredis`, `pg` (or ORM), `@solana/web3.js`
- [ ] **1.3. Environment Configuration**:
    - `.env` template for `RPC_URL`, `PRIVATE_KEY` (BS58), `DATABASE_URL`, `REDIS_URL`.
- [ ] **1.4. Database Schema**:
    - Define `Order` table: `id`, `inputToken`, `outputToken`, `amount`, `status` (PENDING, ROUTING, EXECUTED, FAILED), `txHash`, `createdAt`.

## Phase 2: Core Services
- [ ] **2.1. Redis & Queue Service**:
    - Initialize BullMQ `order-queue`.
    - Create Redis client for WebSocket Pub/Sub events.
- [ ] **2.2. Fastify API Server**:
    - Register `fastify-websocket`.
    - Create HTTP POST `/api/orders/execute` (Producer).
    - Create WS `/api/orders/:id/status` (Consumer of events).

## Phase 3: The Real DEX Router (Solana Integration)
- [ ] **3.1. Solana Utils**:
    - Helper class to load Wallet from Keypair.
    - Helper to manage Connection (with simple retry on rate limit).
- [ ] **3.2. Meteora Integration**:
    - Install `@meteora-ag/dynamic-amm-sdk` (or relevant SDK).
    - Implement `getMeteoraQuote(inputMint, outputMint, amount)`.
    - Implement `createMeteoraSwapTx(...)`.
- [ ] **3.3. Raydium Integration**:
    - Install `@raydium-io/raydium-sdk-v2`.
    - Implement `getRaydiumQuote(...)`.
    - Implement `createRaydiumSwapTx(...)`.
- [ ] **3.4. Router Logic**:
    - `findBestRoute(...)`: Calls both providers in parallel.
    - Returns: `{ provider: 'raydium' | 'meteora', quote: ..., txBuilder: ... }`.

## Phase 4: The Execution Worker
- [ ] **4.1. Worker Setup**:
    - Create a BullMQ Worker process separate from the API.
- [ ] **4.2. Job Processor**:
    - **Step 1 (Routing)**: Call Router -> Emit 'routing' event.
    - **Step 2 (Building)**: Build Transaction -> Emit 'building' event.
    - **Step 3 (Signing)**: Sign with backend wallet.
    - **Step 4 (Submitting)**: `sendAndConfirmTransaction` -> Emit 'submitted'.
    - **Step 5 (Confirmation)**: Wait for finalization -> Emit 'confirmed' + TX Hash.
- [ ] **4.3. Error Handling**:
    - Wrap steps in try/catch.
    - Implement retry strategy for Network Errors vs. Terminal Errors (e.g. Insufficient Funds).

## Phase 5: Testing & Validation
- [ ] **5.1. Unit Tests**:
    - Mock the Router to test the Queue logic independently of the blockchain.
- [ ] **5.2. Integration Test**:
    - Script to create a local order and listen to the WS feed until completion.

## Phase 6: Documentation & Cleanup
- [ ] **6.1. README**:
    - Instructions to run locally.
    - Explanation of "Market Order" choice.
    - Explanation of "Real Execution" architecture.
