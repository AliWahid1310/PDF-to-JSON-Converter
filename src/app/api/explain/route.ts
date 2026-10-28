import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Default key loaded from environment variable GEMINI_API_KEY (set in Vercel dashboard / .env.local)
const DEFAULT_GEMINI_KEY = process.env.GEMINI_API_KEY || "";

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

async function generateWithFallback(ai: GoogleGenAI, prompt: string): Promise<string> {
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        });
        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        // If 503 (high demand), short pause then retry or switch model
        if (attempt < 2 && err?.message?.includes("503")) {
          await new Promise((res) => setTimeout(res, 800));
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate explanations with available AI models.");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions, subject, apiKey } = body;

    const activeKey =
      (apiKey as string)?.trim() ||
      process.env.GEMINI_API_KEY ||
      DEFAULT_GEMINI_KEY;

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions provided." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: activeKey });

    // Ensure we ONLY supply question number, text, options, and the verified correct answer.
    // The question number and answer mapping are strictly fixed and immutable.
    const promptQuestions = questions.map((q: any) => ({
      number: q.number,
      question: q.question,
      options: q.options || {},
      verifiedAnswer: q.correctAnswer,
    }));

    const prompt = `You are a distinguished academic teacher and subject expert in ${subject || "Science"}.
You are provided with a verified list of exam questions, multiple-choice options, and the verified correct answer for each.

Your task is to write a rigorous, high-quality, 1-3 sentence academic and conceptual explanation for each question explaining WHY that specific answer is scientifically/conceptually correct.

STRICT CONSTRAINTS:
1. NEVER mention "the marking scheme", "mark scheme", "the answer key", "the official answer", "verified by", or "marking guide". Write as an authoritative teacher explaining the underlying concepts, definitions, formulas, calculations, or physical/biological/chemical laws directly.
2. Address why the verified answer is correct and why other key concepts differentiate it.
3. Return ONLY a pure JSON object where each key is the string question number and the value is the explanation string:
{
  "1": "Explanation for question 1...",
  "2": "Explanation for question 2..."
}
4. Output valid JSON only, without markdown code fences or any other commentary.

Questions:
${JSON.stringify(promptQuestions, null, 2)}`;

    const responseText = await generateWithFallback(ai, prompt);

    let parsedExplanations: Record<string, string> = {};
    try {
      const cleanJson = responseText
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      parsedExplanations = JSON.parse(cleanJson);
    } catch {
      console.error("Failed to parse Gemini response:", responseText);
      throw new Error("Failed to parse AI generated explanations.");
    }

    return NextResponse.json({
      success: true,
      explanations: parsedExplanations,
    });
  } catch (error: any) {
    console.error("Explain route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate explanations.",
      },
      { status: 500 }
    );
  }
}
