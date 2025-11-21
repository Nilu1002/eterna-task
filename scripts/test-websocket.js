#!/usr/bin/env node

/**
 * WebSocket Order Testing Script
 * Tests order submission and real-time status updates
 */

const WebSocket = require('ws');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const WS_URL = BASE_URL.replace('http', 'ws');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

async function submitOrder(orderData) {
  const response = await fetch(`${BASE_URL}/api/orders/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function connectWebSocket(orderId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}/api/orders/${orderId}/status`);
    const updates = [];
    let startTime = Date.now();

    ws.on('open', () => {
      console.log(`${colors.blue}🔌 WebSocket connected for order: ${orderId}${colors.reset}\n`);
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (message.type === 'history') {
        console.log(`${colors.cyan}📜 Order History:${colors.reset}`);
        message.data.forEach((item) => {
          console.log(`   ${getStatusEmoji(item.status)} ${item.status} - ${item.metadata ? JSON.stringify(item.metadata) : ''}`);
        });
        console.log('');
      } else if (message.type === 'update') {
        const update = message.data;
        updates.push(update);

        const emoji = getStatusEmoji(update.status);
        const color = getStatusColor(update.status);

        console.log(`${color}${emoji} [${elapsed}s] Status: ${update.status.toUpperCase()}${colors.reset}`);

        if (update.metadata) {
          Object.entries(update.metadata).forEach(([key, value]) => {
            console.log(`   ${colors.yellow}├─${colors.reset} ${key}: ${JSON.stringify(value)}`);
          });
        }
        console.log('');

        // Close connection when order is completed or failed
        if (update.status === 'confirmed' || update.status === 'failed') {
          setTimeout(() => {
            ws.close();
            resolve(updates);
          }, 500);
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`${colors.red}❌ WebSocket error:${colors.reset}`, error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log(`${colors.blue}🔌 WebSocket closed${colors.reset}\n`);
    });
  });
}

function getStatusEmoji(status) {
  const emojis = {
    pending: '⏳',
    routing: '🔀',
    building: '🔨',
    submitted: '📤',
    confirmed: '✅',
    failed: '❌',
  };
  return emojis[status] || '📍';
}

function getStatusColor(status) {
  const statusColors = {
    pending: colors.yellow,
    routing: colors.cyan,
    building: colors.blue,
    submitted: colors.blue,
    confirmed: colors.green,
    failed: colors.red,
  };
  return statusColors[status] || colors.reset;
}

async function testSingleOrder() {
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}  Testing Single Order Execution${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}\n`);

  const orderData = {
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amount: 1.5,
  };

  console.log(`${colors.cyan}📝 Submitting order:${colors.reset}`, orderData);

  try {
    const orderResponse = await submitOrder(orderData);
    console.log(`${colors.green}✅ Order accepted!${colors.reset}`);
    console.log(`   Order ID: ${orderResponse.orderId}`);
    console.log(`   Created At: ${orderResponse.createdAt}\n`);

    await connectWebSocket(orderResponse.orderId);

    console.log(`${colors.green}✨ Order processing complete!${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

async function testMultipleOrders(count = 3) {
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}  Testing ${count} Concurrent Orders${colors.reset}`);
  console.log(`${colors.green}═══════════════════════════════════════════════════${colors.reset}\n`);

  const orders = [];

  for (let i = 1; i <= count; i++) {
    const orderData = {
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: parseFloat((0.5 + i * 0.3).toFixed(2)),
    };

    console.log(`${colors.cyan}📝 Submitting order ${i}/${count}:${colors.reset}`, orderData);

    try {
      const orderResponse = await submitOrder(orderData);
      console.log(`${colors.green}✅ Order ${i} accepted: ${orderResponse.orderId}${colors.reset}\n`);
      orders.push(orderResponse.orderId);
    } catch (error) {
      console.error(`${colors.red}❌ Order ${i} failed:${colors.reset}`, error.message);
    }
  }

  console.log(`${colors.yellow}⏳ Monitoring all ${orders.length} orders via WebSocket...${colors.reset}\n`);

  // Monitor all orders concurrently
  await Promise.all(orders.map((orderId) => connectWebSocket(orderId)));

  console.log(`${colors.green}✨ All orders processed!${colors.reset}\n`);
}

// CLI Interface
const args = process.argv.slice(2);
const mode = args[0] || 'single';

(async () => {
  try {
    if (mode === 'multiple') {
      const count = parseInt(args[1]) || 3;
      await testMultipleOrders(count);
    } else {
      await testSingleOrder();
    }
  } catch (error) {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  }
})();
