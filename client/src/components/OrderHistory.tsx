import React from 'react';

interface OrderHistoryProps {
    orders: Array<{
        id: string;
        tokenIn: string;
        tokenOut: string;
        amount: number;
        status: string;
        createdAt: string;
    }>;
    onSelectOrder: (id: string) => void;
    selectedId?: string;
}

export const OrderHistory: React.FC<OrderHistoryProps> = ({ orders, onSelectOrder, selectedId }) => {
    if (orders.length === 0) {
        return null;
    }

    const getStatusClass = (status: string) => {
        const key = status?.toLowerCase();
        const allowed = new Set(['pending', 'routing', 'building', 'submitted', 'confirmed', 'failed']);
        const variant = allowed.has(key) ? key : 'pending';
        return `status-badge status-badge--${variant}`;
    };

    return (
        <div className="order-history glass-panel">
            <h3 className="order-history__title">Recent Orders</h3>
            <div className="order-history__list">
                {orders.map((order) => (
                    <div
                        key={order.id}
                        className={`order-history__item ${selectedId === order.id ? 'is-selected' : ''}`}
                        onClick={() => onSelectOrder(order.id)}
                    >
                        <div className="order-history__meta">
                            <span className="order-history__pair">
                                {order.amount} {order.tokenIn} → {order.tokenOut}
                            </span>
                            <span className="order-history__timestamp">
                                {new Date(order.createdAt).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className={getStatusClass(order.status)}>
                            {order.status}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
