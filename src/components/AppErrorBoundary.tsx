import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/react";

/**
 * Root crash shield — a render error anywhere in the tree lands here instead
 * of white-screening the whole app. Shows a friendly clay card with a reload
 * button; "נסה שוב" first attempts a soft re-render before a full reload.
 */
export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
    // Tag with the route it crashed on and mark it fatal (it white-screens the
    // whole app, unlike a caught mutation error) so these triage above noise.
    Sentry.withScope((scope) => {
      scope.setLevel("fatal");
      scope.setTag("source", "errorBoundary");
      scope.setTag("route", window.location.pathname);
      scope.setExtra("componentStack", info.componentStack);
      Sentry.captureException(error);
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-background text-on-background">
        <div className="clay-card max-w-[26rem] w-full p-8 text-center bg-surface">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="font-extrabold text-xl text-on-surface mb-2" style={{ fontFamily: "'Assistant', sans-serif" }}>
            קצר חשמלי קטן
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
            משהו השתבש בתצוגה. הנתונים שלך שמורים — נסה לרענן ונחזור לזרום.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              className="btn-clay-primary !px-5 !py-2.5 !text-sm"
              onClick={() => this.setState({ error: null })}
            >
              נסה שוב
            </button>
            <button
              className="px-5 py-2.5 rounded-2xl border-2 border-outline font-semibold text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer"
              onClick={() => window.location.reload()}
            >
              רענון מלא
            </button>
          </div>
        </div>
      </div>
    );
  }
}
