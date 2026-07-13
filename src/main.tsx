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
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
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

