import { ExamMergedJson } from "@/types/exam";

/**
 * Generates the standardized exam JSON filename according to:
 * Subjectcode_year_session_variant e.g. for biology (9700_2026_f_m_12.json)
 *
 * Key:
 * f_m for february/march session
 * m_j for may/june session
 * o_n for oct/nov session
 */
export function formatExamFilename(
  examData?: Partial<ExamMergedJson> | null,
  fallbackFilename?: string
): string {
  if (!examData) {
    if (fallbackFilename) {
      const base = fallbackFilename.replace(/\.[^/.]+$/, "");
      return `${base}.json`;
    }
    return "exam.json";
  }

  const candidateSources = [
    examData.paper,
    examData.pdfUrl,
    fallbackFilename,
    examData.syllabus,
  ].filter(Boolean) as string[];

  // 1. Subject code (e.g. 0455, 9700, 9702, 9708, 0610, etc.)
  let subjectCode = "";
  let variantFromSlash = "";

  // A. Check for explicit slash pattern first: e.g. "0455/11", "9708/12", "9702/11"
  for (const src of candidateSources) {
    const slashMatch = src.match(/(?:^|[^0-9])(\d{4})\/(\d{1,2})(?:[^0-9]|$)/);
    if (slashMatch) {
      subjectCode = slashMatch[1];
      variantFromSlash = slashMatch[2];
      break;
    }
  }

  // B. Check if any source starts with 4 digits: e.g. "0455_s23_qp_11.pdf", "9708_m18_qp_12.pdf"
  if (!subjectCode) {
    for (const src of candidateSources) {
      const startMatch = src.match(/^(?:qp|ms|exam)?[_\s-]*(\d{4})(?:[^0-9]|$)/i);
      if (startMatch) {
        subjectCode = startMatch[1];
        break;
      }
    }
  }

  // C. Find any 4-digit code that is NOT a calendar year (1990-2099)
  // e.g. "0455", "0610", "0620", "9700", "9702", "9708", "9709", "9618"
  if (!subjectCode) {
    for (const src of candidateSources) {
      const allFourDigits = [...src.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((m) => m[1]);
      for (const numStr of allFourDigits) {
        const num = parseInt(numStr, 10);
        if (num < 1990 || num > 2099) {
          subjectCode = numStr;
          break;
        }
      }
      if (subjectCode) break;
    }
  }

  // D. If still not found and there are multiple 4-digit numbers, pick the first one
  if (!subjectCode) {
    for (const src of candidateSources) {
      const allFourDigits = [...src.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((m) => m[1]);
      if (allFourDigits.length > 0) {
        subjectCode = allFourDigits[0];
        break;
      }
    }
  }

  // E. Fallback only if no 4-digit code could be found in ANY filename or metadata
  if (!subjectCode && examData.subject) {
    const subLower = examData.subject.toLowerCase();
    const isIGCSE = (examData.syllabus || "").toLowerCase().includes("igcse");
    if (subLower.includes("bio")) subjectCode = isIGCSE ? "0610" : "9700";
    else if (subLower.includes("chem")) subjectCode = isIGCSE ? "0620" : "9701";
    else if (subLower.includes("phys")) subjectCode = isIGCSE ? "0625" : "9702";
    else if (subLower.includes("math")) subjectCode = isIGCSE ? "0580" : "9709";
    else if (subLower.includes("comp")) subjectCode = isIGCSE ? "0478" : "9618";
    else if (subLower.includes("econ")) subjectCode = isIGCSE ? "0455" : "9708";
    else if (subLower.includes("bus")) subjectCode = isIGCSE ? "0450" : "9609";
    else if (subLower.includes("acc")) subjectCode = isIGCSE ? "0452" : "9706";
    else {
      subjectCode = subLower.replace(/[^a-z0-9]/g, "");
    }
  }

  if (!subjectCode) subjectCode = "exam";

  // 2. Year (4-digit: e.g. 2026, 2025, 2023)
  let year = "";
  const yearSources = [examData.session, examData.paper, examData.pdfUrl, fallbackFilename];
  for (const src of yearSources) {
    if (!src) continue;
    const yMatch = src.match(/\b(20\d{2})\b/);
    if (yMatch) {
      year = yMatch[1];
      break;
    }
  }
  if (!year) {
    // Check 2-digit year after session letter (e.g. m26, s25, s23, w24)
    for (const src of yearSources) {
      if (!src) continue;
      const shortYearMatch = src.match(/[msw](\d{2})\b/i);
      if (shortYearMatch) {
        year = `20${shortYearMatch[1]}`;
        break;
      }
    }
  }
  if (!year) year = new Date().getFullYear().toString();

  // 3. Session code (f_m, m_j, o_n)
  let sessionCode = "";
  const sessionText = `${examData.session || ""} ${examData.paper || ""} ${examData.pdfUrl || ""} ${fallbackFilename || ""}`.toLowerCase();

  if (
    sessionText.includes("feb") ||
    sessionText.includes("march") ||
    sessionText.includes("f_m") ||
    sessionText.includes("f/m") ||
    /\b[a-z0-9_]*_m\d{2}\b/i.test(sessionText) ||
    /_m_\d+/i.test(sessionText)
  ) {
    sessionCode = "f_m";
  } else if (
    sessionText.includes("may") ||
    sessionText.includes("june") ||
    sessionText.includes("m_j") ||
    sessionText.includes("m/j") ||
    /\b[a-z0-9_]*_s\d{2}\b/i.test(sessionText) ||
    /_s_\d+/i.test(sessionText)
  ) {
    sessionCode = "m_j";
  } else if (
    sessionText.includes("oct") ||
    sessionText.includes("nov") ||
    sessionText.includes("o_n") ||
    sessionText.includes("o/n") ||
    /\b[a-z0-9_]*_w\d{2}\b/i.test(sessionText) ||
    /_w_\d+/i.test(sessionText)
  ) {
    sessionCode = "o_n";
  } else {
    sessionCode = "f_m";
  }

  // 4. Variant (e.g. "12", "11", "13", "22")
  let variant = variantFromSlash;
  if (!variant) {
    const varSources = [examData.paper, examData.pdfUrl, examData.component, fallbackFilename];
    for (const src of varSources) {
      if (!src) continue;
      const clean = src.toLowerCase().replace(/\.pdf$/i, "");
      const m =
        clean.match(/(?:paper|component|variant|qp|ms)[_\s-]*([1-6][1-6])\b/i) ||
        clean.match(/_([1-6][1-6])$/) ||
        clean.match(/\b([1-6][1-6])\b/) ||
        clean.match(/_(\d{1,2})$/) ||
        clean.match(/\b(\d{1,2})\b/);
      if (m) {
        variant = m[1];
        break;
      }
    }
  }
  if (!variant) variant = "12";

  return `${subjectCode}_${year}_${sessionCode}_${variant}.json`;
}

/**
 * Downloads JSON using the native Save As dialog (showSaveFilePicker) with fallback.
 * Guarantees correct .json extension and user-selected save destination.
 */
export async function downloadJson(content: string | object, filename: string = "exam_marked.json") {
  const jsonString = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  let cleanFilename = filename.trim();
  if (!cleanFilename.toLowerCase().endsWith(".json")) {
    cleanFilename = `${cleanFilename}.json`;
  }

  // 1. Try showSaveFilePicker (Chrome, Edge, Opera)
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: cleanFilename,
        types: [
          {
            description: "JSON File",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled picker dialog
      if (err?.name === "AbortError") return;
      console.warn("showSaveFilePicker failed, falling back to blob anchor:", err);
    }
  }

  // 2. Standard blob anchor fallback
  try {
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  } catch (err) {
    console.error("Download failed:", err);
    alert("Download failed. Please try again.");
  }
}
