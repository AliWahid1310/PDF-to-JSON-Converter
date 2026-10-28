import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let jsonContent = "";
    let filename = "exam_marked.json";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      jsonContent = typeof body.json === "string" ? body.json : JSON.stringify(body.json, null, 2);
      if (body.filename) filename = body.filename;
    } else {
      const formData = await req.formData();
      jsonContent = (formData.get("json") as string) || "";
      const rawName = formData.get("filename") as string;
      if (rawName) filename = rawName;
    }

    if (!filename.toLowerCase().endsWith(".json")) {
      filename = `${filename}.json`;
    }

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
