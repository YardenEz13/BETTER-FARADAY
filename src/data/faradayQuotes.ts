export interface FaradayQuote {
  he: string;
  en: string;
}

/** Short quotes attributed to Michael Faraday, translated to Hebrew. */
export const FARADAY_QUOTES: FaradayQuote[] = [
  {
    he: "שום דבר יקר מדי לניסיון, אם הניסיון מציע תוצאות סבירות של הצלחה.",
    en: "Nothing is too wonderful to be true, if it be consistent with the laws of nature.",
  },
  {
    he: "הנטייה החזקה ביותר של הנפש היא לשקוד על עבודה, לחשוב ולדבוק.",
    en: "The important thing is to know how to take all things quietly.",
  },
  {
    he: "מדע נבנה מעובדות, כפי שבית נבנה מאבנים; אך אוסף עובדות אינו מדע יותר מאשר ערימת אבנים היא בית.",
    en: "Science is built up of facts, as a house is built of stones.",
  },
  {
    he: "אף אדם לא צריך להתייאש מכך שהוא לא מבין דבר בפעם הראשונה שהוא נתקל בו.",
    en: "No one should faint or fail on the first repulse.",
  },
  {
    he: "העבודה. סיים כל דבר שאתה מתחיל.",
    en: "Work. Finish. Publish.",
  },
  {
    he: "הדמיון צריך להיות מוגבל מאוד בענייני מדע.",
    en: "The imagination should be given full play but should be balanced by judgment.",
  },
  {
    he: "אני יכול לבטוח בעובדה, אבל בתאוריה - לעולם.",
    en: "I can trust a fact, and always cross-examine an assertion.",
  },
  {
    he: "אין דבר קסום מדי כדי להיות אמיתי, כל עוד הוא עולה בקנה אחד עם חוקי הטבע.",
    en: "Nothing is too wonderful to be true, if it be consistent with the laws of nature.",
  },
  {
    he: "אך מה השימוש בתינוק שזה עתה נולד?",
    en: "But what use is a newborn baby?",
  },
  {
    he: "טבעו של הידע האנושי, ככל שהוא רחב, נותר תמיד מוקף בבורות.",
    en: "The five essentials for research are: brains, patience, money, willingness, and love of the subject.",
  },
];

/** Returns a random Faraday quote. */
export function randomQuote(): FaradayQuote {
  return FARADAY_QUOTES[Math.floor(Math.random() * FARADAY_QUOTES.length)];
}
