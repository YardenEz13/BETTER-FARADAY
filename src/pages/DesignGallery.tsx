import { useState } from "react";
import { Trash2, Plus, Zap, Inbox, Settings } from "../components/electric";
import {
  ClayButton,
  ClayCard,
  Chip,
  SegTabs,
  Field,
  FieldTextarea,
  Badge,
  Stat,
  ProgressBar,
  EmptyState,
  Skeleton,
  SkeletonCard,
  BottomSheet,
  Modal,
  ToastStack,
  useToasts,
  type BadgeTone,
  type StatTone,
  type ModalTone,
} from "../components/ui";
import { useTheme } from "../components/ThemeContext";

/**
 * /design — internal, dev-only living styleguide. Renders every ui/
 * primitive in its variants/sizes/states, plus the type scale and color
 * tokens. Not linked from the app; registered only when import.meta.env.DEV.
 */

const BADGE_TONES: BadgeTone[] = ["primary", "secondary", "tertiary", "error", "neutral"];
const STAT_TONES: StatTone[] = ["default", "primary", "secondary", "tertiary", "error"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-headline-md text-on-surface font-extrabold border-b-2 border-outline pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label-mono text-on-surface-variant">{label}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`w-full h-16 rounded-xl border-2 border-outline ${className}`} />
      <span className="text-label-md text-on-surface-variant font-mono">{name}</span>
    </div>
  );
}

export default function DesignGallery() {
  const { theme, toggleTheme } = useTheme();
  const [segValue, setSegValue] = useState<"a" | "b" | "c">("a");
  const [chipSelected, setChipSelected] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [modalTone, setModalTone] = useState<ModalTone | null>(null);
  const { toasts, push, dismiss } = useToasts();

  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-background py-10">
      <div className="page-shell page-shell--wide flex flex-col gap-12">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-headline-xl font-extrabold">Faraday Logic — Design Gallery</h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              עמוד פנימי (dev-only) לכל רכיבי ה-ui/ במערכת העיצוב.
            </p>
          </div>
          <ClayButton variant="ghost" onClick={toggleTheme}>
            {theme === "dark" ? "מצב יום ☀️" : "מצב לילה 🌙"}
          </ClayButton>
        </header>

        {/* ── Color tokens ── */}
        <Section title="Color Tokens">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <ColorSwatch name="primary" className="bg-primary" />
            <ColorSwatch name="primary-container" className="bg-primary-container" />
            <ColorSwatch name="secondary" className="bg-secondary" />
            <ColorSwatch name="secondary-container" className="bg-secondary-container" />
            <ColorSwatch name="tertiary" className="bg-tertiary" />
            <ColorSwatch name="tertiary-container" className="bg-tertiary-container" />
            <ColorSwatch name="error" className="bg-error" />
            <ColorSwatch name="error-container" className="bg-error-container" />
            <ColorSwatch name="background" className="bg-background" />
            <ColorSwatch name="surface" className="bg-surface" />
            <ColorSwatch name="surface-container-low" className="bg-surface-container-low" />
            <ColorSwatch name="surface-container-high" className="bg-surface-container-high" />
          </div>
        </Section>

        {/* ── Type scale ── */}
        <Section title="Type Scale">
          <div className="flex flex-col gap-3">
            {[
              "text-headline-xl",
              "text-headline-lg",
              "text-headline-md",
              "text-headline-sm",
              "text-body-lg",
              "text-body-md",
              "text-body-sm",
              "text-label-lg",
              "text-label-md",
              "text-label-sm",
            ].map((cls) => (
              <div key={cls} className="flex items-baseline gap-4">
                <span className="w-40 shrink-0 font-mono text-label-md text-on-surface-variant">{cls}</span>
                <span className={cls}>אלקטרון זורם במעגל — Faraday</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── ClayButton ── */}
        <Section title="ClayButton">
          {(["primary", "secondary", "ghost", "icon"] as const).map((variant) => (
            <Row key={variant} label={`variant="${variant}"`}>
              {(["sm", "md", "lg"] as const).map((size) => (
                <ClayButton key={size} variant={variant} size={size}>
                  {variant === "icon" ? <Plus size={18} /> : `${variant} / ${size}`}
                </ClayButton>
              ))}
              <ClayButton variant={variant} loading>
                {variant === "icon" ? undefined : "loading"}
              </ClayButton>
              <ClayButton variant={variant} disabled>
                {variant === "icon" ? <Trash2 size={18} /> : "disabled"}
              </ClayButton>
            </Row>
          ))}
        </Section>

        {/* ── ClayCard ── */}
        <Section title="ClayCard">
          <Row label="padding">
            {(["none", "sm", "md", "lg"] as const).map((padding) => (
              <ClayCard key={padding} padding={padding} className="w-40">
                <span className="text-body-sm">padding=&quot;{padding}&quot;</span>
              </ClayCard>
            ))}
            <ClayCard interactive className="w-40">
              <span className="text-body-sm">interactive</span>
            </ClayCard>
          </Row>
        </Section>

        {/* ── Chip ── */}
        <Section title="Chip">
          <Row label="states">
            <Chip>ברירת מחדל</Chip>
            <Chip selected={chipSelected} onClick={() => setChipSelected((v) => !v)}>
              {chipSelected ? "נבחר" : "לחץ לבחירה"}
            </Chip>
            <Chip icon={<Zap size={14} />}>עם אייקון</Chip>
            <Chip icon={<Zap size={14} />} selected>
              נבחר + אייקון
            </Chip>
          </Row>
        </Section>

        {/* ── SegTabs ── */}
        <Section title="SegTabs">
          <Row label="controlled example">
            <SegTabs
              label="דוגמת טאבים"
              value={segValue}
              onChange={setSegValue}
              tabs={[
                { id: "a", label: "טאב א׳" },
                { id: "b", label: "טאב ב׳", icon: <Zap size={14} /> },
                { id: "c", label: "טאב ג׳" },
              ]}
            />
            <span className="text-body-sm text-on-surface-variant">נבחר: {segValue}</span>
          </Row>
        </Section>

        {/* ── Field ── */}
        <Section title="Field / FieldTextarea">
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <Field label="שם" placeholder="הקלד/י שם" hint="שדה רגיל עם רמז" />
            <Field label="אימייל" placeholder="name@example.com" error="כתובת אימייל לא תקינה" />
            <FieldTextarea label="הערות" placeholder="כתוב/י כאן..." hint="שדה טקסט חופשי" className="sm:col-span-2" />
          </div>
        </Section>

        {/* ── Badge ── */}
        <Section title="Badge">
          <Row label="tones">
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </Row>
        </Section>

        {/* ── Stat ── */}
        <Section title="Stat">
          <Row label="size=&quot;md&quot;">
            {STAT_TONES.map((tone) => (
              <Stat key={tone} tone={tone} value="128" label={tone} icon={<Zap size={16} />} />
            ))}
          </Row>
          <Row label="size=&quot;lg&quot;">
            {STAT_TONES.map((tone) => (
              <Stat key={tone} tone={tone} size="lg" value="4,290" label={tone} />
            ))}
          </Row>
        </Section>

        {/* ── ProgressBar ── */}
        <Section title="ProgressBar">
          <Row label="variants (size=md)">
            <div className="w-52"><ProgressBar value={72} variant="primary" label="primary" /></div>
            <div className="w-52"><ProgressBar value={45} variant="gradient" label="gradient" /></div>
            <div className="w-52"><ProgressBar value={90} variant="tertiary" label="tertiary" /></div>
          </Row>
          <Row label="current (electric, XP/level)">
            <div className="w-52"><ProgressBar value={64} variant="current" label="current" /></div>
            <div className="w-52"><ProgressBar value={100} variant="current" label="current full (spark)" /></div>
          </Row>
          <Row label="size=&quot;sm&quot;">
            <div className="w-52"><ProgressBar value={60} size="sm" label="small" /></div>
          </Row>
          <Row label="custom color">
            <div className="w-52"><ProgressBar value={33} color="var(--color-secondary)" label="custom" /></div>
          </Row>
        </Section>

        {/* ── EmptyState ── */}
        <Section title="EmptyState">
          <ClayCard padding="lg">
            <EmptyState
              icon={<Inbox size={28} />}
              title="אין נתונים להצגה"
              description="כאשר יתווספו נתונים, הם יופיעו כאן."
              action={<ClayButton variant="primary">רענן</ClayButton>}
              quote
            />
          </ClayCard>
        </Section>

        {/* ── Skeleton / SkeletonCard ── */}
        <Section title="Skeleton / SkeletonCard">
          <Row label="Skeleton (generic)">
            <Skeleton width={160} height={14} />
            <Skeleton width={80} height={80} rounded="full" />
            <Skeleton width={220} height={40} rounded={12} />
          </Row>
          <Row label="SkeletonCard variants">
            <SkeletonCard variant="kpi" className="w-48" />
            <SkeletonCard variant="student-card" className="w-64" />
            <SkeletonCard variant="mastery-cell" className="w-24" />
          </Row>
        </Section>

        {/* ── BottomSheet ── */}
        <Section title="BottomSheet">
          <Row label="trigger">
            <ClayButton variant="secondary" onClick={() => setSheetOpen(true)}>
              <Settings size={16} /> פתח BottomSheet
            </ClayButton>
          </Row>
          <BottomSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="דוגמת BottomSheet" height="50vh">
            <div className="p-6 flex flex-col gap-3">
              <p className="text-body-md">תוכן לדוגמה בתוך ה-BottomSheet. גרור מטה לסגירה.</p>
              <ClayButton variant="ghost" onClick={() => setSheetOpen(false)}>סגור</ClayButton>
            </div>
          </BottomSheet>
        </Section>

        {/* ── Modal ── */}
        <Section title="Modal">
          <Row label="tones">
            <ClayButton variant="primary" onClick={() => setModalTone("primary")}>primary</ClayButton>
            <ClayButton variant="secondary" onClick={() => setModalTone("secondary")}>secondary</ClayButton>
            <ClayButton variant="ghost" onClick={() => setModalTone("danger")}>danger</ClayButton>
          </Row>
          <Modal
            open={modalTone !== null}
            onClose={() => setModalTone(null)}
            tone={modalTone ?? "primary"}
            title={modalTone === "danger" ? "לצאת מהתרגול?" : "נושא הושלם! ✨"}
            footer={
              <>
                <ClayButton variant="primary" onClick={() => setModalTone(null)}>אישור</ClayButton>
                <ClayButton variant="ghost" onClick={() => setModalTone(null)}>ביטול</ClayButton>
              </>
            }
          >
            {modalTone === "danger"
              ? "ההתקדמות בסשן הנוכחי לא תישמר. אפשר תמיד לחזור ולהמשיך מאותו מקום במפת הלמידה."
              : "כל הכבוד! סיימת את כל 12 השאלות בנושא. פרופסור פאראדיי ממליץ להמשיך לנושא הבא."}
          </Modal>
        </Section>

        {/* ── Toast ── */}
        <Section title="Toast">
          <Row label="kinds">
            <ClayButton variant="primary" size="sm" onClick={() => push("success", "תשובה נכונה! ✓", "+20 XP · דיוק 87%")}>הצלחה</ClayButton>
            <ClayButton variant="secondary" size="sm" onClick={() => push("info", "פרופסור פאראדיי", "אני כאן אם תצטרך רמז")}>מידע</ClayButton>
            <ClayButton variant="ghost" size="sm" onClick={() => push("streak", "שיא רצף חדש!", "7 ימים ברציפות — כל הכבוד")}>רצף 🔥</ClayButton>
            <ClayButton variant="ghost" size="sm" onClick={() => push("error", "לא הצלחנו לשמור", "בדוק את החיבור ונסה שוב")}>שגיאה</ClayButton>
          </Row>
          <ToastStack toasts={toasts} onDismiss={dismiss} />
        </Section>
      </div>
    </div>
  );
}
