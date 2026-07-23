import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Category behaviour, in one place ──
// Consumables can be re-bought forever and grant a charge instead of an
// "owned" flag. Everything else is a one-time purchase; the equippables among
// them write their `value` into a student field (see equipPatch).
const CONSUMABLE = new Set(["streak_freeze", "xp_boost"]);

const XP_BOOST_DEFAULT_HOURS = 24;

type EquipPatch =
  | { avatarColor: string }
  | { equippedTheme: string | undefined }
  | { equippedTitle: string | undefined };

/** The student patch that equips (value) or unequips (undefined) a category,
 *  or null when the category isn't equippable at all. Single source of truth
 *  for "can this be equipped" across getShop / equipItem / unequipItem. */
function equipPatch(category: string, value: string | undefined): EquipPatch | null {
  switch (category) {
    // avatarColor is a required field — there is always one active, so it can
    // be swapped but never cleared.
    case "avatar_color": return value ? { avatarColor: value } : null;
    case "theme": return { equippedTheme: value };
    case "title": return { equippedTitle: value };
    default: return null;
  }
}

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

    // An equippable item reads as "equipped" when the student's active state
    // for that category matches its payload.
    const activeValue: Record<string, string | null | undefined> = {
      avatar_color: student?.avatarColor,
      theme: student?.equippedTheme,
      title: student?.equippedTitle,
    };

    return {
      balance: earned - spent,
      earned,
      spent,
      // Live consumable state, so the shop can show what a charge is worth
      // instead of a vague "you have some".
      freezes: student?.streakFreezes ?? 0,
      boostUntil: student?.xpBoostUntil ?? null,
      items: items.map((it) => {
        const consumable = CONSUMABLE.has(it.category);
        const owned = !consumable && ownedItemIds.has(it._id);
        return {
          _id: it._id,
          name: it.name,
          description: it.description,
          icon: it.icon,
          category: it.category,
          price: it.price,
          value: it.value ?? null,
          consumable,
          equippable: equipPatch(it.category, it.value) !== null,
          owned,
          equipped: owned && !!it.value && activeValue[it.category] === it.value,
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
    const badges: Array<{ _id: string; name: string; icon: string; price: number }> = [];
    for (const p of purchases) {
      const item = await ctx.db.get(p.itemId);
      if (item && item.category === "badge") {
        // price drives the client-side rarity tier (see src/lib/rewardTier.ts)
        badges.push({ _id: item._id, name: item.name, icon: item.icon, price: item.price });
      }
    }
    return badges;
  },
});

// ── The equipped title, resolved to its shop-item metadata (icon + price) ──
// students.equippedTitle stores only the display text; the header needs the
// item's price to pick a rarity tier and its icon for the pill glyph.
export const getEquippedTitle = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    const student = await ctx.db.get(studentId);
    const text = student?.equippedTitle;
    if (!text) return null;
    // Titles are a small catalogue; match the active item by its `value`.
    const items = await ctx.db
      .query("shopItems")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const item = items.find((it) => it.category === "title" && it.value === text);
    return { text, icon: item?.icon ?? "star", price: item?.price ?? 0 };
  },
});

// ── Equip an owned avatar-color / theme / title item ──
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
    if (!item.value) throw new Error("Item has no equippable value");

    const patch = equipPatch(item.category, item.value);
    if (!patch) throw new Error("Item is not equippable");

    // Must own the item.
    const owned = await ctx.db
      .query("purchases")
      .withIndex("by_student_item", (q) =>
        q.eq("studentId", studentId).eq("itemId", itemId),
      )
      .first();
    if (!owned) throw new Error("Not owned");

    await ctx.db.patch(studentId, patch);
    return { ok: true };
  },
});

// ── Take an equipped cosmetic back off (themes and titles; see equipPatch) ──
export const unequipItem = mutation({
  args: { studentId: v.id("students"), category: v.string() },
  handler: async (ctx, { studentId, category }) => {
    const student = await ctx.db.get(studentId);
    if (!student) throw new Error("Student not found");
    const patch = equipPatch(category, undefined);
    if (!patch) throw new Error("Category cannot be unequipped");
    await ctx.db.patch(studentId, patch);
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

    const isConsumable = CONSUMABLE.has(item.category);

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

    const now = Date.now();
    await ctx.db.insert("purchases", {
      studentId,
      itemId,
      price: item.price,
      createdAt: now,
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
      createdAt: now,
    });

    // Consumables grant their charge on purchase.
    if (item.category === "streak_freeze") {
      await ctx.db.patch(studentId, {
        streakFreezes: (student.streakFreezes ?? 0) + 1,
      });
    } else if (item.category === "xp_boost") {
      // Duration lives in the item's `value` (hours), so a longer boost is a
      // catalogue row rather than code. Buying while one is running extends it.
      const hours = Number(item.value) || XP_BOOST_DEFAULT_HOURS;
      const from = Math.max(now, student.xpBoostUntil ?? 0);
      await ctx.db.patch(studentId, { xpBoostUntil: from + hours * 3_600_000 });
    }

    return { balance: earned - (spent + item.price) };
  },
});

// ── Seed the shop catalogue (idempotent) ──
// No central seed.ts exists in this project, so the shop seeds itself. Run with
// `npx convex run shop:seedShop`.
// `icon` is an ELECTRIC_ICONS registry key (case-insensitive) — anything else
// renders as a generic reward glyph in the shop grid.
const SHOP_ITEMS: Array<{
  name: string;
  description: string;
  icon: string;
  category: string;
  price: number;
  sortOrder: number;
  value?: string;
}> = [
  // ── Avatar colours — the value is a CSS color matching AVATAR_COLORS in
  // classroom.ts; it gets written straight into students.avatarColor.
  { name: "אווטאר כחול חשמלי", description: "צבע אווטאר כחול זוהר", icon: "palette", category: "avatar_color", price: 100, sortOrder: 1, value: "#3b82f6" },
  { name: "אווטאר סגול", description: "צבע אווטאר סגול מלכותי", icon: "palette", category: "avatar_color", price: 100, sortOrder: 2, value: "#8b5cf6" },
  { name: "אווטאר ורוד", description: "צבע אווטאר ורוד נועז", icon: "palette", category: "avatar_color", price: 120, sortOrder: 3, value: "#ec4899" },
  { name: "אווטאר טורקיז", description: "צבע אווטאר טורקיז רענן", icon: "palette", category: "avatar_color", price: 120, sortOrder: 4, value: "#06b6d4" },
  { name: "אווטאר ירוק ניאון", description: "צבע אווטאר ירוק זורם", icon: "palette", category: "avatar_color", price: 150, sortOrder: 5, value: "#10b981" },
  { name: "אווטאר כתום להבה", description: "צבע אווטאר כתום בוער", icon: "palette", category: "avatar_color", price: 150, sortOrder: 6, value: "#f97316" },
  { name: "אווטאר אדום מגנטי", description: "צבע אווטאר אדום עז", icon: "palette", category: "avatar_color", price: 200, sortOrder: 7, value: "#ef4444" },
  { name: "אווטאר זהב", description: "צבע אווטאר זהב נדיר", icon: "palette", category: "avatar_color", price: 250, sortOrder: 8, value: "#f59e0b" },

  // ── Map backdrops — value is the FaradayCanvas variant applied to the
  // learning map ("night" additionally layers the starfield).
  { name: "ערכת נושא לילה", description: "רקע שמי לילה זרועי כוכבים למפת הלמידה", icon: "moon", category: "theme", price: 300, sortOrder: 20, value: "night" },
  { name: "ערכת נושא חשמלית", description: "רקע קווי-שדה חשמליים מוגברים למפת הלמידה", icon: "zap", category: "theme", price: 400, sortOrder: 21, value: "electric" },
  { name: "קונסטלציה", description: "רשת כוכבים מתחברת שנעה עם הסמן", icon: "sparkles", category: "theme", price: 450, sortOrder: 22, value: "constellation" },
  { name: "מסלולי אלקטרונים", description: "אטומי בוהר מרחפים ברקע המפה", icon: "atom", category: "theme", price: 500, sortOrder: 23, value: "atom" },
  { name: "השראה אלקטרומגנטית", description: "סליל וזרם מושרה — הניסוי של פאראדיי", icon: "inductor", category: "theme", price: 600, sortOrder: 24, value: "induction" },
  { name: "כלוב פאראדיי", description: "כלוב מגן שסופג פריקות חשמל", icon: "shield", category: "theme", price: 750, sortOrder: 25, value: "cage" },
  { name: "אפקט פאראדיי", description: "סרטי קיטוב מסתובבים — הנדיר בערכות", icon: "lens", category: "theme", price: 1000, sortOrder: 26, value: "effect" },

  // ── Titles — value is the Hebrew text shown beside the student's name.
  { name: "תואר: מתחיל נמרץ", description: "תואר שמוצג ליד השם שלך", icon: "user", category: "title", price: 150, sortOrder: 40, value: "מתחיל נמרץ" },
  { name: "תואר: מהנדס זרם", description: "תואר שמוצג ליד השם שלך", icon: "circuit", category: "title", price: 300, sortOrder: 41, value: "מהנדס זרם" },
  { name: "תואר: צייד נגזרות", description: "תואר שמוצג ליד השם שלך", icon: "sigma", category: "title", price: 450, sortOrder: 42, value: "צייד נגזרות" },
  { name: "תואר: מכשף המשוואות", description: "תואר שמוצג ליד השם שלך", icon: "calculator", category: "title", price: 650, sortOrder: 43, value: "מכשף המשוואות" },
  { name: "תואר: אלוף המתכונת", description: "תואר שמוצג ליד השם שלך", icon: "graduationCap", category: "title", price: 850, sortOrder: 44, value: "אלוף המתכונת" },
  { name: "תואר: מוח על", description: "התואר היוקרתי ביותר בחנות", icon: "trophy", category: "title", price: 1500, sortOrder: 45, value: "מוח על" },

  // ── Consumables ──
  { name: "הקפאת רצף", description: "שומרת על הרצף שלך ליום שהחמצת", icon: "shield", category: "streak_freeze", price: 80, sortOrder: 60 },
  { name: "מגבר אנרגיה 24 שעות", description: "כל הנקודות שתרוויח נכפלות ב-2 ליממה", icon: "battery", category: "xp_boost", price: 200, sortOrder: 61, value: "24" },
  { name: "מגבר אנרגיה לשבוע", description: "כפול נקודות במשך שבוע שלם", icon: "capacitor", category: "xp_boost", price: 1000, sortOrder: 62, value: "168" },

  // ── Badges (pure display, shown beside the name on the map) ──
  { name: "תג מתמטיקאי", description: "תג כבוד למי שפתר 100 שאלות", icon: "trophy", category: "badge", price: 500, sortOrder: 80 },
  { name: "תג אלוף הרצף", description: "תג יוקרתי לשומרי רצף מתמידים", icon: "flame", category: "badge", price: 600, sortOrder: 81 },
  { name: "תג ברק", description: "לפותרים המהירים בכיתה", icon: "bolt", category: "badge", price: 400, sortOrder: 82 },
  { name: "תג חוקר", description: "למי ששואל את פאראדיי בלי הפסקה", icon: "lens", category: "badge", price: 450, sortOrder: 83 },
  { name: "תג ללא טעויות", description: "לדיוק שלא מתפשר", icon: "target", category: "badge", price: 800, sortOrder: 84 },
  { name: "תג אגדה", description: "התג הנדיר ביותר בחנות", icon: "star", category: "badge", price: 2000, sortOrder: 85 },
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
      // Idempotent upsert: this list is the source of truth for everything but
      // the row id, so re-running fixes rows seeded by an older catalogue.
      const changed =
        row.value !== it.value || row.description !== it.description ||
        row.icon !== it.icon || row.price !== it.price ||
        row.category !== it.category || row.sortOrder !== it.sortOrder;
      if (changed) {
        await ctx.db.patch(row._id, { ...it, value: it.value });
        updated++;
      }
    }
    return { inserted, updated, total: existing.length + inserted };
  },
});
