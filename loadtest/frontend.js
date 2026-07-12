// Frontend load test — the Vite/Vercel-served SPA shell + static assets.
// Tests CDN/edge + index.html delivery, not React runtime (SPA renders client-side).
//
// Run:
//   k6 run -e FRONTEND_URL=https://your-app.vercel.app frontend.js
//   k6 run -e FRONTEND_URL=https://your-app.vercel.app -e STAGE=stress frontend.js

import http from "k6/http";
import { check, sleep } from "k6";
import { FRONTEND_URL } from "./config.js";

const PROFILES = {
  smoke: { vus: 2, duration: "30s" },
  load: {
    stages: [
      { duration: "1m", target: 50 },
      { duration: "3m", target: 50 },
      { duration: "1m", target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: "2m", target: 300 },
      { duration: "2m", target: 0 },
    ],
  },
};

export const options = {
  ...PROFILES[__ENV.STAGE || "smoke"],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1200"],
  },
};

// Deep-link routes worth exercising (SPA rewrite -> index.html on Vercel).
const ROUTES = ["/", "/teacher", "/practice", "/dashboard"];

export default function () {
  for (const route of ROUTES) {
    const res = http.get(`${FRONTEND_URL}${route}`, { tags: { route } });
    check(res, {
      "status 200": (r) => r.status === 200,
      "served html": (r) => (r.headers["Content-Type"] || "").includes("text/html"),
    });
    sleep(1);
  }
}
