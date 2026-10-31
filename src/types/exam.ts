export interface QuestionItem {
  number: number;
  question: string;
  diagramDescription?: string;
  options?: Record<string, string> | null;
  correctAnswer: string;
  marks: number;
  explanation: string;
}

export interface ExamMergedJson {
  subject: string;
  syllabus: string;
  paper: string;
  component: string;
  session: string;
  duration: string;
  totalMarks: number;
  pdfUrl: string;
  questions: QuestionItem[];
}

// Simplified output shape for the downloaded/copied JSON
export interface SimplifiedQuestionItem {
  question_number: number;
  correct_answer: string;
  explanation: string;
}

export interface SimplifiedExamJson {
  pdfUrl: string;
  questions: SimplifiedQuestionItem[];
}

/** Transform full internal data to the simplified output shape */
export function toSimplifiedJson(data: ExamMergedJson): SimplifiedExamJson {
  return {
    pdfUrl: data.pdfUrl,
    questions: data.questions.map((q) => ({
      question_number: q.number,
      correct_answer: q.correctAnswer,
      explanation: q.explanation,
    })),
  };
}

export interface GenerateApiResponse {
  success: boolean;
  data?: ExamMergedJson;
  rawJson?: string;
  error?: string;
  isDemo?: boolean;
  note?: string;
}
