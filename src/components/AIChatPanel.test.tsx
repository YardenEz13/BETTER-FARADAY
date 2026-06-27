import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AIChatPanel from "./AIChatPanel";

// Mock Convex React hooks
const mockStartChat = vi.fn().mockResolvedValue("mock-chat-123");
const mockAddMessage = vi.fn().mockResolvedValue("mock-msg-123");
const mockEndChat = vi.fn().mockResolvedValue(true);
const mockSyncMessages = vi.fn().mockResolvedValue(true);
const mockCreateBrief = vi.fn().mockResolvedValue(true);

vi.mock("convex/react", () => ({
  useMutation: (apiPath: string) => {
    if (apiPath.includes("startChat")) return mockStartChat;
    if (apiPath.includes("addMessage")) return mockAddMessage;
    if (apiPath.includes("endChat")) return mockEndChat;
    if (apiPath.includes("syncMessages")) return mockSyncMessages;
    if (apiPath.includes("createBrief")) return mockCreateBrief;
    return vi.fn();
  },
  useQuery: () => [],
}));

// Mock Convex api definition
vi.mock("../../convex/_generated/api", () => ({
  api: {
    aiChat: {
      startChat: "startChat",
      addMessage: "addMessage",
      endChat: "endChat",
      syncMessages: "syncMessages",
      getStudentChats: "getStudentChats",
    },
    sessionBriefs: {
      createBrief: "createBrief",
    },
  },
}));

// Mock localAI service
vi.mock("../services/localAI", () => ({
  isLocalAIAvailable: vi.fn().mockResolvedValue(true),
  getAIStatus: vi.fn().mockReturnValue("ready"),
  createSession: vi.fn().mockResolvedValue(true),
  destroySession: vi.fn(),
  streamMessage: vi.fn().mockResolvedValue("תשובה מנחה כלשהי מהמורה $x = 1$"),
  getMockResponse: vi.fn().mockReturnValue("תשובת מוק"),
  onModelProgress: vi.fn(),
  estimateTokens: vi.fn().mockReturnValue(10),
  heuristicSummary: vi.fn().mockReturnValue("סיכום שיחה"),
  isGPUMode: vi.fn().mockReturnValue(true),
  reinitSession: vi.fn().mockResolvedValue(true),
  onDebugUpdate: vi.fn().mockReturnValue(() => {}),
  analyzeConversation: vi.fn().mockResolvedValue({}),
  generateCompositeBrief: vi.fn().mockResolvedValue({}),
}));

// Mock chat storage to prevent actual IndexedDB access in UI test
vi.mock("../services/chatStorage", () => ({
  saveActiveSession: vi.fn().mockResolvedValue(true),
  getActiveSession: vi.fn().mockResolvedValue(null),
  clearActiveSession: vi.fn().mockResolvedValue(true),
  saveMessages: vi.fn().mockResolvedValue(true),
  getMessages: vi.fn().mockResolvedValue([]),
  debouncedSaveMessages: vi.fn(),
  flushAllPending: vi.fn(),
}));

describe("AIChatPanel Component", () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render anything when isOpen is false", () => {
    const { container } = render(
      <AIChatPanel
        isOpen={false}
        onClose={onCloseMock}
        studentId="student-1"
        agentType="practice"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render chat interface when isOpen is true", async () => {
    render(
      <AIChatPanel
        isOpen={true}
        onClose={onCloseMock}
        studentId="student-1"
        agentType="practice"
        topicName="סדרות"
      />
    );

    // Should display the tutor's name in the header
    const nameEls = await screen.findAllByText(/פרופסור פאראדיי/);
    expect(nameEls.length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should send message and display response", async () => {
    render(
      <AIChatPanel
        isOpen={true}
        onClose={onCloseMock}
        studentId="student-1"
        agentType="practice"
        topicName="סדרות"
      />
    );

    const inputEl = await screen.findByRole("textbox");
    const sendButton = screen.getByRole("button", { name: /שלח/ });

    // Type a message
    fireEvent.change(inputEl, { target: { value: "איך מתחילים?" } });
    expect(inputEl).toHaveValue("איך מתחילים?");

    // Click send
    fireEvent.click(sendButton);

    // Message input is cleared
    expect(inputEl).toHaveValue("");

    // Message should appear in chat
    expect(screen.getByText("איך מתחילים?")).toBeInTheDocument();
  });

  it("should trigger onClose when clicking close/minimize button", async () => {
    const { container } = render(
      <AIChatPanel
        isOpen={true}
        onClose={onCloseMock}
        studentId="student-1"
        agentType="practice"
      />
    );

    // Find the minimize button (ChevronDown, title="מזעור")
    await screen.findAllByText(/פרופסור פאראדיי/);
    const closeButton = container.querySelector('[title="מזעור"]') as HTMLButtonElement | null;
    expect(closeButton).toBeDefined();

    fireEvent.click(closeButton!);

    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });
});

