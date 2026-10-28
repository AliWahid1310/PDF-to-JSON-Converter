"use client";

import React, { useState } from "react";
import { QuestionItem } from "@/types/exam";
import { Check, CheckCircle2, ChevronDown, ChevronUp, Award, BookOpen, Image as ImageIcon } from "lucide-react";

interface QuestionCardProps {
  question: QuestionItem;
  index: number;
}

export default function QuestionCard({ question, index }: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const optionsEntries = question.options ? Object.entries(question.options) : [];

  return (
    <div className="question-card">
      <div className="qc-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="qc-header-left">
          <span className="qc-index-badge">Q{question.number}</span>
          <div className="qc-title-preview">
            <span className="qc-preview-text">
              {question.question.length > 110
                ? `${question.question.slice(0, 110)}...`
                : question.question}
            </span>
          </div>
        </div>

        <div className="qc-header-right">
          <span className="qc-marks-badge">
            <Award className="w-3.5 h-3.5 text-black" />
            {question.marks} {question.marks === 1 ? "Mark" : "Marks"}
          </span>
          <button className="qc-toggle-btn" aria-label="Toggle Question Details">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4 text-black" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="qc-body">
          {/* Question Text */}
          <div className="qc-section">
            <div className="qc-section-label">
              <BookOpen className="w-4 h-4 text-black" />
              <span>Question Statement</span>
            </div>
            <p className="qc-question-full">{question.question}</p>
          </div>

          {/* Diagram Description if present */}
          {question.diagramDescription && (
            <div className="qc-diagram-box">
              <div className="qc-diagram-header">
                <ImageIcon className="w-4 h-4 text-black" />
                <span>Diagram / Graph Details</span>
              </div>
              <p className="qc-diagram-text">{question.diagramDescription}</p>
            </div>
          )}

          {/* Options Grid */}
          {optionsEntries.length > 0 && (
            <div className="qc-section">
              <span className="qc-sublabel">Options:</span>
              <div className="qc-options-grid">
                {optionsEntries.map(([key, val]) => {
                  const isCorrect =
                    question.correctAnswer.trim().toUpperCase() === key.trim().toUpperCase() ||
                    question.correctAnswer.trim().toLowerCase() === val.trim().toLowerCase();
                  return (
                    <div
                      key={key}
                      className={`qc-option-item ${isCorrect ? "qc-option-correct" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="option-key-badge">{key}</span>
                        <span className="option-text">{val}</span>
                      </div>
                      {isCorrect && <Check className="w-4 h-4 text-black flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Verified Correct Answer */}
          <div className="qc-answer-box">
            <div className="qc-answer-header">
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span className="qc-answer-label">Marking Scheme Verified Answer</span>
            </div>
            <div className="qc-answer-value">
              Option {question.correctAnswer}
              {question.options && question.options[question.correctAnswer]
                ? ` — ${question.options[question.correctAnswer]}`
                : ""}
            </div>
          </div>

          {/* Pedagogical Explanation */}
          {question.explanation && (
            <div className="qc-explanation-box">
              <div className="qc-explanation-header">
                <span className="qc-bulb-icon">💡</span>
                <span className="qc-explanation-label">Teacher&apos;s Explanation &amp; Solution Steps</span>
              </div>
              <p className="qc-explanation-text">{question.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
