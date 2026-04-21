import { mutation } from "./_generated/server";

export default mutation({
  args: {},
  handler: async (ctx) => {
    const t = await ctx.db.query("topics").collect();
    for (const d of t) await ctx.db.delete(d._id);
    const q = await ctx.db.query("questions").collect();
    for (const d of q) await ctx.db.delete(d._id);
    return t.length;
  },
});
