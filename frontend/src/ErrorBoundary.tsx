import { Component, type ErrorInfo, type ReactNode } from "react";

// A blank page is almost always an uncaught render error. This boundary turns
// that into a visible message (with the stack) so the failure is diagnosable
// on-screen instead of silently blanking the app.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", textAlign: "left" }}>
          <h1 style={{ color: "#c00" }}>Something broke</h1>
          <p>The app hit a runtime error. Details:</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#1a1a1a", color: "#f88", padding: "12px", borderRadius: "8px" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <p style={{ color: "#888" }}>
            If this looks like stale demo data, run{" "}
            <code>localStorage.removeItem('ltride.mockdb.v6')</code> in the console and reload.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
