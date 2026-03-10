# Multi-Agent System Architecture for Clinical Notes Analysis

## Overview

This application implements a multi-agent AI system for analyzing clinical notes and automatically tagging them for ADRD (Alzheimer's Disease and Related Dementias) diagnosis.

## System Architecture

### Frontend Components

1. **FileUpload Component** (`/src/app/components/FileUpload.tsx`)
   - Handles Excel file upload containing Patient ID and clinical notes
   - Parses Excel data using `xlsx` library
   - Triggers the multi-agent analysis pipeline
   - Displays upload progress and patient preview

2. **ChartReview Component** (`/src/app/components/ChartReview.tsx`)
   - Displays AI-analyzed clinical notes with highlights
   - Shows structured decision panel with ADRD diagnosis
   - Presents evidence with strength ratings
   - Visualizes disease progression timeline

### Multi-Agent AI System

Located in `/src/app/services/aiAgentService.ts`, the system consists of 5 specialized agents:

#### 1. Extraction Agent
**Purpose:** Extracts key medical entities from clinical notes

**Functionality:**
- Identifies medical history indicators
- Extracts diagnosis mentions
- Finds cognitive test references (MMSE, MoCA, etc.)
- Locates medication information
- Identifies functional status indicators

**Output:** Structured data with categorized medical entities

#### 2. Classification Agent
**Purpose:** Classifies ADRD diagnosis and determines subtype

**Functionality:**
- Determines if patient has ADRD (Yes/No/Uncertain)
- Classifies ADRD subtype:
  - AD (Alzheimer's Disease)
  - VaD (Vascular Dementia)
  - FTD (Frontotemporal Dementia)
  - LBD (Lewy Body Dementia)
  - Mixed
  - Unspecified

**Output:** Diagnosis classification with subtype

#### 3. Evidence Agent
**Purpose:** Identifies and grades evidence supporting the diagnosis

**Functionality:**
- Identifies multiple types of evidence:
  - Diagnosis Evidence
  - Cognitive Test Results
  - Medication History
  - Functional Decline Indicators
  - Chronicity Markers
  - Delirium Triggers
- Grades evidence strength:
  - STRONG
  - MODERATE
  - WEAK

**Output:** List of evidence items with strength ratings

#### 4. Timeline Agent
**Purpose:** Constructs chronological disease progression timeline

**Functionality:**
- Extracts temporal information from notes
- Identifies key events in disease progression
- Creates visual timeline representation
- Marks significant milestones

**Output:** Chronological timeline of events

#### 5. Confidence Agent
**Purpose:** Calculates confidence scores for the diagnosis

**Functionality:**
- Analyzes evidence strength distribution
- Applies weighted scoring algorithm
- Considers evidence quality and quantity
- Generates confidence percentage

**Formula:**
```
Confidence = min(100, strongCount × 30 + moderateCount × 15 + weakCount × 5 + 20)
```

**Output:** Confidence score (0-100%)

### Multi-Agent Orchestrator

The `MultiAgentAnalyzer` class coordinates all agents:

```typescript
async analyze(clinicalNote: ClinicalNote): Promise<AnalysisResult>
```

**Workflow:**
1. Extract medical entities (Extraction Agent)
2. Classify diagnosis (Classification Agent)
3. Identify evidence (Evidence Agent)
4. Construct timeline (Timeline Agent)
5. Calculate confidence (Confidence Agent)
6. Determine acute vs chronic status
7. Return comprehensive analysis result

## Data Flow

```
Excel Upload
    ↓
Parse Patient Data
    ↓
For Each Patient:
    ↓
Multi-Agent Analysis
    ├─ Extraction Agent
    ├─ Classification Agent
    ├─ Evidence Agent
    ├─ Timeline Agent
    └─ Confidence Agent
    ↓
Store Results
    ↓
Display Analysis
```

## Expected Excel Format

Your Excel file should contain these columns:

- **Patient ID** (required): Unique patient identifier
- **Notes** or **Clinical Notes** (required): Clinical notes text
- **Admission Date** (optional): Date of admission (YYYY-MM-DD)

Example:
| Patient ID | Notes | Admission Date |
|------------|-------|----------------|
| 1002345 | Patient is an 81-year-old female with... | 2024-04-10 |

## Analysis Output

The system generates a comprehensive analysis including:

1. **ADRD Diagnosis**
   - Has ADRD: Yes/No/Uncertain
   - Subtype classification
   - Confidence percentage

2. **Evidence List**
   - Type of evidence
   - Supporting text excerpt
   - Source location
   - Strength rating

3. **Clinical Highlights**
   - Color-coded important terms
   - Category-based filtering

4. **Disease Timeline**
   - Chronological progression
   - Key events and milestones

5. **Acute vs Chronic Determination**
   - Process classification
   - Supporting rationale

## Backend Integration (Future Enhancement)

For production deployment, replace the mock `MultiAgentAnalyzer` with actual backend API calls:

```typescript
// Example backend integration
async analyze(clinicalNote: ClinicalNote): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clinicalNote)
  });
  return response.json();
}
```

The backend should implement the same multi-agent architecture using:
- LangChain for agent orchestration
- OpenAI GPT-4 or similar LLM for NLP tasks
- Vector databases for medical knowledge retrieval
- Custom medical NER (Named Entity Recognition) models

## Security Considerations

⚠️ **Important:** This application is for demonstration purposes only.

- Do not use with real patient data without proper HIPAA compliance
- Implement proper authentication and authorization
- Encrypt data in transit and at rest
- Follow healthcare data privacy regulations
- Use secure backend API endpoints
- Implement audit logging for all analysis requests

## Future Enhancements

1. **Real-time Backend Integration**
   - Connect to production AI agents
   - Use Supabase for data persistence

2. **Advanced NLP**
   - Fine-tuned medical language models
   - Custom entity recognition
   - Relationship extraction

3. **Enhanced Evidence Grading**
   - More sophisticated scoring algorithms
   - Multi-criteria decision analysis
   - Uncertainty quantification

4. **Collaborative Features**
   - Multi-user review and annotation
   - Consensus building tools
   - Expert feedback integration

5. **Export Capabilities**
   - Generate PDF reports
   - Export to EHR systems
   - Batch processing results
