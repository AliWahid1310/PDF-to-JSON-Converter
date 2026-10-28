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

    const prompt = `You are an expert Cambridge teacher in ${subject || "Science"}.
You are provided with a verified list of multiple-choice exam questions and their OFFICIAL verified marking scheme answers.

Your task is to write a clear, accurate, and concise 1-2 sentence academic explanation for each question explaining WHY the specified verified answer is correct.

CRITICAL CONSTRAINTS:
1. Do NOT change the question number or the verified answer.
2. Return ONLY a pure JSON object mapping each question number (as a string key) to its explanation string.
Example format:
{
  "1": "Work is a scalar quantity because it has magnitude only and is the scalar product of force and displacement, whereas force, momentum, and velocity are all vectors.",
  "2": "A systematic error causes all readings to shift consistently in one direction away from the true value, thus affecting accuracy rather than precision."
}
3. Output valid JSON only, without markdown fences or additional text.

Here are the questions:
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

