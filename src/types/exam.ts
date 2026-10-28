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

export interface GenerateApiResponse {
  success: boolean;
  data?: ExamMergedJson;
  rawJson?: string;
  error?: string;
  isDemo?: boolean;
  note?: string;
}
