// src/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }              // whatever this boundary wraps
interface State { error: Error | null }               // the crash we caught, if any

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };                      // start assuming no crash

  static getDerivedStateFromError(error: Error) {
    return { error };                                  // React calls this when a child below throws
  }

  render() {
    if (this.state.error) {
      // Show the crash on-screen instead of a silent blank page.
      return (
        <pre style={{ padding: 20, color: "crimson", whiteSpace: "pre-wrap" }}>
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children;                        // no crash: render normally
  }
}