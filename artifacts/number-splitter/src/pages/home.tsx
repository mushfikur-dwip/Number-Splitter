import { useState, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

const HISTORY_KEY = "ns_download_history";
const MAX_HISTORY = 50;
const EXPORT_HEADERS = [
  "Name*",
  "Mobile*",
  "Country*",
  "State*",
  "City*",
  "Departments*",
  "Description",
  "DistributeToCallerId",
  "DistributionCode",
  "RemindDate",
  "RepeateType",
];
const DEPARTMENT_OPTIONS = ["dep001", "dep002", "dep003", "dep004", "dep005"];
const FIXED_LOCATION = {
  country: "Pakistan",
  state: "Pak",
  city: "pak",
};

type FileFormat = "xlsx" | "csv";
type Department = (typeof DEPARTMENT_OPTIONS)[number];

type ExportOptions = {
  department: Department;
  callerId: string;
};

type HistoryEntry = {
  id: string;
  sessionId: string;
  timestamp: number;
  totalNumbers: number;
  splitSize: number;
  fileCount: number;
  fileNames: string[];
  format?: FileFormat;
  department?: Department;
  callerId?: string;
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
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
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

function buildExportRows(numbers: string[], options: ExportOptions): string[][] {
  return numbers.map((number) => [
    number,
    number,
    FIXED_LOCATION.country,
    FIXED_LOCATION.state,
    FIXED_LOCATION.city,
    options.department,
    "",
    options.callerId,
    "",
    "",
    "",
  ]);
}

function downloadXlsx(numbers: string[], filename: string, options: ExportOptions) {
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...buildExportRows(numbers, options)]);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Numbers");
  XLSX.writeFile(wb, filename);
}

function downloadCsv(numbers: string[], filename: string, options: ExportOptions) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const rows = [EXPORT_HEADERS, ...buildExportRows(numbers, options)];
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
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
  const [department, setDepartment] = useState<Department>("dep001");
  const [callerId, setCallerId] = useState("");
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
  const trimmedCallerId = callerId.trim();

  const handleSplitAndDownload = useCallback(async () => {
    if (numbers.length === 0) return;
    setIsDownloading(true);

    const sessionId = generateSessionId();
    const chunks = chunkArray(numbers, validSplitSize);
    const ext = format;
    const fileNames = chunks.map((_, i) => `${sessionId}_part${i + 1}.${ext}`);
    const exportOptions = { department, callerId: trimmedCallerId };

    try {
      for (let i = 0; i < chunks.length; i++) {
        setDownloadProgress({ current: i + 1, total: chunks.length });
        if (format === "csv") {
          downloadCsv(chunks[i], fileNames[i], exportOptions);
        } else {
          downloadXlsx(chunks[i], fileNames[i], exportOptions);
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
        department,
        callerId: trimmedCallerId,
      };

      setLastResult(entry);
      const updated = [entry, ...loadHistory()];
      saveHistory(updated);
      setHistory(updated.slice(0, MAX_HISTORY));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [numbers, validSplitSize, format, department, trimmedCallerId]);

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
            Paste phone numbers, choose the split size, and download Excel files
          </p>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground">
                Phone Numbers
              </label>
              {numbers.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {numbers.length.toLocaleString()} numbers
                  </span>
                  {duplicatesRemoved > 0 && (
                    <span className="text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 px-2.5 py-1 rounded-full">
                      {duplicatesRemoved} duplicates removed
                    </span>
                  )}
                </div>
              )}
            </div>
            <textarea
              className="w-full px-4 py-3 text-sm font-mono bg-card text-foreground placeholder:text-muted-foreground resize-none focus:outline-none leading-relaxed"
              rows={12}
              placeholder={`Paste phone numbers here (one per line or copied from Excel)\n\n923001234567\n923011234567\n923021234567\n...`}
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
                File Format
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
              <label className="text-sm font-semibold text-foreground">
                Excel Sheet Settings
              </label>
            </div>
            <div className="px-4 py-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="department" className="text-sm font-medium text-foreground">
                  Departments*
                </label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value as Department);
                    setLastResult(null);
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DEPARTMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="caller-id" className="text-sm font-medium text-foreground">
                  DistributeToCallerId
                </label>
                <input
                  id="caller-id"
                  type="text"
                  value={callerId}
                  onChange={(e) => {
                    setCallerId(e.target.value);
                    setLastResult(null);
                  }}
                  placeholder="Example: lhuser1459"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                Country: {FIXED_LOCATION.country}, State: {FIXED_LOCATION.state}, City: {FIXED_LOCATION.city}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <label htmlFor="split-size" className="text-sm font-semibold text-foreground">
                Numbers per file
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
                    <span className="font-semibold text-foreground">{fileCount}</span>{" "}
                    {format === "csv" ? "CSV" : "Excel"} files will be created
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
                    Download complete!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                    {lastResult.totalNumbers.toLocaleString()} numbers - {lastResult.fileCount} files - Session:{" "}
                    <span className="font-mono font-semibold">{lastResult.sessionId}</span>
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    Department: <span className="font-mono">{lastResult.department}</span> — Caller ID:{" "}
                    <span className="font-mono">{lastResult.callerId}</span>
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
              disabled={numbers.length === 0 || trimmedCallerId.length === 0 || isDownloading}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isDownloading ? (
                <>
                  <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {downloadProgress
                    ? `Downloading... ${downloadProgress.current}/${downloadProgress.total}`
                    : "Preparing..."}
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
                Clear
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
                <span className="text-sm font-semibold text-foreground">Download History</span>
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
                    No download history yet
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
                                <span className="font-semibold">{entry.totalNumbers.toLocaleString()}</span> numbers →{" "}
                                <span className="font-semibold">{entry.fileCount}</span> files
                                <span className="text-muted-foreground ml-1">({entry.splitSize} per file)</span>
                              </p>
                              {entry.department && entry.callerId && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Department: <span className="font-mono">{entry.department}</span> — Caller ID:{" "}
                                  <span className="font-mono">{entry.callerId}</span>
                                </p>
                              )}
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
                        Clear History
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20 px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              How to use
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">1.</span>
                Paste phone numbers in the box above, one per line or copied from Excel/CSV
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">2.</span>
                Select a Department and enter the DistributeToCallerId
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">3.</span>
                Enter how many numbers each file should contain, for example 200
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">4.</span>
                Click "Split &amp; Download" to download all files
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">5.</span>
                Each download session gets unique file names, for example <span className="font-mono">abc123_part1.xlsx</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
