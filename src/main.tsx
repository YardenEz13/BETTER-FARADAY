import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import PrototypeGate from "./components/PrototypeGate";
import { installGlobalErrorLogging } from "./services/remoteLogger";
import "./index.css";

installGlobalErrorLogging();

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

