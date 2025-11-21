import React, { useState } from 'react';

interface OrderFormProps {
    onSubmit: (data: { tokenIn: string; tokenOut: string; amount: number }) => void;
    isLoading: boolean;
}

export const OrderForm: React.FC<OrderFormProps> = ({ onSubmit, isLoading }) => {
    const [tokenIn, setTokenIn] = useState('SOL');
    const [tokenOut, setTokenOut] = useState('USDC');
    const [amount, setAmount] = useState<string>('1');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            tokenIn,
            tokenOut,
            amount: parseFloat(amount),
        });
    };

    return (
        <form className="order-form glass-panel" onSubmit={handleSubmit}>
            <div className="order-form__heading">
                <h2 className="order-form__title">Swap Tokens</h2>
                <p className="order-form__subtitle">Lightning-fast execution</p>
            </div>

            <div className="order-form__field">
                <label className="order-form__label">Amount</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.000001"
                    required
                    className="order-form__input"
                    placeholder="0.00"
                />
            </div>

            <div className="order-form__swap-grid">
                <div className="order-form__field">
                    <label className="order-form__label">From</label>
                    <select
                        value={tokenIn}
                        onChange={(e) => setTokenIn(e.target.value)}
                        className="order-form__select"
                    >
                        <option value="SOL">SOL</option>
                        <option value="USDC">USDC</option>
                        <option value="ETH">ETH</option>
                    </select>
                </div>

                <div className="order-form__field">
                    <label className="order-form__label">To</label>
                    <select
                        value={tokenOut}
                        onChange={(e) => setTokenOut(e.target.value)}
                        className="order-form__select"
                    >
                        <option value="USDC">USDC</option>
                        <option value="SOL">SOL</option>
                        <option value="ETH">ETH</option>
                    </select>
                </div>

                <button
                    type="button"
                    className="order-form__swap-indicator"
                    onClick={() => {
                        const temp = tokenIn;
                        setTokenIn(tokenOut);
                        setTokenOut(temp);
                    }}
                    title="Swap currencies"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8v12M17 20l4-4M17 20l-4-4" />
                    </svg>
                </button>
            </div>

            <button
                type="submit"
                disabled={isLoading || !amount}
                className="order-form__cta"
            >
                {isLoading ? (
                    <span className="order-form__cta-content">
                        <span className="order-form__spinner">⟳</span>
                        Processing...
                    </span>
                ) : (
                    'Swap Now ⚡'
                )}
            </button>
        </form>
    );
};
