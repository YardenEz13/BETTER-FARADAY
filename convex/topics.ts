import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("topics").order("asc").collect();
  },
});

export const get = query({
  args: { id: v.id("topics") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});
