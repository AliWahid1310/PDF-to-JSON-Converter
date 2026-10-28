"use client";

import React from "react";
import { GraduationCap, Sparkles, CheckCircle2 } from "lucide-react";

interface HeaderProps {
  apiKey?: string;
  onOpenApiKeyModal?: () => void;
}

export default function Header({ apiKey, onOpenApiKeyModal }: HeaderProps) {
  const isCustomKey = Boolean(apiKey && apiKey.trim().length > 0);

  return (
    <header className="header-container">
      <div className="header-inner">
        <div className="brand-group">
          <div className="brand-icon">
            <GraduationCap className="icon-main" />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <h1 className="brand-title">Learningscapes Academy</h1>
              <span className="brand-badge">Teachers Suite</span>
            </div>
            <p className="brand-subtitle">
              Exam Paper &amp; Marking Scheme JSON Generator
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="system-pill">
            <Sparkles className="w-3.5 h-3.5 text-black" />
            <span>Direct PDF Parser</span>
          </div>

          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className="api-key-header-btn configured"
            title="Scientific conceptual explanations are enabled for all users. Click if you wish to configure a custom Gemini key."
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            <span>{isCustomKey ? "Custom Key Active" : "AI Explanations Ready"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
