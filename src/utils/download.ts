/**
 * Downloads JSON using the native Save As dialog (showSaveFilePicker).
 * The user picks where to save — guarantees correct .json filename.
 */
export async function downloadJson(content: string | object, filename: string = "exam_marked.json") {
  const jsonString = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  let cleanFilename = filename.trim();
  if (!cleanFilename.toLowerCase().endsWith(".json")) {
    cleanFilename = `${cleanFilename}.json`;
  }

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
  } catch (err: any) {
    // User cancelled — do nothing
    if (err?.name === "AbortError") return;
    console.error("Download failed:", err);
    alert("Download failed. Please try again.");
  }
}
