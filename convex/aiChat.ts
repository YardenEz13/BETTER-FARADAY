import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Start a new chat session ──
export const startChat = mutation({
  args: {
    studentId: v.id("students"),
    agentType: v.string(),
    topicId: v.optional(v.id("topics")),
    questionId: v.optional(v.id("questions")),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const chatId = await ctx.db.insert("aiChats", {
      studentId: args.studentId,
      agentType: args.agentType,
      topicId: args.topicId,
      questionId: args.questionId,
      title: args.title,
      startedAt: Date.now(),
      messageCount: 0,
    });
    return chatId;
  },
});

// ── Add a message to an existing chat ──
export const addMessage = mutation({
  args: {
    chatId: v.id("aiChats"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { chatId, role, content }) => {
    await ctx.db.insert("aiMessages", {
      chatId,
      role,
      content,
      timestamp: Date.now(),
    });
    // Increment message count
    const chat = await ctx.db.get(chatId);
    if (chat) {
      await ctx.db.patch(chatId, { messageCount: chat.messageCount + 1 });
    }
  },
});

// ── Sync multiple messages at once (for offline queue) ──
export const syncMessages = mutation({
  args: {
    messages: v.array(v.object({
      chatId: v.id("aiChats"),
      role: v.string(),
      content: v.string(),
      timestamp: v.number(),
    })),
  },
  handler: async (ctx, { messages }) => {
    for (const msg of messages) {
      await ctx.db.insert("aiMessages", msg);
      const chat = await ctx.db.get(msg.chatId);
      if (chat) {
        await ctx.db.patch(msg.chatId, { messageCount: chat.messageCount + 1 });
      }
    }
  },
});

// ── End a chat with computed metrics ──
export const endChat = mutation({
  args: {
    chatId: v.id("aiChats"),
    metrics: v.optional(v.object({
      confusionScore: v.number(),
      topicsCovered: v.array(v.string()),
      questionsAsked: v.number(),
      avgResponseLength: v.number(),
      sentiment: v.string(),
      keyStrugglePoints: v.array(v.string()),
      // Gemma-enhanced fields
      engagementScore: v.optional(v.number()),
      progressionSignal: v.optional(v.string()),
      conceptMentions: v.optional(v.array(v.string())),
      totalDurationMs: v.optional(v.number()),
      questionDepth: v.optional(v.number()),
      independenceRatio: v.optional(v.number()),
      gemmaAnalysisSummary: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { chatId, metrics }) => {
    await ctx.db.patch(chatId, {
      endedAt: Date.now(),
      metrics,
    });
  },
});

// ── Get all chats for a student ──
export const getStudentChats = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, { studentId }) => {
    return await ctx.db
      .query("aiChats")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(50);
  },
});

// ── Get the most recent open (resumable) chat for a student+agent ──
export const getActiveChat = query({
  args: {
    studentId: v.id("students"),
    agentType: v.string(),
  },
  handler: async (ctx, { studentId, agentType }) => {
    const chat = await ctx.db
      .query("aiChats")
      .withIndex("by_student_agent", (q) =>
        q.eq("studentId", studentId).eq("agentType", agentType)
      )
      .order("desc")
      .first();

    if (!chat || chat.endedAt) return null;

    // Only resume if within last 4 hours
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    if (chat.startedAt < fourHoursAgo) return null;

    return chat;
  },
});

// ── Get messages for a specific chat ──
export const getChatMessages = query({
  args: { chatId: v.id("aiChats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("aiMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();
  },
});

// ── Teacher analytics: all chats across a classroom ──
export const getTeacherChatAnalytics = query({
  args: { classroomId: v.id("classrooms") },
  handler: async (ctx, { classroomId }) => {
    // Get all students in classroom
    const students = await ctx.db
      .query("students")
      .withIndex("by_classroom", (q) => q.eq("classroomId", classroomId))
      .collect();

    const studentIds = new Set(students.map((s) => s._id));
    const allChats = [];

    for (const student of students) {
      const chats = await ctx.db
        .query("aiChats")
        .withIndex("by_student", (q) => q.eq("studentId", student._id))
        .order("desc")
        .take(20);

      for (const chat of chats) {
        allChats.push({
          ...chat,
          studentName: student.name,
          studentAvatar: student.avatarColor,
        });
      }
    }

    // Sort by most recent
    allChats.sort((a, b) => b.startedAt - a.startedAt);

    // Compute aggregated metrics
    const chatsWithMetrics = allChats.filter((c) => c.metrics);
    const avgConfusion = chatsWithMetrics.length > 0
      ? Math.round(chatsWithMetrics.reduce((s, c) => s + (c.metrics?.confusionScore ?? 0), 0) / chatsWithMetrics.length)
      : 0;

    const sentimentCounts = { frustrated: 0, neutral: 0, confident: 0 };
    for (const c of chatsWithMetrics) {
      const s = c.metrics?.sentiment as keyof typeof sentimentCounts;
      if (s in sentimentCounts) sentimentCounts[s]++;
    }

    // Collect all struggle points
    const struggleMap: Record<string, number> = {};
    for (const c of chatsWithMetrics) {
      for (const point of c.metrics?.keyStrugglePoints ?? []) {
        struggleMap[point] = (struggleMap[point] || 0) + 1;
      }
    }
    const topStruggles = Object.entries(struggleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([point, count]) => ({ point, count }));

    return {
      chats: allChats.slice(0, 50),
      summary: {
        totalChats: allChats.length,
        avgConfusion,
        sentimentCounts,
        topStruggles,
        totalMessages: allChats.reduce((s, c) => s + c.messageCount, 0),
      },
    };
  },
});
