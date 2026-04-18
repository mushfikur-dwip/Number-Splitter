import { useState, useCallback, useEffect } from "react";
const XLSX:any={utils:{aoa_to_sheet:()=>({}),book_new:()=>({}),book_append_sheet:()=>{}},write:()=>new ArrayBuffer(0),writeFile:()=>{}};
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  History, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  Trash2,
  AlertCircle
} from "lucide-react";
import './_group.css';

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

export default function VariantA() {
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
  
  // Predict file names for preview
  const sessionIdPreview = "abc123";
  const previewChunks = Math.min(fileCount, 3);
  const hasMorePreview = fileCount > 3;

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
  }, [numbers, validSplitSize, format]);

  const handleClear = () => {
    setInput("");
    setLastResult(null);
  };

  const handleClearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/20">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:px-6">
        
        {/* Header */}
        <div className="mb-10 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm border border-primary/10 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full"></div>
            <Sparkles className="w-8 h-8 text-primary relative z-10" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Number Splitter
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            নম্বরগুলো পেস্ট করুন, ভাগের সংখ্যা দিন — Excel ফাইল ডাউনলোড করুন
          </p>
        </div>

        <div className="space-y-6">
          
          {/* Input Area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                নম্বর তালিকা
              </label>
              {numbers.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
                  <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                    {numbers.length.toLocaleString()} টি নম্বর
                  </span>
                  {duplicatesRemoved > 0 && (
                    <span className="text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {duplicatesRemoved} ডুপ্লিকেট বাদ
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className={`relative rounded-xl transition-all duration-200 ${input ? 'border border-border shadow-sm bg-card' : 'border-2 border-dashed border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-border'}`}>
              <textarea
                className={`w-full px-5 py-4 text-sm bg-transparent placeholder:text-muted-foreground/60 resize-none focus:outline-none leading-relaxed min-h-[240px] rounded-xl ${input ? 'font-mono text-foreground' : 'text-center'}`}
                placeholder={input ? "" : `নম্বরগুলো এখানে পেস্ট করুন (লাইন বাই লাইন বা Excel থেকে কপি করুন)\n\n01711234567\n01811234567\n01911234567\n...`}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setLastResult(null);
                }}
                spellCheck={false}
              />
              {input && (
                <div className="absolute bottom-3 right-3">
                  <button 
                    onClick={handleClear}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors"
                  >
                    পরিষ্কার করুন
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Unified Output Settings Card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold text-foreground block mb-3 sm:mb-2">
                  ফাইল ফরম্যাট
                </label>
                <div className="flex p-1 bg-muted rounded-lg border border-border/50 max-w-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("xlsx");
                      setLastResult(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      format === "xlsx"
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat("csv");
                      setLastResult(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      format === "csv"
                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    CSV
                  </button>
                </div>
              </div>
              
              <div className="hidden sm:block w-px h-12 bg-border/50 self-center"></div>
              
              <div className="flex-1 sm:text-right">
                <label htmlFor="split-size" className="text-sm font-semibold text-foreground block mb-2">
                  প্রতিটি ফাইলে কতটি নম্বর?
                </label>
                <div className="flex items-center sm:justify-end gap-3">
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
                    className="w-28 px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary font-mono shadow-sm"
                  />
                  <span className="text-sm text-muted-foreground font-medium">টি করে</span>
                </div>
              </div>
            </div>

            {/* Live Preview Stats row inside the card */}
            <div className="px-5 py-3 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-semibold text-foreground">{fileCount}টি</span>{" "}
                ফাইল তৈরি হবে
                {numbers.length > 0 && validSplitSize > 0 && (
                   <span className="text-xs opacity-70 ml-1">
                     ({numbers.length.toLocaleString()} ÷ {validSplitSize})
                   </span>
                )}
              </div>

              {fileCount > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Array.from({ length: previewChunks }).map((_, i) => (
                    <span key={i} className="text-xs font-mono bg-muted/50 border border-border/50 text-muted-foreground px-2 py-0.5 rounded-md">
                      {sessionIdPreview}_p{i+1}.{format}
                    </span>
                  ))}
                  {hasMorePreview && (
                    <span className="text-xs text-muted-foreground px-1">+{fileCount - 3}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Success Banner */}
          {lastResult && (
            <div className="rounded-xl border-t-4 border-t-green-500 border-x border-b border-border bg-card shadow-sm px-5 py-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-foreground">
                    ডাউনলোড সম্পন্ন হয়েছে!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">{lastResult.totalNumbers.toLocaleString()}</span> টি নম্বর — <span className="font-semibold text-foreground">{lastResult.fileCount}</span> টি ফাইল
                    <span className="mx-2 text-border">•</span>
                    Session: <span className="font-mono font-medium text-foreground">{lastResult.sessionId}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {lastResult.fileNames.map((name) => (
                      <span key={name} className="text-xs font-mono bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-md">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Area */}
          <div className="pt-2">
            <button
              onClick={handleSplitAndDownload}
              disabled={numbers.length === 0 || isDownloading}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 rounded-xl text-base font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {isDownloading ? (
                <>
                  <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {downloadProgress
                    ? `ডাউনলোড হচ্ছে… ${downloadProgress.current}/${downloadProgress.total}`
                    : "তৈরি হচ্ছে..."}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" strokeWidth={2.5} />
                  Split &amp; Download (.{format})
                </>
              )}
            </button>
          </div>

          {/* History Collapsible */}
          <div className="mt-8 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">ডাউনলোড হিস্টোরি</span>
                {history.length > 0 && (
                  <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
                    {history.length}
                  </span>
                )}
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${showHistory ? "rotate-180" : ""}`} 
              />
            </button>

            {showHistory && (
              <div className="border-t border-border/50 bg-muted/5">
                {history.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    এখনো কোনো ডাউনলোড হিস্টোরি নেই
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-border/50 max-h-[320px] overflow-y-auto">
                      {history.map((entry) => (
                        <div key={entry.id} className="px-5 py-4 hover:bg-muted/30 transition-colors group">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 mb-1">
                                <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                                  {entry.sessionId}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">
                                  {formatDate(entry.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">
                                <span className="font-semibold">{entry.totalNumbers.toLocaleString()}</span> নম্বর
                                <span className="text-muted-foreground mx-1.5">→</span>
                                <span className="font-semibold">{entry.fileCount}</span> ফাইল
                                <span className="text-muted-foreground text-xs ml-1.5">({entry.splitSize}টি করে)</span>
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {entry.fileNames.map((name) => (
                                  <span key={name} className="text-xs font-mono text-muted-foreground bg-card border border-border/50 px-1.5 py-0.5 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-border/50 bg-muted/10 flex justify-end">
                      <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 font-medium px-2 py-1 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        হিস্টোরি মুছুন
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Instructions Panel - Quieter */}
          <div className="mt-8 rounded-xl bg-transparent border border-border/40 px-5 py-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              কিভাবে ব্যবহার করবেন
            </p>
            <ul className="text-sm text-muted-foreground/80 space-y-2.5 list-none">
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>উপরের বক্সে নম্বরগুলো পেস্ট করুন — লাইন বাই লাইন বা Excel/CSV থেকে কপি করে দিন</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>প্রতি ফাইলে কতটি নম্বর রাখতে চান সেটা লিখুন (যেমন ২০০)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>"Split &amp; Download" বাটনে ক্লিক করুন — সব ফাইল একসাথে ডাউনলোড হবে</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0 mt-0.5">4</span>
                <span>প্রতিটি ডাউনলোড সেশনে ইউনিক নাম (যেমন <span className="font-mono text-muted-foreground bg-muted px-1 rounded">abc123_part1.xlsx</span>) — কখনো ডুপ্লিকেট হবে না</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
