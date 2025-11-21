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
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 5;

    // Reset to first page when orders change (optional, but good for new orders)
    React.useEffect(() => {
        if (currentPage === 1) return;
        // If we want to stay on the current page unless it's out of bounds:
        const maxPage = Math.ceil(orders.length / itemsPerPage) || 1;
        if (currentPage > maxPage) setCurrentPage(maxPage);
    }, [orders.length]);

    if (orders.length === 0) {
        return null;
    }

    const totalPages = Math.ceil(orders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentOrders = orders.slice(startIndex, startIndex + itemsPerPage);

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
                {currentOrders.map((order) => (
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

            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        className="pagination__button"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <span className="pagination__info">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        className="pagination__button"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};
