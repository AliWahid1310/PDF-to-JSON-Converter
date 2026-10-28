import { NextRequest, NextResponse } from "next/server";
import { parseExamPdfs } from "@/utils/pdfParser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const questionPaperFile = formData.get("questionPaper") as File | null;
    const markingSchemeFile = formData.get("markingScheme") as File | null;
    const customPdfUrl = (formData.get("pdfUrl") as string) || "";

    if (!questionPaperFile) {
      return NextResponse.json(
        { success: false, error: "Please upload the Question Paper PDF." },
        { status: 400 }
      );
    }

    if (!markingSchemeFile) {
      return NextResponse.json(
        { success: false, error: "Please upload the Marking Scheme PDF." },
        { status: 400 }
      );
    }

    const effectivePdfUrl =
      customPdfUrl.trim() ||
      questionPaperFile.name ||
      "exam_paper.pdf";

    const qpBuffer = Buffer.from(await questionPaperFile.arrayBuffer());
    const msBuffer = Buffer.from(await markingSchemeFile.arrayBuffer());

    // Directly parse the uploaded Question Paper and Marking Scheme PDFs
    const examData = await parseExamPdfs(qpBuffer, msBuffer, effectivePdfUrl);

    if (!examData.questions || examData.questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not extract questions from the uploaded Question Paper PDF. Please ensure the PDF contains selectable text (not scanned images).",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: examData,
      rawJson: JSON.stringify(examData, null, 2),
      isDemo: false,
    });
  } catch (error: any) {
    console.error("PDF Parsing API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process the uploaded PDFs.",
      },
      { status: 500 }
    );
  }
}
