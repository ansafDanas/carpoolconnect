import { Component } from "react";
import Button from "./ui/Button";

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    console.error("CarpoolConnect encountered an unexpected interface error.");
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center bg-background p-6">
        <section className="w-full max-w-lg rounded-[32px] border border-border/80 bg-white p-8 text-center shadow-elevated sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Something went wrong</p>
          <h1 className="mt-3 text-2xl font-extrabold text-primary">We couldn&apos;t load this page</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">Try again. If the problem continues, return to the CarpoolConnect dashboard.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>Try again</Button>
            <Button type="button" onClick={() => window.location.assign("/")}>Go to dashboard</Button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
