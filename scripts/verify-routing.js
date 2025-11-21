#!/usr/bin/env node

/**
 * DEX Routing Verification Script
 * Submits multiple orders and analyzes routing decisions
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const WS_URL = BASE_URL.replace('http', 'ws');
const WebSocket = require('ws');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

async function submitOrderAndMonitor(orderData) {
  return new Promise(async (resolve, reject) => {
    try {
      // Submit order
      const response = await fetch(`${BASE_URL}/api/orders/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const { orderId } = await response.json();

      // Monitor via WebSocket
      const ws = new WebSocket(`${WS_URL}/api/orders/${orderId}/status`);
      const result = { orderId, orderData, routing: null, execution: null };

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'update') {
          const update = message.data;

          // Capture routing decision
          if (update.status === 'building' && update.metadata?.selectedDex) {
            result.routing = {
              selectedDex: update.metadata.selectedDex,
              raydiumQuote: update.metadata.raydiumQuote,
              meteoraQuote: update.metadata.meteoraQuote,
            };
          }

          // Capture execution result
          if (update.status === 'confirmed') {
            result.execution = {
              txHash: update.metadata?.txHash,
              executedPrice: update.metadata?.executedPrice,
              outputAmount: update.metadata?.outputAmount,
            };
            ws.close();
            resolve(result);
          }

          if (update.status === 'failed') {
            result.execution = { error: update.metadata?.error };
            ws.close();
            resolve(result);
          }
        }
      });

      ws.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        ws.close();
        reject(new Error('Timeout waiting for order completion'));
      }, 30000);

    } catch (error) {
      reject(error);
    }
  });
}

async function analyzeRouting(numOrders = 10) {
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}  DEX Routing Analysis${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`${colors.cyan}Submitting ${numOrders} orders to analyze DEX routing decisions...${colors.reset}\n`);

  const results = [];

  // Submit orders sequentially to see routing distribution
  for (let i = 1; i <= numOrders; i++) {
    const orderData = {
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: parseFloat((1 + Math.random()).toFixed(2)),
    };

    process.stdout.write(`${colors.yellow}[${i}/${numOrders}] Processing...${colors.reset}\r`);

    try {
      const result = await submitOrderAndMonitor(orderData);
      results.push(result);
    } catch (error) {
      console.error(`\n${colors.red}Order ${i} failed: ${error.message}${colors.reset}`);
    }
  }

  console.log(`\n\n${colors.green}✅ Analysis Complete!${colors.reset}\n`);

  // Analyze results
  const raydiumCount = results.filter(r => r.routing?.selectedDex === 'raydium').length;
  const meteoraCount = results.filter(r => r.routing?.selectedDex === 'meteora').length;
  const failedCount = results.filter(r => r.execution?.error).length;

  console.log(`${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║           ROUTING DISTRIBUTION                 ║${colors.reset}`);
  console.log(`${colors.cyan}╠════════════════════════════════════════════════╣${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset} Raydium selected:  ${colors.blue}${raydiumCount.toString().padEnd(3)}${colors.reset} (${((raydiumCount/numOrders)*100).toFixed(1)}%) ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset} Meteora selected:  ${colors.magenta}${meteoraCount.toString().padEnd(3)}${colors.reset} (${((meteoraCount/numOrders)*100).toFixed(1)}%) ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}║${colors.reset} Failed:            ${colors.red}${failedCount.toString().padEnd(3)}${colors.reset} (${((failedCount/numOrders)*100).toFixed(1)}%) ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}\n`);

  // Show sample routing decisions
  console.log(`${colors.cyan}SAMPLE ROUTING DECISIONS:${colors.reset}\n`);

  results.slice(0, 5).forEach((result, idx) => {
    if (!result.routing) return;

    const { selectedDex, raydiumQuote, meteoraQuote } = result.routing;
    const raydiumOutput = raydiumQuote?.expectedOutput || 0;
    const meteoraOutput = meteoraQuote?.expectedOutput || 0;
    const difference = Math.abs(raydiumOutput - meteoraOutput);
    const percentDiff = ((difference / Math.max(raydiumOutput, meteoraOutput)) * 100).toFixed(2);

    console.log(`${colors.yellow}Order ${idx + 1}:${colors.reset} ${result.orderData.amount} SOL → USDC`);
    console.log(`  ${colors.blue}Raydium:${colors.reset} ${raydiumOutput.toFixed(4)} USDC (fee: ${raydiumQuote?.feeBps || 0} bps)`);
    console.log(`  ${colors.magenta}Meteora:${colors.reset} ${meteoraOutput.toFixed(4)} USDC (fee: ${meteoraQuote?.feeBps || 0} bps)`);
    console.log(`  ${colors.green}→ Selected: ${selectedDex.toUpperCase()}${colors.reset} (${percentDiff}% better)`);
    console.log('');
  });

  // Verify both DEXs are being used
  if (raydiumCount === 0 || meteoraCount === 0) {
    console.log(`${colors.red}⚠️  WARNING: Only one DEX is being selected!${colors.reset}`);
    console.log(`${colors.red}   This may indicate a routing issue.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ Both DEXs are being utilized - routing is working correctly!${colors.reset}\n`);
  }

  // Verify price variance
  const priceVariances = results
    .filter(r => r.routing)
    .map(r => {
      const ray = r.routing.raydiumQuote?.price || 0;
      const met = r.routing.meteoraQuote?.price || 0;
      return Math.abs(ray - met) / Math.max(ray, met) * 100;
    });

  const avgVariance = priceVariances.reduce((a, b) => a + b, 0) / priceVariances.length;

  console.log(`${colors.cyan}PRICE VARIANCE ANALYSIS:${colors.reset}`);
  console.log(`  Average price difference: ${avgVariance.toFixed(2)}%`);
  console.log(`  Expected range: 2-5%`);

  if (avgVariance >= 2 && avgVariance <= 5) {
    console.log(`  ${colors.green}✅ Within expected range${colors.reset}\n`);
  } else {
    console.log(`  ${colors.yellow}⚠️  Outside expected range${colors.reset}\n`);
  }
}

// CLI
const args = process.argv.slice(2);
const numOrders = parseInt(args[0]) || 10;

analyzeRouting(numOrders).catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
