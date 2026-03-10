/**
 * Multi-Agent AI System for Clinical Notes Analysis
 *
 * Agent Architecture:
 * 1. Extraction Agent  – extracts entities and their character-level spans
 * 2. Classification Agent – classifies ADRD diagnosis and subtype
 * 3. Evidence Agent    – grades supporting evidence and links spans
 * 4. Timeline Agent    – constructs chronological disease progression
 * 5. Confidence Agent  – calculates confidence scores
 */

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────
export type HighlightCategory =
  | "diagnosis"
  | "cognitive"
  | "medication"
  | "function"
  | "history"
  | "acute";

export interface TextSpan {
  id: string;
  start: number;
  end: number;
  text: string;
  category: HighlightCategory;
  evidenceId?: number;
}

export interface Evidence {
  id: number;
  type: string;
  displayText: string;
  spanText: string; // exact phrase found in the note
  source: string;
  strength: "STRONG" | "MODERATE" | "WEAK";
  category: HighlightCategory;
  spanId: string;
}

export interface TimelineEvent {
  id: string;
  year: string;
  event: string;
  description: string;
  type: "onset" | "diagnosis" | "treatment" | "progression" | "current";
}

export interface ClinicalNote {
  patientId: string;
  notes: string;
  admissionDate?: string;
}

export interface AnalysisResult {
  patientId: string;
  admissionDate: string;
  rawNotes: string;
  diagnosis: {
    hasADRD: "Yes" | "No" | "Uncertain";
    subtype: "AD" | "VaD" | "FTD" | "LBD" | "Mixed" | "Unspecified" | null;
    confidence: number;
  };
  spans: TextSpan[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  acuteVsChronic: string;
  hasConflict: boolean;
  hasDelirium: boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function findSpans(
  notes: string,
  patterns: Record<HighlightCategory, string[]>
): TextSpan[] {
  const raw: TextSpan[] = [];

  for (const [cat, terms] of Object.entries(patterns) as [
    HighlightCategory,
    string[]
  ][]) {
    for (const term of terms) {
      let regex: RegExp;
      try {
        regex = new RegExp(term, "gi");
      } catch {
        // If pattern is invalid regex, fall back to literal match
        regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      }
      let m: RegExpExecArray | null;
      while ((m = regex.exec(notes)) !== null) {
        raw.push({
          id: `${cat}-${m.index}`,
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          category: cat,
        });
      }
    }
  }

  // Sort and remove overlaps
  raw.sort((a, b) => a.start - b.start);
  const clean: TextSpan[] = [];
  let lastEnd = -1;
  for (const s of raw) {
    if (s.start >= lastEnd) {
      clean.push(s);
      lastEnd = s.end;
    }
  }
  return clean;
}

// ─────────────────────────────────────────────────────────────
// Agent 1 – Extraction
// ─────────────────────────────────────────────────────────────
class ExtractionAgent {
  private patterns: Record<HighlightCategory, string[]> = {
    diagnosis: [
      "alzheimer's disease",
      "alzheimer's",
      "alzheimers",
      "vascular dementia",
      "lewy body dementia",
      "lewy body",
      "frontotemporal dementia",
      "frontotemporal",
      "mixed dementia",
      "dementia",
      "ADRD",
    ],
    cognitive: [
      "MMSE \\d+\\/\\d+",
      "MMSE",
      "MoCA \\w+ \\d+\\/\\d+",
      "MoCA score \\d+\\/\\d+",
      "MoCA",
      "cognitive decline",
      "cognitive impairment",
      "memory decline",
      "memory problems",
      "progressive memory decline",
      "mental status",
      "frontal lobe tasks",
      "fluctuating cognition",
    ],
    medication: [
      "donepezil \\d+\\s?mg[^.]*",
      "donepezil",
      "rivastigmine \\d+mg[^.]*",
      "rivastigmine",
      "galantamine",
      "memantine \\d+mg[^.]*",
      "memantine",
      "quetiapine",
      "Aricept",
    ],
    function: [
      "assistance with bathing and dressing",
      "assistance with all ADLs",
      "assistance with medication management",
      "requires assistance",
      "independent in basic ADLs",
      "instrumental ADLs",
      "ADL",
      "significant functional decline",
      "wandering behavior",
      "REM sleep behavior disorder",
      "visual hallucinations",
      "hallucinations",
      "parkinsonism",
    ],
    history: [
      "progressive memory decline",
      "personality changes",
      "disinhibition",
      "behavioral changes",
      "behavioral disturbances",
      "confusion",
      "disorientation",
      "multiple small strokes",
      "multiple falls",
      "history of falls",
    ],
    acute: [
      "acute confusion",
      "UTI",
      "sepsis",
      "delirium",
      "pneumonia",
      "agitation",
      "rapid cognitive decline",
      "acute",
    ],
  };

  extract(notes: string) {
    return findSpans(notes, this.patterns);
  }
}

// ─────────────────────────────────────────────────────────────
// Agent 2 – Classification
// ─────────────────────────────────────────────────────────────
class ClassificationAgent {
  classify(notes: string): {
    hasADRD: "Yes" | "No" | "Uncertain";
    subtype: "AD" | "VaD" | "FTD" | "LBD" | "Mixed" | "Unspecified" | null;
  } {
    const n = notes.toLowerCase();
    const adrdIndicators = ["alzheimer", "dementia", "cognitive decline", "memory decline", "adrd"];
    const hasADRD = adrdIndicators.some((i) => n.includes(i));

    let subtype: "AD" | "VaD" | "FTD" | "LBD" | "Mixed" | "Unspecified" | null = null;
    const isAD = n.includes("alzheimer");
    const isVaD = n.includes("vascular dementia") || n.includes("vascular disease") || n.includes("small strokes");
    const isFTD = n.includes("frontotemporal");
    const isLBD = n.includes("lewy body");

    const subtypeCount = [isAD, isVaD, isFTD, isLBD].filter(Boolean).length;
    if (subtypeCount > 1) subtype = "Mixed";
    else if (isAD) subtype = "AD";
    else if (isVaD) subtype = "VaD";
    else if (isFTD) subtype = "FTD";
    else if (isLBD) subtype = "LBD";
    else if (hasADRD) subtype = "Unspecified";

    return { hasADRD: hasADRD ? "Yes" : "Uncertain", subtype };
  }
}

// ─────────────────────────────────────────────────────────────
// Agent 3 – Evidence
// ─────────────────────────────────────────────────────────────
class EvidenceAgent {
  build(spans: TextSpan[]): Evidence[] {
    const evidence: Evidence[] = [];
    let id = 1;
    const used = new Set<string>();

    const push = (
      span: TextSpan,
      type: string,
      strength: "STRONG" | "MODERATE" | "WEAK",
      displayText: string
    ) => {
      if (used.has(span.id)) return;
      used.add(span.id);
      const spanWithLink = { ...span, evidenceId: id };
      evidence.push({
        id: id++,
        type,
        displayText,
        spanText: span.text,
        source: "Clinical Note",
        strength,
        category: span.category,
        spanId: spanWithLink.id,
      });
    };

    // Prioritised evidence extraction
    const byCat = (cat: HighlightCategory) => spans.filter((s) => s.category === cat);

    for (const s of byCat("diagnosis")) {
      push(s, "Formal Diagnosis", "STRONG", `Documented: "${s.text}"`);
    }
    for (const s of byCat("cognitive")) {
      push(s, "Cognitive Assessment", "STRONG", `Test result: "${s.text}"`);
    }
    for (const s of byCat("medication")) {
      push(s, "Dementia Medication", "MODERATE", `Prescribed: "${s.text}"`);
    }
    for (const s of byCat("function")) {
      push(s, "Functional Status", "MODERATE", `ADL note: "${s.text}"`);
    }
    for (const s of byCat("history").slice(0, 3)) {
      push(s, "History / Chronicity", "MODERATE", `History: "${s.text}"`);
    }
    for (const s of byCat("acute").slice(0, 2)) {
      push(s, "Acute Event", "WEAK", `Acute finding: "${s.text}"`);
    }

    return evidence;
  }
}

// ─────────────────────────────────────────────────────────────
// Agent 4 – Timeline
// ─────────────────────────────────────────────────────────────
class TimelineAgent {
  construct(notes: string, admissionDate: string): TimelineEvent[] {
    const n = notes.toLowerCase();
    const events: TimelineEvent[] = [];
    const admYear = admissionDate
      ? new Date(admissionDate).getFullYear()
      : new Date().getFullYear();

    // Extract explicit years
    const yearRx = /\b(19|20)\d{2}\b/g;
    const foundYears = [...new Set((notes.match(yearRx) || []).map(Number))].sort();

    // Infer years from "X years ago" phrases
    const agoRx = /(\d+)[- ]year[s]? (?:history|ago)/gi;
    let m: RegExpExecArray | null;
    while ((m = agoRx.exec(notes)) !== null) {
      foundYears.push(admYear - parseInt(m[1]));
    }

    const uniqueYears = [...new Set(foundYears)].sort();

    const typeMap: Record<number, TimelineEvent["type"]> = {};

    uniqueYears.forEach((yr) => {
      let type: TimelineEvent["type"] = "progression";
      let event = "Progression noted";
      let desc = "";

      if (yr === Math.min(...uniqueYears)) {
        type = "onset";
        event = "Symptom onset";
        desc = "Initial cognitive / behavioral symptoms";
      } else if (n.includes("diagnosed") && !typeMap[yr]) {
        type = "diagnosis";
        event = "ADRD Diagnosed";
        desc = "Formal diagnosis established";
      } else if (n.includes("donepezil") || n.includes("rivastigmine") || n.includes("memantine")) {
        type = "treatment";
        event = "Treatment started";
        desc = "Dementia medication initiated";
      }

      typeMap[yr] = type;
      events.push({ id: `ev-${yr}`, year: String(yr), event, description: desc, type });
    });

    // Always add "Current Admission"
    events.push({
      id: "ev-current",
      year: admissionDate || "This Admission",
      event: "Current Admission",
      description: "Acute event / current evaluation",
      type: "current",
    });

    // Deduplicate by year
    const seen = new Set<string>();
    return events.filter((e) => {
      if (seen.has(e.year)) return false;
      seen.add(e.year);
      return true;
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Agent 5 – Confidence
// ─────────────────────────────────────────────────────────────
class ConfidenceAgent {
  calculate(evidence: Evidence[]): number {
    const strong = evidence.filter((e) => e.strength === "STRONG").length;
    const moderate = evidence.filter((e) => e.strength === "MODERATE").length;
    const weak = evidence.filter((e) => e.strength === "WEAK").length;
    return Math.min(98, strong * 25 + moderate * 12 + weak * 4 + 15);
  }
}

// ─────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────
export class MultiAgentAnalyzer {
  private extraction = new ExtractionAgent();
  private classification = new ClassificationAgent();
  private evidenceAgent = new EvidenceAgent();
  private timeline = new TimelineAgent();
  private confidence = new ConfidenceAgent();

  async analyze(clinicalNote: ClinicalNote): Promise<AnalysisResult> {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

    const notes = clinicalNote.notes;
    const admissionDate =
      clinicalNote.admissionDate || new Date().toISOString().split("T")[0];

    const spans = this.extraction.extract(notes);
    const classification = this.classification.classify(notes);
    const evidence = this.evidenceAgent.build(spans);
    const timelineEvents = this.timeline.construct(notes, admissionDate);
    const confidenceScore = this.confidence.calculate(evidence);

    // Link span evidenceId back
    const evidenceIdMap = new Map(evidence.map((e) => [e.spanId, e.id]));
    const linkedSpans = spans.map((s) => ({
      ...s,
      evidenceId: evidenceIdMap.get(s.id),
    }));

    const n = notes.toLowerCase();
    const hasDelirium = n.includes("delirium") || n.includes("acute confusion");
    const hasConflict =
      classification.hasADRD === "Yes" && (n.includes("acute") || hasDelirium);

    const acuteVsChronic = (() => {
      if (n.includes("chronic") || n.includes("progressive") || n.includes("years"))
        return "Chronic neurodegenerative process – pre-existing dementia likely";
      if (n.includes("acute") || n.includes("sudden"))
        return "Acute-on-chronic – consider superimposed delirium";
      return "Insufficient data to classify acuity";
    })();

    return {
      patientId: clinicalNote.patientId,
      admissionDate,
      rawNotes: notes,
      diagnosis: { ...classification, confidence: confidenceScore },
      spans: linkedSpans,
      evidence,
      timeline: timelineEvents,
      acuteVsChronic,
      hasConflict,
      hasDelirium,
    };
  }
}