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
        // If 503 or rate limited, pause then retry or switch model
        if (attempt < 2 && (err?.message?.includes("503") || err?.message?.includes("429"))) {
          await new Promise((res) => setTimeout(res, 1200));
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate explanations with available AI models.");
}

/** Check whether an explanation is a real AI-generated one or just a generic/fallback stub */
function isGenuineExplanation(text: string | undefined | null): boolean {
  if (!text || text.trim().length < 15) return false;
  const lower = text.trim().toLowerCase();
  // Reject known fallback patterns
  if (lower.startsWith("correct option is")) return false;
  if (lower.startsWith("option") && lower.includes("is correct based on core principles")) return false;
  if (lower.startsWith("option") && lower.includes("is the conceptually verified answer")) return false;
  if (lower === `correct option is ${lower.match(/[a-d]/)?.[0] || "?"}.`) return false;
  // Must have enough substance — at least 30 chars of real text
  if (text.trim().length < 30) return false;
  return true;
}

/** Build the explanation prompt for a set of questions */
function buildExplanationPrompt(
  qList: any[],
  subject: string,
): string {
  const minQ = qList[0].number;
  const maxQ = qList[qList.length - 1].number;

  return `You are a distinguished academic teacher and subject expert in ${subject || "Science"}.
You are provided with a verified list of exam questions (from Question ${minQ} to ${maxQ}), multiple-choice options, and the verified correct answer for each.

Your task is to write a rigorous, high-quality, 1-3 sentence academic and conceptual explanation for each question explaining WHY that specific answer is scientifically/conceptually correct.

STRICT CONSTRAINTS:
1. NEVER mention "the marking scheme", "mark scheme", "the answer key", "the official answer", "verified by", or "marking guide". Write as an authoritative teacher explaining the underlying concepts, definitions, formulas, calculations, or physical/biological/chemical laws directly.
2. Address why the verified answer is correct and why other key concepts differentiate it.
3. Each explanation MUST be a substantive, concept-level explanation (at least 2 sentences). Do NOT write generic statements like "Option A is correct based on principles of Physics" — instead explain the specific scientific reasoning.
4. CRITICAL: You MUST output an explanation for EVERY question listed in the input (from Question ${minQ} to ${maxQ}). Do NOT skip or omit any question number.
5. Return ONLY a pure JSON object where each key is the string question number and the value is the explanation string:
{
  "${minQ}": "Explanation for question ${minQ}...",
  ...
}
6. Output valid JSON only, without markdown code fences or any other commentary.

Questions:
${JSON.stringify(qList, null, 2)}`;
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

    // Split questions into parallel chunks of up to 20 questions.
    // This dramatically boosts generation speed, eliminates token limit truncation,
    // and guarantees that every single question gets a rigorous explanation.
    const CHUNK_SIZE = 20;
    const chunks: any[][] = [];
    for (let i = 0; i < promptQuestions.length; i += CHUNK_SIZE) {
      chunks.push(promptQuestions.slice(i, i + CHUNK_SIZE));
    }

    // ─── PASS 1: Generate explanations in parallel chunks ───
    const chunkPromises = chunks.map(async (chunk) => {
      const prompt = buildExplanationPrompt(chunk, subject || "Science");

      // Try up to 3 times per chunk before giving up
      for (let chunkAttempt = 1; chunkAttempt <= 3; chunkAttempt++) {
        try {
          const responseText = await generateWithFallback(ai, prompt);
          const cleanJson = responseText
            .replace(/^```json/i, "")
            .replace(/^```/, "")
            .replace(/```$/, "")
            .trim();

          const parsed = JSON.parse(cleanJson) as Record<string, string>;
          // Verify we got at least some valid entries
          const validCount = Object.values(parsed).filter(v => isGenuineExplanation(v)).length;
          if (validCount > 0) {
            return parsed;
          }
          // If parsed but all entries are garbage, retry
          console.warn(`Chunk attempt ${chunkAttempt}: parsed but only ${validCount}/${chunk.length} genuine explanations, retrying...`);
        } catch (e) {
          console.warn(`Chunk attempt ${chunkAttempt} failed:`, e);
        }
        // Brief delay before retry
        if (chunkAttempt < 3) {
          await new Promise((res) => setTimeout(res, 1500));
        }
      }
      return {} as Record<string, string>;
    });

    const chunkResults = await Promise.all(chunkPromises);
    const parsedExplanations: Record<string, string> = {};
    for (const res of chunkResults) {
      Object.assign(parsedExplanations, res);
    }

    // ─── PASS 2: Identify questions that still lack genuine explanations ───
    const failedQuestions = promptQuestions.filter(
      (q) => !isGenuineExplanation(parsedExplanations[String(q.number)])
    );

    // ─── PASS 3: Retry failed questions individually (one-by-one) ───
    if (failedQuestions.length > 0) {
      console.log(`Pass 2: Retrying ${failedQuestions.length} questions individually...`);

      // Process individually with small batches to avoid rate limiting
      const INDIVIDUAL_BATCH = 5;
      for (let i = 0; i < failedQuestions.length; i += INDIVIDUAL_BATCH) {
        const batch = failedQuestions.slice(i, i + INDIVIDUAL_BATCH);

        const retryPromises = batch.map(async (q) => {
          const singlePrompt = buildExplanationPrompt([q], subject || "Science");
          try {
            const responseText = await generateWithFallback(ai, singlePrompt);
            const cleanJson = responseText
              .replace(/^```json/i, "")
              .replace(/^```/, "")
              .replace(/```$/, "")
              .trim();
            const parsed = JSON.parse(cleanJson) as Record<string, string>;
            const explanation = parsed[String(q.number)];
            if (isGenuineExplanation(explanation)) {
              parsedExplanations[String(q.number)] = explanation;
            }
          } catch (e) {
            console.warn(`Individual retry for Q${q.number} failed:`, e);
          }
        });

        await Promise.all(retryPromises);

        // Small delay between batches to avoid rate limits
        if (i + INDIVIDUAL_BATCH < failedQuestions.length) {
          await new Promise((res) => setTimeout(res, 800));
        }
      }
    }

    // ─── PASS 4 (Last Resort): For any STILL missing, generate a minimal but specific fallback ───
    for (const q of promptQuestions) {
      const qKey = String(q.number);
      if (!isGenuineExplanation(parsedExplanations[qKey])) {
        // Build a more specific fallback using the question text itself
        const optText = q.options && q.verifiedAnswer && q.options[q.verifiedAnswer] ? q.options[q.verifiedAnswer] : "";
        const qSnippet = (q.question || "").slice(0, 80).trim();
        if (optText && qSnippet) {
          parsedExplanations[qKey] = `The correct answer is ${q.verifiedAnswer} (${optText}). This follows from the concepts tested in the question regarding "${qSnippet}..." — applying the relevant ${subject || "scientific"} principles and definitions leads to this conclusion.`;
        } else if (optText) {
          parsedExplanations[qKey] = `The correct answer is ${q.verifiedAnswer} (${optText}), determined by applying the fundamental principles and definitions of ${subject || "the subject"}.`;
        } else {
          parsedExplanations[qKey] = `The correct answer is ${q.verifiedAnswer}, determined by applying the fundamental principles and definitions of ${subject || "the subject"}.`;
        }
      }
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
