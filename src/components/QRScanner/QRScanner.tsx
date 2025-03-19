import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { QRCodeData } from '../../types';
import { getVertexAI, getGenerativeModel } from 'firebase/vertexai';
import { getApp } from 'firebase/app';
import * as pdfjsLib from 'pdfjs-dist';
// Configure PDF.js to use a CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
interface QRScannerProps {
  onScan: (data: QRCodeData) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [invalidQRError, setInvalidQRError] = useState<string | null>(null);
  const [rawQRContent, setRawQRContent] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [isPdfMode, setIsPdfMode] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize code reader once
  const codeReader = new BrowserQRCodeReader();

  // Toggle between QR scanner and PDF upload
  const toggleMode = () => {
    setIsPdfMode(!isPdfMode);
    setError('');
    setInvalidQRError(null);
    setRawQRContent(null);
    
    // Stop scanner if running
    if (controlsRef.current && !isPdfMode) {
      controlsRef.current.stop();
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      // Read the file
      const arrayBuffer = await file.arrayBuffer();
      
      // Configure PDF.js for main thread operation
      // Using @ts-ignore because we need to force no worker mode
      // @ts-ignore
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableStream: true,
        disableAutoFetch: true,
        disableRange: true
      });
      
      // Get the PDF document
      const pdf = await loadingTask.promise;
      console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Process each page
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          console.log(`Processing page ${i}/${pdf.numPages}`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          fullText += pageText + '\n';
        } catch (pageError) {
          console.warn(`Error extracting text from page ${i}:`, pageError);
        }
      }
      
      if (!fullText.trim()) {
        throw new Error('No text could be extracted from the PDF');
      }
      
      console.log(`Extracted ${fullText.length} characters of text`);
      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle PDF selection
  const handlePdfSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.type !== 'application/pdf') {
      setError('Selected file is not a PDF');
      return;
    }
    
    try {
      setIsProcessingAI(true);
      setRawQRContent(`Extracting text from: ${file.name}...`);
      
      // Extract text from PDF
      console.log(`Processing PDF file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      const extractedText = await extractTextFromPDF(file);
      console.log(`Successfully extracted ${extractedText.length} characters of text from PDF`);
      
      if (extractedText.length > 200) {
        // Log a preview of the extracted text (first 200 chars)
        console.log('Text preview:', extractedText.substring(0, 200) + '...');
      } else {
        console.log('Extracted text:', extractedText);
      }
      
      setRawQRContent(extractedText);
      
      // Process with AI
      const result = await processWithAI(extractedText);
      if (result) {
        console.log('Successfully processed PDF with AI:', result);
        onScan(result);
      } else {
        console.error('AI processing failed to extract subscription information');
        setInvalidQRError('Could not extract subscription information from the PDF.');
      }
    } catch (error) {
      console.error('PDF processing error:', error);
      setInvalidQRError(`Failed to process the PDF file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again with a different file.`);
    } finally {
      setIsProcessingAI(false);
      // Reset the file input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Process QR data with Firebase Vertex AI when standard parsing fails
  const processWithAI = async (rawData: string): Promise<QRCodeData | null> => {
    try {
      setIsProcessingAI(true);
      console.log('Processing content with AI...');
      
      // Initialize Vertex AI
      const firebaseApp = getApp();
      const vertexAI = getVertexAI(firebaseApp);
      const model = getGenerativeModel(vertexAI, { model: "gemini-2.0-flash" });
      
      // Create a well-crafted prompt for the model
      const prompt = `
        Analyze the following text extracted from a QR code or PDF and extract relevant subscription information.
        The text may contain information about a subscription, registration, membership, utility bill, or insurance policy.

        I need to extract these common fields (if present):
        - Type of subscription (vehicle, membership, utility, insurance, or other)
        - Name/title of the subscription
        - Provider or issuing organization
        - Start date (in YYYY-MM-DD format)
        - End date or expiry date (in YYYY-MM-DD format)
        - Amount or cost (numeric value)
        - Currency
        - Any unique identifier (vehicle number, membership ID, account number, policy number)

        IMPORTANT: Also extract these personal/contact details if available:
        - Owner name or customer name
        - Address (billing or service address)
        - Contact number or phone
        - Email ID

        I also want to extract ANY other potentially useful fields present in the data that could be relevant for a subscription management system.

        Return the information in a structured JSON format with the following schema:
        {
          "type": "vehicle|membership|utility|insurance|other",
          "data": {
            "name": "The name or title",
            "provider": "Provider name",
            "startDate": "YYYY-MM-DD",
            "endDate": "YYYY-MM-DD",
            "amount": number,
            "currency": "Currency code like INR, USD",
            
            // Personal/contact details if available
            "ownerName": "Name of the owner/customer",
            "address": "Billing or service address",
            "contactNumber": "Phone number with or without country code",
            "email": "Email address of the owner/customer",
            
            // Include any of these identifiers if present
            "vehicleNumber": "For vehicle subscriptions",
            "membershipId": "For membership subscriptions",
            "accountNumber": "For utility subscriptions",
            "policyNumber": "For insurance subscriptions",
            
            // Include any other fields found in the text
            "additionalField1": "value1",
            "additionalField2": "value2"
          }
        }
        If there's not enough information to determine this is a subscription, respond with: {"insufficient": true}

        Text to analyze:
        ${rawData}
      `;
      
      // Generate content using the prompt
      const result = await model.generateContent(prompt);
      const response = result.response;
      let text = response.text();
      console.log('AI response:', text);

      // remove the ```json and ``` from the response
      text = text.replace('```json', '').replace('```', '');
      
      // Try to parse the response as JSON
      try {
        const parsedData = JSON.parse(text);
        
        // Check if the AI determined there was insufficient data
        if (parsedData.insufficient) {
          console.log('AI determined insufficient subscription data');
          return null;
        }
        
        // Return the parsed data
        return parsedData as QRCodeData;
      } catch (parseError) {
        console.error('Error parsing AI response as JSON:', parseError);
        return null;
      }
    } catch (error) {
      console.error('Error processing with AI:', error);
      return null;
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Handle invalid QR code with countdown and auto-close
  useEffect(() => {
    if (invalidQRError) {
      // Set initial countdown
      setCountdown(5);
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Set new countdown timer
      timerRef.current = setInterval(() => {
        setCountdown(prevCount => {
          if (prevCount <= 1) {
            // Clean up and close when timer reaches zero
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setInvalidQRError(null);
            setRawQRContent(null);
            onClose();
            return 0;
          }
          return prevCount - 1;
        });
      }, 1000);
    }
    
    // Clean up timer on unmount or when error is cleared
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [invalidQRError, onClose]);

  // For testing - use sample data
  const handleDebugScan = () => {
    const sampleData: QRCodeData = {
      type: 'vehicle',
      data: {
        name: 'Honda Civic Registration',
        provider: 'Transport Department',
        vehicleNumber: 'DL01AB1234',
        vehicleType: 'Sedan',
        registrationType: 'Private',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        amount: 2000,
        currency: 'INR',
      }
    };
    
    onScan(sampleData);
  };

  // For testing - simulate invalid QR code
  const handleInvalidQRTest = () => {
    setInvalidQRError('The QR code could not be read or does not contain valid subscription data');
    setRawQRContent('{"incomplete": true, "missing": "required fields"}');
    if (controlsRef.current) {
      controlsRef.current.stop();
    }
  };

  // For testing - demonstrate AI processing
  const handleAIProcessingTest = async () => {
    setIsProcessingAI(true);
    setTimeout(async () => {
      const testData = `Vehicle Registration Certificate
        Owner: John Smith
        Vehicle Number: KA01AB1234
        Vehicle Type: SUV
        Registration Date: 2023-05-15
        Valid Until: 2028-05-14
        Fee Paid: Rs. 5,000
        Issued By: RTO Karnataka`;
      
      setRawQRContent(testData);
      const result = await processWithAI(testData);
      if (result) {
        onScan(result);
      } else {
        setInvalidQRError('The QR code could not be processed by AI.');
      }
    }, 2000);
  };

  // Check for camera permission and get camera devices
  useEffect(() => {
    async function setupCamera() {
      try {
        console.log('Setting up camera...');
        
        // First attempt to get permission by requesting user media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Now we should have permission, enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available video devices:', videoDevices);
        
        if (videoDevices.length === 0) {
          setError('No camera found on your device');
          return;
        }
        
        setDevices(videoDevices);
        setSelectedDeviceId(videoDevices[0].deviceId);
        
        // Clean up initial stream
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        console.error('Camera setup error:', err);
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setError('Camera access denied. Please enable camera access in your browser settings.');
        } else {
          setError(`Could not access camera: ${err.message || 'Unknown error'}`);
        }
      }
    }
    
    setupCamera();
    
    // Clean up on unmount
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  // Start/stop scanning when device changes or component unmounts
  useEffect(() => {
    if (!selectedDeviceId || !videoRef.current) return;
    
    console.log('Starting scanner with device:', selectedDeviceId);
    setScanning(true);
    setError('');
    
    const startScanner = async () => {
      try {
        if (controlsRef.current) {
          console.log('Stopping previous scanner');
          controlsRef.current.stop();
          controlsRef.current = null;
        }
        
        console.log('Creating new scanner');
        const controls = await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current!,
          async (result, error) => {
            if (result) {
              console.log('QR code scanned:', result.getText());
              const rawData = result.getText();
              setRawQRContent(rawData);
              
              try {
                // First try to parse as JSON
                const qrData = JSON.parse(rawData) as QRCodeData;
                
                // Validate the QR data structure
                if (qrData.type && qrData.data && qrData.data.name) {
                  // Successfully parsed and validated
                  onScan(qrData);
                  
                  // Stop scanning after successful scan
                  if (controls) {
                    controls.stop();
                  }
                  return;
                } else {
                  console.log('Incomplete JSON data, will try AI processing');
                  
                  // Invalid structure, try AI processing
                  const aiProcessedData = await processWithAI(rawData);
                  if (aiProcessedData) {
                    onScan(aiProcessedData);
                    if (controls) {
                      controls.stop();
                    }
                    return;
                  }
                  
                  // AI couldn't extract enough data
                  setInvalidQRError('The QR code data is incomplete. Please scan a valid subscription QR code.');
                  if (controls) {
                    controls.stop();
                  }
                }
              } catch (parseError) {
                console.error('Failed to parse QR code data as JSON, trying AI:', parseError);
                
                // Not valid JSON, try AI processing
                const aiProcessedData = await processWithAI(rawData);
                if (aiProcessedData) {
                  onScan(aiProcessedData);
                  if (controls) {
                    controls.stop();
                  }
                  return;
                }
                
                // AI couldn't extract enough data
                setInvalidQRError('The QR code does not contain valid subscription data that we could recognize.');
                if (controls) {
                  controls.stop();
                }
              }
            }
            
            if (error && !(error instanceof Error) && error !== null) {
              console.error('QR scan error:', error);
            }
          }
        );
        
        controlsRef.current = controls;
        console.log('Scanner started successfully');
      } catch (err: any) {
        console.error('Error starting QR scanner:', err);
        setError(`Failed to start camera: ${err.message || 'Unknown error'}`);
        setScanning(false);
      }
    };
    
    startScanner();
    
    // Clean up function
    return () => {
      console.log('Cleaning up QR scanner');
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [selectedDeviceId, codeReader, onScan]);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    console.log('Changing to device:', newDeviceId);
    
    if (controlsRef.current) {
      controlsRef.current.stop();
    }
    
    setSelectedDeviceId(newDeviceId);
  };

  const handleRestartCamera = () => {
    console.log('Manually restarting camera');
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    
    // Force the useEffect to run again
    setSelectedDeviceId('');
    setTimeout(() => {
      if (devices.length > 0) {
        setSelectedDeviceId(devices[0].deviceId);
      }
    }, 500);
  };

  if (invalidQRError) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full animate-fade-in">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-red-600 dark:text-red-400">
              {t('QR Code Error')}
            </h3>
          </div>
          
          <div className="p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <p className="text-center text-gray-700 dark:text-gray-300 mb-4">
              {invalidQRError}
            </p>
            
            {rawQRContent && (
              <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-md overflow-auto max-h-32">
                <p className="text-xs font-mono text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-all">
                  <span className="block text-xs font-semibold mb-1 text-gray-500 dark:text-gray-400">QR Content:</span>
                  {rawQRContent}
                </p>
              </div>
            )}
            
            <div className="flex justify-center mb-4">
              <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4 overflow-hidden">
                <div 
                  className="bg-red-600 h-2.5 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 5) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              {t('Closing in')} {countdown} {t('seconds')}...
            </p>
          </div>
          
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {t('Close Now')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {isPdfMode ? t('Extract from PDF') : t('subscription.scanQR')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          {/* Toggle between QR and PDF modes */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full p-1">
              <button
                type="button"
                onClick={() => !isPdfMode || toggleMode()}
                className={`px-4 py-2 rounded-full text-sm font-medium focus:outline-none ${
                  !isPdfMode 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Scan QR
              </button>
              <button
                type="button"
                onClick={() => isPdfMode || toggleMode()}
                className={`px-4 py-2 rounded-full text-sm font-medium focus:outline-none ${
                  isPdfMode 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Upload PDF
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900 p-3 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                {error.includes('denied') && 'Please check your browser settings to allow camera access and refresh this page.'}
              </p>
            </div>
          )}
          
          {isProcessingAI && (
            <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 p-4 rounded-md shadow-md overflow-hidden relative">
              <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
              <div className="flex items-center">
                <div className="relative mr-4 flex-shrink-0">
                  {/* AI Brain Processing Animation */}
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center relative overflow-hidden">
                    {/* Pulsing circles */}
                    <div className="absolute w-12 h-12 rounded-full bg-indigo-400 opacity-20 animate-ping-slow"></div>
                    <div className="absolute w-8 h-8 rounded-full bg-purple-400 opacity-20 animate-ping"></div>
                    
                    {/* Brain icon */}
                    <svg className="w-6 h-6 text-white z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    
                    {/* Moving dots for "processing" effect */}
                    <div className="absolute bottom-1 flex space-x-0.5 justify-center">
                      <div className="w-1 h-1 bg-white rounded-full opacity-80 animate-pulse"></div>
                      <div className="w-1 h-1 bg-white rounded-full opacity-80 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      <div className="w-1 h-1 bg-white rounded-full opacity-80 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-grow">
                  <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                    {isPdfMode ? 'Processing PDF with AI' : 'Analyzing QR code with AI'}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 mt-1">
                    {isPdfMode 
                      ? 'Extracting text and identifying key subscription details...' 
                      : 'Reading content and identifying subscription information...'}
                  </p>
                  
                  {/* Progress bar with shimmer effect */}
                  <div className="mt-2 h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative overflow-hidden animate-progress-indeterminate">
                      <div className="absolute inset-0 bg-shimmer"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isPdfMode ? (
            // PDF Upload Mode
            <div className="flex flex-col items-center justify-center">
              <div className="mb-6 w-full p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors cursor-pointer" onClick={handleUploadClick}>
                <div className="flex flex-col items-center justify-center">
                  <svg className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload a PDF</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF files only</p>
                </div>

                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handlePdfSelection}
                  accept="application/pdf"
                />
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                The system will extract text from the PDF and analyze it to find subscription information.
                For best results, use PDFs with selectable text (not scanned images).
                PDF should include subscription details like dates, amounts, and service information.
              </p>
            </div>
          ) : (
            // QR Scanner Mode
            <>
              <div className="mb-4">
                <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('Select Camera')}
                </label>
                <select
                  id="camera-select"
                  value={selectedDeviceId}
                  onChange={handleDeviceChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800"
                >
                  {devices.length === 0 ? (
                    <option value="">Loading cameras...</option>
                  ) : (
                    devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${devices.indexOf(device) + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  {scanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-48 w-48 border-2 border-indigo-500 rounded-lg opacity-70"></div>
                      <div className="absolute h-6 w-6 border-t-2 border-l-2 border-indigo-500 top-1/2 left-1/2 -translate-x-24 -translate-y-24 rounded-tl-md"></div>
                      <div className="absolute h-6 w-6 border-t-2 border-r-2 border-indigo-500 top-1/2 right-1/2 translate-x-24 -translate-y-24 rounded-tr-md"></div>
                      <div className="absolute h-6 w-6 border-b-2 border-l-2 border-indigo-500 bottom-1/2 left-1/2 -translate-x-24 translate-y-24 rounded-bl-md"></div>
                      <div className="absolute h-6 w-6 border-b-2 border-r-2 border-indigo-500 bottom-1/2 right-1/2 translate-x-24 translate-y-24 rounded-br-md"></div>
                    </div>
                  )}
                  {!scanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <p className="text-white text-center px-4">
                        {selectedDeviceId ? "Camera initializing..." : "Select a camera from the dropdown"}
                      </p>
                    </div>
                  )}
                  {isProcessingAI && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
                      <div className="text-center px-6 py-5 bg-gray-900 bg-opacity-80 rounded-xl border border-indigo-500 max-w-xs mx-auto">
                        {/* AI Processing Animation */}
                        <div className="mx-auto w-16 h-16 mb-4 relative">
                          {/* Outer rotating ring */}
                          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-l-transparent animate-spin-slow"></div>
                          
                          {/* Inner pulsing circle */}
                          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 animate-pulse"></div>
                          
                          {/* Center icon */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 16.5C14.4853 16.5 16.5 14.4853 16.5 12C16.5 9.51472 14.4853 7.5 12 7.5C9.51472 7.5 7.5 9.51472 7.5 12C7.5 14.4853 9.51472 16.5 12 16.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M3 12H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M16.5 12H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 7.5V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M12 21V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          
                          {/* Floating particles */}
                          <div className="absolute -right-1 top-2 w-2 h-2 rounded-full bg-blue-400 animate-float" style={{ animationDelay: '0s' }}></div>
                          <div className="absolute -left-1 bottom-2 w-1.5 h-1.5 rounded-full bg-indigo-300 animate-float" style={{ animationDelay: '0.5s' }}></div>
                          <div className="absolute left-4 -top-1 w-1 h-1 rounded-full bg-purple-400 animate-float" style={{ animationDelay: '1s' }}></div>
                        </div>
                        
                        <h4 className="text-indigo-300 font-semibold text-lg mb-1">AI Processing</h4>
                        <p className="text-white text-sm mb-3">
                          {isPdfMode ? 'Analyzing PDF content...' : 'Processing QR code data...'}
                        </p>
                        
                        {/* Text animation (typing effect) */}
                        <div className="flex justify-center space-x-1 text-xs text-indigo-300">
                          <span>Processing</span>
                          <span className="inline-flex">
                            <span className="animate-blink">.</span>
                            <span className="animate-blink" style={{ animationDelay: '0.3s' }}>.</span>
                            <span className="animate-blink" style={{ animationDelay: '0.6s' }}>.</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={handleRestartCamera}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Restart Camera
                </button>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                {scanning && !error
                  ? t('Position the QR code within the frame to scan') 
                  : t('Select a camera and start scanning')}
              </p>
            </>
          )}

          {/* Debug/Testing buttons */}
          <div className="flex justify-center gap-3 mb-4 flex-wrap">
            <button
              type="button"
              onClick={handleDebugScan}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Use Sample Data
            </button>
            <button
              type="button"
              onClick={handleInvalidQRTest}
              className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 dark:text-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              Test Invalid QR
            </button>
            <button
              type="button"
              onClick={handleAIProcessingTest}
              className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 dark:text-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Test AI Processing
            </button>
          </div>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
} 