import { readFileSync } from 'fs';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log('No GEMINI_API_KEY found, skipping live test.');
  process.exit(0);
}

const theme = 'כדורגל';
const inputs = [
  { id: '1', original: 'לדני יש 5 תפוחים. הוא אכל 2. כמה נשארו?' },
  { id: '2', original: 'חשב את השטח של ריבוע שצלעו $x = 4$.' }
];

const systemPrompt = `אתה עוזר לכתוב מחדש שאלות מתמטיקה בעברית בצורה מהנה לתלמידים.
כללי ברזל:
1. שמור את כל הנוסחאות המתמטיות בדיוק כפי שהן — אל תשנה שום דבר בין סימני $ ... $ או \\[ ... \\].
2. שמור את מבנה השאלה — אל תוסיף פסקאות חדשות, אל תקצר.
3. הוסף רק הקשר נושאי מהנה: שמות שחקנים, מועדונים, דמויות מהסדרה, וכד' — בהתאם לנושא שנבחר.
4. כתוב בעברית בלבד. החזר JSON מדויק ללא שום טקסט נוסף.`;

const userPrompt = `נושא: ${theme}

השאלות (בפורמט JSON):
${JSON.stringify(inputs, null, 2)}

החזר את אותו ה-JSON עם השאלות משוכתבות בהקשר של "${theme}". חובה להחזיר מערך JSON של אובייקטים המכילים 'id' ו-'rewritten' לכל שאלה.`;

async function run() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                rewritten: { type: 'STRING' }
              },
              required: ['id', 'rewritten']
            }
          }
        },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    console.error('API Error:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Response text:', responseText);
  try {
    const parsed = JSON.parse(responseText);
    console.log('Parsed successfully:', parsed.length, 'items');
  } catch (e) {
    console.error('Failed to parse JSON:', e);
  }
}
run();
