import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrderForm } from './components/OrderForm';
import { StatusTimeline } from './components/StatusTimeline';
import { OrderHistory } from './components/OrderHistory';

interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status: string;
  createdAt: string;
}

// Get API base URL from environment variable or use relative path for development
const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

function App() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const apiBaseUrl = getApiBaseUrl();
        const res = await fetch(`${apiBaseUrl}/api/orders`);
        if (res.ok) {
          const data = await res.json();
          setPastOrders(data);
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };
    fetchHistory();
  }, []);

  // Submit new order
  const handleOrderSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/orders/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to submit order');

      const result = await response.json();
      setActiveOrderId(result.orderId);

      // Add to local history immediately
      const newOrder = {
        id: result.orderId,
        ...data,
        status: 'pending',
        createdAt: result.createdAt,
      };
      setPastOrders(prev => [newOrder, ...prev]);

    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Failed to submit order');
    } finally {
      setIsLoading(false);
    }
  };

  // WebSocket connection for active order
  useEffect(() => {
    if (!activeOrderId) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Connect to WebSocket
    const apiBaseUrl = getApiBaseUrl();
    let wsUrl: string;

    if (apiBaseUrl) {
      // Production: use the backend URL from environment variable
      const backendUrl = new URL(apiBaseUrl);
      const protocol = backendUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${backendUrl.host}/api/orders/${activeOrderId}/status`;
    } else {
      // Development: use relative path (will be proxied by Vite)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/orders/${activeOrderId}/status`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'history') {
        setOrderHistory(message.data);
        if (message.data.length > 0) {
          setOrderStatus(message.data[message.data.length - 1].status);
        }
      } else if (message.type === 'update') {
        setOrderStatus(message.data.status);
        setOrderHistory(prev => [...prev, message.data]);

        // Update past orders list status
        setPastOrders(prev => prev.map(order =>
          order.id === activeOrderId
            ? { ...order, status: message.data.status }
            : order
        ));
      }
    };

    return () => {
      ws.close();
    };
  }, [activeOrderId]);

  return (
    <div className="app">
      <motion.h1
        className="app__title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        ⚡ Order Execution Engine
      </motion.h1>

      <div className="app__grid">
        <div className="app__column">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <OrderForm onSubmit={handleOrderSubmit} isLoading={isLoading} />
          </motion.div>

          <AnimatePresence mode="wait">
            {activeOrderId && (
              <motion.div
                key="status"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <StatusTimeline
                  status={orderStatus}
                  history={orderHistory}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="app__column">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <OrderHistory
              orders={pastOrders}
              selectedId={activeOrderId || undefined}
              onSelectOrder={setActiveOrderId}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default App;