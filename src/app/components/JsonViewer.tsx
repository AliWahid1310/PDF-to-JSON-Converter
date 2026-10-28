"use client";

import React from "react";
import { FileJson, ShieldCheck } from "lucide-react";

interface JsonViewerProps {
  jsonString: string;
  filename?: string;
}

export default function JsonViewer({
  jsonString,
  filename = "9702_s26_marked.json",
}: JsonViewerProps) {
  const hasCitations = /\[cite:[^\]]+\]|【[^】]+】|\bcite:/i.test(jsonString);

  return (
    <div className="json-viewer-container">
      <div className="jv-toolbar">
        <div className="jv-toolbar-left">
          <div className="jv-badge">
            <FileJson className="w-4 h-4 text-black" />
            <span>{filename}</span>
          </div>
          <div className={`jv-tag ${!hasCitations ? "jv-tag-success" : "jv-tag-warn"}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            <span>{!hasCitations ? "Clean Output • Valid JSON" : "Citations Detected"}</span>
          </div>
        </div>
      </div>

      <div className="jv-code-wrapper">
        <pre className="jv-pre">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
}
