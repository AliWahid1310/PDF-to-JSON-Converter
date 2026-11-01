import { ExamPair } from "@/types/exam";

/**
 * Detects whether a file is a Question Paper (qp) or Marking Scheme (ms).
 */
export function detectRole(filenameOrFile: File | string): "qp" | "ms" | "unknown" {
  const name = (typeof filenameOrFile === "string" ? filenameOrFile : filenameOrFile.name).toLowerCase();

  // 1. Explicit phrase matches
  const isQuestionPaperPhrase =
    name.includes("question paper") ||
    name.includes("question_paper") ||
    name.includes("question-paper") ||
    name.includes("questionpaper") ||
    name.includes("question papers") ||
    name.includes("question_papers");

  const isMarkingSchemePhrase =
    name.includes("marking scheme") ||
    name.includes("marking_scheme") ||
    name.includes("marking-scheme") ||
    name.includes("markingscheme") ||
    name.includes("mark scheme") ||
    name.includes("mark_scheme") ||
    name.includes("mark-scheme") ||
    name.includes("markscheme") ||
    name.includes("marking schemes") ||
    name.includes("marking_schemes");

  if (isQuestionPaperPhrase && !isMarkingSchemePhrase) return "qp";
  if (isMarkingSchemePhrase && !isQuestionPaperPhrase) return "ms";

  // 2. Token / word boundary matches (e.g. _qp_, -qp-, qp., "qp ", _ms_, -ms-, ms.)
  const isQpToken = /(?:^|[^a-z0-9])(qp)(?:[^a-z0-9]|$)/i.test(name);
  const isMsToken = /(?:^|[^a-z0-9])(ms)(?:[^a-z0-9]|$)/i.test(name);

  if (isQpToken && !isMsToken) return "qp";
  if (isMsToken && !isQpToken) return "ms";

  // 3. Fallback substring match if unambiguous
  const hasQp = name.includes("qp");
  const hasMs = name.includes("ms");
  if (hasQp && !hasMs) return "qp";
  if (hasMs && !hasQp) return "ms";

  return "unknown";
}

/**
 * Normalizes an exam filename to a canonical key by removing role indicators (qp, ms)
 * and normalizing punctuation.
 * e.g. "9700_s26_qp_11.pdf" -> "9700_s26_11"
 * e.g. "qp 11.pdf" -> "11"
 */
export function normalizeExamKey(filename: string): string {
  let s = filename.toLowerCase().replace(/\.pdf$/i, "");
  s = s.replace(/[\s\-_]+/g, "_");
  s = s.replace(/question_papers?|marking_schemes?|mark_schemes?|questionpaper|markingscheme|markscheme/g, "");
  s = s.replace(/(?:^|_)(?:qp|ms)(?:_|$)/g, "_");
  s = s.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return s || "exam";
}

/**
 * Extracts component/variant number like 11, 12, 13, 21, 22, 1, 2, etc.
 */
export function extractVariant(filename: string): string | null {
  const clean = filename.toLowerCase().replace(/\.pdf$/i, "");
  const m =
    clean.match(/(?:paper|component|variant|qp|ms)?[_\s-]*([1-6][1-6])\b/i) ||
    clean.match(/\b([1-6][1-6])\b/) ||
    clean.match(/_(\d{1,2})$/) ||
    clean.match(/\b(\d{1,2})\b/);
  return m ? m[1] : null;
}

/**
 * Generates a human-friendly label for an exam pair (e.g. "Paper 11", "9700_s26_11", etc.).
 */
export function generatePairLabel(qp: File | null, ms: File | null, fallbackIndex: number): string {
  const name = qp?.name || ms?.name || `Exam ${fallbackIndex + 1}`;
  const v = extractVariant(name);
  if (v) {
    return `Paper ${v}`;
  }
  const clean = normalizeExamKey(name).replace(/_/g, " ");
  return clean ? clean.toUpperCase() : `Exam ${fallbackIndex + 1}`;
}

/**
 * Automatically groups and pairs Question Paper files and Marking Scheme files
 * by exam signature, subject, year, session, and variant number.
 */
export function pairExamFiles(files: File[]): ExamPair[] {
  const qps: File[] = [];
  const mss: File[] = [];
  const unclassified: File[] = [];

  for (const f of files) {
    const role = detectRole(f);
    if (role === "qp") qps.push(f);
    else if (role === "ms") mss.push(f);
    else unclassified.push(f);
  }

  // Handle single unclassified file if one slot is obviously missing
  if (qps.length === 1 && mss.length === 0 && unclassified.length === 1) {
    mss.push(unclassified[0]);
  } else if (mss.length === 1 && qps.length === 0 && unclassified.length === 1) {
    qps.push(unclassified[0]);
  }

  const pairs: ExamPair[] = [];
  const usedMs = new Set<File>();

  // Pass 1: Exact normalized key matching
  for (let i = 0; i < qps.length; i++) {
    const qp = qps[i];
    const qpKey = normalizeExamKey(qp.name);
    let matchedMs: File | null = null;

    for (const ms of mss) {
      if (!usedMs.has(ms) && normalizeExamKey(ms.name) === qpKey) {
        matchedMs = ms;
        break;
      }
    }

    if (matchedMs) {
      usedMs.add(matchedMs);
      pairs.push({
        id: `pair-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: generatePairLabel(qp, matchedMs, i),
        qp,
        ms: matchedMs,
        status: "ready",
      });
    } else {
      pairs.push({
        id: `pair-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: generatePairLabel(qp, null, i),
        qp,
        ms: null,
        status: "missing_ms",
      });
    }
  }

  // Pass 2: Variant matching for remaining unmatched pairs
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    if (!pair.ms && pair.qp) {
      const qpVariant = extractVariant(pair.qp.name);
      if (qpVariant) {
        for (const ms of mss) {
          if (!usedMs.has(ms) && extractVariant(ms.name) === qpVariant) {
            pair.ms = ms;
            pair.status = "ready";
            pair.label = generatePairLabel(pair.qp, ms, i);
            usedMs.add(ms);
            break;
          }
        }
      }
    }
  }

  // Pass 3: Any leftover MS files that had no matching QP
  let leftoverIdx = pairs.length;
  for (const ms of mss) {
    if (!usedMs.has(ms)) {
      pairs.push({
        id: `pair-${leftoverIdx}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: generatePairLabel(null, ms, leftoverIdx),
        qp: null,
        ms,
        status: "missing_qp",
      });
      leftoverIdx++;
    }
  }

  // Sort pairs cleanly by variant/label if possible (e.g. Paper 11 before Paper 12 before Paper 13)
  pairs.sort((a, b) => {
    const vA = extractVariant(a.qp?.name || a.ms?.name || "");
    const vB = extractVariant(b.qp?.name || b.ms?.name || "");
    if (vA && vB) {
      const numA = parseInt(vA, 10);
      const numB = parseInt(vB, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    }
    return a.label.localeCompare(b.label);
  });

  return pairs;
}

