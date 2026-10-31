import { extractText } from "unpdf";
import { ExamMergedJson, QuestionItem } from "@/types/exam";

/**
 * Map Adobe Symbol Font / Windows TrueType Private Use Area (U+F000 - U+F0FF)
 * and related mathematical/scientific glyphs to their standard Unicode equivalents.
 */
const SYMBOL_FONT_MAP: Record<string, string> = {
  // PUA mapped ASCII / Latin range
  "\uF020": " ",
  "\uF021": "!",
  "\uF022": "∀",
  "\uF023": "#",
  "\uF024": "∃",
  "\uF025": "%",
  "\uF026": "&",
  "\uF027": "∋",
  "\uF028": "(",
  "\uF029": ")",
  "\uF02A": "∗",
  "\uF02B": "+",
  "\uF02C": ",",
  "\uF02D": "−",
  "\uF02E": ".",
  "\uF02F": "/",
  "\uF030": "0",
  "\uF031": "1",
  "\uF032": "2",
  "\uF033": "3",
  "\uF034": "4",
  "\uF035": "5",
  "\uF036": "6",
  "\uF037": "7",
  "\uF038": "8",
  "\uF039": "9",
  "\uF03A": ":",
  "\uF03B": ";",
  "\uF03C": "<",
  "\uF03D": "=",
  "\uF03E": ">",
  "\uF03F": "?",
  "\uF040": "≅",
  // Greek Capitals
  "\uF041": "Α",
  "\uF042": "Β",
  "\uF043": "Χ",
  "\uF044": "Δ",
  "\uF045": "Ε",
  "\uF046": "Φ",
  "\uF047": "Γ",
  "\uF048": "Η",
  "\uF049": "Ι",
  "\uF04A": "ϑ",
  "\uF04B": "Κ",
  "\uF04C": "Λ",
  "\uF04D": "Μ",
  "\uF04E": "Ν",
  "\uF04F": "Ο",
  "\uF050": "Π",
  "\uF051": "Θ",
  "\uF052": "Ρ",
  "\uF053": "Σ",
  "\uF054": "Τ",
  "\uF055": "Υ",
  "\uF056": "ς",
  "\uF057": "Ω",
  "\uF058": "Ξ",
  "\uF059": "Ψ",
  "\uF05A": "Ζ",
  "\uF05B": "[",
  "\uF05C": "∴",
  "\uF05D": "]",
  "\uF05E": "⊥",
  "\uF05F": "_",
  "\uF060": "¯",
  // Greek Lowercase
  "\uF061": "α",
  "\uF062": "β",
  "\uF063": "χ",
  "\uF064": "δ",
  "\uF065": "ε",
  "\uF066": "ϕ",
  "\uF067": "γ",
  "\uF068": "η",
  "\uF069": "ι",
  "\uF06A": "φ",
  "\uF06B": "κ",
  "\uF06C": "λ",
  "\uF06D": "μ",
  "\uF06E": "ν",
  "\uF06F": "ο",
  "\uF070": "π",
  "\uF071": "θ",
  "\uF072": "ρ",
  "\uF073": "σ",
  "\uF074": "τ",
  "\uF075": "υ",
  "\uF076": "ϖ",
  "\uF077": "ω",
  "\uF078": "ξ",
  "\uF079": "ψ",
  "\uF07A": "ζ",
  "\uF07B": "{",
  "\uF07C": "|",
  "\uF07D": "}",
  "\uF07E": "~",
  // Upper Symbols & Math Operators
  "\uF0A0": " ",
  "\uF0A1": "ϒ",
  "\uF0A2": "′",
  "\uF0A3": "≤",
  "\uF0A4": "⁄",
  "\uF0A5": "∞",
  "\uF0A6": "ƒ",
  "\uF0A7": "♣",
  "\uF0A8": "♦",
  "\uF0A9": "♥",
  "\uF0AA": "♠",
  "\uF0AB": "↔",
  "\uF0AC": "←",
  "\uF0AD": "↑",
  "\uF0AE": "→",
  "\uF0AF": "↓",
  "\uF0B0": "°",
  "\uF0B1": "±",
  "\uF0B2": "″",
  "\uF0B3": "≥",
  "\uF0B4": "×",
  "\uF0B5": "∝",
  "\uF0B6": "∂",
  "\uF0B7": "•",
  "\uF0B8": "÷",
  "\uF0B9": "≠",
  "\uF0BA": "≡",
  "\uF0BB": "≈",
  "\uF0BC": "…",
  "\uF0BD": "|",
  "\uF0BE": "−",
  "\uF0BF": "↵",
  "\uF0C0": "ℵ",
  "\uF0C1": "ℑ",
  "\uF0C2": "ℜ",
  "\uF0C3": "℘",
  "\uF0C4": "⊗",
  "\uF0C5": "⊕",
  "\uF0C6": "∅",
  "\uF0C7": "∩",
  "\uF0C8": "∪",
  "\uF0C9": "⊃",
  "\uF0CA": "⊇",
  "\uF0CB": "⊄",
  "\uF0CC": "⊂",
  "\uF0CD": "⊆",
  "\uF0CE": "∈",
  "\uF0CF": "∉",
  "\uF0D0": "∠",
  "\uF0D1": "∇",
  "\uF0D2": "®",
  "\uF0D3": "©",
  "\uF0D4": "™",
  "\uF0D5": "∏",
  "\uF0D6": "√",
  "\uF0D7": "⋅",
  "\uF0D8": "¬",
  "\uF0D9": "∧",
  "\uF0DA": "∨",
  "\uF0DB": "⇔",
  "\uF0DC": "⇐",
  "\uF0DD": "⇒",
  "\uF0DE": "⇑",
  "\uF0DF": "⇓",
  "\uF0E0": "◊",
  "\uF0E1": "⟨",
  "\uF0E2": "⟩",
  "\uF0E5": "∑",
  "\uF0F0": "€",
  "\uF0F2": "∫",
  // Wingdings tick / cross
  "\uF0FC": "✓",
  "\uF0FB": "✗",
};

export function normalizeSymbols(text: string): string {
  if (!text) return "";
  let res = text.replace(/[\uF000-\uF0FF]/g, (ch) => {
    if (SYMBOL_FONT_MAP[ch]) return SYMBOL_FONT_MAP[ch];
    const code = ch.charCodeAt(0) - 0xf000;
    if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
    return "";
  });
  // Map control characters for tick and cross commonly extracted from Cambridge PDFs
  res = res.replace(/\u0016/g, "✓").replace(/[\u001A\u001a]/g, "✗");
  return res;
}

function stripArtifacts(text: string): string {
  if (!text) return "";
  return normalizeSymbols(text)
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
  return normalizeSymbols(stripArtifacts(t))
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

function joinHeaderLines(lines: string[]): string[] {
  const result: string[] = [];
  const endConnectors = /^(of|in|to|for|with|by|from|that|should|be|and|or|the|a|an|at|on|as|during|into|onto|high|low|thin|thick|folded|increased|decreased|stomatal|vascular|waxy|rough)$/i;
  const startConnectors = /^(of|in|to|for|with|by|from|that|and|or|the|a|an|at|on|as|during|into|onto)$/i;

  let current = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (!current) {
      current = l;
    } else {
      const lastWord = current.split(/\s+/).pop() || "";
      const firstWord = l.split(/\s+/)[0] || "";
      if (endConnectors.test(lastWord) || startConnectors.test(firstWord)) {
        current += " " + l;
      } else {
        result.push(current);
        current = l;
      }
    }
  }
  if (current) {
    result.push(current);
  }
  return result;
}

function parseHeadersSmart(headerBlock: string, numCols: number): string[] {
  if (!headerBlock || numCols <= 0) {
    return Array.from({ length: Math.max(numCols, 2) }, (_, i) => `Column ${i + 1}`);
  }

  const trimmed = headerBlock.trim();

  // Numbered headers: "1 2 3 4 5"
  if (/^(\d+\s+)+\d+$/.test(trimmed)) {
    return trimmed.split(/\s+/);
  }

  const rawLines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  const joinedLines = joinHeaderLines(rawLines);

  // Exact match with joined lines
  if (joinedLines.length === numCols) {
    return joinedLines;
  }

  // Exact multiple of joined lines
  if (joinedLines.length > numCols && joinedLines.length % numCols === 0) {
    const linesPerCol = joinedLines.length / numCols;
    const cols: string[] = [];
    for (let i = 0; i < numCols; i++) {
      cols.push(joinedLines.slice(i * linesPerCol, (i + 1) * linesPerCol).join(" "));
    }
    return cols;
  }

  // Multi-space separated
  const spaced = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
  if (spaced.length === numCols) {
    return spaced;
  }

  // Words count matches numCols
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === numCols) {
    return words;
  }

  // Group joined lines as evenly as possible
  if (joinedLines.length >= numCols) {
    const cols: string[] = [];
    const base = Math.floor(joinedLines.length / numCols);
    const rem = joinedLines.length % numCols;
    let idx = 0;
    for (let i = 0; i < numCols; i++) {
      const take = base + (i < rem ? 1 : 0);
      cols.push(joinedLines.slice(idx, idx + take).join(" "));
      idx += take;
    }
    return cols;
  }

  // Group words as evenly as possible
  if (words.length >= numCols) {
    const cols: string[] = [];
    const base = Math.floor(words.length / numCols);
    const rem = words.length % numCols;
    let idx = 0;
    for (let i = 0; i < numCols; i++) {
      const take = base + (i < rem ? 1 : 0);
      cols.push(words.slice(idx, idx + take).join(" "));
      idx += take;
    }
    return cols;
  }

  return Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
}

function splitRowSmart(rowText: string, numCols: number, allRows?: string[]): string[] {
  const trimmed = rowText.trim();
  if (numCols <= 1) return [trimmed];

  // If row contains ticks and crosses exclusively
  const symbols = trimmed.split(/\s+/).filter(Boolean);
  if (symbols.length === numCols && symbols.every((s) => /^[✓✗xX]$/.test(s))) {
    return symbols;
  }

  // Tab or multi-space
  const spaced = trimmed.split(/\s{2,}|\t+/).filter(Boolean);
  if (spaced.length === numCols) return spaced;

  // Exact newlines
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === numCols) return lines;

  // Exact word count
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === numCols) return tokens;

  // Multi-token equal size
  if (tokens.length > numCols && tokens.length % numCols === 0) {
    const size = tokens.length / numCols;
    const parts: string[] = [];
    for (let i = 0; i < numCols; i++) {
      parts.push(tokens.slice(i * size, (i + 1) * size).join(" "));
    }
    return parts;
  }

  // "only" delimiter for 2 columns: e.g. "1, 2 and 3 only 1, 2 and 4 only"
  if (numCols === 2 && trimmed.includes("only")) {
    const m = trimmed.match(/^([\s\S]+?\bonly\b)\s+([\s\S]+)$/i);
    if (m) {
      return [m[1].trim(), m[2].trim()];
    }
  }

  // For 2 columns: try matching common prefix/phrase if allRows provided
  if (numCols === 2 && allRows && allRows.length === 4) {
    for (const other of allRows) {
      if (other === rowText) continue;
      const oTokens = other.trim().split(/\s+/).filter(Boolean);
      let commonLen = 0;
      while (commonLen < tokens.length && commonLen < oTokens.length && tokens[commonLen] === oTokens[commonLen]) {
        commonLen++;
      }
      if (commonLen >= 2 && commonLen < tokens.length) {
        const col1 = tokens.slice(0, commonLen).join(" ");
        const col2 = tokens.slice(commonLen).join(" ");
        return [col1, col2];
      }
    }
  }

  // For 2 columns, split evenly
  if (numCols === 2 && tokens.length > 2) {
    const mid = Math.floor(tokens.length / 2);
    return [tokens.slice(0, mid).join(" "), tokens.slice(mid).join(" ")];
  }

  // For N columns, distribute tokens
  if (tokens.length > numCols) {
    const parts: string[] = [];
    const base = Math.floor(tokens.length / numCols);
    const rem = tokens.length % numCols;
    let idx = 0;
    for (let i = 0; i < numCols; i++) {
      const take = base + (i < rem ? 1 : 0);
      parts.push(tokens.slice(idx, idx + take).join(" "));
      idx += take;
    }
    return parts;
  }

  return [trimmed];
}

function formatTableQuestion(
  beforeOptions: string,
  rawOptions: Record<string, string>
): { questionText: string; options: Record<string, string> } {
  let aText = rawOptions.A || "";
  let bText = rawOptions.B || "";
  let cText = rawOptions.C || "";
  let dText = rawOptions.D || "";

  // 1. Detect and strip table key / legend on the right of rows (e.g. key, ✓ = ..., ✗ = ...)
  const keyItems: string[] = [];
  const keyMatchA = aText.match(/\bkey\b\s*$/i);
  if (keyMatchA) {
    keyItems.push("key");
    aText = aText.slice(0, keyMatchA.index).trim();
  }
  const legendRegex = /([✓✗xX]\s*=\s*[^\n]+)$/i;
  const matchB = bText.match(legendRegex);
  if (matchB) {
    keyItems.push(matchB[1].trim());
    bText = bText.slice(0, matchB.index).trim();
  }
  const matchC = cText.match(legendRegex);
  if (matchC) {
    keyItems.push(matchC[1].trim());
    cText = cText.slice(0, matchC.index).trim();
  }
  const matchD = dText.match(legendRegex);
  if (matchD) {
    keyItems.push(matchD[1].trim());
    dText = dText.slice(0, matchD.index).trim();
  }

  // Find question boundary (the last '?' or ':')
  const lastQMark = Math.max(beforeOptions.lastIndexOf("?"), beforeOptions.lastIndexOf(":"));
  const preamble = lastQMark !== -1 ? beforeOptions.slice(0, lastQMark + 1).trim() : beforeOptions.trim();
  const headerBlock = lastQMark !== -1 ? beforeOptions.slice(lastQMark + 1).trim() : "";

  // Check if this is a table question
  const allOptionText = aText + " " + bText + " " + cText + " " + dText;
  const hasTicksOrCrosses = /[✓✗]/.test(allOptionText);
  const hasTableKeyword = /\b(?:Which|In which|What)\s+(?:table\s+)?row\b|\bThe\s+table\s+(?:shows|lists|gives)\b|\bWhich\s+(?:table\s+)?changes\b/i.test(beforeOptions);
  const hasHeaderBlock = headerBlock.length > 0;
  const hasLegend = keyItems.length > 0;

  const isTable = (hasTableKeyword && (hasHeaderBlock || hasTicksOrCrosses)) || (hasTicksOrCrosses && (hasLegend || hasHeaderBlock));

  if (!isTable) {
    return { questionText: beforeOptions, options: rawOptions };
  }

  // Determine numCols
  const hTrim = headerBlock.trim();
  let numCols = 0;

  // Numbered headers: "1 2 3 4 5"
  if (/^(\d+\s+)+\d+$/.test(hTrim)) {
    numCols = hTrim.split(/\s+/).length;
  }

  // Ticks or crosses
  if (numCols === 0 && hasTicksOrCrosses) {
    const aTicks = aText.replace(/[^✓✗]/g, "");
    const bTicks = bText.replace(/[^✓✗]/g, "");
    if (aTicks.length >= 2 && aTicks.length === bTicks.length) {
      numCols = aTicks.length;
    }
  }

  // Repeating "only"
  if (numCols === 0 && (/\bonly\b[\s\S]+\bonly\b/i.test(aText) || (/\bonly\b/i.test(aText) && /\bonly\b/i.test(bText)))) {
    numCols = 2;
  }

  // Equal word counts across all 4 rows
  if (numCols === 0) {
    const aToks = aText.split(/\s+/).filter(Boolean);
    const bToks = bText.split(/\s+/).filter(Boolean);
    const cToks = cText.split(/\s+/).filter(Boolean);
    const dToks = dText.split(/\s+/).filter(Boolean);
    if (aToks.length >= 2 && aToks.length <= 6 && aToks.length === bToks.length && aToks.length === cToks.length && aToks.length === dToks.length) {
      numCols = aToks.length;
    }
  }

  // Header block lines
  if (numCols === 0 && hTrim) {
    const rawLines = hTrim.split("\n").map((l) => l.trim()).filter(Boolean);
    const joined = joinHeaderLines(rawLines);
    if (joined.length >= 2 && joined.length <= 5) {
      numCols = joined.length;
    }
  }

  if (numCols < 2 || numCols > 6) {
    numCols = 2;
  }

  const headers = parseHeadersSmart(headerBlock, numCols);
  const allRows = [aText, bText, cText, dText];

  const rowA = splitRowSmart(aText, numCols, allRows);
  const rowB = splitRowSmart(bText, numCols, allRows);
  const rowC = splitRowSmart(cText, numCols, allRows);
  const rowD = splitRowSmart(dText, numCols, allRows);

  // Build Markdown table
  const tableRows: string[] = [];
  tableRows.push(`| | ${headers.join(" | ")} |`);
  tableRows.push(`| :---: | ${headers.map(() => ":---:").join(" | ")} |`);
  tableRows.push(`| **A** | ${rowA.join(" | ")} |`);
  tableRows.push(`| **B** | ${rowB.join(" | ")} |`);
  tableRows.push(`| **C** | ${rowC.join(" | ")} |`);
  tableRows.push(`| **D** | ${rowD.join(" | ")} |`);

  let mdTable = tableRows.join("\n");
  const legendEntries = keyItems.filter((k) => k.toLowerCase() !== "key");
  if (legendEntries.length > 0) {
    mdTable += "\n\n**Key:**\n" + legendEntries.map((k) => `- ${k}`).join("\n");
  }

  const finalQuestion = (preamble + "\n\n" + mdTable).trim();

  return {
    questionText: finalQuestion,
    options: {
      A: rowA.join(" | "),
      B: rowB.join(" | "),
      C: rowC.join(" | "),
      D: rowD.join(" | "),
    },
  };
}

export async function parseExamPdfs(
  qpBuffer: ArrayBuffer | Uint8Array,
  msBuffer: ArrayBuffer | Uint8Array,
  filename: string
): Promise<ExamMergedJson> {
  // 1. Extract text from Marking Scheme using unpdf
  const msResult = await extractText(new Uint8Array(msBuffer));
  const rawMsPages = Array.isArray(msResult.text) ? msResult.text : [msResult.text || ""];
  const msPages = rawMsPages.map((p) => normalizeSymbols(p));
  const msFullText = msPages.join("\n");
  const answersMap = parseMarkingScheme(msFullText);

  // 2. Extract text from Question Paper using unpdf
  const qpResult = await extractText(new Uint8Array(qpBuffer));
  const rawQpPages = Array.isArray(qpResult.text) ? qpResult.text : [qpResult.text || ""];
  const qpPages = rawQpPages.map((p) => normalizeSymbols(p));

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
      const formatted = formatTableQuestion(optResult.beforeOptions, optResult.options);
      questionText = formatted.questionText;
      options = formatted.options;
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
