import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  AlertTriangle, HelpCircle, User, ChevronRight, CheckCircle,
  Check, X, Plus, Download, ChevronDown, ChevronUp, Trash2, Tag,
  ChevronLeft, ArrowLeft, Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
type ADRDOption = "Yes" | "No" | "Uncertain";
type SubtypeOpt = "AD" | "VaD" | "FTD" | "LBD" | "Mixed" | "Unspecified";
type Strength   = "STRONG" | "MODERATE" | "WEAK" | null;
type EvStatus   = "accepted" | "rejected" | null;

interface SectionDef {
  value: string;
  label: string;
  dotColor: string;
  highlightStyle: React.CSSProperties;
}

interface ManualLabel {
  id: number;
  text: string;
  category: string;
  noteRef: string;
  addedAt: string;
}

interface SelectionPopover {
  text: string;
  x: number;
  y: number;
  above: boolean;
  sectionLabel: string;
}

interface EvidenceItem {
  id: number;
  type: string;
  strength: Strength;
  desc: string;
  quote: string;
  spanId: string;
  cat: string;
}

interface TimelineItem {
  date: string;
  dot: string;
  label: string;
  description?: string;
  order?: number;
}

// ─── Section definitions ──────────────────────────────────────
const BASE_SECTIONS: SectionDef[] = [
  {
    value: "history",
    label: "History",
    dotColor: "#3b82f6",
    highlightStyle: { backgroundColor: "#bfdbfe", color: "#1e3a8a", borderBottom: "2px solid #3b82f6" },
  },
  {
    value: "lab",
    label: "Lab",
    dotColor: "#10b981",
    highlightStyle: { backgroundColor: "#a7f3d0", color: "#065f46", borderBottom: "2px solid #10b981" },
  },
  {
    value: "medication",
    label: "Medications",
    dotColor: "#a855f7",
    highlightStyle: { backgroundColor: "#e9d5ff", color: "#581c87", borderBottom: "2px solid #a855f7" },
  },
  {
    value: "radiology",
    label: "Radiology",
    dotColor: "#f97316",
    highlightStyle: { backgroundColor: "#fed7aa", color: "#7c2d12", borderBottom: "2px solid #f97316" },
  },
  {
    value: "cognitive",
    label: "Cognitive Tests",
    dotColor: "#f43f5e",
    highlightStyle: { backgroundColor: "#fecdd3", color: "#881337", borderBottom: "2px solid #f43f5e" },
  },
];

const STRENGTH_CLS: Record<string, string> = {
  STRONG:   "text-green-600",
  MODERATE: "text-amber-600",
  WEAK:     "text-red-500",
};

// ─── Note section tab bar ─────────────────────────────────────
const NOTE_SECTIONS = [
  { key: "cc",      label: "Chief Complaint"            },
  { key: "hpi",     label: "History of Present Illness" },
  { key: "pmh",     label: "Past Medical History"       },
  { key: "pe",      label: "Physical Exam"              },
  { key: "pr",      label: "Pertinent Results"          },
  { key: "bhc",     label: "Brief Hospital Course"      },
  { key: "dd",      label: "Discharge Diagnosis"        },
  { key: "dc",      label: "Discharge Condition"        },
  { key: "medssec", label: "Medications"                },
];

// ─── Patient row mapper ───────────────────────────────────────
function nk(s: string) { return s.toLowerCase().replace(/[_\s\-]/g, ""); }

function hexToRgba(hex: string, alpha: number) {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (full.length !== 6) return `rgba(59,130,246,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function sectionFromColor(value: string, label: string, color: string): SectionDef {
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#3b82f6";
  return {
    value,
    label,
    dotColor: safeColor,
    highlightStyle: {
      backgroundColor: hexToRgba(safeColor, 0.22),
      color: "#111827",
      borderBottom: `2px solid ${safeColor}`,
    },
  };
}

function getRowValue(row: Record<string, string>, candidates: string[]) {
  const norms = candidates.map(nk);
  const found = Object.keys(row).find((k) => norms.includes(nk(k)));
  return found ? String(row[found] ?? "").trim() : "";
}

function parseJSON(value: string): unknown | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeCategory(value: string): string {
  const v = nk(value);
  if (v.includes("med")) return "medication";
  if (v.includes("radio") || v.includes("image") || v.includes("ct") || v.includes("mri")) return "radiology";
  if (v.includes("cogn") || v.includes("moca") || v.includes("mmse")) return "cognitive";
  if (v.includes("lab") || v.includes("blood") || v.includes("tsh")) return "lab";
  if (v.includes("diag")) return "diagnosis";
  if (v.includes("acute") || v.includes("delir")) return "acute";
  if (v.includes("func") || v.includes("adl")) return "function";
  return v || "history";
}

function normalizeStrength(value: string): Strength {
  const v = String(value || "").toUpperCase();
  if (v === "STRONG" || v === "MODERATE" || v === "WEAK") return v;
  return null;
}

function extractEvidenceWrapper(row: Record<string, string>) {
  const raw = getRowValue(row, ["evidence", "evidence_json", "ai_evidence", "evidence_data"]);
  const parsed = parseJSON(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function extractEvidenceArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.evidence)) return obj.evidence;
  return [];
}

function mapEvidenceFromRow(row: Record<string, string>): EvidenceItem[] {
  const raw = getRowValue(row, ["evidence", "evidence_json", "ai_evidence", "evidence_data"]);
  const parsed = parseJSON(raw);
  const evidenceArray = extractEvidenceArray(parsed);
  if (evidenceArray.length === 0) return [];

  return evidenceArray
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const categoryRaw = String(obj.cat ?? obj.category ?? "").trim();
      const categoryNormalized = normalizeCategory(categoryRaw);
      const type = String(
        obj.type
        ?? (categoryRaw ? categoryRaw.replace(/[_\-]/g, " ") : "")
        ?? "Evidence"
      ).trim() || "Evidence";
      const quote = String(obj.quote ?? obj.text ?? "").trim();
      const desc = String(obj.desc ?? obj.description ?? quote).trim();
      const cat = normalizeCategory(categoryRaw || type || categoryNormalized);
      return {
        id: idx + 1,
        type,
        strength: normalizeStrength(String(obj.strength ?? "")),
        desc,
        quote,
        spanId: `ev-span-${idx + 1}`,
        cat,
      };
    })
    .filter((item): item is EvidenceItem => Boolean(item && item.desc));
}

function mapTimelineFromRow(row: Record<string, string>, keys: string[]): TimelineItem[] {
  const raw = getRowValue(row, keys);
  const parsed = parseJSON(raw);

  const timelineDotFromCategory = (category: string) => {
    const c = nk(category);
    if (c.includes("history")) return "bg-blue-500";
    if (c.includes("presentation") || c.includes("emergency")) return "bg-orange-500";
    if (c.includes("diagnostic") || c.includes("radiology")) return "bg-purple-500";
    if (c.includes("lab") || c.includes("kidney")) return "bg-emerald-500";
    if (c.includes("cogn")) return "bg-rose-500";
    if (c.includes("functional") || c.includes("rehab")) return "bg-indigo-500";
    if (c.includes("disposition") || c.includes("discharge")) return "bg-green-500";
    return "bg-gray-400";
  };

  const extractTimelineArray = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.timeline)) return obj.timeline;
    if (Array.isArray(obj.admission_timeline)) return obj.admission_timeline;
    if (Array.isArray(obj.comprehensive_timeline)) return obj.comprehensive_timeline;
    return [];
  };

  const timelineArray = extractTimelineArray(parsed);

  if (timelineArray.length > 0) {
    const items: (TimelineItem | null)[] = timelineArray
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;

        const orderRaw = Number(obj.order);
        const order = Number.isFinite(orderRaw) ? orderRaw : undefined;
        const event = String(obj.event ?? obj.label ?? "").trim();
        const description = String(obj.description ?? obj.text ?? "").trim();
        const category = String(obj.category ?? "").trim();

        const labelSource = event
          || description
          || String(obj.label ?? "")
          || String(obj.text ?? "")
          || String(obj.event ?? "")
          || String(obj.description ?? "");
        const label = String(labelSource).trim();
        if (!label) return null;

        const date = String(
          obj.date
          ?? obj.date_label
          ?? obj.time
          ?? obj.year
          ?? ""
        ).trim() || (order != null ? `Step ${order}` : "-");

        const dot = String(obj.dot ?? "").trim() || timelineDotFromCategory(category);
        const detail = event && description ? description : undefined;

        return { date, label, dot, description: detail, order };
      });

    return items
      .filter((item): item is TimelineItem => item !== null)
      .sort((a, b) => {
        if (a.order != null && b.order != null) return a.order - b.order;
        if (a.order != null) return -1;
        if (b.order != null) return 1;
        return 0;
      });
  }

  if (!raw) return [];

  // Support plain text timelines split by lines: "date: event"
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(":");
      if (parts.length >= 2) {
        return { date: parts[0].trim(), label: parts.slice(1).join(":").trim(), dot: "bg-gray-400" };
      }
      return { date: "-", label: line, dot: "bg-gray-400" };
    });
}

function getDiagnosisDefaults(row: Record<string, string>) {
  const evidenceWrapper = extractEvidenceWrapper(row);

  const adrdRaw = (
    getRowValue(row, ["adrd", "adrddx", "adrd_diagnosis", "diagnosis", "has_adrd"])
    || String(evidenceWrapper?.adrddx ?? evidenceWrapper?.adrd ?? "")
  ).trim();
  const subtypeRaw = (
    getRowValue(row, ["subtype", "adrd_subtype", "dementia_subtype"])
    || String(evidenceWrapper?.subtype ?? "")
  ).trim();
  const confidenceRaw = (
    getRowValue(row, ["confidence", "diagnosis_confidence", "adrd_confidence"])
    || String(evidenceWrapper?.confidence ?? "")
  ).trim();

  const adrd: ADRDOption = adrdRaw.toLowerCase() === "yes"
    ? "Yes"
    : adrdRaw.toLowerCase() === "no"
      ? "No"
      : "Uncertain";

  const subtypeMap: Record<string, SubtypeOpt> = {
    ad: "AD",
    vad: "VaD",
    ftd: "FTD",
    lbd: "LBD",
    mixed: "Mixed",
    unspecified: "Unspecified",
  };
  const subtype = subtypeMap[nk(subtypeRaw)] ?? "Unspecified";

  const confidenceNum = Number(confidenceRaw);
  const confidence = Number.isFinite(confidenceNum)
    ? Math.max(0, Math.min(100, confidenceNum))
    : null;

  return { adrd, subtype, confidence };
}

function mapPatientRow(row: Record<string, string>) {
  const get = (...candidates: string[]) => {
    const norms = candidates.map(nk);
    const found = Object.keys(row).find((k) => norms.includes(nk(k)));
    return found ? (row[found] ?? "—") : "—";
  };
  return {
    patient_ID: get("patient_ID"),
    admit_age:  get("admit_age"),
    gender:     get("gender"),
    race:       get("race"),
    insurance:  get("insurance"),
    language:   get("language"),
    notes:      get("notes"),
  };
}

// ─────────────────────────────────────────────────────────────
export default function ADRDReview() {
  // ── Router state + sessionStorage fallback ───────────────────
  const location  = useLocation();
  const navigate  = useNavigate();

  // Try router state first, then sessionStorage
  const patients: Record<string, string>[] = (() => {
    const fromState = (location.state as { patients?: Record<string, string>[] })?.patients;
    if (fromState && fromState.length > 0) return fromState;
    try {
      const stored = sessionStorage.getItem("adrd_patients");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  })();

  const hasPatients = patients.length > 0;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listOpen, setListOpen]         = useState(false);

  const [activeLeftNav, setActiveLeftNav]             = useState("all");
  const [activeNoteSection, setActiveNoteSection]     = useState("cc");
  const [activeSpan, setActiveSpan]                   = useState<string | null>(null);
  const [activeEv, setActiveEv]                       = useState<string | null>(null);
  const [adrd, setAdrd]                               = useState<ADRDOption>("Uncertain");
  const [subtype, setSubtype]                         = useState<SubtypeOpt>("Unspecified");
  const [evidenceStatus, setEvidenceStatus]           = useState<Record<string, EvStatus>>({});
  const [demoOpen, setDemoOpen]                       = useState(true);
  const [timelineTab, setTimelineTab]                 = useState<"admission" | "comprehensive">("admission");
  const [manualLabels, setManualLabels]               = useState<ManualLabel[]>([]);
  const [customSections, setCustomSections]           = useState<SectionDef[]>([]);
  const [selectionPopover, setSelectionPopover]       = useState<SelectionPopover | null>(null);
  const [customFormOpen, setCustomFormOpen]           = useState(false);
  const [customText, setCustomText]                   = useState("");
  const [customCategory, setCustomCategory]           = useState("history");
  const [newSectionName, setNewSectionName]           = useState("");
  const [newSectionColor, setNewSectionColor]         = useState("#0ea5e9");

  const middleRef  = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // ── Derived active patient data ───────────────────────────────
  const currentPatientRaw = hasPatients ? patients[currentIndex] : null;
  const mapped = currentPatientRaw ? mapPatientRow(currentPatientRaw) : null;
  const diagnosisDefaults = currentPatientRaw ? getDiagnosisDefaults(currentPatientRaw) : {
    adrd: "Uncertain" as ADRDOption,
    subtype: "Unspecified" as SubtypeOpt,
    confidence: null as number | null,
  };
  const evidenceItems = currentPatientRaw ? mapEvidenceFromRow(currentPatientRaw) : [];
  const sectionDefs = [...BASE_SECTIONS, ...customSections];
  const sectionMap = new Map(sectionDefs.map((s) => [s.value, s]));
  const leftNavItems = [
    { key: "all", label: "All", dotColor: "#9ca3af" },
    ...sectionDefs.map((s) => ({ key: s.value, label: s.label, dotColor: s.dotColor })),
  ];

  const getSectionDef = (category: string) => {
    if (sectionMap.has(category)) return sectionMap.get(category) as SectionDef;
    const key = normalizeCategory(category);
    return sectionMap.get(key) ?? sectionMap.get("history") ?? BASE_SECTIONS[0];
  };

  const displayEvidence = [
    ...evidenceItems.map((ev) => ({
      key: `ai-${ev.id}`,
      source: "ai" as const,
      type: ev.type,
      strength: ev.strength,
      desc: ev.desc,
      spanId: ev.spanId,
      cat: ev.cat,
    })),
    ...manualLabels.map((lbl) => ({
      key: `manual-${lbl.id}`,
      source: "manual" as const,
      type: getSectionDef(lbl.category).label,
      strength: null as Strength,
      desc: `"${lbl.text}"`,
      spanId: `ml-span-${lbl.id}`,
      cat: lbl.category,
    })),
  ];

  const admissionTimeline = currentPatientRaw
    ? mapTimelineFromRow(currentPatientRaw, ["admission_timeline", "timeline_admission", "timeline_this_admission"])
    : [];
  const comprehensiveTimeline = currentPatientRaw
    ? mapTimelineFromRow(currentPatientRaw, ["comprehensive_timeline", "timeline_history", "timeline"])
    : [];
  const acuteVsChronicSummary = currentPatientRaw
    ? (
      getRowValue(currentPatientRaw, [
        "AC",
        "acute_vs_chronic",
        "acute_chronic_summary",
        "assessment_summary",
      ]) || "-"
    )
    : "-";

  const activeDemographics = mapped ?? {
    patient_ID: "-",
    admit_age:  "-",
    gender:     "-",
    race:       "-",
    insurance:  "-",
    language:   "-",
    notes:      "",
  };
  const rawNote = activeDemographics.notes && activeDemographics.notes !== "—"
    ? activeDemographics.notes : "";

  // ── Reset per-patient state when index changes ────────────────
  useEffect(() => {
    setEvidenceStatus({});
    setManualLabels([]);
    setAdrd(diagnosisDefaults.adrd);
    setSubtype(diagnosisDefaults.subtype);
    setActiveSpan(null);
    setActiveEv(null);
    setActiveLeftNav("all");
    setActiveNoteSection("cc");
    setSelectionPopover(null);
    setCustomFormOpen(false);
    setCustomText("");
    if (middleRef.current) middleRef.current.scrollTop = 0;
  }, [currentIndex, diagnosisDefaults.adrd, diagnosisDefaults.subtype]);

  // ── IntersectionObserver for tab sync ────────────────────────
  useEffect(() => {
    const root = middleRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.find((e) => e.isIntersecting);
        if (vis) {
          const key = vis.target.id.replace("note-", "");
          setActiveNoteSection(key);
          document.getElementById(`tab-${key}`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
        }
      },
      { root, threshold: 0.25 }
    );
    NOTE_SECTIONS.forEach(({ key }) => {
      const el = document.getElementById(`note-${key}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  // ── Close popover on outside click ───────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectionPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Text-selection → popover ─────────────────────────────────
  const handleNoteMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
      const text = sel.toString().trim();
      if (text.length < 2) return;

      const range = sel.getRangeAt(0);
      const rect  = range.getBoundingClientRect();

      let sectionLabel = "";
      let node: Node | null = range.startContainer;
      while (node) {
        if (node instanceof Element && node.id?.startsWith("note-")) {
          const key = node.id.replace("note-", "");
          sectionLabel = NOTE_SECTIONS.find((s) => s.key === key)?.label ?? "";
          break;
        }
        node = node.parentElement;
      }

      const above = rect.top > 180;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170);

      setSelectionPopover({
        text,
        x,
        y: above ? rect.top - 6 : rect.bottom + 6,
        above,
        sectionLabel,
      });
    }, 10);
  }, []);

  // ── Apply a label from the popover ───────────────────────────
  const applySelectionLabel = (category: string) => {
    if (!selectionPopover) return;
    setManualLabels((prev) => [
      ...prev,
      {
        id:        Date.now(),
        text:      selectionPopover.text,
        category,
        noteRef:   selectionPopover.sectionLabel,
        addedAt:   new Date().toISOString(),
      },
    ]);
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  };

  const addCustomSection = () => {
    const label = newSectionName.trim();
    if (!label) return;

    const base = `custom_${nk(label) || "section"}`;
    let value = base;
    let i = 2;
    while (sectionMap.has(value) || value === "all") {
      value = `${base}_${i}`;
      i += 1;
    }

    const section = sectionFromColor(value, label, newSectionColor);
    setCustomSections((prev) => [...prev, section]);
    setCustomCategory(section.value);
    setNewSectionName("");
  };

  // ── Add custom label (fallback form) ─────────────────────────
  const addCustomLabel = () => {
    if (!customText.trim()) return;
    setManualLabels((prev) => [
      ...prev,
      { id: Date.now(), text: customText.trim(), category: customCategory, noteRef: "", addedAt: new Date().toISOString() },
    ]);
    setCustomText("");
    setCustomFormOpen(false);
  };

  const removeLabel = (id: number) => setManualLabels((prev) => prev.filter((l) => l.id !== id));

  // ── Navigation helpers ────────────────────────────────────────
  const scrollToNoteSection = useCallback((key: string) => {
    setActiveNoteSection(key);
    const el = document.getElementById(`note-${key}`);
    if (el && middleRef.current)
      middleRef.current.scrollTo({ top: (el as HTMLElement).offsetTop - 8, behavior: "smooth" });
  }, []);

  const scrollToLeftNav = useCallback((key: string) => {
    setActiveLeftNav(key);
    const cat = key;
    if (cat === "all" || !middleRef.current) return;

    // Wait for re-render after filter switch, then jump to first visible highlight of this category.
    setTimeout(() => {
      const container = middleRef.current;
      if (!container) return;

      const byCategory = container.querySelector(`[data-ev-cat="${cat}"]`) as HTMLElement | null;
      const fallbackEvidence = displayEvidence.find((ev) => ev.cat === cat);
      const byId = fallbackEvidence
        ? (document.getElementById(fallbackEvidence.spanId) as HTMLElement | null)
        : null;
      const target = byCategory ?? byId;

      if (target) {
        container.scrollTo({
          top: target.offsetTop - 80,
          behavior: "smooth",
        });
      }
    }, 80);
  }, [displayEvidence]);

  const jumpToSpan = (spanId: string, evId: string) => {
    setActiveSpan(spanId);
    setActiveEv(evId);
    // Switch left-nav so the correct category highlight becomes visible
    const ev = displayEvidence.find((e) => e.key === evId);
    if (ev) {
      setActiveLeftNav(ev.cat);
    }
    setTimeout(() => document.getElementById(spanId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const onSpanClick = (spanId: string, evId?: string) => {
    setActiveSpan(spanId);
    if (evId) {
      setActiveEv(evId);
      setTimeout(() => document.getElementById(`ev-${evId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  };

  const toggleEvStatus = (id: string, status: "accepted" | "rejected") =>
    setEvidenceStatus((prev) => ({ ...prev, [id]: prev[id] === status ? null : status }));

  // ── Export JSON ───────────────────────────────────────────────
  const exportJSON = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      patient: activeDemographics,
      adrdDiagnosis: { adrd, subtype, confidence: diagnosisDefaults.confidence },
      evidence: displayEvidence.map((ev) => ({
        id: ev.key,
        source: ev.source,
        type: ev.type,
        strength: ev.strength,
        description: ev.desc,
        status: evidenceStatus[ev.key] ?? "pending",
      })),
      manualLabels,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `adrd-review-${activeDemographics.patient_ID}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const labelCatMeta = (val: string) => getSectionDef(val);

  // ── hl(): plain render-helper (NOT a React component) ────────
  // Using a plain function avoids the "new component type per render" issue:
  // React sees the returned <span> directly, never unmounts/remounts it.
  const hl = (id: string, cat: string, text: string, evId?: string): React.ReactNode => {
    const activeCat = activeLeftNav;
    const section = getSectionDef(cat);
    const isVisible = activeLeftNav === "all" || cat === activeCat;
    if (!isVisible) return <span key={id} id={id}>{text}</span>;
    return (
      <span
        key={id}
        id={id}
        data-ev-cat={cat}
        data-ev-id={evId != null ? String(evId) : undefined}
        onClick={() => {
          if (evId != null) {
            onSpanClick(id, evId);
          } else {
            setActiveSpan(id);
            setActiveEv(null);
          }
        }}
        style={{
          ...section.highlightStyle,
          paddingLeft: "2px",
          paddingRight: "2px",
          borderRadius: "2px",
          cursor: "pointer",
          ...(activeSpan === id
            ? { outline: "2px solid #3b82f6", outlineOffset: "1px" }
            : {}),
        }}
      >
        {text}
      </span>
    );
  };

  // ── Highlight evidence quotes inside any plain text ───────────
  const renderHighlightedNote = (text: string): React.ReactNode => {
    const activeCat = activeLeftNav;

    const candidates: { spanId: string; quote: string; cat: string; evId?: string }[] = [
      ...evidenceItems.map((ev) => ({
        spanId: ev.spanId,
        quote: ev.quote,
        cat: ev.cat,
        evId: `ai-${ev.id}`,
      })),
      ...manualLabels.map((lbl) => ({
        spanId: `ml-span-${lbl.id}`,
        quote: lbl.text,
        cat: lbl.category,
        evId: `manual-${lbl.id}`,
      })),
    ].filter((c) => activeLeftNav === "all" || c.cat === activeCat);

    const matches: { start: number; end: number; item: { spanId: string; quote: string; cat: string; evId?: string } }[] = [];

    const normalizeWithMap = (input: string) => {
      const chars: string[] = [];
      const map: number[] = [];
      let prevWasSpace = true;

      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (/[A-Za-z0-9]/.test(ch)) {
          chars.push(ch.toLowerCase());
          map.push(i);
          prevWasSpace = false;
        } else if (!prevWasSpace) {
          chars.push(" ");
          map.push(i);
          prevWasSpace = true;
        }
      }

      while (chars.length > 0 && chars[chars.length - 1] === " ") {
        chars.pop();
        map.pop();
      }

      return { normalized: chars.join(""), map };
    };

    const normalizeSimple = (input: string) => {
      const { normalized } = normalizeWithMap(input);
      return normalized;
    };

    const normalizedSource = normalizeWithMap(text);

    const sourceTokens: { token: string; start: number; end: number }[] = [];
    const sourceTokenRegex = /[A-Za-z0-9]+/g;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = sourceTokenRegex.exec(text)) !== null) {
      sourceTokens.push({
        token: tokenMatch[0].toLowerCase(),
        start: tokenMatch.index,
        end: tokenMatch.index + tokenMatch[0].length,
      });
    }

    const findPhraseSpan = (phrase: string): { start: number; end: number } | null => {
      const normalizedPhrase = normalizeSimple(phrase);
      if (normalizedPhrase) {
        const normIndex = normalizedSource.normalized.indexOf(normalizedPhrase);
        if (normIndex >= 0) {
          const start = normalizedSource.map[normIndex];
          const endMapIndex = normIndex + normalizedPhrase.length - 1;
          const end = (normalizedSource.map[endMapIndex] ?? start) + 1;
          if (start != null && end > start) {
            return { start, end };
          }
        }
      }

      const phraseTokens = (phrase.match(/[A-Za-z0-9]+/g) ?? []).map((w) => w.toLowerCase());
      if (phraseTokens.length === 0 || sourceTokens.length === 0) return null;

      for (let i = 0; i <= sourceTokens.length - phraseTokens.length; i++) {
        let ok = true;
        for (let j = 0; j < phraseTokens.length; j++) {
          if (sourceTokens[i + j].token !== phraseTokens[j]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          return {
            start: sourceTokens[i].start,
            end: sourceTokens[i + phraseTokens.length - 1].end,
          };
        }
      }

      // Relaxed fallback for long quotes: allow skipped tokens in source while keeping quote order.
      const maxSkips = Math.max(6, Math.floor(phraseTokens.length * 0.6));
      for (let i = 0; i < sourceTokens.length; i++) {
        if (sourceTokens[i].token !== phraseTokens[0]) continue;

        let j = 1;
        let k = i + 1;
        let skips = 0;
        let lastMatchedIndex = i;

        while (j < phraseTokens.length && k < sourceTokens.length) {
          if (sourceTokens[k].token === phraseTokens[j]) {
            lastMatchedIndex = k;
            j += 1;
            k += 1;
            continue;
          }
          skips += 1;
          if (skips > maxSkips) break;
          k += 1;
        }

        if (j === phraseTokens.length) {
          return {
            start: sourceTokens[i].start,
            end: sourceTokens[lastMatchedIndex].end,
          };
        }
      }

      return null;
    };

    for (const item of candidates) {
      const span = findPhraseSpan(item.quote);
      if (!span) continue;
      const start = span.start;
      const end = span.end;
      if (matches.some((x) => start < x.end && end > x.start)) continue;
      matches.push({ start, end, item });
    }

    matches.sort((a, b) => a.start - b.start);

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
      nodes.push(hl(m.item.spanId, m.item.cat, text.slice(m.start, m.end), m.item.evId));
      cursor = m.end;
    }
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return <>{nodes}</>;
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden">

      {/* ══════ HEADER ══════ */}
      <header className="flex-none border-b border-gray-200 px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Upload
              </button>
              <span className="text-gray-300 text-xs select-none">|</span>
              <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">
                AI-Powered Chart Review Interface — targeted ADRD
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1 shrink-0">
            {/* ── Patient count ── */}
            {hasPatients && (
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
                <Users className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-700 font-medium tabular-nums whitespace-nowrap">
                  {patients.length} patients
                </span>
              </div>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-md">
              <AlertTriangle className="w-3.5 h-3.5" /> Conflict Alert
            </span>
            <span className="inline-flex items-center text-xs text-gray-700 bg-white border border-gray-300 px-3 py-1 rounded-md">
              Delirium Warning
            </span>
            <button className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ══════ PATIENT NAVIGATION BAR (visible only when patients are loaded) ══════ */}
      {hasPatients && (
        <div className="flex-none bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2 relative z-20">

          {/* Prev button */}
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-medium shadow-sm disabled:opacity-30 hover:bg-blue-100 transition-colors shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Counter + Next + List toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-blue-600 font-medium tabular-nums whitespace-nowrap">
              {currentIndex + 1} / {patients.length}
            </span>
            <button
              onClick={() => setCurrentIndex((i) => Math.min(patients.length - 1, i + 1))}
              disabled={currentIndex === patients.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 text-xs font-medium shadow-sm disabled:opacity-30 hover:bg-blue-100 transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setListOpen((o) => !o)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 text-xs hover:bg-blue-100 transition-colors"
              title="Patient list"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dropdown patient list */}
          {listOpen && (
            <div className="absolute top-full right-4 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-700">All Patients ({patients.length})</span>
                <button onClick={() => setListOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {patients.map((p, i) => {
                  const m = mapPatientRow(p);
                  const patientId = m.patient_ID !== "—" ? m.patient_ID : `Row ${i + 1}`;
                  return (
                    <button
                      key={i}
                      onClick={() => { setCurrentIndex(i); setListOpen(false); }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                        i === currentIndex ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        i === currentIndex ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">patient_ID: {patientId}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {[m.gender, m.admit_age !== "—" ? `${m.admit_age} yrs` : "", m.race]
                            .filter((v) => v && v !== "—").join(" · ")}
                        </p>
                      </div>
                      {i === currentIndex && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ 3-COLUMN BODY ══════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT ── */}
        <aside className="w-44 flex-none border-r border-gray-200 bg-white flex flex-col">
          <div className="px-4 pt-3 pb-1.5">
            <p className="text-xs font-semibold text-gray-700">Section Navigator</p>
          </div>
          <nav className="flex-1 overflow-y-auto">
            {leftNavItems.map((sec) => {
              const active = activeLeftNav === sec.key;
              return (
                <button key={sec.key} onClick={() => scrollToLeftNav(sec.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors
                    ${active ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.dotColor }} />
                  <span className={`flex-1 ${active ? "font-medium text-gray-900" : "text-gray-600"}`}>
                    {sec.label}
                  </span>
                  <ChevronRight className={`w-3 h-3 ${active ? "text-gray-500" : "text-gray-300"}`} />
                </button>
              );
            })}
          </nav>

          {/* Create custom section */}
          <div className="border-t border-gray-100 px-3 py-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Add Section</p>
            <input
              type="text"
              placeholder="Section name"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomSection()}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400 bg-white"
            />
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={newSectionColor}
                onChange={(e) => setNewSectionColor(e.target.value)}
                className="w-8 h-8 border border-gray-300 rounded p-0.5 bg-white shrink-0"
                title="Section color"
              />
              <button
                onClick={addCustomSection}
                disabled={!newSectionName.trim()}
                className="flex-1 text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </aside>

        {/* ── MIDDLE: Clinical Note ── */}
        <main
          ref={middleRef}
          onMouseUp={handleNoteMouseUp}
          className="flex-1 overflow-y-auto border-r border-gray-200 flex flex-col select-text"
        >
          {/* Note content */}
          <div className="px-6 py-5 flex-1">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Clinical Note with AI Highlights</h2>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Tag className="w-3 h-3" /> Select text to label
              </span>
            </div>

            {/* ── Full clinical note ── */}
            {rawNote ? (
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {renderHighlightedNote(rawNote)}
              </p>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
                <p className="text-sm text-gray-500">
                  No clinical note data found for this patient row.
                </p>
              </div>
            )}

            {/* ── Dual Timeline ── */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Timeline</h3>
                <div className="flex bg-gray-100 rounded-md p-0.5 gap-0.5">
                  {(["admission", "comprehensive"] as const).map((t) => (
                    <button key={t} onClick={() => setTimelineTab(t)}
                      className={`text-xs px-2.5 py-1 rounded transition-all ${
                        timelineTab === t ? "bg-white text-gray-800 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
                      }`}>
                      {t === "admission" ? "This Admission" : "Comprehensive History"}
                    </button>
                  ))}
                </div>
              </div>

              {timelineTab === "admission" && (
                <div className="relative pl-5">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />
                  {admissionTimeline.length === 0 ? (
                    <p className="text-xs text-gray-400">No admission timeline data.</p>
                  ) : (
                    <div className="space-y-3">
                      {admissionTimeline.map((item, idx) => (
                        <div key={idx} className="relative flex gap-3 items-start">
                          <div className={`w-3.5 h-3.5 rounded-full ${item.dot} shrink-0 mt-0.5 z-10 ring-2 ring-white`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 leading-none mb-0.5">{item.date}</p>
                            <p className="text-sm text-gray-800 leading-snug">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 leading-snug mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {timelineTab === "comprehensive" && (
                <div className="relative pl-5">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200" />
                  {comprehensiveTimeline.length === 0 ? (
                    <p className="text-xs text-gray-400">No comprehensive timeline data.</p>
                  ) : (
                    <div className="space-y-3">
                      {comprehensiveTimeline.map((item, idx) => (
                        <div key={idx} className="relative flex gap-3 items-start">
                          <div className={`w-3.5 h-3.5 rounded-full ${item.dot} shrink-0 mt-0.5 z-10 ring-2 ring-white`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 leading-none mb-0.5">{item.date}</p>
                            <p className="text-sm text-gray-800 leading-snug">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 leading-snug mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT: Decision Panel ── */}
        <aside className="w-[300px] flex-none bg-white flex flex-col border-l border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Decision Panel</span>
            <div className="flex items-center gap-2">
              <button className="text-gray-400 hover:text-gray-600"><HelpCircle className="w-4 h-4" /></button>
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* 1. Demographics */}
            <div className="border-b border-gray-100">
              <button onClick={() => setDemoOpen((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Patient Demographics</span>
                {demoOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {demoOpen && (
                <div className="px-4 pb-3">
                  <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {([
                      ["patient_ID", activeDemographics.patient_ID],
                      ["admit_age", activeDemographics.admit_age !== "—" ? `${activeDemographics.admit_age} yrs` : "—"],
                      ["gender", activeDemographics.gender],
                      ["race", activeDemographics.race],
                      ["insurance", activeDemographics.insurance],
                      ["language", activeDemographics.language],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-gray-400 leading-none mb-0.5">{k}</p>
                        <p className="text-xs text-gray-800 font-medium leading-snug break-words">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. ADRD Diagnosis */}
            <div className="px-4 pt-3 pb-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">ADRD Diagnosis</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 w-14 shrink-0">ADRD:</span>
                <div className="flex gap-1.5">
                  {(["Yes", "No", "Uncertain"] as ADRDOption[]).map((opt) => (
                    <button key={opt} onClick={() => setAdrd(opt)}
                      className={`text-xs px-2.5 py-1 rounded border transition-all ${
                        adrd === opt ? "border-blue-500 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}>{opt}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xs text-gray-500 w-14 shrink-0 mt-1">Subtype:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(["AD", "VaD", "FTD", "LBD", "Mixed", "Unspecified"] as SubtypeOpt[]).map((t) => (
                    <button key={t} onClick={() => setSubtype(t)}
                      className={`text-xs px-2 py-1 rounded border transition-all ${
                        subtype === t ? "border-blue-500 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-500 hover:border-gray-400"
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-14 shrink-0">Confidence:</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${diagnosisDefaults.confidence ?? 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-800">
                  {diagnosisDefaults.confidence == null ? "-" : `${diagnosisDefaults.confidence}%`}
                </span>
              </div>
            </div>

            {/* 3. Evidence */}
            <div className="px-4 pt-3 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Evidence ({displayEvidence.length})</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-0.5"><Check className="w-3 h-3 text-green-500" /> Accept</span>
                  <span className="flex items-center gap-0.5"><X className="w-3 h-3 text-red-400" /> Reject</span>
                </div>
              </div>
              {displayEvidence.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">No evidence data in uploaded row.</p>
              )}
              {displayEvidence.map((ev, idx) => {
                const status   = evidenceStatus[ev.key] ?? null;
                const accepted = status === "accepted";
                const rejected = status === "rejected";
                return (
                  <div key={ev.key} id={`ev-${ev.key}`}
                    className={`py-2.5 border-b border-gray-100 last:border-0 rounded-sm transition-colors ${
                      accepted ? "bg-green-50" : rejected ? "bg-red-50" : activeEv === ev.key ? "bg-blue-50" : ""
                    }`}>
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <span className="text-xs text-gray-800 font-medium flex-1 leading-snug">
                        {idx + 1}. {ev.type}{ev.source === "manual" ? " (Manual)" : ""}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {ev.strength && <span className={`text-xs font-semibold ${STRENGTH_CLS[ev.strength]}`}>{ev.strength}</span>}
                        <button onClick={() => toggleEvStatus(ev.key, "accepted")} title="Accept"
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            accepted ? "bg-green-500 border-green-500 text-white" : "border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600"
                          }`}><Check className="w-3 h-3" /></button>
                        <button onClick={() => toggleEvStatus(ev.key, "rejected")} title="Reject"
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            rejected ? "bg-red-400 border-red-400 text-white" : "border-gray-300 text-gray-400 hover:border-red-400 hover:text-red-500"
                          }`}><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug mb-1">{ev.desc}</p>
                    <div className="flex items-center justify-between">
                      <button onClick={() => jumpToSpan(ev.spanId, ev.key)} className="text-xs text-blue-500 hover:text-blue-700 hover:underline">
                        Jump to text
                      </button>
                      {status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${accepted ? "text-green-700 bg-green-100" : "text-red-600 bg-red-100"}`}>
                          {accepted ? "✅ Accepted" : "❌ Rejected"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4. Manual Labels */}
            <div className="px-4 pt-3 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Manual Labels {manualLabels.length > 0 && <span className="ml-1 text-blue-500">({manualLabels.length})</span>}
                </p>
                <button
                  onClick={() => setCustomFormOpen((p) => !p)}
                  className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  title="Add label manually"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Custom
                </button>
              </div>

              {/* Selection hint */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 mb-2.5">
                <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-snug">
                  Highlight any text in the note, then pick a category from the popup.
                </p>
              </div>

              {/* Fallback manual form */}
              {customFormOpen && (
                <div className="mb-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
                  <input
                    type="text"
                    placeholder="Enter label text…"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomLabel()}
                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400 bg-white"
                  />
                  <div className="flex gap-1.5">
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    >
                      {sectionDefs.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <button onClick={addCustomLabel} disabled={!customText.trim()}
                      className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-40 transition-colors shrink-0">
                      Add
                    </button>
                    <button onClick={() => setCustomFormOpen(false)}
                      className="text-xs px-2 py-1.5 border border-gray-300 rounded hover:bg-gray-100 text-gray-500 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Labels list */}
              {manualLabels.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-3">No labels added yet</p>
              ) : (
                <div className="space-y-1.5">
                  {manualLabels.map((lbl) => {
                    const meta = labelCatMeta(lbl.category);
                    return (
                      <div key={lbl.id} className="group flex items-start gap-2 bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-2 transition-colors">
                        <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: meta.dotColor }} />
                        <div className="flex-1 min-w-0">
                          <span
                            className="inline-block text-xs px-1.5 py-0.5 rounded border mb-0.5"
                            style={{
                              backgroundColor: hexToRgba(meta.dotColor, 0.14),
                              borderColor: hexToRgba(meta.dotColor, 0.35),
                              color: "#111827",
                            }}
                          >
                            {meta.label}
                          </span>
                          <p className="text-xs text-gray-800 leading-snug">"{lbl.text}"</p>
                          {lbl.noteRef && <p className="text-xs text-gray-400 mt-0.5">📍 {lbl.noteRef}</p>}
                        </div>
                        <button onClick={() => removeLabel(lbl.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all shrink-0 mt-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. Acute vs Chronic */}
            <div className="px-4 pt-3 pb-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">Acute vs Chronic</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {acuteVsChronicSummary}
              </p>
            </div>

            {/* 6. Export */}
            <div className="px-4 py-4">
              <button onClick={exportJSON}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                <Download className="w-4 h-4" /> Export Labels as JSON
              </button>
              <p className="text-xs text-gray-400 text-center mt-1.5">
                Saves diagnosis, evidence decisions &amp; all labels
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ══════ FLOATING SELECTION POPOVER ══════ */}
      {selectionPopover && (
        <div
          ref={popoverRef}
          style={{
            position:  "fixed",
            left:      selectionPopover.x,
            top:       selectionPopover.y,
            transform: selectionPopover.above
              ? "translateX(-50%) translateY(-100%)"
              : "translateX(-50%)",
            zIndex: 9999,
            marginTop: selectionPopover.above ? -6 : 6,
          }}
          className="w-72 bg-white border border-gray-200 rounded-xl shadow-2xl p-3"
        >
          {/* Arrow */}
          {selectionPopover.above ? (
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45 block" />
          ) : (
            <span className="absolute left-1/2 -translate-x-1/2 -top-[5px] w-2.5 h-2.5 bg-white border-l border-t border-gray-200 rotate-45 block" />
          )}

          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-800 italic leading-snug line-clamp-2">
                "{selectionPopover.text.length > 55
                  ? selectionPopover.text.slice(0, 55) + "…"
                  : selectionPopover.text}"
              </p>
              {selectionPopover.sectionLabel && (
                <p className="text-xs text-gray-400 mt-0.5">📍 {selectionPopover.sectionLabel}</p>
              )}
            </div>
            <button onClick={() => setSelectionPopover(null)}
              className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Divider + label prompt */}
          <p className="text-xs text-gray-500 mb-2 font-medium">Label as evidence type:</p>

          {/* Category buttons */}
          <div className="flex flex-wrap gap-1.5">
            {sectionDefs.map((cat) => (
              <button
                key={cat.value}
                onClick={() => applySelectionLabel(cat.value)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all duration-100 active:scale-95"
                style={{
                  backgroundColor: hexToRgba(cat.dotColor, 0.12),
                  borderColor: hexToRgba(cat.dotColor, 0.45),
                  color: "#111827",
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.dotColor }} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}