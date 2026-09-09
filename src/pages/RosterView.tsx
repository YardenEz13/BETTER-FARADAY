import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserPlus, Check, AlertTriangle } from "../components/electric";
import { consentDateError } from "../../convex/classroom";
import { studentCount } from "../lib/hebrew";

/**
 * The class roster, with the consent date beside every name.
 *
 * `addStudent` has enforced a parental-consent date since it became the only
 * public door into the `students` table — but nothing ever showed it back, so
 * a teacher could not answer "does every student in this class have a signed
 * form on file?" without opening the database. `docs/parental-consent-he.md`
 * makes that promise to parents and the school's checklist asks the school to
 * confirm it; this is the screen that lets them.
 *
 * Rows created before the field existed (the seed fixtures, and anyone added
 * during the prototype) carry no date. They are shown as such rather than
 * hidden: an unknown consent state is the thing worth seeing.
 *
 * No delete here, deliberately. There is no auth yet (`studentId` is a
 * client-supplied arg everywhere) and a public mutation that erases a student
 * is a bigger hole than the one this closes. `classroom.purgeStudent` stays
 * internal, run by hand.
 */

interface Props {
  classroomId: Id<"classrooms"> | null;
}

export default function RosterView({ classroomId }: Props) {
  const students = useQuery(api.classroom.getByClassroom, classroomId ? { classroomId } : "skip");
  const addStudent = useMutation(api.classroom.addStudent);

  const [name, setName] = useState("");
  const [consentOn, setConsentOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => [...(students ?? [])].sort((a, b) => a.name.localeCompare(b.name, "he")),
    [students],
  );
  const missing = rows.filter((s) => !s.consentOn).length;

  const handleAdd = async () => {
    setError(null);
    if (!name.trim()) return setError("צריך שם תלמיד/ה");
    // The same validator the mutation runs, so the message appears before the
    // round trip rather than as a thrown error afterwards.
    const dateError = consentDateError(consentOn);
    if (dateError) return setError(dateError);
    if (!classroomId) return setError("לא נמצאה כיתה");

    setSaving(true);
    try {
      await addStudent({ classroomId, name: name.trim(), consentOn });
      setName("");
      setConsentOn("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההוספה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="flex flex-col gap-5 px-4 md:px-6 pb-10">
      {/* ── Consent summary ── */}
      <section className="clay-card p-5 flex flex-wrap items-center gap-4">
        <div>
          <div className="label-mono text-label-lg text-on-surface-variant">רשימת הכיתה</div>
          <div className="font-bold text-headline-sm text-on-surface mt-0.5">
            {studentCount(rows.length)}
          </div>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 ${
            missing === 0
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-tertiary/40 bg-tertiary/10 text-tertiary"
          }`}
        >
          {missing === 0 ? <Check size={16} /> : <AlertTriangle size={16} />}
          {/* The count leads the phrase, so it goes through studentCount —
              "תלמיד אחד" for one, not "1 תלמידים" — and sits after Hebrew text
              rather than at the start, where bidi would flip it to the left. */}
          <span className="font-semibold text-body-md">
            {missing === 0
              ? "לכל התלמידים רשום תאריך הסכמת הורים"
              : `חסר תאריך הסכמה ל־${studentCount(missing)}`}
          </span>
        </div>
      </section>

      {/* ── Add one ── */}
      <section className="clay-card p-5 flex flex-col gap-3">
        <div className="label-mono text-label-lg text-on-surface-variant">הוספת תלמיד/ה</div>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">
          תאריך ההסכמה הוא התאריך שעל גבי הטופס החתום שחזר מההורים. הטופס עצמו נשאר
          בתיק של בית הספר — כאן נרשם רק המצביע אליו.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 min-w-[12rem] bg-surface border-2 border-outline rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none"
            placeholder="שם התלמיד/ה"
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="rtl"
          />
          <input
            type="date"
            aria-label="תאריך הסכמת הורים"
            className="bg-surface border-2 border-outline rounded-xl px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none"
            value={consentOn}
            onChange={(e) => setConsentOn(e.target.value)}
            // A signed form cannot be dated in the future; the server rejects
            // it too, this just stops the picker offering it.
            max={new Date().toISOString().slice(0, 10)}
          />
          <button className="btn-clay-primary" onClick={handleAdd} disabled={saving}>
            <UserPlus size={16} />
            {saving ? "מוסיף…" : "הוספה"}
          </button>
        </div>
        {error && <div className="text-body-sm text-error font-semibold">{error}</div>}
      </section>

      {/* ── The roster ── */}
      <section className="clay-card p-2">
        {students === undefined && (
          <div className="p-6 text-center text-on-surface-variant text-body-md">טוען…</div>
        )}
        {students !== undefined && rows.length === 0 && (
          <div className="p-6 text-center text-on-surface-variant text-body-md">
            אין עדיין תלמידים בכיתה.
          </div>
        )}
        <ul>
          {rows.map((s) => (
            <li
              key={s._id}
              className="flex items-center gap-3 px-4 py-3 border-b-2 border-outline last:border-b-0"
            >
              <span
                className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-outline"
                style={{ background: s.avatarColor }}
                aria-hidden
              />
              <span className="flex-1 font-semibold text-body-md text-on-surface">{s.name}</span>
              {s.consentOn ? (
                <span className="num flex items-center gap-1.5 text-body-sm text-primary" dir="ltr">
                  <Check size={14} />
                  {s.consentOn}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-body-sm text-tertiary font-semibold">
                  <AlertTriangle size={14} />
                  אין תאריך הסכמה
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
