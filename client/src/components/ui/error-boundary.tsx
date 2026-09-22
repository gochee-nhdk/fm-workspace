import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Đã có sự cố hiển thị xảy ra
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6">
            {this.state.error?.message || 'Một lỗi không mong muốn đã xảy ra trong giao diện người dùng.'}
          </p>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={this.handleReset}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Tải lại trang
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
