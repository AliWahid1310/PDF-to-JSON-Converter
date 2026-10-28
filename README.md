# MarkCraft AI — Question Paper & Marking Scheme Fusion Engine

A Next.js full-stack application (frontend + backend) that merges exam question paper PDFs and official marking scheme PDFs into one structured, verified, citation-free JSON file.

---

## ✨ Features

- **Dual-PDF Drag & Drop Studio**:
  - **Question Paper (PDF)**: Extracts full problem statements, sub-questions, and options.
  - **Marking Scheme (PDF)**: Extracts correct answers, marks allocations, and method rubrics.
- **Strict Instruction Enforcement**:
  - Follows your exact prompt:
    > *"Generate only the json code for this pdf. Mark it according to the marking scheme attached. Add he explanations with the correct answer as well. the pdf url variable should be pdfUrl. do not add cite"*
  - Cross-references each question number directly to its answer key.
  - Generates clear pedagogical explanations for why the answer is correct.
  - Binds the specified `pdfUrl` variable to the root object and each question item.
  - Strips all citation markers (`[cite: ...]`, `【...】`, etc.).
- **Interactive Multi-View Results**:
  - **Question Cards**: Question statements, correct answer badges, method rubric breakdown, and step-by-step explanations.
  - **Raw JSON Code Viewer**: Syntax-highlighted JSON viewer with filter, line numbers, and schema validator.
  - **Summary Table**: Compact table view for quick review.
- **Direct Download & Copy**:
  - One-click **Download .json** button.
  - One-click **Copy JSON** to clipboard with toast confirmation.
- **Built-in AI & Demo Mode**:
  - Supports live multimodal AI extraction via **Google Gemini 2.5 Flash / 1.5 Flash**.
  - Configure your Gemini API key via the top-right UI modal or `.env.local`.
  - Built-in instant **"Load Sample Exam & Marking Scheme"** demo button for testing without an API key.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Gemini API Key (Optional)
You can provide your key directly in the web app UI (saved in `localStorage`), or set it in `.env.local`:
```bash
cp .env.local.example .env.local
# Add your GEMINI_API_KEY
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📄 Output JSON Schema

```json
{
  "pdfUrl": "https://example.com/question-paper.pdf",
  "paperTitle": "Mathematics - Paper 1 (Pure Mathematics)",
  "subject": "Mathematics",
  "totalMarks": 75,
  "totalQuestions": 5,
  "questions": [
    {
      "questionNumber": 1,
      "subQuestion": "1(a)",
      "questionText": "Find the set of real values of k for which the quadratic equation...",
      "options": null,
      "correctAnswer": "k < -8 or k > 8",
      "markingCriteria": "M1: b² - 4ac > 0; M1: k² - 64 > 0; A1: k < -8 or k > 8",
      "marks": 3,
      "explanation": "For any quadratic equation to have two distinct real roots...",
      "pdfUrl": "https://example.com/question-paper.pdf"
    }
  ]
}
```
