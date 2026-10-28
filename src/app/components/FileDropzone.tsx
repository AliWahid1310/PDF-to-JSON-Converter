"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, X, AlertCircle } from "lucide-react";

interface FileDropzoneProps {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor?: "yellow" | "indigo" | "emerald";
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
}

export default function FileDropzone({
  id,
  title,
  subtitle,
  badge,
  badgeColor = "yellow",
  file,
  onFileSelect,
  accept = ".pdf,application/pdf",
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setErrorMsg(null);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const selected = droppedFiles[0];
      if (selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf")) {
        onFileSelect(selected);
      } else {
        setErrorMsg("Please upload a valid PDF document.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.type === "application/pdf" || selected.name.toLowerCase().endsWith(".pdf")) {
        onFileSelect(selected);
      } else {
        setErrorMsg("Please upload a valid PDF document.");
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="dropzone-card">
      <div className="dropzone-header">
        <div>
          <span className="pill-tag pill-yellow">{badge}</span>
          <h3 className="dropzone-title">{title}</h3>
        </div>
        {file && (
          <span className="file-ready-tag">
            <CheckCircle2 className="w-4 h-4 text-black" />
            <span>Ready</span>
          </span>
        )}
      </div>

      <p className="dropzone-desc">{subtitle}</p>

      <div
        id={id}
        className={`dropzone-surface ${isDragging ? "is-dragging" : ""} ${
          file ? "has-file" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {!file ? (
          <div className="dropzone-idle">
            <div className="upload-icon-wrapper">
              <UploadCloud className="w-8 h-8 text-black" />
            </div>
            <div className="upload-instructions">
              <span className="upload-cta">Click to browse</span> or drag and drop PDF
            </div>
            <p className="upload-hint">Supports standard exam PDFs up to 50MB</p>
          </div>
        ) : (
          <div className="dropzone-selected">
            <div className="file-icon-box">
              <FileText className="w-7 h-7 text-black" />
            </div>
            <div className="file-info-details">
              <span className="selected-filename" title={file.name}>
                {file.name}
              </span>
              <span className="selected-filesize">{formatSize(file.size)}</span>
            </div>
            <button
              type="button"
              className="btn-remove-file"
              onClick={handleRemove}
              title="Remove file"
            >
              <X className="w-4 h-4 text-black" />
            </button>
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
