// Short quotes attributed to Michael Faraday, in Hebrew. Only the Hebrew line
// is ever rendered — the English originals lived here unused and were dropped.
const FARADAY_QUOTES = [
  "אין דבר קסום מדי כדי להיות אמיתי, כל עוד הוא עולה בקנה אחד עם חוקי הטבע.",
  "הדבר החשוב הוא לדעת לקחת כל דבר בשלווה.",
  "מדע נבנה מעובדות, כפי שבית נבנה מאבנים; אך אוסף עובדות אינו מדע יותר מאשר ערימת אבנים היא בית.",
  "אף אדם לא צריך להתייאש מכך שהוא לא מבין דבר בפעם הראשונה שהוא נתקל בו.",
  "עבודה. סיים. פרסם.",
  "יש לתת לדמיון חופש מלא, אך לאזן אותו בשיקול דעת.",
  "אני יכול לבטוח בעובדה, אבל טענה — תמיד אחקור.",
  "אך מה השימוש בתינוק שזה עתה נולד?",
  "חמשת היסודות למחקר: שכל, סבלנות, כסף, נכונות, ואהבת הנושא.",
];

/** Returns a random Faraday quote (Hebrew). */
export function randomQuote(): string {
  return FARADAY_QUOTES[Math.floor(Math.random() * FARADAY_QUOTES.length)];
}
