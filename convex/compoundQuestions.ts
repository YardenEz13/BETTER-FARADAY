import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// ── Get all compound questions (bounded) ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("compoundQuestions").take(50);
  },
});

// ── Signed URL for a compound question's scanned figure (packet import) ──
export const getFigureUrl = query({
  args: { id: v.id("compoundQuestions") },
  handler: async (ctx, { id }) => {
    const q = await ctx.db.get(id);
    if (!q?.figureImageStorageId) return null;
    return await ctx.storage.getUrl(q.figureImageStorageId);
  },
});

// ── Get compound questions that match any of the given topic IDs ──
// compoundQuestions store topicIds as an array, so there is no index to seek —
// fetch the (curated, small) set and filter. Shared with homework.ts's
// adaptive generator, which needs the same candidate list server-side.
// ponytail: bounded at 100 rows; add a by_topic join table if the bank grows.
export async function compoundQuestionsForTopics(
  ctx: QueryCtx,
  topicIds: Id<"topics">[],
): Promise<Doc<"compoundQuestions">[]> {
  const all = await ctx.db.query("compoundQuestions").take(100);
  const topicSet = new Set(topicIds.map((t) => t.toString()));
  return all.filter((q) => q.topicIds.some((tid) => topicSet.has(tid.toString())));
}

