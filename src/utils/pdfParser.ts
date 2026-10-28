import { extractText } from "unpdf";
import { ExamMergedJson, QuestionItem } from "@/types/exam";

function stripArtifacts(text: string): string {
  if (!text) return "";
  return text
    // PapaCambridge watermarks & download banners
    .replace(/PapaCambridge[^\n]*/gi, "")
    .replace(/papacambridge\.com[^\n]*/gi, "")
    .replace(/Downloaded from [^\n]*/gi, "")
    .replace(/Licensed for hosting on [^\n]*/gi, "")
    .replace(/Re-uploading, mirroring or re-hosting[^\n]*/gi, "")
    .replace(/Trace ID:\s*[^\n]*/gi, "")
    .replace(/.*Source:\s*papacambridge\.com[^\n]*/gi, "")
    .replace(/.*Question Paper\s+(?:June|November|March|February)\s+\d{4}[^\n]*/gi, "")
    // Other past paper sites
    .replace(/www\.gceguide\.com[^\n]*/gi, "")
    .replace(/gceguide\.com[^\n]*/gi, "")
    .replace(/dynamicpapers\.com[^\n]*/gi, "")
    .replace(/bestexamhelp\.com[^\n]*/gi, "")
    .replace(/physicsandmathstutor\.com[^\n]*/gi, "")
    // Cambridge copyright notices (including 2026+ variations)
    .replace(/©\s*(?:Cambridge University Press & Assessment|Cambridge Assessment International Education|UCLES|Cambridge International Examinations|Cambridge International)[^\n]*/gi, "")
    .replace(/Cambridge University Press & Assessment[^\n]*/gi, "")
    .replace(/Cambridge Assessment International Education[^\n]*/gi, "")
    .replace(/Cambridge International Examinations[^\n]*/gi, "")
    .replace(/©\s*[A-Za-z\s&]+\d{4}[^\n]*/g, "")
    // Turn over & blank page notices
    .replace(/\[?\bTurn over\b\]?/gi, "")
    .replace(/\bBLANK PAGE\b/gi, "")
    // Syllabus footer codes like 9700/11/M/J/26
    .replace(/\b\d{4}\/\d{2}\/[A-Za-z0-9\/]+\b/gi, "")
    // Barcode strings like *4083621324*
    .replace(/\*[0-9]{8,}\*/g, "")
    // Print batch codes
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
  if (!block) return null;

  // Find all candidate start positions for Option A (preceded by start of string, newline, or 2+ spaces)
  const aMatches: number[] = [];
  const aRegex = /(?:^|\n|[ \t]{2,})A[ \t]+/g;
  let m: RegExpExecArray | null;
  while ((m = aRegex.exec(block)) !== null) {
    const aPos = m.index + m[0].indexOf("A");
    aMatches.push(aPos);
  }

  // Iterate backwards from the LAST occurrence of A to the first.
  // This guarantees that questions starting with 'A <word>' or questions containing numbered statements
  // never swallow their text into Option A, and always match the real options at the end.
  for (let i = aMatches.length - 1; i >= 0; i--) {
    const aPos = aMatches[i];
    const sub = block.slice(aPos);

    // Try separate lines: A ... \nB ... \nC ... \nD ...
    const nlMatch = sub.match(/^A[ \t]+([\s\S]+?)\n[ \t]*B[ \t]+([\s\S]+?)\n[ \t]*C[ \t]+([\s\S]+?)\n[ \t]*D[ \t]+([\s\S]+)$/);
    if (nlMatch) {
      return {
        options: {
          A: cleanText(nlMatch[1]),
          B: cleanText(nlMatch[2]),
          C: cleanText(nlMatch[3]),
          D: cleanText(nlMatch[4]),
        },
        beforeOptions: cleanText(block.slice(0, aPos)),
      };
    }

    // Try horizontal/inline options: A ... B ... C ... D ...
    const flexMatch = sub.match(/^A[ \t]+([\s\S]+?)(?:[ \t]+|\n)B[ \t]+([\s\S]+?)(?:[ \t]+|\n)C[ \t]+([\s\S]+?)(?:[ \t]+|\n)D[ \t]+([\s\S]+)$/);
    if (flexMatch) {
      return {
        options: {
          A: cleanText(flexMatch[1]),
          B: cleanText(flexMatch[2]),
          C: cleanText(flexMatch[3]),
          D: cleanText(flexMatch[4]),
        },
        beforeOptions: cleanText(block.slice(0, aPos)),
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
    bodyText += "\n" + stripArtifacts(qpPages[idx]);
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

    // Find where the next question begins to delimit the current question block.
    // If the current question contains numbered statements (e.g. 1, 2, 3 in Question 2),
    // next question candidate is only valid if options A, B, C, D occur before it!
    let nextMatchIndexInFull = bodyText.length;
    if (qNum < totalQuestions) {
      const nextQRegex = new RegExp(
        '(?:^|\\n)[ \\t]*' + nextQ + '[ \\t]+(?=[^\\n]*[A-Za-z])([^\\n]{6,})',
        'gm'
      );
      const searchRegion = bodyText.slice(matchIndexInFull + match[0].length);
      let candidate: RegExpExecArray | null;
      let chosenIndex = -1;

      while ((candidate = nextQRegex.exec(searchRegion)) !== null) {
        const textBeforeCandidate = searchRegion.slice(0, candidate.index);
        const hasOptionsBefore = extractOptions(textBeforeCandidate) !== null;

        if (hasOptionsBefore) {
          chosenIndex = candidate.index;
          break;
        } else {
          chosenIndex = candidate.index;
        }
      }

      if (chosenIndex !== -1) {
        nextMatchIndexInFull = matchIndexInFull + match[0].length + chosenIndex;
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

    // Advance searchOffset to the boundary of the next question
    searchOffset = nextMatchIndexInFull;
  }

  return {
    ...meta,
    questions,
  };
}
