import { useState, useEffect, useRef } from 'react';
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

function App() {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Submit new order
  const handleOrderSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/orders/execute', {
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
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/orders/${activeOrderId}/status`;
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
      <h1 className="app__title">
        ⚡ Order Execution Engine
      </h1>

      <div className="app__grid">
        <div className="app__column">
          <OrderForm onSubmit={handleOrderSubmit} isLoading={isLoading} />

          {activeOrderId && (
            <StatusTimeline
              status={orderStatus}
              history={orderHistory}
            />
          )}
        </div>

        <div className="app__column">
          <OrderHistory
            orders={pastOrders}
            selectedId={activeOrderId || undefined}
            onSelectOrder={setActiveOrderId}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
