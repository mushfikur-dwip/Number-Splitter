import { useState, useCallback } from "react";
import * as XLSX from "xlsx";

function parseNumbers(raw: string): string[] {
  return raw
    .split(/[\n\r\t,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function downloadXlsx(numbers: string[], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(numbers.map((n) => [n]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Numbers");
  XLSX.writeFile(wb, filename);
}

export default function Home() {
  const [input, setInput] = useState("");
  const [splitSize, setSplitSize] = useState<number>(200);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    total: number;
    files: number;
  } | null>(null);

  const numbers = parseNumbers(input);
  const validSplitSize = splitSize > 0 ? splitSize : 1;
  const fileCount = numbers.length > 0 ? Math.ceil(numbers.length / validSplitSize) : 0;

  const handleSplitAndDownload = useCallback(() => {
    if (numbers.length === 0) return;
    setIsDownloading(true);

    setTimeout(() => {
      try {
        const chunks = chunkArray(numbers, validSplitSize);
        chunks.forEach((chunk, index) => {
          downloadXlsx(chunk, `numbers_part${index + 1}.xlsx`);
        });
        setLastResult({ total: numbers.length, files: chunks.length });
      } finally {
        setIsDownloading(false);
      }
    }, 50);
  }, [numbers, validSplitSize]);

  const handleClear = () => {
    setInput("");
    setLastResult(null);
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-3-3v6M4.5 19.5l15-15M3 9l4.5-4.5M17 17l2 2M7.5 4.5l.5.5M16.5 16.5l.5.5"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h4v4H4zM16 6h4v4h-4zM4 14h4v4H4zM16 14h4v4h-4z"
              />
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
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {numbers.length.toLocaleString()} টি নম্বর
                </span>
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
              <label
                htmlFor="split-size"
                className="text-sm font-semibold text-foreground"
              >
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
                  <svg
                    className="w-4 h-4 text-primary shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    <span className="font-semibold text-foreground">
                      {fileCount}টি
                    </span>{" "}
                    Excel ফাইল তৈরি হবে
                    {fileCount > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        ({numbers.length.toLocaleString()} ÷ {validSplitSize} ={" "}
                        {fileCount})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {lastResult && (
            <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800/50 dark:bg-green-950/30 px-4 py-3 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  ডাউনলোড সম্পন্ন হয়েছে!
                </p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
                  {lastResult.total.toLocaleString()} টি নম্বর{" "}
                  {lastResult.files} টি Excel ফাইলে ডাউনলোড হয়েছে।
                </p>
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
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  তৈরি হচ্ছে...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Split &amp; Download (.xlsx)
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
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
