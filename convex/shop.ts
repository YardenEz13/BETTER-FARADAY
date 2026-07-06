import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Shop catalogue + ownership + balance for one student ──
export const getShop = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    const earned = student?.xp ?? 0;
    const spent = student?.xpSpent ?? 0;

    const items = await ctx.db
      .query("shopItems")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    items.sort((a, b) => a.sortOrder - b.sortOrder);

    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const ownedItemIds = new Set(purchases.map((p) => p.itemId));

    return {
      balance: earned - spent,
      earned,
      spent,
      items: items.map((it) => ({
        _id: it._id,
        name: it.name,
        description: it.description,
        icon: it.icon,
        category: it.category,
        price: it.price,
        // Consumables (streak_freeze) can be re-bought; others are one-time.
        owned: it.category !== "streak_freeze" && ownedItemIds.has(it._id),
      })),
    };
  },
});

// ── Purchase an item ──
export const purchaseItem = mutation({
  args: {
    studentId: v.id("students"),
    itemId: v.id("shopItems"),
  },
  handler: async (ctx, { studentId, itemId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const item = await ctx.db.get(itemId);
    if (!item || !item.active) throw new Error("Item not available");

    const isConsumable = item.category === "streak_freeze";

    // Non-consumables can't be bought twice.
    if (!isConsumable) {
      const existing = await ctx.db
        .query("purchases")
        .withIndex("by_student_item", (q) =>
          q.eq("studentId", studentId).eq("itemId", itemId),
        )
        .first();
      if (existing) throw new Error("Already owned");
    }

    const earned = student.xp ?? 0;
    const spent = student.xpSpent ?? 0;
    const balance = earned - spent;
    if (balance < item.price) throw new Error("Insufficient XP");

    await ctx.db.insert("purchases", {
      studentId,
      itemId,
      price: item.price,
      createdAt: Date.now(),
      consumed: isConsumable ? false : undefined,
    });

    // Increment the spent rollup and log a negative-amount xpEvent. The event
    // is inserted directly (NOT via awardXpHelper) — the helper also decrements
    // students.xp, which would double-charge since balance = xp - xpSpent.
    await ctx.db.patch(studentId, { xpSpent: spent + item.price });
    await ctx.db.insert("xpEvents", {
      studentId,
      amount: -item.price,
      reason: "purchase",
      refId: itemId,
      createdAt: Date.now(),
    });

    // Buying a streak freeze grants an available charge.
    if (isConsumable) {
      await ctx.db.patch(studentId, {
        streakFreezes: (student.streakFreezes ?? 0) + 1,
      });
    }

    return { balance: earned - (spent + item.price) };
  },
});

// ── Seed the shop catalogue (idempotent) ──
// No central seed.ts exists in this project, so the shop seeds itself. Run with
// `npx convex run shop:seedShop`.
const SHOP_ITEMS: Array<{
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  sortOrder: number;
}> = [
  { name: "אווטאר כחול חשמלי", description: "צבע אווטאר כחול זוהר", icon: "Palette", category: "avatar_color", price: 100, sortOrder: 1 },
  { name: "אווטאר סגול", description: "צבע אווטאר סגול מלכותי", icon: "Palette", category: "avatar_color", price: 100, sortOrder: 2 },
  { name: "אווטאר זהב", description: "צבע אווטאר זהב נדיר", icon: "Palette", category: "avatar_color", price: 250, sortOrder: 3 },
  { name: "הקפאת רצף", description: "שומרת על הרצף שלך ליום שהחמצת", icon: "Snowflake", category: "streak_freeze", price: 80, sortOrder: 4 },
  { name: "ערכת נושא לילה", description: "פותחת את מצב הלילה של האפליקציה", icon: "Moon", category: "theme", price: 300, sortOrder: 5 },
  { name: "ערכת נושא חשמלית", description: "רקע קווי-שדה חשמליים", icon: "Zap", category: "theme", price: 400, sortOrder: 6 },
  { name: "תג מתמטיקאי", description: "תג כבוד למי שפתר 100 שאלות", icon: "Award", category: "badge", price: 500, sortOrder: 7 },
  { name: "תג אלוף הרצף", description: "תג יוקרתי לשומרי רצף מתמידים", icon: "Flame", category: "badge", price: 600, sortOrder: 8 },
];

export const seedShop = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("shopItems").collect();
    const byName = new Set(existing.map((i) => i.name));
    let inserted = 0;
    for (const it of SHOP_ITEMS) {
      if (byName.has(it.name)) continue;
      await ctx.db.insert("shopItems", { ...it, active: true });
      inserted++;
    }
    return { inserted, total: existing.length + inserted };
  },
});
