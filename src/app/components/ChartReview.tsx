import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { AlertTriangle, HelpCircle, User, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { AnalysisResult, Evidence, HighlightCategory, TextSpan } from "../services/aiAgentService";

// ─────────────────────────────────────────────────────────────
// Design tokens – matches the provided UI mockup exactly
// ─────────────────────────────────────────────────────────────
const CAT_STYLE: Record<HighlightCategory, { bg: string; text: string; label: string }> = {
  diagnosis:  { bg: "bg-blue-100",   text: "text-blue-900",   label: "Diagnosis"      },
  cognitive:  { bg: "bg-purple-100", text: "text-purple-900", label: "Cognitive tests" },
  medication: { bg: "bg-green-100",  text: "text-green-900",  label: "Medications"    },
  function:   { bg: "bg-orange-100", text: "text-orange-900", label: "Function"       },
  history:    { bg: "bg-yellow-100", text: "text-yellow-900", label: "History"        },
  acute:      { bg: "bg-slate-200",  text: "text-slate-700",  label: "Acute"          },
};

const STRENGTH_STYLE: Record<Evidence["strength"], string> = {
  STRONG:   "text-green-600",
  MODERATE: "text-yellow-600",
  WEAK:     "text-red-500",
};

// Timeline dot colors keyed by event type
const TL_DOT: Record<string, string> = {
  onset:       "bg-blue-500",
  diagnosis:   "bg-green-500",
  treatment:   "bg-green-500",
  progression: "bg-gray-400",
  current:     "bg-blue-600",
};

type FilterTab = "All" | HighlightCategory;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "All",        label: "All"            },
  { key: "diagnosis",  label: "Diagnosis"      },
  { key: "cognitive",  label: "Cognitive tests" },
  { key: "medication", label: "Medications"    },
  { key: "function",   label: "Function"       },
  { key: "history",    label: "Timeline"       },  // shows history highlights
];

// Section navigator – colours + active state exactly as per mockup
const SECTIONS = [
  { key: "history",   label: "History",           dot: "bg-blue-500"   },
  { key: "lab",       label: "Lab",               dot: "bg-yellow-400" },
  { key: "meds",      label: "Medications",       dot: "bg-yellow-400" },
  { key: "radiology", label: "Radiology",         dot: "bg-yellow-400" },
  { key: "discharge", label: "Discharge Diagnosis", dot: "bg-yellow-400", hasArrow: true },
  { key: "timeline",  label: "Timeline",          dot: "bg-green-500", active: true },
  { key: "cognitive", label: "Cognitive Tests",   dot: "bg-gray-300"   },
  { key: "evidence",  label: "Evidence Summary",  dot: "bg-gray-300"   },
];

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Renders note text with inline colour-coded AI highlights */
function HighlightedNote({
  text, spans, activeSpanId, filterTab, spanRefs, onSpanClick,
}: {
  text: string;
  spans: TextSpan[];
  activeSpanId: string | null;
  filterTab: FilterTab;
  spanRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  onSpanClick: (span: TextSpan) => void;
}) {
  const visible = filterTab === "All" ? spans : spans.filter((s) => s.category === filterTab);

  type Seg = { type: "plain"; text: string } | { type: "hi"; text: string; span: TextSpan };
  const segs: Seg[] = [];
  let cur = 0;
  for (const s of visible) {
    if (s.start > cur) segs.push({ type: "plain", text: text.slice(cur, s.start) });
    segs.push({ type: "hi", text: text.slice(s.start, s.end), span: s });
    cur = s.end;
  }
  if (cur < text.length) segs.push({ type: "plain", text: text.slice(cur) });

  return (
    <p className="leading-relaxed text-gray-800 text-sm whitespace-pre-wrap">
      {segs.map((seg, i) => {
        if (seg.type === "plain") return <span key={i}>{seg.text}</span>;
        const st = CAT_STYLE[seg.span.category];
        const isActive = activeSpanId === seg.span.id;
        return (
          <span
            key={i}
            ref={(el) => { if (el) spanRefs.current.set(seg.span.id, el); else spanRefs.current.delete(seg.span.id); }}
            onClick={() => onSpanClick(seg.span)}
            title={st.label}
            className={`${st.bg} ${st.text} px-0.5 rounded cursor-pointer transition-all duration-200 ${
              isActive ? "ring-2 ring-offset-1 ring-blue-400 shadow-sm" : ""
            }`}
          >
            {seg.text}
          </span>
        );
      })}
    </p>
  );
}

/** Horizontal timeline graph matching the design mockup */
function TimelineGraph({ events }: { events: AnalysisResult["timeline"] }) {
  if (!events.length) return null;
  return (
    <div className="relative pt-2 pb-2 px-2">
      {/* connecting line */}
      <div
        className="absolute h-0.5 bg-gray-300"
        style={{ top: 40, left: 48, right: 48, zIndex: 0 }}
      />
      <div className="flex items-start" style={{ position: "relative", zIndex: 1 }}>
        {events.map((ev, idx) => {
          const dotClass = TL_DOT[ev.type] || "bg-gray-400";
          const isLast = idx === events.length - 1;
          return (
            <div key={ev.id} className="flex-1 flex flex-col items-center min-w-0">
              {/* year / date label */}
              <span className="text-xs text-gray-600 mb-2 font-medium truncate max-w-full px-1 text-center">
                {ev.year.length > 4 ? "This admission" : ev.year}
              </span>
              {/* dot */}
              <div className={`w-4 h-4 rounded-full ${dotClass} ${isLast ? "ring-2 ring-blue-300" : ""} mb-2 shrink-0`} />
              {/* label */}
              <div className="text-center px-1 max-w-[90px]">
                <p className="text-xs text-gray-700 font-medium leading-tight">{ev.event}</p>
                {ev.description && (
                  <p className="text-xs text-gray-400 leading-tight mt-0.5">{ev.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────
export default function ChartReview() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis]     = useState<AnalysisResult | null>(null);
  const [allResults, setAllResults] = useState<AnalysisResult[]>([]);
  const [filterTab, setFilterTab]   = useState<FilterTab>("All");
  const [activeNav, setActiveNav]   = useState("timeline");

  // per-session editable diagnosis
  const [editDx, setEditDx] = useState<AnalysisResult["diagnosis"] | null>(null);

  // span focus
  const [activeSpanId, setActiveSpanId]     = useState<string | null>(null);
  const [activeEvId, setActiveEvId]         = useState<number | null>(null);

  const spanRefs       = useRef<Map<string, HTMLElement>>(new Map());
  const noteScrollRef  = useRef<HTMLDivElement>(null);
  const evPanelRef     = useRef<HTMLDivElement>(null);

  // ── load session ──
  useEffect(() => {
    const raw = sessionStorage.getItem("analysisResults");
    if (!raw) { navigate("/"); return; }
    const results: AnalysisResult[] = JSON.parse(raw);
    setAllResults(results);
    const decoded = patientId ? decodeURIComponent(patientId) : "";
    const found   = results.find((r) => r.patientId === decoded);
    if (!found) { navigate("/"); return; }
    setAnalysis(found);
    setEditDx({ ...found.diagnosis });
  }, [patientId, navigate]);

  const currentIdx = allResults.findIndex(
    (r) => r.patientId === decodeURIComponent(patientId || "")
  );

  const goPatient = (idx: number) => {
    if (idx < 0 || idx >= allResults.length) return;
    navigate(`/review/${encodeURIComponent(allResults[idx].patientId)}`);
  };

  // ── jump from evidence → note text ──
  const jumpToSpan = useCallback((spanId: string, evId: number) => {
    setActiveSpanId(spanId);
    setActiveEvId(evId);
    setFilterTab("All");
    setTimeout(() => {
      const el = spanRefs.current.get(spanId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }, []);

  // ── click a highlight → scroll evidence ──
  const handleSpanClick = useCallback((span: TextSpan) => {
    setActiveSpanId(span.id);
    if (span.evidenceId != null) {
      setActiveEvId(span.evidenceId);
      setTimeout(() => {
        const el = document.getElementById(`ev-${span.evidenceId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 60);
    }
  }, []);

  // ── save edits ──
  const saveDx = useCallback((newDx: AnalysisResult["diagnosis"]) => {
    if (!analysis) return;
    const updated = { ...analysis, diagnosis: newDx };
    setAnalysis(updated);
    const all2 = allResults.map((r) => r.patientId === analysis.patientId ? updated : r);
    setAllResults(all2);
    sessionStorage.setItem("analysisResults", JSON.stringify(all2));
  }, [analysis, allResults]);

  // ── scroll to section ──
  const scrollTo = (key: string) => {
    setActiveNav(key);
    const el = document.getElementById(`sec-${key}`);
    if (el && noteScrollRef.current) {
      noteScrollRef.current.scrollTo({ top: (el as HTMLElement).offsetTop - 8, behavior: "smooth" });
    }
  };

  if (!analysis || !editDx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading analysis…</p>
        </div>
      </div>
    );
  }

  const dx = editDx;

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* ════════════ HEADER ════════════ */}
      <header className="flex-none border-b border-gray-200 px-6 py-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[17px] font-bold text-gray-900 leading-tight">
                AI-Powered ADRD Chart Review Interface
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Patient ID:&nbsp;<span className="text-gray-700">{analysis.patientId}</span>
                &nbsp;|&nbsp;Admission Date:&nbsp;<span className="text-gray-700">{analysis.admissionDate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {/* Patient prev / next */}
            {allResults.length > 1 && (
              <div className="flex items-center gap-0.5 mr-1">
                <button
                  disabled={currentIdx <= 0}
                  onClick={() => goPatient(currentIdx - 1)}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <span className="text-xs text-gray-500">{currentIdx + 1}/{allResults.length}</span>
                <button
                  disabled={currentIdx >= allResults.length - 1}
                  onClick={() => goPatient(currentIdx + 1)}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}

            {analysis.hasConflict && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" />
                Conflict Alert
              </span>
            )}
            {analysis.hasDelirium && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-white border border-gray-300 px-2.5 py-1 rounded-full">
                Delirium Warning
              </span>
            )}
            <button className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ════════════ BODY (3 columns) ════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Section Navigator ── */}
        <aside className="w-48 flex-none border-r border-gray-200 bg-white overflow-y-auto">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-semibold text-gray-700">Section Navigator</p>
          </div>
          <nav className="py-2">
            {SECTIONS.map((sec) => {
              const isActive = activeNav === sec.key;
              return (
                <button
                  key={sec.key}
                  onClick={() => scrollTo(sec.key)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left transition-colors ${
                    isActive ? "bg-green-50 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sec.dot}`} />
                  <span className="flex-1 leading-snug">{sec.label}</span>
                  {sec.hasArrow && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── MIDDLE: Clinical Note ── */}
        <main
          ref={noteScrollRef}
          className="flex-1 overflow-y-auto bg-white"
        >
          {/* Sticky filter bar */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-2.5 flex items-center gap-0">
            <span className="text-xs text-gray-400 mr-3">Filter:</span>
            {FILTER_TABS.map((tab, i) => {
              const active = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setFilterTab(tab.key); setActiveSpanId(null); }}
                  className={`text-sm px-3 py-1 transition-colors ${
                    active
                      ? "text-gray-800 border border-gray-300 rounded-full"
                      : "text-gray-500 hover:text-gray-700"
                  } ${i > 0 ? "ml-1" : ""}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="px-6 py-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Clinical Note with AI Highlights
            </h2>

            {/* ─ History section ─ */}
            <section id="sec-history" className="mb-6">
              <p className="text-sm font-semibold text-gray-800 mb-2">History:</p>
              <HighlightedNote
                text={analysis.rawNotes}
                spans={analysis.spans}
                activeSpanId={activeSpanId}
                filterTab={filterTab}
                spanRefs={spanRefs}
                onSpanClick={handleSpanClick}
              />
            </section>

            {/* ─ Lab (placeholder) ─ */}
            <section id="sec-lab" className="mb-6 hidden" />

            {/* ─ Medications list ─ */}
            <section id="sec-meds" className="mb-6">
              {analysis.spans.filter((s) => s.category === "medication").length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Medications detected:</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.spans.filter((s) => s.category === "medication").map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSpanClick(s)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          activeSpanId === s.id
                            ? "bg-green-200 border-green-400"
                            : "bg-green-50 border-green-200 text-green-800"
                        }`}
                      >
                        {s.text}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* ─ Radiology placeholder ─ */}
            <section id="sec-radiology" className="mb-6 hidden" />

            {/* ─ Discharge diagnosis ─ */}
            <section id="sec-discharge" className="mb-6 hidden" />

            {/* ─ Timeline ─ */}
            <section id="sec-timeline" className="mb-6">
              <p className="text-sm font-semibold text-gray-800 mb-3">Timeline View</p>
              <TimelineGraph events={analysis.timeline} />
            </section>

            {/* ─ Cognitive Tests ─ */}
            <section id="sec-cognitive" className="mb-6">
              {analysis.spans.filter((s) => s.category === "cognitive").length > 0 && (
                <>
                  <p className="text-sm font-semibold text-gray-800 mb-2">Cognitive test results:</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.spans.filter((s) => s.category === "cognitive").map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleSpanClick(s)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          activeSpanId === s.id
                            ? "bg-purple-200 border-purple-400"
                            : "bg-purple-50 border-purple-200 text-purple-800"
                        }`}
                      >
                        {s.text}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            {/* ─ Evidence summary (compact, in middle column) ─ */}
            <section id="sec-evidence" className="mb-8 hidden" />

            {/* ─ Acute vs Chronic banner ─ */}
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium text-gray-700">Acute vs Chronic:&nbsp;</span>
                <span className="text-gray-600">{analysis.acuteVsChronic}</span>
              </span>
            </div>
          </div>
        </main>

        {/* ── RIGHT: Structured Decision Panel ── */}
        <aside
          ref={evPanelRef}
          className="w-72 flex-none border-l border-gray-200 bg-white overflow-y-auto"
        >
          {/* panel header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Structured Decision Panel</span>
            <div className="flex items-center gap-2">
              <button className="text-gray-400 hover:text-gray-600">
                <HelpCircle className="w-4 h-4" />
              </button>
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* ── ADRD Diagnosis ── */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">ADRD Diagnosis</p>

              {/* ADRD toggle */}
              <div className="flex items-center gap-1 mb-2.5">
                <span className="text-xs text-gray-500 w-16 shrink-0">ADRD:</span>
                <div className="flex gap-1.5">
                  {(["Yes", "No", "Uncertain"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        const next = { ...dx, hasADRD: opt };
                        setEditDx(next);
                        saveDx(next);
                      }}
                      className={`text-xs px-2.5 py-1 rounded border transition-all ${
                        dx.hasADRD === opt
                          ? "border-blue-500 text-blue-700 bg-blue-50"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtype toggle */}
              <div className="mb-2.5">
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs text-gray-500 w-16 shrink-0">Subtype:</span>
                  <div className="flex gap-1.5">
                    {(["AD", "VaD", "FTD", "LBD"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          const next = { ...dx, subtype: t };
                          setEditDx(next);
                          saveDx(next);
                        }}
                        className={`text-xs px-2 py-1 rounded border transition-all ${
                          dx.subtype === t
                            ? "border-blue-500 text-blue-700 bg-blue-50"
                            : "border-gray-300 text-gray-500 hover:border-gray-400"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 ml-16">
                  {(["Mixed", "Unspecified"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        const next = { ...dx, subtype: t };
                        setEditDx(next);
                        saveDx(next);
                      }}
                      className={`text-xs px-2 py-1 rounded border transition-all ${
                        dx.subtype === t
                          ? "border-blue-500 text-blue-700 bg-blue-50"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 shrink-0">Confidence:</span>
                <span className="text-sm">🌈</span>
                <span className="text-sm font-semibold text-gray-800">{dx.confidence}%</span>
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-gray-100" />

            {/* ── Evidence List ── */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Evidence ({analysis.evidence.length})
              </p>

              <div className="space-y-0">
                {analysis.evidence.map((ev, idx) => {
                  const isActive = activeEvId === ev.id;
                  return (
                    <div
                      key={ev.id}
                      id={`ev-${ev.id}`}
                      className={`py-2.5 border-b border-gray-100 last:border-b-0 transition-colors ${
                        isActive ? "bg-blue-50 -mx-5 px-5" : ""
                      }`}
                    >
                      {/* row 1: number + type + strength */}
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className="text-xs text-gray-800 font-medium">
                          {idx + 1}. {ev.type}
                        </span>
                        <span className={`text-xs font-semibold shrink-0 ${STRENGTH_STYLE[ev.strength]}`}>
                          {ev.strength}
                        </span>
                      </div>
                      {/* row 2: description */}
                      <p className="text-xs text-gray-500 leading-snug mb-1 line-clamp-2">
                        {ev.displayText}
                      </p>
                      {/* row 3: jump to text + arrow */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => jumpToSpan(ev.spanId, ev.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          Jump to text
                        </button>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    </div>
                  );
                })}

                {analysis.evidence.length === 0 && (
                  <p className="text-xs text-gray-400 py-3">No evidence extracted.</p>
                )}
              </div>
            </div>

            {/* divider */}
            <div className="border-t border-gray-100" />

            {/* ── Acute vs Chronic (right panel copy) ── */}
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1.5">Acute vs Chronic:</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {analysis.acuteVsChronic}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}