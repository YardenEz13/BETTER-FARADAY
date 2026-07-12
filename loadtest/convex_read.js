// Read-path load test for the Faraday Convex backend.
// Safe: hits ONLY read queries (no mutations, no AI/Gemini spend).
//
// Run:
//   k6 run convex_read.js
//   k6 run -e CONVEX_URL=https://<deployment>.convex.cloud convex_read.js
//   k6 run -e STAGE=stress convex_read.js
//
// Grafana Cloud (free) streaming:
//   k6 run -o cloud convex_read.js        (after: k6 cloud login)
//
// Output for logs tool (JSON lines -> Loki/SigNoz/Better Stack):
//   k6 run --out json=results.json convex_read.js

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
import { convexQuery, isConvexOk, pick } from "./config.js";

const convexLatency = new Trend("convex_query_latency", true);

// ---- Load profiles. Pick with -e STAGE=smoke|load|stress|soak ----
const PROFILES = {
  smoke: { vus: 2, duration: "30s" },
  load: {
    stages: [
      { duration: "1m", target: 25 },
      { duration: "3m", target: 25 },
      { duration: "1m", target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: "2m", target: 100 },
      { duration: "3m", target: 200 },
      { duration: "2m", target: 0 },
    ],
  },
  soak: { vus: 20, duration: "30m" },
};

const profile = PROFILES[__ENV.STAGE || "smoke"];

export const options = {
  ...profile,
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% transport errors
    http_req_duration: ["p(95)<800"], // 95% under 800ms
    convex_query_latency: ["p(95)<800"],
  },
};

// setup() runs once: discover real IDs so the test hits realistic data.
// Note: classroom:list actually returns the "students" table (see convex/classroom.ts) —
// use getFirstClassroom for a real classrooms._id.
export function setup() {
  const firstClassroom = JSON.parse(
    convexQuery(http, "classroom:getFirstClassroom").body
  ).value;
  const topics = JSON.parse(convexQuery(http, "topics:list").body).value || [];
  return {
    classroomIds: firstClassroom ? [firstClassroom._id] : [],
    topicIds: topics.map((t) => t._id),
  };
}

export default function (data) {
  const classroomId = data.classroomIds.length ? pick(data.classroomIds) : null;

  // Weighted mix of the hot read queries a real dashboard fires.
  const calls = [
    () => convexQuery(http, "topics:list"),
    () => convexQuery(http, "classroom:list"),
  ];
  if (classroomId) {
    calls.push(
      () => convexQuery(http, "commandCenter:getCommandCenter", { classroomId }),
      () => convexQuery(http, "classroom:getClassroomHeatmap", { classroomId }),
      () => convexQuery(http, "classroom:getLiveAlerts", { classroomId }),
      () => convexQuery(http, "leaderboard:getWeeklyLeaderboard", { classroomId })
    );
  }

  const res = pick(calls)();
  convexLatency.add(res.timings.duration);
  check(res, {
    "http 200": (r) => r.status === 200,
    "convex ok": (r) => isConvexOk(r),
  });

  sleep(Math.random() * 1.5 + 0.5); // 0.5–2s think time per VU
}
