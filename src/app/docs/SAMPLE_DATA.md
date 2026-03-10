# Sample Data for Testing

## Excel File Format

Create an Excel file (.xlsx or .xls) with the following structure:

### Column Headers

| Patient ID | Notes | Admission Date |
|------------|-------|----------------|

### Sample Data

You can use the following sample data to test the application:

#### Patient 1002345
**Patient ID:** 1002345  
**Admission Date:** 2024-04-10  
**Notes:**
```
Patient is an 81-year-old female with a history of progressive memory decline for the past 5 years. Family reports worsening confusion and difficulty managing finances. No prior psychiatric history. MMSE 18/30. Previously diagnosed with Alzheimer's disease 3 years ago and started on donepezil 10 mg daily. Requires assistance with bathing and dressing. Able to feed herself. Ambulates with a walker. No recent falls. Admitted for acute confusion and weakness. Found to have UTI and sepsis. Treated with IV antibiotics. Mental status improved with treatment but not yet back to baseline. Baseline per family: oriented to person only, needs help with all instrumental ADLs.
```

#### Patient 1002346
**Patient ID:** 1002346  
**Admission Date:** 2024-04-12  
**Notes:**
```
78-year-old male with 4-year history of cognitive decline. Wife reports progressive memory problems and disorientation. MoCA score 16/30. Previously diagnosed with vascular dementia. Currently on rivastigmine 6mg twice daily. History of multiple small strokes. Requires assistance with medication management and transportation. Lives at home with wife who is primary caregiver. Recent hospitalization for pneumonia with delirium that has mostly resolved.
```

#### Patient 1002347
**Patient ID:** 1002347  
**Admission Date:** 2024-04-15  
**Notes:**
```
72-year-old female presenting with behavioral changes over past 2 years. Family reports personality changes, disinhibition, and difficulty with executive function. No significant memory complaints initially. MMSE 24/30 but poor performance on frontal lobe tasks. Neuroimaging shows frontal lobe atrophy. Suspected frontotemporal dementia. Currently not on dementia medications. Independent in basic ADLs but needs supervision for complex tasks. Recent episode of wandering behavior.
```

#### Patient 1002348
**Patient ID:** 1002348  
**Admission Date:** 2024-04-18  
**Notes:**
```
85-year-old male with mixed dementia picture. History of Alzheimer's disease diagnosed 5 years ago, also with evidence of vascular disease. MMSE 14/30. On donepezil 10mg daily and memantine 10mg twice daily. Significant functional decline over past year. Requires assistance with all ADLs. History of multiple falls. Visual hallucinations reported by family, suggesting possible Lewy body component. Admitted for management of agitation and behavioral disturbances.
```

#### Patient 1002349
**Patient ID:** 1002349  
**Admission Date:** 2024-04-20  
**Notes:**
```
68-year-old female with rapid cognitive decline over past 6 months. Presents with visual hallucinations, parkinsonism, and fluctuating cognition. MMSE 19/30 with marked variability. Clinical picture highly suggestive of Lewy body dementia. Started on low-dose quetiapine for hallucinations with some improvement. Rivastigmine initiated. Significant REM sleep behavior disorder reported by spouse. Requires assistance with most ADLs due to motor symptoms and cognitive impairment.
```

## How to Create Test Excel File

### Option 1: Manual Creation
1. Open Microsoft Excel or Google Sheets
2. Create three columns: "Patient ID", "Notes", "Admission Date"
3. Copy and paste the sample data above
4. Save as .xlsx file

### Option 2: Using the Data Above
Copy the entire table below and paste into Excel:

```
Patient ID	Notes	Admission Date
1002345	Patient is an 81-year-old female with a history of progressive memory decline for the past 5 years. Family reports worsening confusion and difficulty managing finances. No prior psychiatric history. MMSE 18/30. Previously diagnosed with Alzheimer's disease 3 years ago and started on donepezil 10 mg daily. Requires assistance with bathing and dressing. Able to feed herself. Ambulates with a walker. No recent falls. Admitted for acute confusion and weakness. Found to have UTI and sepsis. Treated with IV antibiotics. Mental status improved with treatment but not yet back to baseline. Baseline per family: oriented to person only, needs help with all instrumental ADLs.	2024-04-10
1002346	78-year-old male with 4-year history of cognitive decline. Wife reports progressive memory problems and disorientation. MoCA score 16/30. Previously diagnosed with vascular dementia. Currently on rivastigmine 6mg twice daily. History of multiple small strokes. Requires assistance with medication management and transportation. Lives at home with wife who is primary caregiver. Recent hospitalization for pneumonia with delirium that has mostly resolved.	2024-04-12
1002347	72-year-old female presenting with behavioral changes over past 2 years. Family reports personality changes, disinhibition, and difficulty with executive function. No significant memory complaints initially. MMSE 24/30 but poor performance on frontal lobe tasks. Neuroimaging shows frontal lobe atrophy. Suspected frontotemporal dementia. Currently not on dementia medications. Independent in basic ADLs but needs supervision for complex tasks. Recent episode of wandering behavior.	2024-04-15
1002348	85-year-old male with mixed dementia picture. History of Alzheimer's disease diagnosed 5 years ago, also with evidence of vascular disease. MMSE 14/30. On donepezil 10mg daily and memantine 10mg twice daily. Significant functional decline over past year. Requires assistance with all ADLs. History of multiple falls. Visual hallucinations reported by family, suggesting possible Lewy body component. Admitted for management of agitation and behavioral disturbances.	2024-04-18
1002349	68-year-old female with rapid cognitive decline over past 6 months. Presents with visual hallucinations, parkinsonism, and fluctuating cognition. MMSE 19/30 with marked variability. Clinical picture highly suggestive of Lewy body dementia. Started on low-dose quetiapine for hallucinations with some improvement. Rivastigmine initiated. Significant REM sleep behavior disorder reported by spouse. Requires assistance with most ADLs due to motor symptoms and cognitive impairment.	2024-04-20
```

## Expected Analysis Results

When you upload this sample file, the AI agents will analyze each patient and provide:

1. **ADRD Diagnosis Classification**
   - Patient 1002345: AD (Alzheimer's Disease)
   - Patient 1002346: VaD (Vascular Dementia)
   - Patient 1002347: FTD (Frontotemporal Dementia)
   - Patient 1002348: Mixed Dementia
   - Patient 1002349: LBD (Lewy Body Dementia)

2. **Evidence Extraction**
   - Cognitive test scores (MMSE, MoCA)
   - Medication information
   - Functional status
   - Symptom descriptions
   - Historical timeline

3. **Confidence Scores**
   - Based on strength and quantity of evidence
   - Typical range: 60-90%

4. **Timeline Construction**
   - Disease onset and progression
   - Key diagnostic events
   - Treatment milestones

## Notes

- All data is fictional and created for demonstration purposes
- The AI analysis is simulated and uses pattern matching algorithms
- For production use, integrate with real AI/ML models
- Ensure compliance with healthcare data regulations when using real patient data
