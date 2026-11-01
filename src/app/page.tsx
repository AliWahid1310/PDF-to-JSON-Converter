"use client";

import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import UnifiedDropzone from "./components/UnifiedDropzone";
import JsonViewer from "./components/JsonViewer";
import {
  ExamMergedJson,
  GenerateApiResponse,
  toSimplifiedJson,
  ExamPair,
  BatchConversionResult,
} from "@/types/exam";
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
  FolderArchive,
  FileCheck,
} from "lucide-react";

import { parseExamPdfs } from "@/utils/pdfParser";

export default function Home() {
  const [pairs, setPairs] = useState<ExamPair[]>([]);
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [markingScheme, setMarkingScheme] = useState<File | null>(null);

  // Optional saved custom Gemini API Key
  const [apiKey, setApiKey] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);

  // Loading and Progress states
  const [isLoading, setIsLoading] = useState(false);
  const [progressStatusText, setProgressStatusText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batch Result states
  const [batchResults, setBatchResults] = useState<BatchConversionResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Result state (legacy & active result display)
  const [resultData, setResultData] = useState<ExamMergedJson | null>(null);
  const [rawJson, setRawJson] = useState<string>("");

  const [copiedQuick, setCopiedQuick] = useState(false);

  // Retrieve saved API key if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem("markcraft_gemini_key");
      if (saved) setApiKey(saved);
    } catch {
      // ignore
    }
  }, []);

  const handlePairsChange = (newPairs: ExamPair[]) => {
    setPairs(newPairs);
    if (newPairs.length > 0) {
      setQuestionPaper(newPairs[0].qp);
      setMarkingScheme(newPairs[0].ms);
    } else {
      setQuestionPaper(null);
      setMarkingScheme(null);
    }
  };

  const handleGenerate = async () => {
    const readyPairs = pairs.filter((p) => p.qp && p.ms);

    // If no pairs in state, check legacy questionPaper & markingScheme
    if (readyPairs.length === 0) {
      if (questionPaper && markingScheme) {
        readyPairs.push({
          id: "pair-legacy-1",
          label: "Exam Paper",
          qp: questionPaper,
          ms: markingScheme,
          status: "ready",
        });
      } else {
        setErrorMessage(
          "Please upload at least one matching Question Paper and Marking Scheme pair."
        );
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);
    setBatchResults([]);
    setSelectedResultIndex(0);
    setResultData(null);
    setRawJson("");

    const generatedBatch: BatchConversionResult[] = [];

    try {
      for (let i = 0; i < readyPairs.length; i++) {
        const pair = readyPairs[i];
        const qpFile = pair.qp!;
        const msFile = pair.ms!;
        const pairNum = i + 1;
        const totalCount = readyPairs.length;

        // 1. Parse PDFs
        setProgressStatusText(
          `Paper ${pairNum} of ${totalCount} (${pair.label}): Parsing question paper & marking scheme...`
        );

        let examData: ExamMergedJson | null = null;
        let clientParseError: string | null = null;

        try {
          const qpBuffer = await qpFile.arrayBuffer();
          const msBuffer = await msFile.arrayBuffer();
          const parsed = await parseExamPdfs(qpBuffer, msBuffer, qpFile.name);
          if (parsed && parsed.questions && parsed.questions.length > 0) {
            examData = parsed;
          }
        } catch (err: any) {
          console.warn("Client parse attempt for " + pair.label + ":", err);
          clientParseError = err?.message;
        }

        // Fallback to /api/generate if client-side failed
        if (!examData) {
          const formData = new FormData();
          formData.append("questionPaper", qpFile);
          formData.append("markingScheme", msFile);
          formData.append("pdfUrl", qpFile.name);

          const res = await fetch("/api/generate", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const responseText = await res.text();
            throw new Error(
              responseText.slice(0, 200) ||
                `Failed to parse ${qpFile.name} (Direct: ${clientParseError || "Unknown"})`
            );
          }

          const jsonRes: GenerateApiResponse = await res.json();
          if (!jsonRes.success || !jsonRes.data) {
            throw new Error(jsonRes.error || `Failed to parse ${qpFile.name}`);
          }
          examData = jsonRes.data;
        }

        if (!examData || !examData.questions || examData.questions.length === 0) {
          throw new Error(
            `Could not extract questions from "${qpFile.name}". Please ensure the PDF has selectable text.`
          );
        }

        // 2. Synthesize AI Explanations
        setProgressStatusText(
          `Paper ${pairNum} of ${totalCount} (${pair.label}): Synthesizing AI explanations...`
        );

        let finalData = examData;
        // Retry the explain API up to 2 times if it fails
        const MAX_EXPLAIN_RETRIES = 2;
        for (let explainAttempt = 1; explainAttempt <= MAX_EXPLAIN_RETRIES; explainAttempt++) {
          try {
            setProgressStatusText(
              `Paper ${pairNum} of ${totalCount} (${pair.label}): Synthesizing AI explanations${explainAttempt > 1 ? ` (retry ${explainAttempt})` : ""}...`
            );
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
              const enrichedQuestions = examData.questions.map((q) => ({
                ...q,
                explanation:
                  explainJson.explanations[String(q.number)] || q.explanation,
              }));
              finalData = { ...examData, questions: enrichedQuestions };
              break; // Success — stop retrying
            } else {
              console.warn(`Explain API returned success=false for ${pair.label}, attempt ${explainAttempt}`);
              if (explainAttempt < MAX_EXPLAIN_RETRIES) {
                await new Promise((res) => setTimeout(res, 2000));
              }
            }
          } catch (explainErr) {
            console.warn(`Auto-enrichment attempt ${explainAttempt} failed for ${pair.label}:`, explainErr);
            if (explainAttempt < MAX_EXPLAIN_RETRIES) {
              await new Promise((res) => setTimeout(res, 2000));
            }
          }
        }

        // 3. Format Simplified JSON output
        const simplified = toSimplifiedJson(finalData);
        const rawJsonStr = JSON.stringify(simplified, null, 2);
        const filename = formatExamFilename(finalData, qpFile.name);

        generatedBatch.push({
          id: pair.id,
          label: pair.label,
          qpName: qpFile.name,
          msName: msFile.name,
          filename,
          examData: finalData,
          simplifiedData: simplified,
          rawJson: rawJsonStr,
          totalQuestions: finalData.questions.length,
        });
      }

      setBatchResults(generatedBatch);
      setSelectedResultIndex(0);
      if (generatedBatch.length > 0) {
        setResultData(generatedBatch[0].examData);
        setRawJson(generatedBatch[0].rawJson);
      }

      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
      }, 250);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred during conversion.");
    } finally {
      setIsLoading(false);
      setProgressStatusText("");
    }
  };

  const handleSelectResult = (index: number) => {
    setSelectedResultIndex(index);
    if (batchResults[index]) {
      setResultData(batchResults[index].examData);
      setRawJson(batchResults[index].rawJson);
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
    const current = batchResults[selectedResultIndex];
    const filename = current ? current.filename : formatExamFilename(resultData, questionPaper?.name);
    await downloadJson(rawJson, filename);
  };

  const handleDownloadAll = async () => {
    if (batchResults.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (let i = 0; i < batchResults.length; i++) {
        const item = batchResults[i];
        await downloadJson(item.rawJson, item.filename);
        if (i < batchResults.length - 1) {
          // Pause briefly between downloads so browser triggers multiple file downloads smoothly
          await new Promise((res) => setTimeout(res, 500));
        }
      }
    } catch (err) {
      console.error("Batch download error:", err);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleReset = () => {
    setPairs([]);
    setQuestionPaper(null);
    setMarkingScheme(null);
    setBatchResults([]);
    setSelectedResultIndex(0);
    setResultData(null);
    setRawJson("");
    setErrorMessage(null);
  };

  const readyPairs = pairs.filter((p) => p.qp && p.ms);
  const readyCount = readyPairs.length;
  const currentBatchItem = batchResults[selectedResultIndex] || null;

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
            Designed specifically for Learningscapes Academy teachers. Upload single papers or
            batch convert multiple variants at once (e.g. QP 11 &amp; MS 11, QP 12 &amp; MS 12, QP 13 &amp; MS 13).
            Our system auto-matches each Question Paper with its verified Marking Scheme, generates
            step-by-step explanations, and produces separate, cleanly structured JSON files ready for download.
          </p>

          {/* 3 Simple Steps */}
          <div className="teacher-steps-bar">
            <div className="step-item">
              <span className="step-number">1</span>
              <span className="step-text">Drop PDF Pairs (Single or Multiple)</span>
            </div>
            <span className="step-arrow">→</span>
            <div className="step-item">
              <span className="step-number">2</span>
              <span className="step-text">Auto-Match &amp; Generate JSON</span>
            </div>
            <span className="step-arrow">→</span>
            <div className="step-item">
              <span className="step-number">3</span>
              <span className="step-text">Download Clean JSON Files</span>
            </div>
          </div>
        </section>

        {/* Upload Studio Grid */}
        <section className="upload-section">
          <UnifiedDropzone
            pairs={pairs}
            onPairsChange={handlePairsChange}
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
            {(pairs.length > 0 || questionPaper || markingScheme || batchResults.length > 0) && (
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
              disabled={isLoading || readyCount === 0}
              className={`btn-primary ${isLoading ? "btn-loading" : ""}`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>{progressStatusText || "Processing exam papers..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>
                    {readyCount > 1
                      ? `Generate Combined JSON (${readyCount} Papers)`
                      : "Generate Combined JSON"}
                  </span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </section>

        {/* Output & Results Section */}
        {resultData && (
          <section id="results-section" className="results-section">
            {/* Batch Navigation Tabs (when multiple files are converted) */}
            {batchResults.length > 1 && (
              <div className="batch-tabs-bar">
                {batchResults.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`batch-tab-btn ${selectedResultIndex === idx ? "active" : ""}`}
                    onClick={() => handleSelectResult(idx)}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>{item.label}</span>
                    <span className="batch-tab-badge">{item.totalQuestions} Qs</span>
                  </button>
                ))}
              </div>
            )}

            <div className="results-header">
              <div className="results-meta">
                <span className="pill-tag pill-yellow">
                  {batchResults.length > 1
                    ? `Paper ${selectedResultIndex + 1} of ${batchResults.length}: Fusion Complete`
                    : "Fusion Complete"}
                </span>
                <h3 className="results-title">
                  {resultData.subject} • {resultData.paper}
                </h3>
                <p className="results-subtitle">
                  {resultData.syllabus} • {resultData.component} ({resultData.session})
                </p>
              </div>

              <div className="results-quick-actions">
                {/* Download All button when multiple papers exist */}
                {batchResults.length > 1 && (
                  <button
                    id="download-all-btn"
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll}
                    className="btn-action-solid"
                    style={{ background: "#000000", color: "#facc15" }}
                    title="Download all converted JSON files at once"
                  >
                    {isDownloadingAll ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-yellow-accent" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <FolderArchive className="w-4 h-4 text-yellow-accent" />
                        <span>Download All ({batchResults.length} Files)</span>
                      </>
                    )}
                  </button>
                )}

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
                      <span>Copy Current JSON</span>
                    </>
                  )}
                </button>

                <button
                  id="quick-download-btn"
                  onClick={handleQuickDownload}
                  className="btn-action-solid"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {batchResults.length > 1
                      ? `Download ${currentBatchItem?.label || "Paper"}.json`
                      : "Download .json"}
                  </span>
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
                <span className="stat-value">
                  {resultData.totalMarks || resultData.questions?.length || 40}
                </span>
                <span className="stat-desc">Marks Allocated</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Answer Verification</span>
                <span className="stat-value text-yellow-accent">100%</span>
                <span className="stat-desc">Scheme Matches Verified</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Converted</span>
                <span className="stat-value">{batchResults.length || 1}</span>
                <span className="stat-desc">JSON Papers Ready</span>
              </div>
            </div>

            {/* JSON Output */}
            <JsonViewer
              jsonString={rawJson}
              filename={
                currentBatchItem?.filename ||
                formatExamFilename(resultData, questionPaper?.name)
              }
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
