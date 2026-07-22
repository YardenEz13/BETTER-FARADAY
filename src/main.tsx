import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import * as Sentry from "@sentry/react";
import App from "./App";
import PrototypeGate from "./components/PrototypeGate";
import { ThemeProvider } from "./components/ThemeContext";
import { reportToUser } from "./lib/errors";
import "./index.css";

// No DSN (local dev, CI) → Sentry stays fully disabled, zero noise.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // Session Replay is deliberately OFF: it screen-records minors' work and
  // ships it to a third-party processor. Stack traces are enough to debug.
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  tracePropagationTargets: ["localhost", /^https:\/\/.*\.convex\.cloud/],
  enableLogs: true,
});
if (import.meta.env.DEV) (window as any).__sentryDebug = Sentry;

// Catch what the React error boundary can't: rejected promises (e.g. a
// Convex mutation whose .catch was missed) and errors thrown outside React's
// render/commit cycle (event handlers, timers, third-party scripts).
// Both handlers also fan the failure out to <ErrorToaster /> so the user gets
// a toast instead of a button that silently does nothing.
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  console.error("[unhandledrejection]", reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    tags: { source: "unhandledrejection" },
  });
  reportToUser(reason);
});
window.addEventListener("error", (event) => {
  // Skip: React already routes render errors through AppErrorBoundary, and
  // resource load failures (img/script 404s) carry no `error` object.
  if (!event.error) return;
  console.error("[window.onerror]", event.error);
  Sentry.captureException(event.error, { tags: { source: "window.onerror" } });
  reportToUser(event.error);
});

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PrototypeGate>
        <ConvexProvider client={convex}>
          <App />
        </ConvexProvider>
      </PrototypeGate>
    </ThemeProvider>
  </React.StrictMode>
);

