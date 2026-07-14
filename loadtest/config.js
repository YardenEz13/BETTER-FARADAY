// Shared config for k6 load tests against the Faraday (Convex) backend.
//
// Convex exposes a plain HTTP API for functions:
//   POST {CONVEX_URL}/api/query    body: { path, args, format:"json" }
//   POST {CONVEX_URL}/api/mutation  (write — DO NOT hammer prod)
//   POST {CONVEX_URL}/api/action
// Response 200: { status: "success", value } | { status: "error", errorMessage }
//
// Override targets with env vars, e.g.:
//   k6 run -e CONVEX_URL=https://optimistic-weasel-444.convex.cloud convex_read.js
//   k6 run -e FRONTEND_URL=https://your-vercel-app.vercel.app frontend.js

export const CONVEX_URL =
  __ENV.CONVEX_URL || "https://optimistic-weasel-444.convex.cloud";

export const FRONTEND_URL =
  __ENV.FRONTEND_URL || "http://localhost:5173";

export const HEADERS = { "Content-Type": "application/json" };

// Call a Convex read query over HTTP.
export function convexQuery(http, path, args = {}) {
  return http.post(
    `${CONVEX_URL}/api/query`,
    JSON.stringify({ path, args, format: "json" }),
    { headers: HEADERS, tags: { fn: path } }
  );
}

// Call a Convex mutation over HTTP. WRITES DATA — only convex_live_write.js
// uses this, behind its own prod guard rail.
export function convexMutation(http, path, args = {}) {
  return http.post(
    `${CONVEX_URL}/api/mutation`,
    JSON.stringify({ path, args, format: "json" }),
    { headers: HEADERS, tags: { fn: path } }
  );
}

// A Convex 200 can still carry a logical error — check the body.
export function isConvexOk(res) {
  if (res.status !== 200) return false;
  try {
    return JSON.parse(res.body).status === "success";
  } catch {
    return false;
  }
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
