import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Primitives";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("hark ui error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-canvas p-6 text-center text-ink">
        <div className="max-w-[420px] rounded-lg border border-line bg-chrome p-5">
          <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-rose/25 bg-rose-soft text-rose">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.9} />
          </div>
          <div className="text-[14px] font-semibold text-ink">Something went wrong in the UI</div>
          <p className="mt-1.5 break-words mono text-[11.5px] leading-relaxed text-ink3 select-text">
            {this.state.error.message || String(this.state.error)}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => this.setState({ error: null })}
            >
              Try to recover
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reload window</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
