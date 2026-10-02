"use client";

import { Component, type ReactNode } from "react";

/** Shows a prototype's crash in place of its canvas, with a way to try again. */
export class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, message: e.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-[var(--bg-muted)]">
          <p className="text-sm text-red-400">Canvas error</p>
          <p className="max-w-xs text-center text-xs text-[var(--text-muted)]">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] ring-1 ring-white/10 hover:text-[var(--text-primary)]"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
