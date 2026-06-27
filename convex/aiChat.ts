import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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
      missingKnowledge: v.optional(v.array(v.string())),
      teacherActionItem: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { chatId, metrics }) => {
    const existing = await ctx.db.get(chatId);
    if (!existing) return;

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

// ── Recent chats WITH their full message threads (for the teacher profile) ──
export const getRecentChatsWithMessages = query({
  args: { studentId: v.id("students"), limit: v.optional(v.number()) },
  handler: async (ctx, { studentId, limit }) => {
    const chats = await ctx.db
      .query("aiChats")
      .withIndex("by_student", (q) => q.eq("studentId", studentId))
      .order("desc")
      .take(limit ?? 5);

    const result = [];
    for (const chat of chats) {
      const messages = await ctx.db
        .query("aiMessages")
        .withIndex("by_chat", (q) => q.eq("chatId", chat._id))
        .order("asc")
        .collect();
      const topic = chat.topicId ? await ctx.db.get(chat.topicId) : null;
      result.push({
        _id: chat._id,
        title: chat.title,
        agentType: chat.agentType,
        startedAt: chat.startedAt,
        endedAt: chat.endedAt,
        messageCount: chat.messageCount,
        topicName: topic ? ((topic as any).nameHe || (topic as any).name) : null,
        sentiment: chat.metrics?.sentiment ?? null,
        confusionScore: chat.metrics?.confusionScore ?? null,
        keyStrugglePoints: chat.metrics?.keyStrugglePoints ?? [],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      });
    }
    return result;
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

// ── Delete a chat (hard delete — teacher action) ──
export const deleteChat = mutation({
  args: { chatId: v.id("aiChats") },
  handler: async (ctx, { chatId }) => {
    // 1. Delete all messages
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    // 2. Delete associated session brief (if any)
    const brief = await ctx.db
      .query("sessionBriefs")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .first();
    if (brief) {
      await ctx.db.delete(brief._id);
    }

    // 3. Delete the chat itself
    await ctx.db.delete(chatId);
  },
});

// ── Background Cleanup: Find and delete empty, or return abandoned chats ──
export const findChatsToCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;

    // Get all chats that haven't ended
    // We don't have an index on endedAt=undefined, so we just query all and filter,
    // or better, order by desc and take a reasonable chunk to process periodically.
    const activeChats = await ctx.db
      .query("aiChats")
      .order("desc")
      .take(500); // look at the last 500 chats

    const toProcess: any[] = [];
    let deletedCount = 0;

    for (const chat of activeChats) {
      if (chat.endedAt) continue;

      const age = now - chat.startedAt;

      // Rule 1: Empty chats older than 30 minutes -> delete
      if (chat.messageCount === 0 && age > THIRTY_MINUTES) {
        await ctx.db.delete(chat._id);
        deletedCount++;
        continue;
      }

      // Rule 2: Abandoned chats (has messages, open for > 1 hour) -> return for AI processing
      if (chat.messageCount > 0 && age > ONE_HOUR) {
        toProcess.push(chat);
      }
    }

    // Build processing payloads with question context
    const chatsToProcess = [];
    for (const c of toProcess) {
      let contextStr = "";
      if (c.questionId) {
        const question = await ctx.db.get(c.questionId as any);
        if (question && (question as any).stem) {
          contextStr = `שאלה: ${(question as any).stem}`;
        }
      } else if (c.topicId) {
        const topic = await ctx.db.get(c.topicId as any);
        if (topic && (topic as any).name) {
          contextStr = `נושא: ${(topic as any).name}`;
        }
      }

      chatsToProcess.push({
        chatId: c._id,
        agentType: c.agentType,
        context: contextStr,
      });
    }

    return {
      deletedCount,
      chatsToProcess,
    };
  },
});

// ── Internal Wrappers for Background Actions ──
export const getChatMessagesForAnalysis = internalQuery({
  args: { chatId: v.id("aiChats") },
  handler: async (ctx, { chatId }) => {
    return await ctx.db
      .query("aiMessages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc")
      .collect();
  },
});

export const endChatInternal = internalMutation({
  args: {
    chatId: v.id("aiChats"),
    metrics: v.object({
      confusionScore: v.number(),
      topicsCovered: v.array(v.string()),
      questionsAsked: v.number(),
      avgResponseLength: v.number(),
      sentiment: v.string(),
      keyStrugglePoints: v.array(v.string()),
      engagementScore: v.optional(v.number()),
      progressionSignal: v.optional(v.string()),
      conceptMentions: v.optional(v.array(v.string())),
      totalDurationMs: v.optional(v.number()),
      questionDepth: v.optional(v.number()),
      independenceRatio: v.optional(v.number()),
      gemmaAnalysisSummary: v.optional(v.string()),
      missingKnowledge: v.optional(v.array(v.string())),
      teacherActionItem: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { chatId, metrics }) => {
    const existing = await ctx.db.get(chatId);
    if (!existing) return;

    await ctx.db.patch(chatId, {
      endedAt: Date.now(),
      metrics,
    });
  },
});
