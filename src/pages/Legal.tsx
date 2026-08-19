import { Link } from "react-router-dom";
import { ArrowLeft } from "../components/electric";

/**
 * Legal — privacy notice + terms of use, one static page, no state.
 *
 * Deliberately a single route (`/legal`) with two sections rather than
 * /privacy + /terms: two files and two routes to render text nobody links
 * separately is boilerplate. Everything here is plain markup, so it costs
 * one lazy chunk and never needs Convex.
 *
 * ⚠ Keep this in sync with what the app ACTUALLY does. The processor list
 * below is the disclosure that makes the third-party calls lawful; adding a
 * new analytics/AI vendor without adding it here is the compliance bug.
 */

// Public contact for access / correction / deletion requests. Must be an
// address a human actually reads — it is the only data-subject channel.
const CONTACT_EMAIL = "yarden.etz@gmail.com";
const LAST_UPDATED = "19 באוגוסט 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-extrabold text-on-surface">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[15px] leading-relaxed text-on-surface-variant">
        {children}
      </div>
    </section>
  );
}

export default function Legal() {
  return (
    <div className="min-h-screen w-full bg-background px-5 py-10 text-on-surface" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={2.4} />
          חזרה למסך הכניסה
        </Link>

        {/* Bordered surface, not `.clay-card` — that class tilts on hover, which
            is a nice affordance on a button-sized card and nauseating under a
            page of body text. */}
        <div className="rounded-[22px] border-2 border-outline bg-surface p-7 lg:p-10">
          <h1 className="mb-1 text-3xl font-extrabold">מדיניות פרטיות ותנאי שימוש</h1>
          <p className="label-mono mb-8 opacity-60">עודכן לאחרונה: {LAST_UPDATED}</p>

          <div
            className="mb-8 rounded-2xl border-2 border-tertiary/40 bg-tertiary/10 p-4 text-[15px] font-semibold leading-relaxed"
          >
            FARADAY Logic נמצא כיום בשלב <strong>פיילוט</strong>. השירות ניתן לצורכי
            בדיקה ולמידה בלבד, ואינו מהווה תחליף להוראה, לבחינה או להערכה רשמית של
            בית הספר.
          </div>

          {/* ── PRIVACY ── */}
          <Section title="1. איזה מידע נאסף">
            <p>
              <strong>מידע שהוזן על ידי המורה:</strong> שם התלמיד/ה, הכיתה, ורמת הלימוד.
              איננו אוספים תעודת זהות, כתובת, טלפון, תמונת פנים או פרטי תשלום.
            </p>
            <p>
              <strong>מידע שנוצר תוך כדי שימוש:</strong> תשובות לשאלות, זמני פתרון,
              רצפי תרגול (סטריק), נקודות XP, ציוני מבחני מתכונת ושיעורי בית.
            </p>
            <p>
              <strong>שיחות עם המורה הדיגיטלי (פאראדיי):</strong> תוכן ההתכתבות נשמר,
              וכן ניתוח פדגוגי הנגזר ממנה — נושאים שבהם התלמיד/ה מתקשה, רמת עצמאות
              בפתרון, ומגמת התקדמות. ניתוח זה מוצג למורה.
            </p>
            <p>
              <strong>תמונות:</strong> צילומי מחברת שהתלמיד/ה מעלה לקבלת רמז. התמונה
              נשלחת לניתוח ואינה נשמרת לצמיתות בשרתי המערכת.
            </p>
          </Section>

          <Section title="2. למי המידע מועבר">
            <p>השירות נשען על ספקי צד־שלישי. שימוש בשירות כרוך בהעברת מידע אליהם:</p>
            <ul className="ms-5 list-disc space-y-1.5">
              <li>
                <strong>Google (Gemini API)</strong> — תוכן השיחות עם פאראדיי, תשובות
                לשיעורי בית וצילומי מחברת נשלחים לעיבוד ולניתוח.
              </li>
              <li>
                <strong>Convex</strong> — אחסון בסיס הנתונים של המערכת.
              </li>
              <li>
                <strong>Vercel (Analytics, Speed Insights)</strong> — נתוני שימוש
                מצטברים וביצועי טעינה של הדפים.
              </li>
              <li>
                <strong>Sentry</strong> — דיווח תקלות טכניות. הקלטת מסך מושבתת.
              </li>
            </ul>
            <p>
              הגופנים מוגשים מהשרת שלנו ואינם נטענים מרשת חיצונית, כך שטעינת דף
              אינה חושפת את כתובת ה־IP של הדפדפן לספק גופנים.
            </p>
            <p>חלק מהספקים מעבדים ומאחסנים מידע מחוץ לישראל, לרבות בארצות הברית.</p>
            <p>איננו מוכרים מידע ואיננו מעבירים אותו למפרסמים.</p>
          </Section>

          <Section title="3. אחסון בדפדפן">
            <p>
              המערכת שומרת בדפדפן שלך נתונים תפעוליים בלבד: העדפת ערכת נושא, השתקת
              צלילים, סימון שסיור ההיכרות הוצג, והיסטוריית שיחה מקומית לשחזור מהיר
              לאחר רענון. נתונים אלה נדרשים לתפקוד השירות, אינם משמשים לפרסום, ואינם
              מועברים לצד שלישי. ניתן למחוק אותם בכל עת דרך הגדרות הדפדפן.
            </p>
          </Section>

          <Section title="4. קטינים והסכמת הורה">
            <p>
              השירות מיועד לתלמידי תיכון, ולרוב לקטינים. הרשמת תלמיד/ה למערכת נעשית
              על ידי המורה או בית הספר, ובאחריותם לוודא כי ניתנה הסכמת הורה או אפוטרופוס
              לשימוש בשירות ולהעברת המידע כמתואר במסמך זה.
            </p>
            <p>
              הורה או אפוטרופוס רשאי לבקש בכל עת לעיין במידע על ילדו, לתקנו, או להורות
              על מחיקתו והפסקת השימוש בשירות.
            </p>
          </Section>

          <Section title="5. מי רואה את המידע">
            <p>
              המורה של הכיתה רואה את נתוני הלמידה של תלמידי הכיתה, לרבות תמצית
              השיחות עם פאראדיי והניתוח הפדגוגי הנגזר מהן. המידע משמש להוראה בלבד.
            </p>
            <p>
              אין בשירות דוחות להורים. הורה המבקש לעיין במידע על ילדו/ה יפנה
              בכתובת שבסעיף 6.
            </p>
          </Section>

          <Section title="6. זכויותיך">
            <p>
              ניתן לפנות אלינו בבקשה לעיין במידע, לתקנו, או למחוק אותו לצמיתות, בכתובת{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
              . נטפל בפנייה בתוך זמן סביר. מחיקה מוחקת גם את היסטוריית השיחות והניתוחים
              הנגזרים ממנה, ואינה הפיכה.
            </p>
          </Section>

          {/* ── TERMS ── */}
          <hr className="my-9 border-t-2 border-outline" />

          <Section title="7. תנאי שימוש">
            <p>
              השימוש בשירות הוא לצרכים חינוכיים בלבד. אין להשתמש בו לפגיעה באחרים, לניסיון
              גישה למידע של תלמידים אחרים, או להעמסה מכוונת על המערכת.
            </p>
            <p>
              אין להעלות לשירות חומר המוגן בזכויות יוצרים ללא הרשאה מבעל הזכויות. משתמש
              המעלה חומר מצהיר כי הוא רשאי לעשות בו שימוש זה.
            </p>
          </Section>

          <Section title="8. על תשובות ה‑AI">
            <p>
              פאראדיי הוא מודל שפה. תשובותיו, הרמזים והציונים שהוא מפיק{" "}
              <strong>עלולים להיות שגויים</strong>. אין להסתמך עליהם כמקור סמכותי, והם
              אינם מהווים ציון או הערכה רשמיים. במקרה של סתירה — קביעת המורה גוברת.
            </p>
          </Section>

          <Section title="9. אחריות">
            <p>
              השירות ניתן כמות שהוא (AS IS), ללא התחייבות לזמינות, לדיוק או להתאמה
              לצורך מסוים. בכפוף לדין, לא נישא באחריות לנזק עקיף, תוצאתי או אובדן
              נתונים הנובע מהשימוש בשירות.
            </p>
            <p>אנו רשאים לעדכן מסמך זה. שינוי מהותי יוצג בכניסה לשירות.</p>
          </Section>

          <Section title="10. דין וסמכות שיפוט">
            <p>
              על מסמך זה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט
              המוסמכים בישראל.
            </p>
          </Section>

          {/* ── ACCESSIBILITY STATEMENT ── */}
          {/* Israeli service-accessibility regulations expect a declared
              conformance level, the measures actually taken, the gaps that
              remain, and a named contact. Claiming full IS 5568 / WCAG 2.0 AA
              conformance without an audit is itself a violation, so this
              declares PARTIAL conformance and lists what is unverified.
              ⚠ Before the service stops being a closed pilot: appoint a named
              accessibility coordinator and put their name here. */}
          <hr className="my-9 border-t-2 border-outline" />

          <Section title="11. הצהרת נגישות">
            <p>
              אנו רואים בנגישות השירות חלק מהמוצר, ופועלים להנגישו בהתאם לתקן
              הישראלי ת״י 5568 המבוסס על הנחיות <span dir="ltr">WCAG 2.0</span> ברמה{" "}
              <span dir="ltr">AA</span>.
            </p>

            <p className="mt-2 font-bold text-on-surface">מה כבר נעשה</p>
            <ul className="ms-5 list-disc space-y-1.5">
              <li>השירות מוגש בעברית ובכיוון ימין־לשמאל, עם הגדרת שפה תקינה בדפדפן.</li>
              <li>
                לכל התמונות יש טקסט חלופי, ותמונות דקורטיביות מוסתרות מקוראי מסך כדי
                שלא יקראו רעש מיותר.
              </li>
              <li>
                המערכת מכבדת את העדפת מערכת ההפעלה להפחתת אנימציות — מי שהגדיר
                זאת, לא יקבל תנועה מיותרת.
              </li>
              <li>קיים מצב תצוגה בהיר וכהה, וניתן להחליף ביניהם בכל מסך.</li>
              <li>ניתן לנווט במקלדת, ולרכיבים הפעילים יש סימון פוקוס נראה.</li>
              <li>הממשק מותאם למסכי טלפון, והטקסט נשאר קריא בהגדלה.</li>
            </ul>

            <p className="mt-2 font-bold text-on-surface">מה עדיין לא נבדק</p>
            <p>
              השירות נמצא בפיילוט, ו<strong>טרם עבר אודיט נגישות פורמלי</strong> ולא
              התקבלה עבורו חוות דעת של מורשה נגישות. לפיכך איננו מצהירים על עמידה
              מלאה בתקן. בפרט, הרכיבים הבאים טרם נבדקו במלואם:
            </p>
            <ul className="ms-5 list-disc space-y-1.5">
              <li>לוח המקשים המתמטי ומסך בניית התרגיל — בשימוש עם קורא מסך.</li>
              <li>ניגודיות הצבעים בכל המסכים — טרם נמדדה באופן שיטתי.</li>
              <li>תוכן מתמטי מורכב עשוי להיקרא באופן חלקי בקוראי מסך מסוימים.</li>
            </ul>

            <p className="mt-2 font-bold text-on-surface">נתקלתם בבעיה?</p>
            <p>
              אם נתקלתם בקושי להשתמש בשירות, נשמח שתדווחו — הפנייה מטופלת כתקלה
              לכל דבר, ותיאור המסך והפעולה שניסיתם לבצע יעזור לנו לתקן מהר יותר:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-primary hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="label-mono mt-2 opacity-60">
              תאריך עדכון ההצהרה: {LAST_UPDATED}
            </p>
          </Section>

          <p className="mt-8 text-sm text-on-surface-variant">
            שאלות?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
