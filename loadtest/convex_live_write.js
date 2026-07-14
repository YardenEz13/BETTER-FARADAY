// Live-class WRITE load test for the Faraday Convex backend.
// Simulates a live lesson (שיעור חי): a teacher VU starts rounds, student VUs
// discover the active session and each submits one answer per round. This
// exercises the hottest write path (liveAnswers insert + uniqueness check,
// OCC contention on the session row) plus the reactive read queries around it.
//
// WRITES DATA. Guard rail: refuses any non-default target unless you pass
// -e I_KNOW_THIS_IS_PROD=1. Always run against the E2E fixtures:
//   npx convex run seedE2E:seed [--prod]
//   npx convex run seedE2E:seedLoadStudents [--prod]
//
// Run:
//   k6 run convex_live_write.js                                  (dev default)
//   k6 run -e STAGE=load convex_live_write.js
//   k6 run -e CONVEX_URL=https://befitting-panther-27.convex.cloud \
//          -e I_KNOW_THIS_IS_PROD=1 -e STAGE=load convex_live_write.js
//
// Cleanup afterwards: delete the "כיתת בדיקות E2E" classroom's liveSessions /
// liveAnswers from the dashboard (or ignore — they're test-classroom scoped).

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { CONVEX_URL, convexQuery, convexMutation, isConvexOk } from "./config.js";

const DEFAULT_DEV = "https://optimistic-weasel-444.convex.cloud";
if (CONVEX_URL !== DEFAULT_DEV && !__ENV.I_KNOW_THIS_IS_PROD) {
  throw new Error(
    `Refusing to run a WRITE load test against ${CONVEX_URL}. ` +
      "Pass -e I_KNOW_THIS_IS_PROD=1 if you really mean it."
  );
}

const E2E_CLASSROOM_STUDENT_PREFIX = "לוד-טסט";
const E2E_TOPIC_HE = "חשבון בסיסי (בדיקות)";
const ROUND_SECONDS = 20; // teacher starts a fresh question every round

const writeLatency = new Trend("convex_mutation_latency", true);
const answersAccepted = new Counter("live_answers_accepted");
const answersDuplicate = new Counter("live_answers_duplicate");

const PROFILES = {
  smoke: { vus: 5, duration: "40s" },
  load: {
    stages: [
      { duration: "1m", target: 25 },
      { duration: "3m", target: 25 },
      { duration: "1m", target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: "1m", target: 50 },
      { duration: "3m", target: 50 },
      { duration: "1m", target: 0 },
    ],
  },
};

const profile = PROFILES[__ENV.STAGE || "smoke"];

export const options = {
  ...profile,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    convex_mutation_latency: ["p(95)<1000"],
  },
};

// Discover the load-test roster + a question, then start the first session.
export function setup() {
  const students = JSON.parse(convexQuery(http, "classroom:list").body).value || [];
  const roster = students.filter((s) => s.name.startsWith(E2E_CLASSROOM_STUDENT_PREFIX));
  if (roster.length === 0) {
    throw new Error("No load-test students. Run: npx convex run seedE2E:seedLoadStudents");
  }

  const full = JSON.parse(convexQuery(http, "classroom:get", { id: roster[0]._id }).body).value;
  const classroomId = full.classroomId;

  const topics = JSON.parse(convexQuery(http, "topics:list").body).value || [];
  const topic = topics.find((t) => t.nameHe === E2E_TOPIC_HE);
  if (!topic) throw new Error("No E2E topic. Run: npx convex run seedE2E:seed");

  const questions =
    JSON.parse(convexQuery(http, "questions:getByTopic", { topicId: topic._id }).body).value || [];
  if (questions.length === 0) throw new Error("E2E topic has no questions");

  return {
    classroomId,
    questionId: questions[0]._id,
    studentIds: roster.map((s) => s._id),
  };
}

export default function (data) {
  const isTeacher = __VU === 1;

  if (isTeacher) {
    // Teacher: ensure a session is running; rotate it every ROUND_SECONDS
    // (live:start ends the previous session itself), and poll live results
    // like the real dashboard panel does.
    const active = JSON.parse(
      convexQuery(http, "live:getActiveForClassroom", { classroomId: data.classroomId }).body
    ).value;

    if (!active || Math.floor((Date.now() / 1000) % ROUND_SECONDS) === 0) {
      const res = convexMutation(http, "live:start", {
        classroomId: data.classroomId,
        questionId: data.questionId,
      });
      writeLatency.add(res.timings.duration);
      check(res, { "live:start ok": (r) => isConvexOk(r) });
    } else {
      const res = convexQuery(http, "live:getResults", { sessionId: active.sessionId });
      check(res, { "live:getResults ok": (r) => isConvexOk(r) });
    }
    sleep(1);
    return;
  }

  // Student: pick a stable identity per VU, find the active question, answer
  // it once (duplicate answers in the same round are expected no-ops).
  const studentId = data.studentIds[(__VU - 2 + data.studentIds.length) % data.studentIds.length];
  const active = JSON.parse(
    convexQuery(http, "live:getActiveForStudent", { studentId }).body
  ).value;

  if (active && !active.answered) {
    const res = convexMutation(http, "live:submitAnswer", {
      sessionId: active.sessionId,
      studentId,
      choiceIndex: Math.floor(Math.random() * 4),
    });
    writeLatency.add(res.timings.duration);
    const body = JSON.parse(res.body);
    if (body.status === "success") {
      answersAccepted.add(1);
    } else if ((body.errorMessage || "").includes("כבר ענית")) {
      answersDuplicate.add(1); // raced another iteration of the same student
    } else {
      check(res, { "live:submitAnswer ok": () => false });
    }
  }
  sleep(0.5 + Math.random());
}

export function teardown(data) {
  // End whatever session is still active so the test classroom goes quiet.
  const active = JSON.parse(
    convexQuery(http, "live:getActiveForClassroom", { classroomId: data.classroomId }).body
  ).value;
  if (active) convexMutation(http, "live:end", { sessionId: active.sessionId });
}
