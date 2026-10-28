import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { questions, subject, apiKey } = body;

    const activeKey = (apiKey as string)?.trim() || process.env.GEMINI_API_KEY || "";
    if (!activeKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google Gemini API key is required to generate AI explanations. You can get a free key at aistudio.google.com and enter it in the top-right settings.",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions provided." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: activeKey });

    // Prepare lightweight prompt: only question number, question text, options, and verified answer
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
1. NEVER mention "the marking scheme", "mark scheme", "the answer key", or "the official answer". Write as an authoritative teacher explaining the concept, formulas, calculations, or underlying scientific principles directly.
2. Address the concept directly. For example: "Work is a scalar quantity because it is defined as the product of force and displacement, having magnitude only without directional dependence. In contrast, force, momentum, and velocity all possess both magnitude and direction, making them vector quantities."
3. Do NOT change any question number or correct answer. The mapping is fixed.
4. Return ONLY a pure JSON object where each key is the string question number and the value is the explanation string:
{
  "1": "Explanation for question 1...",
  "2": "Explanation for question 2..."
}
5. Output valid JSON only, without markdown fences or any other commentary.

Questions to explain:
${JSON.stringify(promptQuestions, null, 2)}`;

    let responseText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      responseText = response.text || "";
    } catch (err: any) {
      console.warn("Retrying with gemini-1.5-flash:", err?.message);
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });
      responseText = response.text || "";
    }

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

