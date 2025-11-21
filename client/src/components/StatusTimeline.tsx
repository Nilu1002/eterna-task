import React from 'react';

interface StatusTimelineProps {
    status: string;
    history: Array<{ status: string; timestamp: string; detail?: any }>;
}

const STEPS = ['pending', 'routing', 'building', 'submitted', 'confirmed'];

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ status, history }) => {
    const currentStepIndex = STEPS.indexOf(status);
    const isFailed = status === 'failed';

    const getStepClass = (index: number) => {
        const classes = ['status-timeline__step'];
        if (isFailed && index === currentStepIndex) classes.push('is-failed');
        else if (index < currentStepIndex) classes.push('is-completed');
        else if (index === currentStepIndex) classes.push('is-active');
        return classes.join(' ');
    };

    const getIconClass = (index: number) => {
        const classes = ['status-timeline__icon'];
        if (isFailed && index === currentStepIndex) classes.push('is-failed');
        else if (index < currentStepIndex) classes.push('is-completed');
        else if (index === currentStepIndex) classes.push('is-active');
        return classes.join(' ');
    };

    const getLabelClass = (index: number) => {
        const classes = ['status-timeline__label'];
        if (isFailed && index === currentStepIndex) classes.push('is-failed');
        else if (index <= currentStepIndex) classes.push('is-active');
        return classes.join(' ');
    };

    const getLineClass = (index: number) => {
        const classes = ['status-timeline__line'];
        if (index < currentStepIndex) classes.push('is-completed');
        return classes.join(' ');
    };

    const getDetailForStep = (step: string) => {
        const event = history.find((h) => h.status === step);
        if (!event?.detail) return null;

        if (step === 'routing' && event.detail.message) {
            return <div className="status-timeline__detail">{event.detail.message}</div>;
        }
        if (step === 'building' && event.detail.bestPrice) {
            return (
                <div className="status-timeline__detail">
                    Best Price: {event.detail.bestPrice.toFixed(6)} via {event.detail.chosenDex}
                </div>
            );
        }
        if (step === 'confirmed' && event.detail.txHash) {
            return (
                <div className="status-timeline__detail status-timeline__detail--success">
                    Tx: {event.detail.txHash.slice(0, 8)}...
                </div>
            );
        }
        return null;
    };

    return (
        <div className="status-timeline glass-panel">
            <h3 className="status-timeline__title">Order Status</h3>
            <div className="status-timeline__steps">
                {STEPS.map((step, index) => (
                    <div key={step} className={getStepClass(index)}>
                        <div className={getIconClass(index)}>
                            {index < currentStepIndex ? '✓' : index + 1}
                        </div>
                        <div className="status-timeline__text">
                            <div className={getLabelClass(index)}>{step.charAt(0).toUpperCase() + step.slice(1)}</div>
                            {getDetailForStep(step)}
                        </div>
                        {index < STEPS.length - 1 && <div className={getLineClass(index)} />}
                    </div>
                ))}
            </div>
            {isFailed && (
                <div className="status-timeline__alert">
                    Order Failed: {history.find(h => h.status === 'failed')?.detail?.reason || 'Unknown error'}
                </div>
            )}
        </div>
    );
};
