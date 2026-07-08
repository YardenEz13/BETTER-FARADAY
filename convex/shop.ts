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

    const equippedTheme = student?.equippedTheme ?? null;
    const avatarColor = student?.avatarColor ?? null;

    return {
      balance: earned - spent,
      earned,
      spent,
      items: items.map((it) => {
        const owned = it.category !== "streak_freeze" && ownedItemIds.has(it._id);
        // An equippable item reads as "equipped" when the student's active state
        // matches its payload: avatar color = the current avatarColor, theme =
        // the current equippedTheme key.
        const equipped =
          owned &&
          ((it.category === "avatar_color" && !!it.value && it.value === avatarColor) ||
            (it.category === "theme" && !!it.value && it.value === equippedTheme));
        return {
          _id: it._id,
          name: it.name,
          description: it.description,
          icon: it.icon,
          category: it.category,
          price: it.price,
          value: it.value ?? null,
          // Consumables (streak_freeze) can be re-bought; others are one-time.
          owned,
          equipped,
        };
      }),
    };
  },
});

// ── Owned badges only (light query for the StudentHome showcase) ──
export const getOwnedBadges = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .collect();
    const badges: Array<{ _id: string; name: string; icon: string }> = [];
    for (const p of purchases) {
      const item = await ctx.db.get(p.itemId);
      if (item && item.category === "badge") {
        badges.push({ _id: item._id, name: item.name, icon: item.icon });
      }
    }
    return badges;
  },
});

// ── Equip an owned avatar-color or theme item ──
export const equipItem = mutation({
  args: {
    studentId: v.id("students"),
    itemId: v.id("shopItems"),
  },
  handler: async (ctx, { studentId, itemId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");

    const item = await ctx.db.get(itemId);
    if (!item) throw new Error("Item not available");

    if (item.category !== "avatar_color" && item.category !== "theme") {
      throw new Error("Item is not equippable");
    }

    // Must own the item.
    const owned = await ctx.db
      .query("purchases")
      .withIndex("by_student_item", (q) =>
        q.eq("studentId", studentId).eq("itemId", itemId),
      )
      .first();
    if (!owned) throw new Error("Not owned");

    if (!item.value) throw new Error("Item has no equippable value");

    if (item.category === "avatar_color") {
      await ctx.db.patch(studentId, { avatarColor: item.value });
    } else {
      await ctx.db.patch(studentId, { equippedTheme: item.value });
    }
    return { ok: true };
  },
});

// ── Revert the learning-map backdrop to the default (no theme) ──
export const unequipTheme = mutation({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    await ctx.db.patch(studentId, { equippedTheme: undefined });
    return { ok: true };
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
  value?: string;
}> = [
  // avatar_color values are CSS colors matching AVATAR_COLORS in classroom.ts —
  // they get written straight into students.avatarColor.
  { name: "אווטאר כחול חשמלי", description: "צבע אווטאר כחול זוהר", icon: "Palette", category: "avatar_color", price: 100, sortOrder: 1, value: "#3b82f6" },
  { name: "אווטאר סגול", description: "צבע אווטאר סגול מלכותי", icon: "Palette", category: "avatar_color", price: 100, sortOrder: 2, value: "#8b5cf6" },
  { name: "אווטאר זהב", description: "צבע אווטאר זהב נדיר", icon: "Palette", category: "avatar_color", price: 250, sortOrder: 3, value: "#f59e0b" },
  { name: "הקפאת רצף", description: "שומרת על הרצף שלך ליום שהחמצת", icon: "Snowflake", category: "streak_freeze", price: 80, sortOrder: 4 },
  // Dark mode is FREE — this item is now a cosmetic starfield backdrop for the map.
  { name: "ערכת נושא לילה", description: "רקע שמי לילה זרועי כוכבים למפת הלמידה", icon: "Moon", category: "theme", price: 300, sortOrder: 5, value: "night" },
  { name: "ערכת נושא חשמלית", description: "רקע קווי-שדה חשמליים מוגברים למפת הלמידה", icon: "Zap", category: "theme", price: 400, sortOrder: 6, value: "electric" },
  { name: "תג מתמטיקאי", description: "תג כבוד למי שפתר 100 שאלות", icon: "Award", category: "badge", price: 500, sortOrder: 7 },
  { name: "תג אלוף הרצף", description: "תג יוקרתי לשומרי רצף מתמידים", icon: "Flame", category: "badge", price: 600, sortOrder: 8 },
];

export const seedShop = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("shopItems").collect();
    const byName = new Map(existing.map((i) => [i.name, i]));
    let inserted = 0;
    let updated = 0;
    for (const it of SHOP_ITEMS) {
      const row = byName.get(it.name);
      if (!row) {
        await ctx.db.insert("shopItems", { ...it, value: it.value, active: true });
        inserted++;
        continue;
      }
      // Idempotent upsert: refresh value + description on the live catalogue so
      // re-running fixes rows seeded before the equip system existed.
      if (row.value !== it.value || row.description !== it.description) {
        await ctx.db.patch(row._id, { value: it.value, description: it.description });
        updated++;
      }
    }
    return { inserted, updated, total: existing.length + inserted };
  },
});
