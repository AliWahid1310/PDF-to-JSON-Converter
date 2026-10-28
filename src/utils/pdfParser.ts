import { extractText } from "unpdf";
import { ExamMergedJson, QuestionItem } from "@/types/exam";

function cleanText(t: string): string {
  if (!t) return "";
  return t
    .replace(/[\t\r]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function parseExamMetadata(firstPageText: string, filename: string): Omit<ExamMergedJson, "questions"> {
  const meta = {
    subject: "Exam",
    syllabus: "Cambridge International Assessment",
    paper: filename ? filename.replace(/\.[^/.]+$/, "") : "Paper",
    component: "Paper 1 Multiple Choice",
    session: "2025",
    duration: "1 hour 15 minutes",
    totalMarks: 40,
    pdfUrl: filename || "exam.pdf",
  };

  if (!firstPageText) return meta;

  // Syllabus: e.g. "Cambridge International AS & A Level" or "Cambridge IGCSE"
  const sylMatch = firstPageText.match(/(Cambridge International (?:AS & A Level|IGCSE|O Level)[^\n]*)/i);
  if (sylMatch) meta.syllabus = cleanText(sylMatch[1]);

  // Subject & Paper: e.g. "PHYSICS 9702/12"
  const subMatch = firstPageText.match(/\n([A-Z\s]{3,30})\s+(\d{4}\/\d{2})/);
  if (subMatch) {
    meta.subject = cleanText(subMatch[1]);
    meta.paper = cleanText(subMatch[2]);
  } else {
    const singleSub = firstPageText.match(/\n(PHYSICS|CHEMISTRY|BIOLOGY|MATHEMATICS|ECONOMICS|BUSINESS|ACCOUNTING|COMPUTER SCIENCE)/i);
    if (singleSub) meta.subject = cleanText(singleSub[1]);
  }

  // Component
  const compMatch = firstPageText.match(/(Paper \d+ Multiple Choice[^\n]*)/i);
  if (compMatch) meta.component = cleanText(compMatch[1]);

  // Session: e.g. "February/March 2025" or "May/June 2024"
  const sessMatch = firstPageText.match(/((?:February\/March|May\/June|October\/November)\s+\d{4})/i);
  if (sessMatch) meta.session = cleanText(sessMatch[1]);

  // Duration: e.g. "1 hour 15 minutes"
  const durMatch = firstPageText.match(/(\d+\s*hours?\s*\d*\s*minutes?|\d+\s*minutes?)/i);
  if (durMatch) meta.duration = cleanText(durMatch[1]);

  return meta;
}

function parseMarkingScheme(msText: string): Map<number, { answer: string; marks: number }> {
  const answers = new Map<number, { answer: string; marks: number }>();
  if (!msText) return answers;

  const lines = msText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Matches patterns like "1 D 1", "28 C 1", or "40 D 1"
    const match = trimmed.match(/^(\d{1,3})\s+([A-D]|[\w\.\-]+(?:\s*\(?\d*\)?))\s+(\d+)$/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].trim().toUpperCase();
      const marks = parseInt(match[3], 10);
      answers.set(qNum, { answer: ans, marks });
    }
  }

  return answers;
}

function extractOptions(block: string): { options: Record<string, string>; beforeOptions: string } | null {
  // Matches A <text> B <text> C <text> D <text>
  const optRegex = /(?:^|\s|\n)A\s+([\s\S]+?)(?=(?:^|\s|\n)B\s+)(?:^|\s|\n)B\s+([\s\S]+?)(?=(?:^|\s|\n)C\s+)(?:^|\s|\n)C\s+([\s\S]+?)(?=(?:^|\s|\n)D\s+)(?:^|\s|\n)D\s+([\s\S]+)$/;
  const match = block.match(optRegex);
  if (match) {
    return {
      options: {
        A: cleanText(match[1]),
        B: cleanText(match[2]),
        C: cleanText(match[3]),
        D: cleanText(match[4]),
      },
      beforeOptions: block.slice(0, match.index).trim(),
    };
  }

  return null;
}

export async function parseExamPdfs(
  qpBuffer: Buffer,
  msBuffer: Buffer,
  filename: string
): Promise<ExamMergedJson> {
  // 1. Extract text from Marking Scheme using unpdf
  const msResult = await extractText(new Uint8Array(msBuffer));
  const msPages = Array.isArray(msResult.text) ? msResult.text : [msResult.text || ""];
  const msFullText = msPages.join("\n");
  const answersMap = parseMarkingScheme(msFullText);

  // 2. Extract text from Question Paper using unpdf
  const qpResult = await extractText(new Uint8Array(qpBuffer));
  const qpPages = Array.isArray(qpResult.text) ? qpResult.text : [qpResult.text || ""];

  const meta = parseExamMetadata(
    qpPages.length > 0 ? qpPages[0] : "",
    filename
  );
  if (answersMap.size > 0) {
    meta.totalMarks = answersMap.size;
  }

  // 3. Process question body text (skip cover & formula page)
  let bodyText = "";
  for (let idx = 0; idx < qpPages.length; idx++) {
    const pageNum = idx + 1;
    if (pageNum <= 2) continue; // skip cover and formula sheets
    const cleaned = qpPages[idx]
      .replace(/©\s*UCLES\s*\d{4}/gi, "")
      .replace(/\[Turn over/gi, "")
      .replace(/\d{4}\/\d{2}\/[A-Z\/]+\/\d+/gi, "")
      .replace(/Cambridge International[^\n]*/gi, "")
      .replace(/^\s*\d+\s*$/gm, ""); // lone page numbers
    bodyText += "\n" + cleaned;
  }

  // 4. Identify question starts strictly
  const lines = bodyText.split("\n");
  const qStarts: { num: number; charIdx: number }[] = [];
  const seenNumbers = new Set<number>();

  let charOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^(\d{1,3})\s+([A-Z][^\n]+)/);
    if (m) {
      const qNum = parseInt(m[1], 10);
      // Valid question number in range and not seen yet
      if (qNum >= 1 && qNum <= 100 && !seenNumbers.has(qNum)) {
        // If answersMap exists, prioritize numbers in answersMap
        if (answersMap.size === 0 || answersMap.has(qNum)) {
          seenNumbers.add(qNum);
          qStarts.push({ num: qNum, charIdx: charOffset });
        }
      }
    }
    charOffset += l.length + 1;
  }

  // Sort by question number to ensure sequential order
  qStarts.sort((a, b) => a.num - b.num);

  const questions: QuestionItem[] = [];

  for (let i = 0; i < qStarts.length; i++) {
    const current = qStarts[i];
    const next = qStarts[i + 1];

    const blockText = bodyText
      .slice(current.charIdx, next ? next.charIdx : undefined)
      .trim();

    // Strip question number at start
    const withoutNum = blockText.replace(/^\d{1,3}\s+/, "").trim();

    const optResult = extractOptions(withoutNum);
    let questionText = withoutNum;
    let options: Record<string, string> | undefined = undefined;

    if (optResult) {
      questionText = optResult.beforeOptions;
      options = optResult.options;
    }

    const msData = answersMap.get(current.num) || { answer: "", marks: 1 };
    const ansLetter = msData.answer || "";

    // Construct concise teacher explanation
    let explanation = `According to the official marking scheme, the correct answer for Question ${current.num} is option ${ansLetter || "verified in marking key"}.`;
    if (options && ansLetter && options[ansLetter]) {
      explanation += ` (${options[ansLetter]}).`;
    }

    questions.push({
      number: current.num,
      question: cleanText(questionText),
      ...(options ? { options } : {}),
      correctAnswer: ansLetter,
      marks: msData.marks || 1,
      explanation,
    });
  }

  return {
    ...meta,
    questions,
  };
}
