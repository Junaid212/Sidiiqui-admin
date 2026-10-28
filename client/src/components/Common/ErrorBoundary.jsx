import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback({
                    error: this.state.error,
                    resetErrorBoundary: this.handleReset
                });
            }

            return (
                <div style={{
                    padding: '24px',
                    margin: '16px 0',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    color: '#fca5a5'
                }}>
                    <h4 style={{ margin: '0 0 8px', color: '#ef4444' }}>
                        ⚠️ An unexpected interface error occurred
                    </h4>
                    <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-secondary, #8b8ba7)' }}>
                        {this.state.error?.message || 'Something went wrong while rendering this component.'}
                    </p>
                    <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={this.handleReset}
                        style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        Dismiss & Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
