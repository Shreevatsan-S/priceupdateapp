"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AiOutlineCloudUpload } from "react-icons/ai";
import * as ExcelJS from 'exceljs';

// Custom SearchableDropdown component
const SearchableDropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select or type to search..." 
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setSearchTerm(inputValue);
    setIsOpen(true);
    
    // If the input exactly matches an option, select it
    const exactMatch = options.find(option => 
      option.toLowerCase() === inputValue.toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch);
    } else {
      onChange(inputValue);
    }
  };

  const handleOptionClick = (option: string) => {
    onChange(option);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleInputBlur = () => {
    // Delay closing to allow for option clicks
    setTimeout(() => setIsOpen(false), 150);
  };

  const displayValue = searchTerm || value || '';

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <div
              key={index}
              className="px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
              onMouseDown={() => handleOptionClick(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
      
      {isOpen && searchTerm && filteredOptions.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="px-3 py-2 text-sm text-gray-500">
            No matches found
          </div>
        </div>
      )}
    </div>
  );
};

// Business fields configuration
const BUSINESS_FIELDS = [
  { key: 'exShowroomPrice', label: 'Ex Showroom price (excl Incentives/ Subsidy)' },
  { key: 'emps', label: 'EMPS' },
  { key: 'stateSubsidy', label: 'State Subsidy (Claimed after delivery)' },
  { key: 'postGstDiscount', label: 'Post GST Discount' },
  { key: 'p1Total', label: 'P1 Total (Excl Insurance and RTO but incl subsidys)' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'municipalTax', label: 'Municipal tax (% tax on Ex showroom excl. subsidy) [130]' },
  { key: 'rtoRoadSafety', label: 'RTO - Road safety tax / CESS.' },
  { key: 'smartCardFee', label: 'Smart card fee & RTO registration' },
  { key: 'postalCharges', label: 'Postal Charges.' },
  { key: 'serviceCharge', label: 'Service Charge and Penality' },
  { key: 'roadTax', label: 'Road tax (% tax on Ex showroom excl. subsidy) [130]' },
  { key: 'effectiveOnRoadCore', label: 'Effective on road Price to customer - Core' },
  { key: 'effectiveOnRoadPro', label: 'Effective on road Price to customer - Pro' }
];

// Validation functions
const validateColumnMappings = (mappings: {[key: string]: string}, columnNames: string[]) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  BUSINESS_FIELDS.forEach(field => {
    const mappedColumn = mappings[field.key];
    
    if (!mappedColumn) {
      errors.push(`Missing mapping for: ${field.label}`);
    } else if (!columnNames.includes(mappedColumn)) {
      errors.push(`Invalid column selected for ${field.label}: "${mappedColumn}" not found in Excel file`);
    }
  });
  
  // Check for duplicate mappings
  const mappedValues = Object.values(mappings).filter(v => v);
  const duplicates = mappedValues.filter((value, index) => mappedValues.indexOf(value) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate column mappings detected: ${duplicates.join(', ')}`);
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
};

// Auto-mapping functions
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Contains match
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein distance
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
};

const getKeywords = (label: string): string[] => {
  return label.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
};

const findBestMatch = (businessField: { key: string; label: string }, columnNames: string[]): string | null => {
  const fieldKeywords = getKeywords(businessField.label);
  const fieldKey = businessField.key.toLowerCase();
  const fieldLabel = businessField.label.toLowerCase();
  
  let bestMatch = '';
  let bestScore = 0;
  const threshold = 0.3; // Minimum similarity threshold
  
  columnNames.forEach(column => {
    const columnLower = column.toLowerCase();
    const columnKeywords = getKeywords(column);
    
    let score = 0;
    
    // Exact matches (case-insensitive)
    if (columnLower === fieldKey || columnLower === fieldLabel) {
      score = 1.0;
    }
    // Exact match after removing special characters and spaces
    else if (columnLower.replace(/[^a-z0-9]/g, '') === fieldKey.replace(/[^a-z0-9]/g, '') || 
             columnLower.replace(/[^a-z0-9]/g, '') === fieldLabel.replace(/[^a-z0-9]/g, '')) {
      score = 0.95;
    }
    // Field key/label contains column name or vice versa
    else if (fieldKey.includes(columnLower) || columnLower.includes(fieldKey) ||
             fieldLabel.includes(columnLower) || columnLower.includes(fieldLabel)) {
      score = 0.8;
    }
    // Fuzzy Logic
    else {
      // Calculate similarity scores for other cases
      score = Math.max(score, calculateSimilarity(fieldKey, columnLower));
      score = Math.max(score, calculateSimilarity(fieldLabel, column));
      
      // Check keyword matches
      let keywordScore = 0;
      fieldKeywords.forEach(fieldKeyword => {
        columnKeywords.forEach(colKeyword => {
          keywordScore = Math.max(keywordScore, calculateSimilarity(fieldKeyword, colKeyword));
        });
        // Also check if field keyword is contained in the column name
        if (columnLower.includes(fieldKeyword)) {
          keywordScore = Math.max(keywordScore, 0.7);
        }
      });
      score = Math.max(score, keywordScore);
      
      // Boost score for specific patterns (only if not already high)
      if (score < 0.8) {
        if (fieldKey.includes('price') && columnLower.includes('price')) score += 0.2;
        if (fieldKey.includes('tax') && columnLower.includes('tax')) score += 0.2;
        if (fieldKey.includes('insurance') && columnLower.includes('insurance')) score += 0.2;
        if (fieldKey.includes('subsidy') && columnLower.includes('subsidy')) score += 0.2;
        if (fieldKey.includes('discount') && columnLower.includes('discount')) score += 0.2;
        if (fieldKey.includes('road') && columnLower.includes('road')) score += 0.2;
        if (fieldKey.includes('rto') && columnLower.includes('rto')) score += 0.2;
      }
    }
    
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = column;
    }
  });
  
  return bestMatch || null;
};

const autoMapColumns = (columnNames: string[]): {[key: string]: string} => {
  const mappings: {[key: string]: string} = {};
  const usedColumns = new Set<string>();
  
  // First pass: Handle exact matches (highest priority)
  BUSINESS_FIELDS.forEach(field => {
    const fieldKey = field.key.toLowerCase();
    const fieldLabel = field.label.toLowerCase();
    
    // Look for exact matches (case-insensitive)
    const exactMatch = columnNames.find(col => {
      const colLower = col.toLowerCase();
      return colLower === fieldKey || 
             colLower === fieldLabel ||
             colLower.replace(/[^a-z0-9]/g, '') === fieldKey.replace(/[^a-z0-9]/g, '') ||
             colLower.replace(/[^a-z0-9]/g, '') === fieldLabel.replace(/[^a-z0-9]/g, '');
    });
    
    if (exactMatch && !usedColumns.has(exactMatch)) {
      mappings[field.key] = exactMatch;
      usedColumns.add(exactMatch);
    }
  });
  
  // Second pass: Handle remaining fields with similarity matching
  const unmappedFields = BUSINESS_FIELDS.filter(field => !mappings[field.key]);
  
  // Sort remaining fields by specificity (more specific fields first)
  const sortedFields = unmappedFields.sort((a, b) => {
    const aSpecific = a.label.split(' ').length;
    const bSpecific = b.label.split(' ').length;
    return bSpecific - aSpecific;
  });
  
  sortedFields.forEach(field => {
    const availableColumns = columnNames.filter(col => !usedColumns.has(col));
    const bestMatch = findBestMatch(field, availableColumns);
    
    if (bestMatch) {
      mappings[field.key] = bestMatch;
      usedColumns.add(bestMatch);
    }
  });
  
  return mappings;
};

export default function Home() {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<{[key: string]: string}>({});
  const [worksheetData, setWorksheetData] = useState<any[][]>([]);
  const [validationResults, setValidationResults] = useState<{
    errors: string[];
    warnings: string[];
    isValid: boolean;
  }>({ errors: [], warnings: [], isValid: false });
  const [autoMappedFields, setAutoMappedFields] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) return;
        
        const headers: string[] = [];
        const allData: any[][] = [];
        
        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          headers.push(cell.value?.toString() || `Column ${colNumber}`);
        });
        
        // Get data from first 10 rows
        for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 10); rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowData: any[] = [];
          
          for (let colNum = 1; colNum <= headers.length; colNum++) {
            const cell = row.getCell(colNum);
            rowData.push(cell.value?.toString() || '');
          }
          allData.push(rowData);
        }
        
        setColumnNames(headers);
        setWorksheetData(allData);
        
        // Auto-map columns after processing the file
        const autoMappings = autoMapColumns(headers);
        setColumnMappings(autoMappings);
        setAutoMappedFields(new Set(Object.keys(autoMappings)));
      } catch (error) {
        console.error('Error processing Excel file:', error);
        alert('Error reading Excel file. Please ensure it\'s a valid .xlsx or .xls file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      setUploadedFile(file);
      processExcelFile(file);
      setCurrentStep(2);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      setUploadedFile(file);
      processExcelFile(file);
      setCurrentStep(2);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleBackToUpload = () => {
    setCurrentStep(1);
    setFileName(null);
    setUploadedFile(null);
    setColumnNames([]);
    setColumnMappings({});
    setWorksheetData([]);
    setAutoMappedFields(new Set());
  };

  const handleContinueToReview = () => {
    setCurrentStep(3);
  };

  // Validation logic for column mappings
  const validateMappings = () => {
    const requiredFields = [
      'exShowroomPrice',
      'emps',
      'stateSubsidy',
      'postGstDiscount',
      'p1Total',
      'insurance',
      'municipalTax',
      'rtoRoadSafety',
      'smartCardFee',
      'postalCharges',
      'serviceCharge',
      'roadTax',
      'effectiveOnRoadCore',
      'effectiveOnRoadPro'
    ];

    const validMappings: string[] = [];
    const invalidMappings: string[] = [];
    const missingMappings: string[] = [];

    requiredFields.forEach(field => {
      const mappedColumn = columnMappings[field];
      
      if (!mappedColumn) {
        // Field not mapped at all
        missingMappings.push(field);
      } else if (columnNames.includes(mappedColumn)) {
        // Field mapped to a valid column
        validMappings.push(field);
      } else {
        // Field mapped but column doesn't exist in Excel file
        invalidMappings.push(field);
      }
    });

    return {
      validMappings,
      invalidMappings,
      missingMappings,
      totalRequired: requiredFields.length,
      isValid: invalidMappings.length === 0 && missingMappings.length === 0
    };
  };

  const getFieldLabel = (fieldKey: string) => {
    const field = BUSINESS_FIELDS.find(f => f.key === fieldKey);
    return field ? field.label : fieldKey;
  };

  const handleColumnMapping = (field: string, columnName: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [field]: columnName
    }));
    // Remove from auto-mapped set when manually changed
    if (autoMappedFields.has(field)) {
      setAutoMappedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }
  };

  const getPreviewData = (columnName: string) => {
    if (!columnName || !worksheetData.length) return '';
    const columnIndex = columnNames.indexOf(columnName);
    if (columnIndex === -1 || !worksheetData[1]) return '';
    return worksheetData[1][columnIndex] || '';
  };

  // Check validation whenever mappings change
  useEffect(() => {
    if (columnNames.length > 0) {
      const results = validateColumnMappings(columnMappings, columnNames);
      setValidationResults(results);
    }
  }, [columnMappings, columnNames]);

  return (
    <div className="main-dashboard-background grid grid-rows-[auto_1fr] items-center justify-items-center min-h-screen p-8 sm:p-4">
      {/* Header with Logo */}
      <header className="w-full flex justify-center pt-6 pb-8">
        <Image
          src="https://media.atherenergy.com/ather-logo-white.svg"
          alt="Ather Energy Logo"
          width={140}
          height={48}
          className="brightness-0 invert"
          priority
        />
      </header>
      
      <main className="flex flex-col gap-[12px] items-center w-full max-w-6xl justify-center">
        {/* Title Section */}
        <div className="text-center mb-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 drop-shadow-lg">
            Price Validation Tool
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-8 drop-shadow-md max-w-2xl mx-auto">
            Upload and validate your pricing data 
          </p>
        </div>

        {/* Steps Indicator */}
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-between mb-6">
            {/* Step 1: Upload */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold mb-1 shadow-lg text-sm ${currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-white/30 text-white/60'}`}>
                1
              </div>
              <span className={`text-xs font-medium drop-shadow-md ${currentStep >= 1 ? 'text-white' : 'text-white/60'}`}>Upload</span>
            </div>
            
            {/* Connector Line 1 */}
            <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 2 ? 'bg-blue-500' : 'bg-white/30'}`}></div>
            
            {/* Step 2: Map */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold mb-1 text-sm ${currentStep >= 2 ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/30 text-white/60'}`}>
                2
              </div>
              <span className={`text-xs font-medium drop-shadow-md ${currentStep >= 2 ? 'text-white' : 'text-white/60'}`}>Map</span>
            </div>
            
            {/* Connector Line 2 */}
            <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 3 ? 'bg-blue-500' : 'bg-white/30'}`}></div>
            
            {/* Step 3: Review */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold mb-1 text-sm ${currentStep >= 3 ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/30 text-white/60'}`}>
                3
              </div>
              <span className={`text-xs font-medium drop-shadow-md ${currentStep >= 3 ? 'text-white' : 'text-white/60'}`}>Review</span>
            </div>
          </div>
        </div>

        {/* Content based on current step */}
        {currentStep === 1 && (
          /* Drag and Drop Excel Upload Box */
          <div
            className={`w-full max-w-md p-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all duration-300 cursor-pointer backdrop-blur-sm ${dragActive ? "border-blue-400 bg-white/90 scale-105 shadow-xl" : "border-white/40 bg-white/80 hover:border-white/60 hover:bg-white/90 shadow-lg"}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={handleClick}
            tabIndex={0}
            role="button"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleChange}
            />
            <AiOutlineCloudUpload size={48} className="mb-3 text-blue-500" />
            <span className="font-semibold text-base mb-1 text-gray-800">
              Drop your Excel file here
            </span>
            <span className="text-sm text-gray-600 mb-1">
              or click to browse files
            </span>
            <span className="text-xs text-gray-500">
              Supports .xlsx and .xls formats
            </span>
          </div>
        )}

        {currentStep === 2 && (
          /* Column Mapping Interface */
          <div className="w-full max-w-4xl space-y-4">
            {/* File Info */}
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-white/40 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-green-600 font-semibold">✓</span>
                <span className="font-medium text-gray-800">File Uploaded: {fileName}</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Map your Excel columns to the required fields for price validation.
              </p>

              {/* Auto-mapping controls */}
              <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">
                    {Object.keys(columnMappings).length > 0 ? 
                      `${autoMappedFields.size} fields auto-mapped` : 
                      'Auto-mapping available'
                    }
                  </span>
                </div>
                <button
                  onClick={() => {
                    const autoMappings = autoMapColumns(columnNames);
                    setColumnMappings(autoMappings);
                    setAutoMappedFields(new Set(Object.keys(autoMappings)));
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  Re-run Auto-mapping
                </button>
              </div>
              
              {/* Column Mappings */}
              <div className="space-y-3">
                {BUSINESS_FIELDS.map((field) => {
                  const isAutoMapped = autoMappedFields.has(field.key);
                  return (
                    <div key={field.key} className={`grid grid-cols-12 gap-3 p-3 rounded items-center ${isAutoMapped ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                      <div className="col-span-4">
                        <div className="flex items-center gap-2">
                          {isAutoMapped && (
                            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          )}
                          <span 
                            className={`text-sm font-medium block leading-tight cursor-help ${isAutoMapped ? 'text-blue-700' : 'text-gray-700'}`}
                            title={field.label}
                          >
                            {field.label}
                          </span>
                        </div>
                        {isAutoMapped && (
                          <span className="text-xs text-blue-600 font-medium">Auto-mapped</span>
                        )}
                      </div>
                      <div className="col-span-5">
                        <SearchableDropdown
                          options={columnNames}
                          value={columnMappings[field.key] || ''}
                          onChange={(value) => handleColumnMapping(field.key, value)}
                          placeholder="Select or type to search..."
                        />
                      </div>
                      <div className="col-span-3">
                        <div className="text-xs text-gray-600 bg-gray-100 px-2 py-2 rounded text-center min-h-[32px] flex items-center justify-center">
                          <span className="truncate" title={columnMappings[field.key] ? getPreviewData(columnMappings[field.key]) || 'No data' : 'Preview'}>
                            {columnMappings[field.key] ? getPreviewData(columnMappings[field.key]) || 'No data' : 'Preview'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Validation Results */}
              {(validationResults.errors.length > 0 || validationResults.warnings.length > 0) && (
                <div className="mt-4">
                  {validationResults.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">Mapping Errors</h3>
                          <div className="mt-2 text-sm text-red-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationResults.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {validationResults.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">Mapping Warnings</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {validationResults.warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleBackToUpload}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleContinueToReview}
                  disabled={!validationResults.isValid}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 ${validationResults.isValid ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  {validationResults.isValid ? 'Continue to Review' : 'Fix Mapping Errors'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          /* Review and Validation Results */
          <div className="w-full max-w-4xl space-y-4">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white-900 mb-2">Review & Validate</h2>
              </div>

              {/* Validation Status */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Validation Successful</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>All required business fields have been mapped successfully.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Preview */}
              <div className="bg-white/70 rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50/70 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Data Preview (First 5 Rows)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                      <tr>
                        {Object.values(columnMappings).filter(col => col).slice(0, 5).map((column, index) => (
                          <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white/30 divide-y divide-gray-200">
                      {worksheetData.slice(1, 6).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {Object.values(columnMappings).filter(col => col).slice(0, 5).map((column, colIndex) => {
                            const columnIndex = columnNames.indexOf(column as string);
                            return (
                              <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {columnIndex !== -1 ? (row[columnIndex] || '-') : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back to Mapping
                </button>
                <div className="space-x-3">
                  {/* <button
                    onClick={() => {
                      // TODO: Implement download functionality
                      alert('Download functionality would be implemented here');
                    }}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Download Results
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Implement export functionality
                      alert('Export functionality would be implemented here');
                    }}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                     Export Validated Data
                  </button> */}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
