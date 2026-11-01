"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import { ExamPair } from "@/types/exam";
import { detectRole, pairExamFiles } from "@/utils/filePairing";

interface UnifiedDropzoneProps {
  pairs: ExamPair[];
  onPairsChange: (pairs: ExamPair[]) => void;
  questionPaper?: File | null;
  markingScheme?: File | null;
  onFilesDetected?: (qp: File | null, ms: File | null) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function UnifiedDropzone({
  pairs,
  onPairsChange,
  questionPaper,
  markingScheme,
  onFilesDetected,
}: UnifiedDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetedPairRef = useRef<{ pairId: string; role: "qp" | "ms" } | null>(null);

  // Collect all currently held files
  const getAllFiles = (): File[] => {
    const list: File[] = [];
    for (const p of pairs) {
      if (p.qp) list.push(p.qp);
      if (p.ms) list.push(p.ms);
    }
    // Also include legacy single files if passed and not yet in pairs
    if (pairs.length === 0) {
      if (questionPaper) list.push(questionPaper);
      if (markingScheme) list.push(markingScheme);
    }
    return list;
  };

  const processFiles = (files: File[]) => {
    setErrorMsg(null);

    const pdfs = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfs.length === 0) {
      setErrorMsg("Please upload valid PDF files.");
      return;
    }

    // Check if user was targeting a specific slot in an existing pair
    if (targetedPairRef.current) {
      const { pairId, role } = targetedPairRef.current;
      targetedPairRef.current = null;
      const targetPdf = pdfs[0];

      const updated = pairs.map((p) => {
        if (p.id === pairId) {
          const nextQp = role === "qp" ? targetPdf : p.qp;
          const nextMs = role === "ms" ? targetPdf : p.ms;
          const status: ExamPair["status"] =
            nextQp && nextMs ? "ready" : nextQp ? "missing_ms" : "missing_qp";
          return { ...p, qp: nextQp, ms: nextMs, status };
        }
        return p;
      });

      onPairsChange(updated);
      if (onFilesDetected && updated.length > 0) {
        onFilesDetected(updated[0].qp, updated[0].ms);
      }
      return;
    }

    // General drop: merge with existing files and re-pair
    const existing = getAllFiles();
    const merged: File[] = [...existing];
    for (const p of pdfs) {
      if (!merged.some((f) => f.name === p.name && f.size === p.size)) {
        merged.push(p);
      }
    }

    const newPairs = pairExamFiles(merged);
    onPairsChange(newPairs);
    if (onFilesDetected && newPairs.length > 0) {
      onFilesDetected(newPairs[0].qp, newPairs[0].ms);
    }
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

  const handleRemovePair = (pairId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = pairs.filter((p) => p.id !== pairId);
    onPairsChange(updated);
    if (onFilesDetected) {
      if (updated.length > 0) onFilesDetected(updated[0].qp, updated[0].ms);
      else onFilesDetected(null, null);
    }
  };

  const handleRemoveSingleFile = (
    pairId: string,
    role: "qp" | "ms",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const updated = pairs
      .map((p) => {
        if (p.id === pairId) {
          const nextQp = role === "qp" ? null : p.qp;
          const nextMs = role === "ms" ? null : p.ms;
          if (!nextQp && !nextMs) return null;
          const status: ExamPair["status"] =
            nextQp && nextMs ? "ready" : nextQp ? "missing_ms" : "missing_qp";
          return { ...p, qp: nextQp, ms: nextMs, status };
        }
        return p;
      })
      .filter((p): p is ExamPair => p !== null);

    onPairsChange(updated);
    if (onFilesDetected) {
      if (updated.length > 0) onFilesDetected(updated[0].qp, updated[0].ms);
      else onFilesDetected(null, null);
    }
  };

  const handleSlotClick = (pairId: string, role: "qp" | "ms") => {
    targetedPairRef.current = { pairId, role };
    fileInputRef.current?.click();
  };

  const readyPairsCount = pairs.filter((p) => p.status === "ready").length;
  const hasFiles = pairs.length > 0;
  const isMultiple = pairs.length > 1;

  return (
    <div className="dropzone-card unified-dropzone-card">
      <div className="dropzone-header">
        <div>
          <span className="pill-tag pill-yellow">
            {isMultiple ? "Batch Multi-Paper Upload" : "One-Click Upload"}
          </span>
          <h3 className="dropzone-title">
            {isMultiple
              ? `Multiple Exam Papers & Marking Schemes (${pairs.length} Papers)`
              : "Drop Question Paper & Marking Scheme Together"}
          </h3>
        </div>

        {hasFiles && (
          <span className={`file-count-tag ${readyPairsCount === pairs.length ? "ready-all" : ""}`}>
            {readyPairsCount === pairs.length ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>
                  {pairs.length === 1 ? "Both Files Ready" : `All ${pairs.length} Papers Paired & Ready`}
                </span>
              </>
            ) : (
              <span>
                {readyPairsCount} of {pairs.length} Papers Ready ({pairs.length - readyPairsCount} Missing Match)
              </span>
            )}
          </span>
        )}
      </div>

      <p className="dropzone-desc">
        Select or drop all your PDFs into this single box. Upload one paper pair or multiple variants simultaneously (e.g.{" "}
        <strong>QP 11 &amp; MS 11, QP 12 &amp; MS 12, QP 13 &amp; MS 13</strong>). Our system auto-matches each Question Paper with its exact Marking Scheme.
      </p>

      <div
        id="unified-dropzone"
        className={`dropzone-surface unified-surface ${isDragging ? "is-dragging" : ""} ${
          hasFiles ? "has-file" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          targetedPairRef.current = null;
          fileInputRef.current?.click();
        }}
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
              <span className="upload-cta">Click to browse</span> or drag &amp; drop all PDFs here
            </div>
            <p className="upload-hint">
              Drop single or multiple files (e.g. QP 11, MS 11, QP 12, MS 12...) • Files are automatically paired by exam code and variant
            </p>
          </div>
        ) : (
          <div className="unified-files-list" onClick={(e) => e.stopPropagation()}>
            {pairs.map((pair, idx) => (
              <div key={pair.id} className="batch-pair-card">
                <div className="batch-pair-header">
                  <div className="batch-pair-title-box">
                    <Layers className="w-4 h-4 text-black" />
                    <span className="batch-pair-label">{pair.label}</span>
                    {pair.status === "ready" ? (
                      <span className="batch-pair-badge badge-ready">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paired Ready
                      </span>
                    ) : pair.status === "missing_ms" ? (
                      <span className="batch-pair-badge badge-warning">
                        Missing Marking Scheme
                      </span>
                    ) : (
                      <span className="batch-pair-badge badge-warning">
                        Missing Question Paper
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="batch-btn-remove-pair"
                    onClick={(e) => handleRemovePair(pair.id, e)}
                    title={`Remove ${pair.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-black" />
                    <span>Remove</span>
                  </button>
                </div>

                <div className="batch-pair-files">
                  {/* QP Row */}
                  <div className={`unified-file-row ${pair.qp ? "filled" : "empty"}`}>
                    <div className="unified-file-role">
                      <span className="unified-role-badge role-qp">QP</span>
                    </div>
                    {pair.qp ? (
                      <>
                        <div className="file-icon-box">
                          <FileText className="w-5 h-5 text-black" />
                        </div>
                        <div className="file-info-details">
                          <span className="selected-filename" title={pair.qp.name}>
                            {pair.qp.name}
                          </span>
                          <span className="selected-filesize">
                            {formatSize(pair.qp.size)} • Question Paper
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={(e) => handleRemoveSingleFile(pair.id, "qp", e)}
                          title="Remove Question Paper"
                        >
                          <X className="w-4 h-4 text-black" />
                        </button>
                      </>
                    ) : (
                      <div
                        className="unified-empty-slot"
                        onClick={() => handleSlotClick(pair.id, "qp")}
                      >
                        <span className="unified-empty-text">
                          Question Paper missing for {pair.label}. <u>Click to select QP</u>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MS Row */}
                  <div className={`unified-file-row ${pair.ms ? "filled" : "empty"}`}>
                    <div className="unified-file-role">
                      <span className="unified-role-badge role-ms">MS</span>
                    </div>
                    {pair.ms ? (
                      <>
                        <div className="file-icon-box">
                          <FileText className="w-5 h-5 text-black" />
                        </div>
                        <div className="file-info-details">
                          <span className="selected-filename" title={pair.ms.name}>
                            {pair.ms.name}
                          </span>
                          <span className="selected-filesize">
                            {formatSize(pair.ms.size)} • Marking Scheme
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={(e) => handleRemoveSingleFile(pair.id, "ms", e)}
                          title="Remove Marking Scheme"
                        >
                          <X className="w-4 h-4 text-black" />
                        </button>
                      </>
                    ) : (
                      <div
                        className="unified-empty-slot"
                        onClick={() => handleSlotClick(pair.id, "ms")}
                      >
                        <span className="unified-empty-text">
                          Marking Scheme missing for {pair.label}. <u>Click to select MS</u>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Bottom Actions Bar */}
            <div className="unified-actions-bar">
              <button
                type="button"
                className="unified-add-more-btn"
                onClick={() => {
                  targetedPairRef.current = null;
                  fileInputRef.current?.click();
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Papers / Variants</span>
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
