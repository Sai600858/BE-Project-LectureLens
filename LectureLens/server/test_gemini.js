require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const token = process.env.GEMINI_API_KEY;
  try {
    const ai = new GoogleGenerativeAI(token);
    const model = ai.getGenerativeModel({ model: 'gemini-flash-latest' });
    const res = await model.generateContent("Hello Gemini! Say SUCCESS");
    console.log("RESPONSE FROM GEMINI FLASH LATEST:", res.response.text());
  } catch (e) {
    console.error("Error:", e.message);
  }
}

test();
