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
  return import.meta.env.VITE_API_URL || 'https://eterna-backend-7c5v.onrender.com';
};

function App() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const wsRef = useRef<WebSocket | null>(null);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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
      <header className="app__header">
        <div className="app__logo">
          <span className="app__logo-icon">⚡</span>
          <h1 className="app__title-text">Eterna Execution</h1>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <main className="app__main">
        <div className="app__top-row">
          <motion.div
            className="app__section app__section--form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <OrderForm onSubmit={handleOrderSubmit} isLoading={isLoading} />
          </motion.div>

          <div className="app__section app__section--status">
            <AnimatePresence mode="wait">
              {activeOrderId ? (
                <motion.div
                  key="status"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <StatusTimeline
                    status={orderStatus}
                    history={orderHistory}
                  />
                </motion.div>
              ) : (
                <motion.div
                  className="status-placeholder glass-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="status-placeholder__content">
                    <span className="status-placeholder__icon">📡</span>
                    <h3>Ready to Execute</h3>
                    <p>Submit an order to track its status in real-time.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          className="app__bottom-row"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <OrderHistory
            orders={pastOrders}
            selectedId={activeOrderId || undefined}
            onSelectOrder={setActiveOrderId}
          />
        </motion.div>
      </main>
    </div>
  );
}

export default App;