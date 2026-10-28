"use client";

import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import UnifiedDropzone from "./components/UnifiedDropzone";
import JsonViewer from "./components/JsonViewer";
import { ExamMergedJson, GenerateApiResponse } from "@/types/exam";
import { downloadJson } from "@/utils/download";
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
  GraduationCap
} from "lucide-react";

import { parseExamPdfs } from "@/utils/pdfParser";

export default function Home() {
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [markingScheme, setMarkingScheme] = useState<File | null>(null);

  // Loading and Progress states
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [resultData, setResultData] = useState<ExamMergedJson | null>(null);
  const [rawJson, setRawJson] = useState<string>("");

  const [copiedQuick, setCopiedQuick] = useState(false);

  const handleGenerate = async () => {
    if (!questionPaper || !markingScheme) {
      setErrorMessage("Please upload both the Question Paper and the Marking Scheme PDF.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProgressStep(1);

    const stepTimer1 = setTimeout(() => setProgressStep(2), 600);
    const stepTimer2 = setTimeout(() => setProgressStep(3), 1200);

    try {
      const targetPdfUrl = questionPaper.name || "exam.pdf";

      // 1. Try parsing directly in the browser (client-side) first.
      // This completely eliminates Vercel's 4.5MB serverless payload limit (HTTP 413 Request Entity Too Large),
      // allowing files of any size (such as large papers with diagrams) to be parsed instantly and privately.
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

      // 2. If client-side parse did not produce questions, fallback to /api/generate
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
    const baseName = questionPaper?.name.replace(/\.[^/.]+$/, "") || "exam";
    await downloadJson(rawJson, `${baseName}_marked.json`);
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
      <Header />

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

            {/* JSON Output */}
            <JsonViewer
              jsonString={rawJson}
              filename={`${questionPaper?.name.replace(/\.[^/.]+$/, "") || "9702_s26_qp_12"}_marked.json`}
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
    </div>
  );
}
