"use client";

import React from "react";
import { GraduationCap, Sparkles } from "lucide-react";

export default function Header() {
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
        </div>
      </div>
    </header>
  );
}
