import { useState } from "react";
import { useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2, Info } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { MultiAgentAnalyzer } from "../services/aiAgentService";

interface PatientData {
  patientId: string;
  notes: string;
  admissionDate?: string;
}

export default function FileUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      processExcelFile(uploadedFile);
    }
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const patientData: PatientData[] = jsonData.map((row: any) => ({
        patientId: row["Patient ID"] || row["patientId"] || row["patient_id"] || "",
        notes: row["Notes"] || row["notes"] || row["Clinical Notes"] || "",
        admissionDate: row["Admission Date"] || row["admissionDate"] || row["admission_date"] || "",
      }));

      setPatients(patientData);
    };
    reader.readAsBinaryString(file);
  };

  const handleAnalyze = async () => {
    if (patients.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      const analyzer = new MultiAgentAnalyzer();
      const analysisResults = [];
      
      // 分析每个患者的笔记
      for (const patient of patients) {
        setCurrentPatient(patient.patientId);
        const result = await analyzer.analyze({
          patientId: patient.patientId,
          notes: patient.notes,
          admissionDate: patient.admissionDate,
        });
        analysisResults.push(result);
      }
      
      // 将分析结果存储到sessionStorage
      sessionStorage.setItem("analysisResults", JSON.stringify(analysisResults));
      sessionStorage.setItem("patientsData", JSON.stringify(patients));
      
      setIsProcessing(false);
      setCurrentPatient("");
      
      // 导航到第一个患者的分析页面（确保 patientId 非空）
      const firstPatientId = patients[0].patientId || `patient-${0}`;
      navigate(`/review/${encodeURIComponent(firstPatientId)}`);
    } catch (error) {
      console.error("Analysis failed:", error);
      setIsProcessing(false);
      setCurrentPatient("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="mb-2">AI-Powered Clinical Notes Analysis</h1>
          <p className="text-gray-600">Upload an Excel file containing Patient ID and Clinical Notes for AI-powered ADRD analysis</p>
        </div>

        <Card className="p-8">
          <div className="space-y-6">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="mb-2">
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-sm text-gray-500">Excel files (.xlsx, .xls)</p>
              </label>
            </div>

            {/* File Info */}
            {file && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-600">{patients.length} patients found</p>
                </div>
              </div>
            )}

            {/* Patients Preview */}
            {patients.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Patients to Analyze:</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {patients.map((patient, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Patient ID: {patient.patientId}</p>
                          {patient.admissionDate && (
                            <p className="text-sm text-gray-600">Admission Date: {patient.admissionDate}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{patient.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={patients.length === 0 || isProcessing}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing {currentPatient}...
                </>
              ) : (
                "Analyze Notes"
              )}
            </Button>
          </div>
        </Card>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
          <h3 className="font-medium mb-2">Excel File Format:</h3>
          <p className="text-sm text-gray-600">Your Excel file should contain the following columns:</p>
          <ul className="text-sm text-gray-600 list-disc list-inside mt-2">
            <li>Patient ID (required)</li>
            <li>Notes or Clinical Notes (required)</li>
            <li>Admission Date (optional)</li>
          </ul>
        </div>

        {/* Multi-Agent System Info */}
        <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Multi-Agent AI System</h3>
              <p className="text-sm text-blue-800 mb-3">
                Our AI system uses 5 specialized agents to analyze clinical notes:
              </p>
              <ul className="text-sm text-blue-800 space-y-1.5">
                <li><strong>Extraction Agent:</strong> Identifies key medical entities (diagnoses, medications, tests)</li>
                <li><strong>Classification Agent:</strong> Determines ADRD diagnosis and subtype</li>
                <li><strong>Evidence Agent:</strong> Finds and grades supporting evidence (STRONG/MODERATE/WEAK)</li>
                <li><strong>Timeline Agent:</strong> Constructs disease progression timeline</li>
                <li><strong>Confidence Agent:</strong> Calculates diagnostic confidence score</li>
              </ul>
              <p className="text-xs text-blue-700 mt-3">
                Note: This is a demonstration using simulated AI. For production use, integrate with real backend AI services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}