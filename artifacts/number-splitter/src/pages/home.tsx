import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

const HISTORY_KEY = "ns_download_history";
const MAX_HISTORY = 50;

type FileFormat = "xlsx" | "csv";

type HistoryEntry = {
  id: string;
  sessionId: string;
  timestamp: number;
  totalNumbers: number;
  splitSize: number;
  fileCount: number;
  fileNames: string[];
  format?: FileFormat;
};

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {}
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " " + d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

function parseNumbers(raw: string): { numbers: string[]; duplicatesRemoved: number } {
  const all = raw
    .split(/[\n\r\t,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const unique = Array.from(new Set(all));
  return { numbers: unique, duplicatesRemoved: all.length - unique.length };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function downloadXlsx(numbers: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(numbers.map((n) => [n, n]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Numbers");
  XLSX.writeFile(wb, filename);
}

function downloadCsv(numbers: string[], filename: string) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const csv = numbers.map((n) => `${escape(n)},${escape(n)}`).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [input, setInput] = useState("");
  const [splitSize, setSplitSize] = useState<number>(200);
  const [format, setFormat] = useState<FileFormat>("xlsx");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const { numbers, duplicatesRemoved } = parseNumbers(input);
  const validSplitSize = splitSize > 0 ? splitSize : 1;
  const fileCount = numbers.length > 0 ? Math.ceil(numbers.length / validSplitSize) : 0;

  const handleSplitAndDownload = useCallback(async () => {
    if (numbers.length === 0) return;
    setIsDownloading(true);

    const sessionId = generateSessionId();
    const chunks = chunkArray(numbers, validSplitSize);
    const ext = format;
    const fileNames = chunks.map((_, i) => `${sessionId}_part${i + 1}.${ext}`);

    try {
      for (let i = 0; i < chunks.length; i++) {
        setDownloadProgress({ current: i + 1, total: chunks.length });
        if (format === "csv") {
          downloadCsv(chunks[i], fileNames[i]);
        } else {
          downloadXlsx(chunks[i], fileNames[i]);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      setDownloadProgress(null);

      const entry: HistoryEntry = {
        id: `${Date.now()}-${sessionId}`,
        sessionId,
        timestamp: Date.now(),
        totalNumbers: numbers.length,
        splitSize: validSplitSize,
        fileCount: chunks.length,
        fileNames,
        format,
      };

      setLastResult(entry);
      const updated = [entry, ...loadHistory()];
      saveHistory(updated);
      setHistory(updated.slice(0, MAX_HISTORY));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [numbers, validSplitSize]);

  const handleClear = () => {
    setInput("");
    setLastResult(null);
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Number Splitter
          </h1>
          <p className="mt-2 text-muted-foreground text-base">
            নম্বরগুলো পেস্ট করুন, ভাগের সংখ্যা দিন — Excel ফাইল ডাউনলোড করুন
          </p>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">
                নম্বর তালিকা
              </label>
              {numbers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {numbers.length.toLocaleString()} টি নম্বর
                  </span>
                  {duplicatesRemoved > 0 && (
                    <span className="text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 px-2.5 py-1 rounded-full">
                      {duplicatesRemoved} ডুপ্লিকেট বাদ
                    </span>
                  )}
                </div>
              )}
            </div>
            <textarea
              className="w-full px-4 py-3 text-sm font-mono bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
              rows={12}
              placeholder={`নম্বরগুলো এখানে পেস্ট করুন (লাইন বাই লাইন বা Excel থেকে কপি করুন)\n\n01711234567\n01811234567\n01911234567\n...`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setLastResult(null);
              }}
              spellCheck={false}
            />
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <label className="text-sm font-semibold text-foreground">
                ফাইল ফরম্যাট
              </label>
            </div>
            <div className="px-4 py-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormat("xlsx");
                  setLastResult(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-150 active:scale-[0.98] ${
                  format === "xlsx"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6h6v6m-9 4h12a2 2 0 002-2V7l-5-5H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormat("csv");
                  setLastResult(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-150 active:scale-[0.98] ${
                  format === "csv"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                CSV (.csv)
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <label htmlFor="split-size" className="text-sm font-semibold text-foreground">
                প্রতিটি ফাইলে কতটি নম্বর?
              </label>
            </div>
            <div className="px-4 py-4 flex items-center gap-4">
              <input
                id="split-size"
                type="number"
                min={1}
                max={100000}
                value={splitSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setSplitSize(isNaN(v) ? 1 : Math.max(1, v));
                  setLastResult(null);
                }}
                className="w-32 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              {numbers.length > 0 && validSplitSize > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    <span className="font-semibold text-foreground">{fileCount}টি</span>{" "}
                    {format === "csv" ? "CSV" : "Excel"} ফাইল তৈরি হবে
                    <span className="ml-1 text-muted-foreground">
                      ({numbers.length.toLocaleString()} ÷ {validSplitSize} = {fileCount})
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {lastResult && (
            <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30 px-4 py-3">
              <div className="flex items-start gap-3 mb-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    ডাউনলোড সম্পন্ন হয়েছে!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                    {lastResult.totalNumbers.toLocaleString()} টি নম্বর — {lastResult.fileCount} টি ফাইল — Session:{" "}
                    <span className="font-mono font-semibold">{lastResult.sessionId}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lastResult.fileNames.map((name) => (
                      <span key={name} className="text-xs font-mono bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSplitAndDownload}
              disabled={numbers.length === 0 || isDownloading}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isDownloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {downloadProgress
                    ? `ডাউনলোড হচ্ছে… ${downloadProgress.current}/${downloadProgress.total}`
                    : "তৈরি হচ্ছে..."}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Split &amp; Download (.{format})
                </>
              )}
            </button>
            {input.length > 0 && (
              <button
                onClick={handleClear}
                className="px-4 py-3 rounded-xl text-sm font-semibold border border-border bg-card text-foreground transition-all duration-150 hover:bg-muted active:scale-[0.98]"
              >
                পরিষ্কার করুন
              </button>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold text-foreground">ডাউনলোড হিস্টোরি</span>
                {history.length > 0 && (
                  <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    {history.length}
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showHistory && (
              <div className="border-t border-border">
                {history.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    এখনো কোনো ডাউনলোড হিস্টোরি নেই
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-border max-h-80 overflow-y-auto">
                      {history.map((entry) => (
                        <div key={entry.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                                  {entry.sessionId}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(entry.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-foreground mt-1">
                                <span className="font-semibold">{entry.totalNumbers.toLocaleString()}</span> নম্বর →{" "}
                                <span className="font-semibold">{entry.fileCount}</span> ফাইল
                                <span className="text-muted-foreground ml-1">(প্রতি ফাইলে {entry.splitSize}টি)</span>
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {entry.fileNames.map((name) => (
                                  <span key={name} className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex justify-end">
                      <button
                        onClick={handleClearHistory}
                        className="text-xs text-destructive hover:underline font-medium"
                      >
                        হিস্টোরি মুছুন
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              কিভাবে ব্যবহার করবেন
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">1.</span>
                উপরের বক্সে নম্বরগুলো পেস্ট করুন — লাইন বাই লাইন বা Excel/CSV থেকে কপি করে দিন
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">2.</span>
                প্রতি ফাইলে কতটি নম্বর রাখতে চান সেটা লিখুন (যেমন ২০০)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">3.</span>
                "Split &amp; Download" বাটনে ক্লিক করুন — সব ফাইল একসাথে ডাউনলোড হবে
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">4.</span>
                প্রতিটি ডাউনলোড সেশনে ইউনিক নাম (যেমন <span className="font-mono">abc123_part1.xlsx</span>) — কখনো ডুপ্লিকেট হবে না
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
