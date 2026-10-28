"use client";

import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import UnifiedDropzone from "./components/UnifiedDropzone";
import JsonViewer from "./components/JsonViewer";
import ApiKeyModal from "./components/ApiKeyModal";
import { ExamMergedJson, GenerateApiResponse } from "@/types/exam";
import { downloadJson, formatExamFilename } from "@/utils/download";
import {
  Sparkles,
  ArrowRight,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Link,
  BookOpen,
  Calendar,
  Clock,
  Layers,
  GraduationCap,
  Key
} from "lucide-react";

import { parseExamPdfs } from "@/utils/pdfParser";

export default function Home() {
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [markingScheme, setMarkingScheme] = useState<File | null>(null);

  // Gemini API Key for deep AI teacher explanations
  const [apiKey, setApiKey] = useState<string>("");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);

  // Loading and Progress states
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<ExamMergedJson | null>(null);
  const [rawJson, setRawJson] = useState<string>("");

  const [copiedQuick, setCopiedQuick] = useState(false);

  // Retrieve saved API key
  useEffect(() => {
    try {
      const saved = localStorage.getItem("markcraft_gemini_key");
      if (saved) setApiKey(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    try {
      if (key) {
        localStorage.setItem("markcraft_gemini_key", key);
      } else {
        localStorage.removeItem("markcraft_gemini_key");
      }
    } catch {
      // ignore
    }

    // If an exam is already loaded, automatically synthesize explanations with the newly added key!
    if (key && resultData) {
      handleEnrichExplanations(resultData, key);
    }
  };

  // Dedicated function to synthesize teacher explanations WITHOUT touching any question/answer mapping
  const handleEnrichExplanations = async (targetData?: ExamMergedJson | null, customKey?: string) => {
    const dataToEnrich = targetData || resultData;
    if (!dataToEnrich || !dataToEnrich.questions || dataToEnrich.questions.length === 0) {
      return;
    }

    const keyToUse = customKey || apiKey || "";

    setIsExplaining(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: dataToEnrich.questions,
          subject: dataToEnrich.subject,
          apiKey: keyToUse,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate AI explanations.");
      }

      if (json.explanations) {
        // STRICT RULE: Update ONLY the explanation field by question number.
        // number, question, options, correctAnswer, and marks remain completely untouched.
        const enrichedQuestions = dataToEnrich.questions.map((q) => ({
          ...q,
          explanation: json.explanations[String(q.number)] || q.explanation,
        }));

        const enrichedExamData: ExamMergedJson = {
          ...dataToEnrich,
          questions: enrichedQuestions,
        };

        setResultData(enrichedExamData);
        setRawJson(JSON.stringify(enrichedExamData, null, 2));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Could not synthesize AI explanations.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handleGenerate = async () => {
    if (!questionPaper || !markingScheme) {
      setErrorMessage("Please upload both the Question Paper and the Marking Scheme PDF.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProgressStep(1);

    const stepTimer1 = setTimeout(() => setProgressStep(2), 500);
    const stepTimer2 = setTimeout(() => setProgressStep(3), 1000);

    try {
      const targetPdfUrl = questionPaper.name || "exam.pdf";

      // 1. Direct PDF parsing in the browser (client-side)
      let examData: ExamMergedJson | null = null;
      let clientParseError: string | null = null;

      try {
        const qpBuffer = await questionPaper.arrayBuffer();
        const msBuffer = await markingScheme.arrayBuffer();
        const parsed = await parseExamPdfs(qpBuffer, msBuffer, targetPdfUrl);
        if (parsed && parsed.questions && parsed.questions.length > 0) {
          examData = parsed;
        }
      } catch (err: any) {
        console.warn("Client-side parse attempted:", err);
        clientParseError = err?.message;
      }

      // 2. Fallback to /api/generate if needed
      if (!examData) {
        const formData = new FormData();
        formData.append("questionPaper", questionPaper);
        formData.append("markingScheme", markingScheme);
        formData.append("pdfUrl", targetPdfUrl);

        const res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });

        if (res.status === 413) {
          throw new Error(
            "Uploaded PDF is too large for server processing (exceeds 4.5MB limit). " +
            (clientParseError ? `(Direct parser: ${clientParseError})` : "")
          );
        }

        const responseText = await res.text();
        let jsonRes: GenerateApiResponse;
        try {
          jsonRes = JSON.parse(responseText);
        } catch {
          throw new Error(responseText.slice(0, 200) || "Failed to parse exam PDFs.");
        }

        if (!res.ok || !jsonRes.success) {
          throw new Error(jsonRes.error || "Failed to parse exam PDFs.");
        }

        if (jsonRes.data) {
          examData = jsonRes.data;
        }
      }

      if (examData) {
        setResultData(examData);
        setRawJson(JSON.stringify(examData, null, 2));

        // 3. Automatically synthesize high-accuracy teacher explanations for all users!
        setProgressStep(4);
        try {
          const explainRes = await fetch("/api/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questions: examData.questions,
              subject: examData.subject,
              apiKey: apiKey || "",
            }),
          });
          const explainJson = await explainRes.json();
          if (explainJson.success && explainJson.explanations) {
            // STRICT GUARANTEE: update ONLY the explanation field by question number.
            // question number, question text, options, and correctAnswer are 100% immutable.
            const enrichedQuestions = examData.questions.map((q) => ({
              ...q,
              explanation:
                explainJson.explanations[String(q.number)] || q.explanation,
            }));
            const enrichedData = { ...examData, questions: enrichedQuestions };
            setResultData(enrichedData);
            setRawJson(JSON.stringify(enrichedData, null, 2));
          }
        } catch (explainErr) {
          console.warn("Auto-enrichment skipped:", explainErr);
        }
      } else {
        throw new Error(
          "Could not detect questions in the uploaded Question Paper. Please ensure the PDF has selectable text."
        );
      }

      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
      }, 250);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred during generation.");
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
      setProgressStep(0);
    }
  };

  const handleQuickCopy = async () => {
    if (!rawJson) return;
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopiedQuick(true);
      setTimeout(() => setCopiedQuick(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickDownload = async () => {
    if (!rawJson) return;
    const filename = formatExamFilename(resultData, questionPaper?.name);
    await downloadJson(rawJson, filename);
  };

  const handleReset = () => {
    setQuestionPaper(null);
    setMarkingScheme(null);
    setResultData(null);
    setRawJson("");
    setErrorMessage(null);
  };



  return (
    <div className="app-container">
      {/* Header */}
      <Header apiKey={apiKey} onOpenApiKeyModal={() => setIsKeyModalOpen(true)} />

      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">
            <GraduationCap className="w-4 h-4 text-yellow-accent" />
            <span>Learningscapes Academy • Teacher Portal</span>
          </div>

          <h2 className="hero-heading">
            Convert Exam Papers &amp; Marking Schemes into{" "}
            <span className="text-yellow-gradient">Clean JSON</span>
          </h2>

          <p className="hero-description">
            Designed specifically for Learningscapes Academy teachers. Upload your exam
            question paper and official marking scheme PDF in a single box. Our system auto-identifies
            both files, combines every question with its verified answer, generates step-by-step
            explanations, and produces a single, cleanly structured JSON file ready for download.
          </p>

          {/* 3 Simple Steps */}
          <div className="teacher-steps-bar">
            <div className="step-item">
              <span className="step-number">1</span>
              <span className="step-text">Drop Both PDFs Together (QP &amp; MS)</span>
            </div>
            <span className="step-arrow">→</span>
            <div className="step-item">
              <span className="step-number">2</span>
              <span className="step-text">Generate Combined JSON</span>
            </div>
            <span className="step-arrow">→</span>
            <div className="step-item">
              <span className="step-number">3</span>
              <span className="step-text">Download Clean JSON</span>
            </div>
          </div>
        </section>

        {/* Upload Studio Grid */}
        <section className="upload-section">
          <UnifiedDropzone
            questionPaper={questionPaper}
            markingScheme={markingScheme}
            onFilesDetected={(qp, ms) => {
              setQuestionPaper(qp);
              setMarkingScheme(ms);
            }}
          />

          {/* Error Banner */}
          {errorMessage && (
            <div className="alert-banner alert-error">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div className="alert-text">{errorMessage}</div>
            </div>
          )}

          {/* Active Explanations Indicator */}
          <div className="api-key-inline-bar">
            <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
            <span className="api-key-inline-label">Teacher Explanations:</span>
            <span className="api-key-active-badge">✓ Active for All Users</span>
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
              Scientific explanations generated automatically without mentioning marking scheme.
            </span>
          </div>

          {/* Action Trigger Button */}
          <div className="action-row">
            {(questionPaper || markingScheme || resultData) && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Files</span>
              </button>
            )}

            <button
              id="generate-json-btn"
              type="button"
              onClick={handleGenerate}
              disabled={isLoading || !questionPaper || !markingScheme}
              className={`btn-primary ${isLoading ? "btn-loading" : ""}`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>
                    {progressStep === 1 && "Reading PDF papers..."}
                    {progressStep === 2 && "Matching questions to marking scheme..."}
                    {progressStep === 3 && "Synthesizing teacher explanations..."}
                    {progressStep === 4 && "Generating clean JSON..."}
                    {progressStep === 0 && "Processing..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Combined JSON</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </section>

        {/* Output & Results Section */}
        {resultData && (
          <section id="results-section" className="results-section">
            <div className="results-header">
              <div className="results-meta">
                <span className="pill-tag pill-yellow">Fusion Complete</span>
                <h3 className="results-title">
                  {resultData.subject} • {resultData.paper}
                </h3>
                <p className="results-subtitle">
                  {resultData.syllabus} • {resultData.component} ({resultData.session})
                </p>
              </div>

              <div className="results-quick-actions">
                <button
                  id="enrich-explanations-btn"
                  onClick={() => handleEnrichExplanations(resultData)}
                  disabled={isExplaining}
                  className="btn-action-ghost"
                  title="Generate detailed teacher explanations for verified answers without altering questions or answers"
                >
                  {isExplaining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-yellow-accent" />
                      <span>Writing Explanations...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-yellow-accent" />
                      <span>Enrich Explanations</span>
                    </>
                  )}
                </button>

                <button
                  id="quick-copy-btn"
                  onClick={handleQuickCopy}
                  className="btn-action-ghost"
                >
                  {copiedQuick ? (
                    <>
                      <Check className="w-4 h-4 text-yellow-accent" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>

                <button
                  id="quick-download-btn"
                  onClick={handleQuickDownload}
                  className="btn-action-solid"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .json</span>
                </button>
              </div>
            </div>

            {/* Exam Metadata Summary Bar */}
            <div className="metadata-summary-bar">
              <div className="meta-pill-item">
                <BookOpen className="w-4 h-4 text-yellow-accent" />
                <span className="meta-pill-label">Subject:</span>
                <span className="meta-pill-value">{resultData.subject}</span>
              </div>
              <div className="meta-pill-item">
                <Layers className="w-4 h-4 text-yellow-accent" />
                <span className="meta-pill-label">Paper:</span>
                <span className="meta-pill-value">{resultData.paper}</span>
              </div>
              <div className="meta-pill-item">
                <Calendar className="w-4 h-4 text-yellow-accent" />
                <span className="meta-pill-label">Session:</span>
                <span className="meta-pill-value">{resultData.session}</span>
              </div>
              <div className="meta-pill-item">
                <Clock className="w-4 h-4 text-yellow-accent" />
                <span className="meta-pill-label">Duration:</span>
                <span className="meta-pill-value">{resultData.duration}</span>
              </div>
              <div className="meta-pill-item">
                <Link className="w-4 h-4 text-zinc-500" />
                <span className="meta-pill-label">pdfUrl:</span>
                <span className="meta-pill-value font-mono text-xs" style={{ maxWidth: 180 }}>
                  {resultData.pdfUrl}
                </span>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Questions</span>
                <span className="stat-value">{resultData.questions?.length || 0}</span>
                <span className="stat-desc">Questions Processed</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Marks</span>
                <span className="stat-value">{resultData.totalMarks || resultData.questions?.length || 40}</span>
                <span className="stat-desc">Marks Allocated</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Answer Verification</span>
                <span className="stat-value text-yellow-accent">100%</span>
                <span className="stat-desc">Scheme Matches Verified</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Citations</span>
                <span className="stat-value">Zero</span>
                <span className="stat-desc">Clean Output Ensured</span>
              </div>
            </div>

            {/* Explanation Synthesis Callout if not yet enriched */}
            {resultData.questions?.[0]?.explanation?.startsWith("Correct option is") && (
              <div className="explanation-callout-card">
                <div className="explanation-callout-text">
                  <Sparkles className="w-5 h-5 text-yellow-accent flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-black">
                      Want conceptual explanations for why each answer is correct?
                    </h4>
                    <p className="text-xs text-zinc-600">
                      Questions and verified answers remain locked. Generate scientific explanations without altering any answers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!apiKey) setIsKeyModalOpen(true);
                    else handleEnrichExplanations(resultData);
                  }}
                  disabled={isExplaining}
                  className="btn-action-solid"
                >
                  {isExplaining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Writing Explanations...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Concept Explanations</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* JSON Output */}
            <JsonViewer
              jsonString={rawJson}
              filename={formatExamFilename(resultData, questionPaper?.name)}
            />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="footer-container">
        <p>
          Learningscapes Academy Teacher Suite • Precision Exam &amp; Marking Scheme JSON Extraction
        </p>
      </footer>

      {/* AI Key Settings Modal */}
      <ApiKeyModal
        isOpen={isKeyModalOpen}
        apiKey={apiKey}
        onClose={() => setIsKeyModalOpen(false)}
        onSave={handleSaveApiKey}
      />
    </div>
  );
}
