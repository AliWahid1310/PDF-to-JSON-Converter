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

  // 1. Subject code (e.g. 9700, 9702, 9701, 9709)
  let subjectCode = "";

  // Check paper string (e.g. "9700/12" or "9702/12")
  const paperMatch = examData.paper?.match(/(\d{4})\/(\d{1,2})/);
  if (paperMatch) {
    subjectCode = paperMatch[1];
  }

  // If not found in paper, check syllabus (e.g. "9700" or "Cambridge 9700")
  if (!subjectCode && examData.syllabus) {
    const sylMatch = examData.syllabus.match(/\b(\d{4})\b/);
    if (sylMatch) subjectCode = sylMatch[1];
  }

  // If not found, check pdfUrl (e.g. "9700 Biology March 2026...")
  if (!subjectCode && examData.pdfUrl) {
    const urlMatch = examData.pdfUrl.match(/\b(\d{4})\b/);
    if (urlMatch) subjectCode = urlMatch[1];
  }

  // Common Cambridge Subject Code Map fallback if subject name is given
  if (!subjectCode && examData.subject) {
    const subLower = examData.subject.toLowerCase();
    if (subLower.includes("bio")) subjectCode = "9700";
    else if (subLower.includes("chem")) subjectCode = "9701";
    else if (subLower.includes("phys")) subjectCode = "9702";
    else if (subLower.includes("math")) subjectCode = "9709";
    else if (subLower.includes("comp")) subjectCode = "9618";
    else if (subLower.includes("econ")) subjectCode = "9708";
    else if (subLower.includes("bus")) subjectCode = "9609";
    else if (subLower.includes("acc")) subjectCode = "9706";
    else {
      subjectCode = subLower.replace(/[^a-z0-9]/g, "");
    }
  }

  if (!subjectCode) subjectCode = "exam";

  // 2. Year (4-digit: e.g. 2026, 2025)
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
    // Check 2-digit year after session letter (e.g. m26, s25, w24)
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
  let variant = "";
  if (paperMatch) {
    variant = paperMatch[2];
  }
  if (!variant) {
    const varSources = [examData.paper, examData.pdfUrl, examData.component, fallbackFilename];
    for (const src of varSources) {
      if (!src) continue;
      const vMatch = src.match(/(?:paper|qp|ms|variant|scheme)?[_\s-]*(\d{1,2})\.pdf/i) ||
                     src.match(/(?:paper|component)[_\s]*(\d{1,2})\b/i) ||
                     src.match(/[_\s](\d{2})\b/);
      if (vMatch) {
        variant = vMatch[1];
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
