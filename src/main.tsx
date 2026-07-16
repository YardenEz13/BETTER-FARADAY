import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import * as Sentry from "@sentry/react";
import App from "./App";
import PrototypeGate from "./components/PrototypeGate";
import "./index.css";

// No DSN (local dev, CI) → Sentry stays fully disabled, zero noise.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 0.1,
  tracePropagationTargets: ["localhost", /^https:\/\/.*\.convex\.cloud/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});
if (import.meta.env.DEV) (window as any).__sentryDebug = Sentry;

// Catch what the React error boundary can't: rejected promises (e.g. a
// Convex mutation whose .catch was missed) and errors thrown outside React's
// render/commit cycle (event handlers, timers, third-party scripts).
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  console.error("[unhandledrejection]", reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    tags: { source: "unhandledrejection" },
  });
});
window.addEventListener("error", (event) => {
  // Skip: React already routes render errors through AppErrorBoundary, and
  // resource load failures (img/script 404s) carry no `error` object.
  if (!event.error) return;
  console.error("[window.onerror]", event.error);
  Sentry.captureException(event.error, { tags: { source: "window.onerror" } });
});

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrototypeGate>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </PrototypeGate>
  </React.StrictMode>
);

