"use client";

import React, { useState, useEffect } from "react";
import { Key, X, Check, ExternalLink, ShieldCheck, Eye, EyeOff } from "lucide-react";

interface ApiKeyModalProps {
  isOpen: boolean;
  apiKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
}

export default function ApiKeyModal({
  isOpen,
  apiKey,
  onClose,
  onSave,
}: ApiKeyModalProps) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setInputKey(apiKey);
  }, [apiKey]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(inputKey.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const handleClear = () => {
    setInputKey("");
    onSave("");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-wrap">
              <Key className="w-5 h-5 text-black" />
            </div>
            <div>
              <h3 className="modal-title">AI Explanations Key</h3>
              <p className="modal-subtitle">
                Synthesize detailed teacher explanations for verified answers
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="modal-info-box">
              <ShieldCheck className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold leading-relaxed text-black">
                Your question &amp; answer mapping is 100% locked to your uploaded files and cannot be altered. The API key is used only to write academic explanations for why the verified answer is correct.
              </div>
            </div>

            <div>
              <label htmlFor="gemini-key-input" className="modal-label block mb-1.5">
                Google Gemini API Key
              </label>
              <div className="key-input-container">
                <input
                  id="gemini-key-input"
                  type={showKey ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="key-input"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="btn-toggle-eye"
                  aria-label="Toggle password visibility"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-500">Need a free key?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-black flex items-center gap-1"
              >
                <span>Get free Gemini API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="modal-footer">
            {apiKey ? (
              <button
                type="button"
                onClick={handleClear}
                className="btn-modal-clear"
              >
                Remove Key
              </button>
            ) : <div />}
            <div className="modal-footer-right">
              <button
                type="button"
                onClick={onClose}
                className="btn-modal-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-modal-save"
                disabled={!inputKey.trim()}
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Key</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
