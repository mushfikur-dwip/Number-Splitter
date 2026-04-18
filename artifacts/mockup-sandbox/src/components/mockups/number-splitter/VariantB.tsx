import { useState, useCallback, useEffect } from "react";
const XLSX:any={utils:{aoa_to_sheet:()=>({}),book_new:()=>({}),book_append_sheet:()=>{}},write:()=>new ArrayBuffer(0),writeFile:()=>{}};
import {
  FileSpreadsheet,
  FileText,
  Download,
  History,
  Settings2,
  Hash,
  ListOrdered,
  CheckCircle2,
  X,
  ChevronDown,
  HelpCircle,
  Loader2,
  Trash2
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

// Functions from the original code
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
  try {
    const ws = XLSX.utils.aoa_to_sheet(numbers.map((n) => [n, n]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Numbers");
    XLSX.writeFile(wb, filename);
  } catch (err) {
    console.error(err);
  }
}

function downloadCsv(numbers: string[], filename: string) {
  try {
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
  } catch (err) {
    console.error(err);
  }
}

export default function VariantB() {
  const [input, setInput] = useState("");
  const [splitSize, setSplitSize] = useState<number>(200);
  const [format, setFormat] = useState<FileFormat>("xlsx");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastResult, setLastResult] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900">
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col">
        {/* Slim Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Number Splitter</h1>
              <p className="text-sm text-slate-500 font-medium">নম্বরগুলো পেস্ট করুন, ভাগের সংখ্যা দিন — Excel ফাইল ডাউনলোড করুন</p>
            </div>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>কিভাবে ব্যবহার করবেন</span>
            </button>

            {showHelp && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-slate-900 text-sm">নির্দেশিকা</h3>
                  <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <ul className="text-sm text-slate-600 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5 text-xs bg-blue-50 w-4 h-4 rounded-full flex items-center justify-center shrink-0">1</span>
                    <span className="leading-tight">টেক্সট বক্সে নম্বরগুলো পেস্ট করুন (লাইন বাই লাইন)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5 text-xs bg-blue-50 w-4 h-4 rounded-full flex items-center justify-center shrink-0">2</span>
                    <span className="leading-tight">প্রতি ফাইলে কতটি নম্বর রাখতে চান তা সেট করুন</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold mt-0.5 text-xs bg-blue-50 w-4 h-4 rounded-full flex items-center justify-center shrink-0">3</span>
                    <span className="leading-tight">"Split & Download" বাটনে ক্লিক করে ফাইলগুলো নামিয়ে নিন</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </header>

        {/* Editor Surface */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden mb-6 flex-1 min-h-[500px]">
          
          {/* Toolbar */}
          <div className="h-14 bg-slate-50/80 border-b border-slate-200 px-4 flex items-center justify-between gap-4">
            {/* Format Toggles */}
            <div className="flex items-center bg-slate-200/50 p-1 rounded-lg">
              <button
                onClick={() => setFormat("xlsx")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  format === "xlsx" 
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/50" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
              <button
                onClick={() => setFormat("csv")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  format === "csv" 
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/50" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <FileText className="w-4 h-4" />
                CSV
              </button>
            </div>

            {/* Middle Stats */}
            <div className="flex-1 flex justify-center items-center">
              {numbers.length > 0 ? (
                <div className="flex items-center gap-3 bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold border border-blue-100">
                  <span className="flex items-center gap-1">
                    <ListOrdered className="w-3.5 h-3.5 opacity-70" />
                    {numbers.length.toLocaleString()} নম্বর
                  </span>
                  <span className="w-1 h-1 rounded-full bg-blue-300"></span>
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 opacity-70" />
                    {fileCount} ফাইল
                  </span>
                </div>
              ) : (
                <span className="text-xs font-medium text-slate-400">০ নম্বর</span>
              )}
            </div>

            {/* Split Size Input */}
            <div className="flex items-center gap-2">
              <label htmlFor="split-size" className="text-sm font-medium text-slate-600 whitespace-nowrap">
                প্রতি ফাইলে
              </label>
              <div className="relative">
                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="split-size"
                  type="number"
                  min={1}
                  max={100000}
                  value={splitSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSplitSize(isNaN(v) ? 1 : Math.max(1, v));
                  }}
                  className="w-24 pl-8 pr-3 py-1.5 text-sm font-mono font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
                />
              </div>
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1 relative bg-slate-50/30">
            <textarea
              className="absolute inset-0 w-full h-full p-6 text-sm font-mono text-slate-800 bg-transparent resize-none focus:outline-none focus:bg-white transition-colors leading-relaxed"
              placeholder="01711234567&#10;01811234567&#10;01911234567..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setLastResult(null);
              }}
              spellCheck={false}
            />
            {input.length === 0 && (
              <div className="absolute inset-0 pointer-events-none p-6 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
                  <ListOrdered className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">নম্বরগুলো এখানে পেস্ট করুন</p>
                <p className="text-xs">লাইন বাই লাইন বা Excel থেকে সরাসরি কপি করুন</p>
              </div>
            )}
            
            {/* Duplicates Badge Overlay */}
            {duplicatesRemoved > 0 && (
              <div className="absolute top-4 right-6 animate-in fade-in zoom-in pointer-events-none">
                <div className="bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" />
                  {duplicatesRemoved} ডুপ্লিকেট বাদ দেওয়া হয়েছে
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="h-16 bg-white border-t border-slate-200 px-4 flex items-center justify-between z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.02)]">
            <div className="flex items-center gap-3">
               {numbers.length > 0 ? (
                <div className="text-sm text-slate-600 font-medium">
                  <span className="font-bold text-slate-900">{fileCount}</span> টি ফাইল • <span className="font-bold text-slate-900">{numbers.length.toLocaleString()}</span> নম্বর • <span className="font-bold text-slate-900 uppercase">{format}</span>
                </div>
               ) : (
                <div className="text-sm text-slate-400 font-medium">ডাউনলোড করার জন্য নম্বর দিন</div>
               )}
            </div>

            <div className="flex items-center gap-3">
              {input.length > 0 && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  পরিষ্কার
                </button>
              )}
              <button
                onClick={handleSplitAndDownload}
                disabled={numbers.length === 0 || isDownloading}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-blue-600/20"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {downloadProgress 
                      ? `ডাউনলোড হচ্ছে… ${downloadProgress.current}/${downloadProgress.total}`
                      : "তৈরি হচ্ছে..."}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Split & Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Success Toast / Banner */}
        {lastResult && (
          <div className="mb-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-semibold text-emerald-900">ডাউনলোড সম্পন্ন হয়েছে!</h4>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Session: {lastResult.sessionId}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lastResult.fileNames.map(name => (
                    <span key={name} className="inline-flex items-center px-2 py-1 rounded bg-white/60 border border-emerald-200/50 text-xs font-mono text-emerald-800 shadow-sm">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setLastResult(null)} className="text-emerald-500 hover:text-emerald-700 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* History Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-auto">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="bg-slate-100 p-1.5 rounded-lg text-slate-500">
                <History className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-slate-800">ডাউনলোড হিস্টোরি</span>
              {history.length > 0 && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  {history.length}
                </span>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
          </button>

          {showHistory && (
            <div className="border-t border-slate-100 bg-slate-50/50">
              {history.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm font-medium text-slate-500 flex flex-col items-center gap-2">
                  <History className="w-8 h-8 text-slate-300" />
                  এখনো কোনো ডাউনলোড হিস্টোরি নেই
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {history.map((entry) => (
                      <div key={entry.id} className="px-5 py-3 hover:bg-white transition-colors flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-12 h-10 bg-slate-100 border border-slate-200 rounded-lg shrink-0">
                            <span className="text-xs font-bold text-slate-700">{entry.format?.toUpperCase() || 'XLSX'}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                {entry.sessionId}
                              </span>
                              <span className="text-xs font-medium text-slate-500">
                                {formatDate(entry.timestamp)}
                              </span>
                            </div>
                            <div className="text-sm text-slate-700">
                              <span className="font-bold">{entry.totalNumbers.toLocaleString()}</span> নম্বর • <span className="font-bold">{entry.fileCount}</span> ফাইল <span className="text-slate-400 text-xs">(প্রতিটিতে {entry.splitSize}টি)</span>
                            </div>
                          </div>
                        </div>
                        <div className="hidden sm:block text-right">
                           <div className="text-xs text-slate-400 font-mono truncate max-w-[200px]" title={entry.fileNames.join(', ')}>
                              {entry.fileNames.length > 2 
                                ? `${entry.fileNames[0]}, ${entry.fileNames[1]} +${entry.fileNames.length - 2} more` 
                                : entry.fileNames.join(', ')}
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-slate-100 bg-white flex justify-end">
                    <button
                      onClick={handleClearHistory}
                      className="text-xs flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md font-semibold transition-colors"
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

      </div>
    </div>
  );
}
