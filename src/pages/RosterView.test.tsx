import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RosterView from "./RosterView";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * The roster exists to answer one question — does every student have a signed
 * consent form on file — so the tests are about that answer being honest:
 * a missing date must be visible, and a bad date must never reach the mutation.
 */

const mockAdd = vi.fn().mockResolvedValue("new-id");
let roster: Array<{ _id: string; name: string; avatarColor: string; consentOn?: string }> = [];

vi.mock("convex/react", () => ({
  useQuery: () => roster,
  useMutation: () => mockAdd,
}));
vi.mock("../../convex/_generated/api", () => ({
  api: { classroom: { getByClassroom: "getByClassroom", addStudent: "addStudent" } },
}));

/** The component only paints this into a swatch, so any CSS colour will do —
 *  and a token keeps the fixture out of design-lint's raw-hex ratchet. */
const SWATCH = "var(--color-primary)";

const CLASSROOM = "c1" as Id<"classrooms">;
const renderRoster = () => render(<RosterView classroomId={CLASSROOM} />);

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  mockAdd.mockClear();
  roster = [
    { _id: "s1", name: "בני", avatarColor: SWATCH, consentOn: "2026-09-01" },
    { _id: "s2", name: "אורי", avatarColor: SWATCH },
  ];
});

describe("RosterView", () => {
  it("shows the recorded consent date beside a student who has one", () => {
    renderRoster();
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
  });

  it("calls out a student with no consent date rather than hiding them", () => {
    renderRoster();
    expect(screen.getByText("אורי")).toBeInTheDocument();
    expect(screen.getByText("אין תאריך הסכמה")).toBeInTheDocument();
    // "תלמיד אחד", not "1 תלמידים" — studentCount handles Hebrew's dual form.
    expect(screen.getByText("חסר תאריך הסכמה ל־תלמיד אחד")).toBeInTheDocument();
  });

  it("says so plainly when every student is covered", () => {
    roster = [{ _id: "s1", name: "בני", avatarColor: SWATCH, consentOn: "2026-09-01" }];
    renderRoster();
    expect(screen.getByText(/לכל התלמידים רשום תאריך הסכמת הורים/)).toBeInTheDocument();
  });

  it("sorts the roster by name", () => {
    renderRoster();
    const names = screen.getAllByText(/^(בני|אורי)$/).map((n) => n.textContent);
    expect(names).toEqual(["אורי", "בני"]);
  });

  it("adds a student with a name and a consent date", async () => {
    renderRoster();
    fireEvent.change(screen.getByPlaceholderText("שם התלמיד/ה"), { target: { value: "דנה" } });
    fireEvent.change(screen.getByLabelText("תאריך הסכמת הורים"), { target: { value: today() } });
    fireEvent.click(screen.getByRole("button", { name: /הוספה/ }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith({
      classroomId: CLASSROOM, name: "דנה", consentOn: today(),
    }));
  });

  it("refuses a student with no consent date, without calling the server", async () => {
    renderRoster();
    fireEvent.change(screen.getByPlaceholderText("שם התלמיד/ה"), { target: { value: "דנה" } });
    fireEvent.click(screen.getByRole("button", { name: /הוספה/ }));
    expect(await screen.findByText(/תאריך הסכמת ההורים חסר או לא תקין/)).toBeInTheDocument();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("refuses a future consent date — nobody had a signed form in hand", async () => {
    renderRoster();
    fireEvent.change(screen.getByPlaceholderText("שם התלמיד/ה"), { target: { value: "דנה" } });
    fireEvent.change(screen.getByLabelText("תאריך הסכמת הורים"), { target: { value: tomorrow() } });
    fireEvent.click(screen.getByRole("button", { name: /הוספה/ }));
    expect(await screen.findByText(/לא יכול להיות בעתיד/)).toBeInTheDocument();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("trims the name rather than storing the whitespace", async () => {
    renderRoster();
    fireEvent.change(screen.getByPlaceholderText("שם התלמיד/ה"), { target: { value: "  דנה  " } });
    fireEvent.change(screen.getByLabelText("תאריך הסכמת הורים"), { target: { value: today() } });
    fireEvent.click(screen.getByRole("button", { name: /הוספה/ }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: "דנה" }),
    ));
  });

  it("surfaces a server rejection instead of silently doing nothing", async () => {
    mockAdd.mockRejectedValueOnce(new Error("תאריך הסכמת ההורים לא תקין"));
    renderRoster();
    fireEvent.change(screen.getByPlaceholderText("שם התלמיד/ה"), { target: { value: "דנה" } });
    fireEvent.change(screen.getByLabelText("תאריך הסכמת הורים"), { target: { value: today() } });
    fireEvent.click(screen.getByRole("button", { name: /הוספה/ }));
    expect(await screen.findByText("תאריך הסכמת ההורים לא תקין")).toBeInTheDocument();
  });
});
