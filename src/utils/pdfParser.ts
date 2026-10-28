import { extractText } from "unpdf";
import { ExamMergedJson, QuestionItem } from "@/types/exam";

function stripArtifacts(text: string): string {
  if (!text) return "";
  return text
    // Comprehensive Cambridge copyright notices (including 2026+ variations)
    .replace(/©\s*(?:Cambridge University Press & Assessment|Cambridge Assessment International Education|UCLES|Cambridge International Examinations|Cambridge International)[^\n]*/gi, "")
    .replace(/Cambridge University Press & Assessment[^\n]*/gi, "")
    .replace(/Cambridge Assessment International Education[^\n]*/gi, "")
    .replace(/Cambridge International Examinations[^\n]*/gi, "")
    .replace(/©\s*[A-Za-z\s&]+\d{4}[^\n]*/g, "")
    // Turn over notices
    .replace(/\[?\bTurn over\b\]?/gi, "")
    // Blank page notices
    .replace(/\bBLANK PAGE\b/gi, "")
    // Cambridge syllabus/paper footer codes like 9700/12/M/J/26, 9702/12/F/M/25
    .replace(/\b\d{4}\/\d{2}\/[A-Za-z0-9\/]+\b/gi, "")
    // Barcode strings like *4146915581*
    .replace(/\*[0-9]{8,}\*/g, "")
    // Print batch codes like IB25 03_9702_12/3RP
    .replace(/^IB\d{2}\s+[^\n]+/gm, "")
    // Lone page numbers
    .replace(/^\s*\d{1,3}\s*$/gm, "");
}

function cleanText(t: string): string {
  if (!t) return "";
  return stripArtifacts(t)
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
  // Pattern 1: Options on separate lines at the bottom of the question: \nA ... \nB ... \nC ... \nD ...
  const nlMatch = block.match(/\n[ \t]*A[ \t]+([\s\S]+?)\n[ \t]*B[ \t]+([\s\S]+?)\n[ \t]*C[ \t]+([\s\S]+?)\n[ \t]*D[ \t]+([\s\S]+)$/);
  if (nlMatch) {
    return {
      options: {
        A: cleanText(nlMatch[1]),
        B: cleanText(nlMatch[2]),
        C: cleanText(nlMatch[3]),
        D: cleanText(nlMatch[4]),
      },
      beforeOptions: cleanText(block.slice(0, nlMatch.index)),
    };
  }

  // Pattern 2: Flexible horizontal or wrapped options: (?:^|\n)[ \t]*A[ \t]+ ... (?:[ \t]+|\n)B[ \t]+ ...
  const flexMatch = block.match(/(?:^|\n)[ \t]*A[ \t]+([\s\S]+?)(?:[ \t]+|\n)B[ \t]+([\s\S]+?)(?:[ \t]+|\n)C[ \t]+([\s\S]+?)(?:[ \t]+|\n)D[ \t]+([\s\S]+)$/);
  if (flexMatch) {
    return {
      options: {
        A: cleanText(flexMatch[1]),
        B: cleanText(flexMatch[2]),
        C: cleanText(flexMatch[3]),
        D: cleanText(flexMatch[4]),
      },
      beforeOptions: cleanText(block.slice(0, flexMatch.index)),
    };
  }

  // Pattern 3: Fallback from the last occurrence of \nA
  const lastAIdx = block.lastIndexOf("\nA");
  if (lastAIdx !== -1) {
    const sub = block.slice(lastAIdx);
    const subMatch = sub.match(/\nA[ \t]+([\s\S]+?)(?:(?:\n|\s{2,})B[ \t]+)([\s\S]+?)(?:(?:\n|\s{2,})C[ \t]+)([\s\S]+?)(?:(?:\n|\s{2,})D[ \t]+)([\s\S]+)$/);
    if (subMatch) {
      return {
        options: {
          A: cleanText(subMatch[1]),
          B: cleanText(subMatch[2]),
          C: cleanText(subMatch[3]),
          D: cleanText(subMatch[4]),
        },
        beforeOptions: cleanText(block.slice(0, lastAIdx)),
      };
    }
  }

  return null;
}

export async function parseExamPdfs(
  qpBuffer: ArrayBuffer | Uint8Array,
  msBuffer: ArrayBuffer | Uint8Array,
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

  // 3. Determine starting page for question extraction:
  // - Page 1 (index 0) is ALWAYS the cover/instruction sheet.
  // - Page 2 (index 1) is ONLY skipped if it is a pure formula sheet with no questions.
  //   In Biology, Chemistry, Economics, Business, Math, etc., Page 2 starts with Question 1!
  let pStart = 1;
  if (qpPages.length > 2) {
    const p2 = qpPages[1];
    const isFormulaSheet =
      /acceleration of free fall|speed of light/i.test(p2) &&
      /\bFormulae\b/i.test(p2);
    const hasQ1 = /(?:^|\n)[ \t]*1[ \t]+(?=[^\n]*[A-Za-z])[^\n]{6,}/m.test(p2);
    if (isFormulaSheet && !hasQ1) {
      pStart = 2;
    }
  }

  let bodyText = "";
  for (let idx = pStart; idx < qpPages.length; idx++) {
    const cleaned = stripArtifacts(qpPages[idx]);
    bodyText += "\n" + cleaned;
  }

  // 4. Sequential Question Extraction:
  // Questions in exam papers strictly follow 1, 2, 3, ..., N in sequential order.
  const totalQuestions = answersMap.size > 0 ? answersMap.size : 40;
  const questions: QuestionItem[] = [];
  let searchOffset = 0;

  for (let qNum = 1; qNum <= totalQuestions; qNum++) {
    const nextQ = qNum + 1;
    // Header pattern: number at start of line, followed by substantive text containing letters
    const qStartRegex = new RegExp(
      '(?:^|\\n)[ \\t]*' + qNum + '[ \\t]+(?=[^\\n]*[A-Za-z])([^\\n]{6,})',
      'm'
    );
    const slice = bodyText.slice(searchOffset);
    const match = slice.match(qStartRegex);

    if (!match) {
      continue;
    }

    const matchIndexInFull = searchOffset + (match.index || 0);

    // Find where the next question begins to delimit the current question block
    let nextMatchIndexInFull = bodyText.length;
    if (qNum < totalQuestions) {
      const nextQRegex = new RegExp(
        '(?:^|\\n)[ \\t]*' + nextQ + '[ \\t]+(?=[^\\n]*[A-Za-z])([^\\n]{6,})',
        'm'
      );
      const nextSlice = bodyText.slice(matchIndexInFull + match[0].length);
      const nextMatch = nextSlice.match(nextQRegex);
      if (nextMatch && nextMatch.index !== undefined) {
        nextMatchIndexInFull = matchIndexInFull + match[0].length + nextMatch.index;
      }
    }

    const rawBlock = bodyText.slice(matchIndexInFull, nextMatchIndexInFull).trim();
    // Strip leading question number
    const withoutNum = rawBlock.replace(/^[ \t]*\d{1,3}[ \t]+/, "").trim();

    const optResult = extractOptions(withoutNum);
    let questionText = withoutNum;
    let options: Record<string, string> | undefined = undefined;

    if (optResult && Object.keys(optResult.options).length === 4) {
      questionText = optResult.beforeOptions;
      options = optResult.options;
    }

    const msData = answersMap.get(qNum) || { answer: "", marks: 1 };
    const ansLetter = msData.answer || "";

    const optText = options && ansLetter && options[ansLetter] ? `: ${options[ansLetter]}` : "";
    const explanation = `Correct option is ${ansLetter}${optText}.`;

    questions.push({
      number: qNum,
      question: cleanText(questionText),
      ...(options ? { options } : {}),
      correctAnswer: ansLetter,
      marks: msData.marks || 1,
      explanation,
    });

    searchOffset = matchIndexInFull + match[0].length;
  }

  return {
    ...meta,
    questions,
  };
}
