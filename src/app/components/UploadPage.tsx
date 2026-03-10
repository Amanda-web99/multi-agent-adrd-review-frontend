import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle,
  ArrowRight, X, Table2, Brain,
} from "lucide-react";

interface ParsedRow {
  [key: string]: string;
}

function nk(s: string) {
  return String(s || "").toLowerCase().replace(/[_\s\-]/g, "");
}

function isBlankRow(row: ParsedRow, headers: string[]) {
  return headers.every((h) => String(row[h] ?? "").trim() === "");
}

// ── File type helpers ─────────────────────────────────────────
const ACCEPTED_EXTS = [".csv", ".xlsx", ".xls"];
const ACCEPTED_MIME = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

function getFileExt(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function fileTypeLabel(ext: string) {
  if (ext === ".csv")  return { label: "CSV",   color: "text-emerald-600", bg: "bg-emerald-50" };
  if (ext === ".xlsx") return { label: "XLSX",  color: "text-blue-600",    bg: "bg-blue-50"    };
  if (ext === ".xls")  return { label: "XLS",   color: "text-indigo-600",  bg: "bg-indigo-50"  };
  return { label: "FILE", color: "text-gray-600", bg: "bg-gray-50" };
}

// ── Parsers ───────────────────────────────────────────────────
function parseCSVText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("File must have a header row and at least one data row.");
  const hdrs = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const parsed = lines.slice(1).map((line) => {
    const vals: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const obj: ParsedRow = {};
    hdrs.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
  const rows = parsed.filter((row) => !isBlankRow(row, hdrs));
  return { headers: hdrs, rows };
}

function parseExcelBuffer(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  const workbook = XLSX.read(buffer, { type: "array" });

  const toObjects = (sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { headers: [] as string[], rows: [] as ParsedRow[] };
    const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
    if (data.length < 2) return { headers: [] as string[], rows: [] as ParsedRow[] };
    const hdrs = (data[0] as string[]).map((h) => String(h).trim());
    const rows = (data.slice(1) as string[][]).map((row) => {
      const obj: ParsedRow = {};
      hdrs.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ""; });
      return obj;
    }).filter((row) => !isBlankRow(row, hdrs));
    return { headers: hdrs, rows };
  };

  const firstSheetName = workbook.SheetNames[0];
  const primary = toObjects(firstSheetName);
  if (primary.rows.length === 0) {
    throw new Error("File must have a header row and at least one data row.");
  }

  // Optional second sheet: merge structured fields by patient_ID.
  const secondSheetName = workbook.SheetNames[1];
  if (!secondSheetName) {
    return primary;
  }

  const secondary = toObjects(secondSheetName);
  if (secondary.rows.length === 0) {
    return primary;
  }

  const findPatientIdKey = (headers: string[]) => {
    const found = headers.find((h) => nk(h) === nk("patient_ID"));
    return found ?? null;
  };

  const primaryPatientKey = findPatientIdKey(primary.headers);
  const secondaryPatientKey = findPatientIdKey(secondary.headers);
  if (!primaryPatientKey || !secondaryPatientKey) {
    if (!primaryPatientKey) return primary;
    return {
      headers: primary.headers,
      rows: primary.rows.filter((row) => String(row[primaryPatientKey] ?? "").trim() !== ""),
    };
  }

  const secondaryMap = new Map<string, ParsedRow>();
  for (const row of secondary.rows) {
    const patientId = String(row[secondaryPatientKey] ?? "").trim();
    if (!patientId) continue;
    secondaryMap.set(patientId, row);
  }

  const mergedRows = primary.rows.map((row) => {
    const patientId = String(row[primaryPatientKey] ?? "").trim();
    const extra = patientId ? secondaryMap.get(patientId) : null;
    if (!extra) return row;
    return { ...row, ...extra };
  }).filter((row) => String(row[primaryPatientKey] ?? "").trim() !== "");

  const mergedHeaders = Array.from(new Set([...primary.headers, ...secondary.headers]));
  return { headers: mergedHeaders, rows: mergedRows };
}

// ─────────────────────────────────────────────────────────────
export default function UploadPage() {
  const navigate = useNavigate();

  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [fileExt, setFileExt]     = useState("");
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [headers, setHeaders]     = useState<string[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handler ─────────────────────────────────────────────
  const handleFile = (f: File) => {
    setError(null);
    const ext = getFileExt(f.name);
    if (!ACCEPTED_EXTS.includes(ext)) {
      setError("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.");
      return;
    }

    if (ext === ".csv") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { headers: hdrs, rows: data } = parseCSVText(e.target?.result as string);
          setFile(f); setFileExt(ext); setHeaders(hdrs); setRows(data);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Failed to parse CSV.");
        }
      };
      reader.readAsText(f);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { headers: hdrs, rows: data } = parseExcelBuffer(e.target?.result as ArrayBuffer);
          setFile(f); setFileExt(ext); setHeaders(hdrs); setRows(data);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Failed to parse Excel file.");
        }
      };
      reader.readAsArrayBuffer(f);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const clearFile = () => {
    setFile(null); setFileExt(""); setRows([]); setHeaders([]); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAnalyze = () => {
    if (!file) return;
    setLoading(true);
    // Persist to sessionStorage so the review page survives a refresh
    sessionStorage.setItem("adrd_patients", JSON.stringify(rows));
    sessionStorage.setItem("adrd_headers",  JSON.stringify(headers));
    setTimeout(() => navigate("/review", { state: { patients: rows, headers } }), 1200);
  };

  const previewRows = rows.slice(0, 5);
  const typeMeta    = fileTypeLabel(fileExt);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Brain className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 leading-tight">
              AI-Powered Chart Review Interface
            </h1>
            <p className="text-xs text-gray-400 leading-tight">targeted ADRD</p>
          </div>
        </div>
        <span className="text-xs text-gray-400">Step 1 of 2 — Upload Data</span>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">

          {/* Title block */}
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Patient Notes</h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
              Upload a <span className="font-medium text-gray-700">CSV</span>,{" "}
              <span className="font-medium text-gray-700">XLSX</span>, or{" "}
              <span className="font-medium text-gray-700">XLS</span> file containing patient records.
              Each row should include a Patient ID and the corresponding clinical notes. The AI
              will analyze and highlight ADRD-relevant evidence automatically.
            </p>
          </div>

          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl px-8 py-16 cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50/40"
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragOver ? "bg-blue-100" : "bg-gray-100"}`}>
                <UploadCloud className={`w-8 h-8 transition-colors ${dragOver ? "text-blue-500" : "text-gray-400"}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {dragOver ? "Drop your file here" : "Drag & drop your file here"}
                </p>
                <p className="text-xs text-gray-400">or click to browse</p>
              </div>
              {/* Accepted format badges */}
              <div className="flex items-center gap-2 mt-1">
                {[
                  { ext: ".csv",  label: "CSV",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { ext: ".xlsx", label: "XLSX", cls: "bg-blue-50 text-blue-700 border-blue-200"          },
                  { ext: ".xls",  label: "XLS",  cls: "bg-indigo-50 text-indigo-700 border-indigo-200"    },
                ].map((f) => (
                  <span key={f.ext} className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${f.cls}`}>
                    {f.label}
                  </span>
                ))}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={[...ACCEPTED_EXTS, ...ACCEPTED_MIME].join(",")}
                onChange={onInputChange}
                className="hidden"
              />
            </div>
          ) : (
            /* File loaded state */
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* File pill */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeMeta.bg}`}>
                    <FileText className={`w-[18px] h-[18px] ${typeMeta.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{file.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${typeMeta.bg} ${typeMeta.color}`}>
                        {typeMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {rows.length} row{rows.length !== 1 ? "s" : ""} · {headers.length} column{headers.length !== 1 ? "s" : ""} · {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <button onClick={clearFile} className="text-gray-300 hover:text-gray-500 transition-colors ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column tags */}
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                  <Table2 className="w-3.5 h-3.5" /> Detected columns
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map((h) => (
                    <span key={h} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-md text-gray-600 font-mono">
                      {h}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {headers.map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap max-w-[200px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        {headers.map((h) => (
                          <td key={h} className="px-4 py-2.5 text-gray-700 max-w-[200px]">
                            <span className="block truncate" title={row[h]}>
                              {row[h] || <span className="text-gray-300 italic">—</span>}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && (
                  <p className="text-xs text-gray-400 text-center py-2.5 border-t border-gray-100">
                    + {rows.length - 5} more rows not shown
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* Format hint */}
          {!file && (
            <div className="mt-6 bg-white border border-gray-200 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Expected file structure</p>
              <div className="overflow-x-auto rounded-lg bg-gray-50 border border-gray-100 p-3">
                <table className="text-xs w-full font-mono">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left pr-8 pb-1">patient_ID</th>
                      <th className="text-left pr-8 pb-1">admit_age</th>
                      <th className="text-left pr-8 pb-1">gender</th>
                      <th className="text-left pr-8 pb-1">race</th>
                      <th className="text-left pr-8 pb-1">insurance</th>
                      <th className="text-left pr-8 pb-1">language</th>
                      <th className="text-left pb-1">notes</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    <tr>
                      <td className="pr-8">1002345</td>
                      <td className="pr-8">81</td>
                      <td className="pr-8">Female</td>
                      <td className="pr-8">White</td>
                      <td className="pr-8">Medicare</td>
                      <td className="pr-8">English</td>
                      <td className="truncate max-w-[160px]">Patient presents with…</td>
                    </tr>
                    <tr className="text-gray-400">
                      <td className="pr-8">1002346</td>
                      <td className="pr-8">74</td>
                      <td className="pr-8">Male</td>
                      <td className="pr-8">Black</td>
                      <td className="pr-8">Medicaid</td>
                      <td className="pr-8">English</td>
                      <td>Admitted for…</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Excel can include an optional second sheet keyed by patient_ID for fields like adrd, subtype, confidence, acute_vs_chronic, evidence (JSON), admission_timeline (JSON), and comprehensive_timeline (JSON).
              </p>
            </div>
          )}

          {/* Analyze button */}
          {file && !error && (
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-all duration-200 shadow-sm shadow-blue-200"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm font-medium">Processing notes…</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span className="text-sm font-medium">Analyze Notes</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center pb-8 text-xs text-gray-400">
        AI analysis is for research support only. Always verify findings with clinical judgment.
      </footer>
    </div>
  );
}