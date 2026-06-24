import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Base64 length cap. A phone-compressed JPEG is ~150-350KB → ~200-470K chars;
// this guards against an oversized upload pushing the document past Convex's
// 1MB limit. ~900K chars ≈ 675KB binary.
const MAX_BASE64_CHARS = 900_000;

// Sessions live this long before the sweep can reclaim them.
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Desktop: open a bridge session and get a token for the QR ──
export const createBridgeSession = mutation({
  args: {
    studentId: v.id("students"),
    label: v.optional(v.string()),
  },
  handler: async (ctx, { studentId, label }) => {
    const token = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("bridgeSessions", {
      token,
      studentId,
      label,
      status: "pending",
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    return { token };
  },
});

// ── Desktop: subscribe to a session by token (carries the image once uploaded) ──
export const getSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("bridgeSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return null;
    return {
      status: row.status,
      imageBase64: row.imageBase64 ?? null,
      imageMimeType: row.imageMimeType ?? null,
      expiresAt: row.expiresAt,
    };
  },
});

// ── Phone: validate the token. Deliberately returns NO image and NO studentId. ──
export const getPublicSession = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("bridgeSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) {
      return { found: false, status: "missing", label: null, expired: true };
    }
    return {
      found: true,
      status: row.status,
      label: row.label ?? null,
      expired: Date.now() > row.expiresAt,
    };
  },
});

// ── Phone: upload the compressed photo into the session ──
export const attachBridgeImage = mutation({
  args: {
    token: v.string(),
    imageBase64: v.string(),
    imageMimeType: v.string(),
  },
  handler: async (ctx, { token, imageBase64, imageMimeType }) => {
    const row = await ctx.db
      .query("bridgeSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) throw new Error("הקישור אינו תקין");
    if (Date.now() > row.expiresAt) throw new Error("הקישור פג תוקף");
    if (row.status !== "pending") throw new Error("כבר נשלחה תמונה דרך הקישור הזה");
    if (imageBase64.length > MAX_BASE64_CHARS) throw new Error("התמונה גדולה מדי");

    await ctx.db.patch(row._id, {
      status: "uploaded",
      imageBase64,
      imageMimeType,
    });
    return { ok: true };
  },
});

// ── Desktop: mark consumed and drop the image bytes once pulled into the chat ──
export const consumeSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("bridgeSessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return;
    await ctx.db.patch(row._id, {
      status: "consumed",
      imageBase64: undefined,
      imageMimeType: undefined,
    });
  },
});

// ── Cron: reclaim expired or consumed sessions ──
export const sweepExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("bridgeSessions").take(200);
    for (const row of rows) {
      if (now > row.expiresAt || row.status === "consumed") {
        await ctx.db.delete(row._id);
      }
    }
  },
});
