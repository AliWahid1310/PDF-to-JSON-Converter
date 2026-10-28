"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, X, AlertCircle, ArrowLeftRight } from "lucide-react";

interface UnifiedDropzoneProps {
  questionPaper: File | null;
  markingScheme: File | null;
  onFilesDetected: (qp: File | null, ms: File | null) => void;
}

function detectRole(file: File): "qp" | "ms" | "unknown" {
  const name = file.name.toLowerCase();

  // 1. Explicit phrase matches: "question paper", "marking scheme", "mark scheme"
  const isQuestionPaperPhrase =
    name.includes("question paper") ||
    name.includes("question_paper") ||
    name.includes("question-paper") ||
    name.includes("questionpaper") ||
    name.includes("question papers") ||
    name.includes("question_papers");

  const isMarkingSchemePhrase =
    name.includes("marking scheme") ||
    name.includes("marking_scheme") ||
    name.includes("marking-scheme") ||
    name.includes("markingscheme") ||
    name.includes("mark scheme") ||
    name.includes("mark_scheme") ||
    name.includes("mark-scheme") ||
    name.includes("markscheme") ||
    name.includes("marking schemes") ||
    name.includes("marking_schemes");

  if (isQuestionPaperPhrase && !isMarkingSchemePhrase) return "qp";
  if (isMarkingSchemePhrase && !isQuestionPaperPhrase) return "ms";

  // 2. Token / word boundary matches (e.g. _qp_, -qp-, qp., "qp ", _ms_, -ms-, ms.)
  const isQpToken = /(?:^|[^a-z0-9])(qp)(?:[^a-z0-9]|$)/i.test(name);
  const isMsToken = /(?:^|[^a-z0-9])(ms)(?:[^a-z0-9]|$)/i.test(name);

  if (isQpToken && !isMsToken) return "qp";
  if (isMsToken && !isQpToken) return "ms";

  // 3. Fallback substring match if unambiguous
  const hasQp = name.includes("qp");
  const hasMs = name.includes("ms");
  if (hasQp && !hasMs) return "qp";
  if (hasMs && !hasQp) return "ms";

  return "unknown";
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function UnifiedDropzone({
  questionPaper,
  markingScheme,
  onFilesDetected,
}: UnifiedDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: File[]) => {
    setErrorMsg(null);

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfs.length === 0) {
      setErrorMsg("Please upload valid PDF files.");
      return;
    }

    let newQp = questionPaper;
    let newMs = markingScheme;

    for (const pdf of pdfs) {
      const role = detectRole(pdf);
      if (role === "qp") {
        newQp = pdf;
      } else if (role === "ms") {
        newMs = pdf;
      } else {
        // If one slot is empty, put it in the empty slot
        if (!newQp) {
          newQp = pdf;
        } else if (!newMs) {
          newMs = pdf;
        } else {
          setErrorMsg(
            `Could not auto-detect "${pdf.name}". Please ensure the filename contains "Question Paper" / "qp" or "Marking Scheme" / "ms".`
          );
        }
      }
    }

    onFilesDetected(newQp, newMs);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveQp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesDetected(null, markingScheme);
  };

  const handleRemoveMs = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesDetected(questionPaper, null);
  };

  const handleSwapRoles = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFilesDetected(markingScheme, questionPaper);
  };

  const hasFiles = Boolean(questionPaper || markingScheme);
  const bothReady = Boolean(questionPaper && markingScheme);

  return (
    <div className="dropzone-card unified-dropzone-card">
      <div className="dropzone-header">
        <div>
          <span className="pill-tag pill-yellow">One-Click Upload</span>
          <h3 className="dropzone-title">
            Drop Question Paper &amp; Marking Scheme Together
          </h3>
        </div>
        {bothReady ? (
          <span className="file-ready-tag">
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>Both Files Ready</span>
          </span>
        ) : (
          <span className="file-count-tag">
            {questionPaper && !markingScheme && "1 of 2 Uploaded (MS missing)"}
            {!questionPaper && markingScheme && "1 of 2 Uploaded (QP missing)"}
            {!questionPaper && !markingScheme && "0 of 2 Uploaded"}
          </span>
        )}
      </div>

      <p className="dropzone-desc">
        Select or drop both PDFs into this single box. Our system auto-detects files containing <strong>&quot;Question Paper&quot;</strong> or <strong>&quot;qp&quot;</strong> as Question Papers, and <strong>&quot;Marking Scheme&quot;</strong> or <strong>&quot;ms&quot;</strong> as Marking Schemes.
      </p>

      <div
        id="unified-dropzone"
        className={`dropzone-surface unified-surface ${isDragging ? "is-dragging" : ""} ${
          hasFiles ? "has-file" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {!hasFiles ? (
          <div className="dropzone-idle">
            <div className="upload-icon-wrapper">
              <UploadCloud className="w-8 h-8 text-black" />
            </div>
            <div className="upload-instructions">
              <span className="upload-cta">Click to browse</span> or drag &amp; drop both PDFs here
            </div>
            <p className="upload-hint">
              Drop both files at once • Filenames with &quot;Question Paper&quot; / &quot;qp&quot; and &quot;Marking Scheme&quot; / &quot;ms&quot; are automatically identified
            </p>
          </div>
        ) : (
          <div className="unified-files-list" onClick={(e) => e.stopPropagation()}>
            {/* Question Paper slot */}
            <div className={`unified-file-row ${questionPaper ? "filled" : "empty"}`}>
              <div className="unified-file-role">
                <span className="unified-role-badge role-qp">QP</span>
              </div>
              {questionPaper ? (
                <>
                  <div className="file-icon-box">
                    <FileText className="w-5 h-5 text-black" />
                  </div>
                  <div className="file-info-details">
                    <span className="selected-filename" title={questionPaper.name}>
                      {questionPaper.name}
                    </span>
                    <span className="selected-filesize">
                      {formatSize(questionPaper.size)} • Identified as <strong>Question Paper</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-file"
                    onClick={handleRemoveQp}
                    title="Remove Question Paper"
                  >
                    <X className="w-4 h-4 text-black" />
                  </button>
                </>
              ) : (
                <div
                  className="unified-empty-slot"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="unified-empty-text">
                    Question Paper not detected yet. <u>Click or drop QP file</u>
                  </span>
                </div>
              )}
            </div>

            {/* Marking Scheme slot */}
            <div className={`unified-file-row ${markingScheme ? "filled" : "empty"}`}>
              <div className="unified-file-role">
                <span className="unified-role-badge role-ms">MS</span>
              </div>
              {markingScheme ? (
                <>
                  <div className="file-icon-box">
                    <FileText className="w-5 h-5 text-black" />
                  </div>
                  <div className="file-info-details">
                    <span className="selected-filename" title={markingScheme.name}>
                      {markingScheme.name}
                    </span>
                    <span className="selected-filesize">
                      {formatSize(markingScheme.size)} • Identified as <strong>Marking Scheme</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-file"
                    onClick={handleRemoveMs}
                    title="Remove Marking Scheme"
                  >
                    <X className="w-4 h-4 text-black" />
                  </button>
                </>
              ) : (
                <div
                  className="unified-empty-slot"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="unified-empty-text">
                    Marking Scheme not detected yet. <u>Click or drop MS file</u>
                  </span>
                </div>
              )}
            </div>

            {/* Bottom bar of unified list */}
            <div className="unified-actions-bar">
              {bothReady && (
                <button
                  type="button"
                  className="unified-swap-btn"
                  onClick={handleSwapRoles}
                  title="Swap QP and MS roles if misdetected"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Swap Roles</span>
                </button>
              )}
              <button
                type="button"
                className="unified-add-more-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{bothReady ? "Replace / Upload More" : "Add Missing File"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="dropzone-error">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
