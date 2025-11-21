#!/bin/bash

# Test Concurrent Order Processing
# Submits 15 orders simultaneously to test queue behavior

echo "🚀 Submitting 15 concurrent orders..."
echo "Expected: First 10 process immediately, orders 11-15 queued"
echo ""

for i in {1..15}; do
  amount=$(echo "scale=2; 0.5 + $i * 0.1" | bc)

  curl -X POST http://localhost:4000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d "{\"tokenIn\":\"SOL\",\"tokenOut\":\"USDC\",\"amount\":${amount}}" \
    -s -w "\nOrder $i submitted (amount: ${amount})\n" &
done

wait

echo ""
echo "✅ All orders submitted!"
echo "📊 Check your server logs (Terminal 1) for routing decisions"
echo "⚙️  Check your worker logs (Terminal 2) for queue processing"
