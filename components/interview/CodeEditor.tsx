"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { Play, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { CodeAnalysis } from "@/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-500 text-sm">
      Loading editor…
    </div>
  ),
});

interface CodeEditorProps {
  sessionId: string;
  question: string;
}

const LANGUAGES = ["javascript", "typescript", "python", "java", "cpp"];
const DEFAULT_CODE: Record<string, string> = {
  javascript: "// Write your solution here\nfunction solution() {\n  \n}\n",
  typescript: "// Write your solution here\nfunction solution(): void {\n  \n}\n",
  python: "# Write your solution here\ndef solution():\n    pass\n",
  java: "// Write your solution here\npublic class Solution {\n    public void solve() {\n        \n    }\n}\n",
  cpp: "// Write your solution here\n#include <bits/stdc++.h>\nusing namespace std;\n\nvoid solution() {\n    \n}\n",
};

export default function CodeEditor({ sessionId, question }: CodeEditorProps) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(DEFAULT_CODE["javascript"]);
  const [isRunning, setIsRunning] = useState(false);
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!code.trim()) return;
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/interview/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code, question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      setAnalysis(data.analysis as CodeAnalysis);
      setShowAnalysis(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsRunning(false);
    }
  }

  function handleLanguageChange(lang: string) {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang] ?? "");
    setAnalysis(null);
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-500">Code Editor</span>
        </div>
        <Button
          size="sm"
          onClick={handleRun}
          disabled={isRunning || !code.trim()}
        >
          {isRunning ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</>
          ) : (
            <><Play className="w-3.5 h-3.5" /> Run & Analyze</>
          )}
        </Button>
      </div>

      {/* Monaco editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onChange={(val) => setCode(val ?? "")}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Analysis panel */}
      {(error || analysis) && (
        <div className="border-t border-zinc-800 bg-zinc-950">
          <button
            onClick={() => setShowAnalysis((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <span className="font-medium">
              {error ? "⚠️ Error" : analysis?.isCorrect ? "✅ Analysis" : "❌ Analysis"}
            </span>
            {showAnalysis ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>

          {showAnalysis && (
            <div className="px-4 pb-4 space-y-3 text-xs">
              {error && <p className="text-red-400">{error}</p>}

              {analysis && (
                <>
                  <div className="flex gap-4">
                    <span className="text-zinc-400">
                      Time: <span className="text-zinc-200 font-mono">{analysis.timeComplexity}</span>
                    </span>
                    <span className="text-zinc-400">
                      Space: <span className="text-zinc-200 font-mono">{analysis.spaceComplexity}</span>
                    </span>
                  </div>

                  {/* Test results */}
                  {analysis.testResults?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-medium">Test Cases</p>
                      {analysis.testResults.map((t, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span>{t.passed ? "✅" : "❌"}</span>
                          <span className="text-zinc-300">{t.name}</span>
                          {t.note && <span className="text-zinc-500">— {t.note}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bugs */}
                  {analysis.bugs?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-medium">Issues</p>
                      {analysis.bugs.map((b, i) => (
                        <p key={i} className="text-red-400">• {b}</p>
                      ))}
                    </div>
                  )}

                  {/* Suggestions */}
                  {analysis.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-zinc-500 font-medium">Suggestions</p>
                      {analysis.suggestions.map((s, i) => (
                        <p key={i} className="text-indigo-400">• {s}</p>
                      ))}
                    </div>
                  )}

                  <p className="text-zinc-400 leading-relaxed border-t border-zinc-800 pt-2">
                    {analysis.overallFeedback}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
