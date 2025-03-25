import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { QRCodeData } from '../../types';
import { getVertexAI, getGenerativeModel } from 'firebase/vertexai';
import { getApp } from 'firebase/app';
import * as pdfjsLib from 'pdfjs-dist';
// Configure PDF.js to use a CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// A helper function for cross-browser camera access
// Instead of modifying navigator.mediaDevices, we create a compatible function
function getCamera(constraints: MediaStreamConstraints): Promise<MediaStream> {
  // If mediaDevices.getUserMedia is available, use it
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  
  // For older browsers, try legacy APIs (without assigning to read-only properties)
  const getUserMedia = 
    (navigator as any).webkitGetUserMedia || 
    (navigator as any).mozGetUserMedia ||
    (navigator as any).msGetUserMedia;

  if (getUserMedia) {
    return new Promise<MediaStream>((resolve, reject) => {
      getUserMedia.call(navigator, constraints, resolve, reject);
    });
  }
  
  // If no method is available, reject with a helpful error
  return Promise.reject(
    new Error('Camera access is not supported in this browser. Please try a different browser or device.')
  );
}

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

  // Initialize code reader with proper hints using the proper Map format
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  // Add support for international text in QR codes
  hints.set(DecodeHintType.CHARACTER_SET, "UTF-8");
  
  const codeReader = new BrowserQRCodeReader(hints, {
    delayBetweenScanAttempts: 100, // Scan more frequently for better mobile performance
  });

  // Enhanced close handler to ensure camera is properly stopped
  const handleClose = () => {
    console.log('Stopping camera and closing scanner');
    setScanning(false);
    
    // Stop the scanner controls if they exist
    if (controlsRef.current) {
      console.log('Stopping scanner controls');
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    
    // Directly stop any video track from the video element
    if (videoRef.current && videoRef.current.srcObject) {
      console.log('Stopping video tracks directly');
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      
      tracks.forEach(track => {
        console.log(`Stopping track: ${track.kind} - ${track.label}`);
        track.stop();
      });
      
      videoRef.current.srcObject = null;
    }
    
    // Call the parent component's onClose
    onClose();
  };

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
          
          // Check if we already have plenty of text (over 4000 words)
          // const wordCount = fullText.split(/\s+/).length;
          // if (wordCount > 5000) { // Getting a bit more than 4000 to ensure we have 4000 good words after cleanup
          //   console.log(`Reached ${wordCount} words, stopping extraction to save processing time`);
          //   break;
          // }
        } catch (pageError) {
          console.warn(`Error extracting text from page ${i}:`, pageError);
        }
      }
      
      if (!fullText.trim()) {
        throw new Error('No text could be extracted from the PDF');
      }
      
      // Limit to approximately 4000 words
      // const words = fullText.split(/\s+/);
      // if (words.length > 4000) {
      //   console.log(`Limiting extracted text from ${words.length} to 4000 words`);
      //   fullText = words.slice(0, 4000).join(' ');
      // }
      
      console.log(`Extracted ${fullText.length} characters of text (approx. ${fullText.split(/\s+/).length} words)`);
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
      
      // Show preview with word count
      const wordCount = extractedText.split(/\s+/).length;
      if (extractedText.length > 200) {
        // Log a preview of the extracted text (first 200 chars)
        console.log(`Text preview (${wordCount} words): ${extractedText.substring(0, 200)}...`);
      } else {
        console.log(`Extracted text (${wordCount} words): ${extractedText}`);
      }
      
      // Update display with word count
      setRawQRContent(`${extractedText}\n\n(Limited to ${wordCount} words for processing)`);
      
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

  // Component for the AI processing overlay
  const AIProcessingOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
      <div className="text-center px-6 py-5 bg-gray-900 bg-opacity-90 rounded-xl border border-indigo-500 max-w-xs mx-auto">
        {/* Enhanced AI Processing Animation */}
        <div className="mx-auto w-20 h-20 mb-4 relative">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-l-transparent animate-spin-slow"></div>
          
          {/* Middle pulsing ring */}
          <div className="absolute inset-1 rounded-full border-2 border-blue-400 border-r-transparent animate-spin-reverse"></div>
          
          {/* Inner pulsing circle */}
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 animate-pulse"></div>
          
          {/* Scanning effect */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="h-full w-full bg-gradient-to-t from-transparent to-indigo-500 opacity-30 animate-scan"></div>
          </div>
          
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
          <div className="absolute -right-3 top-3 w-2 h-2 rounded-full bg-blue-400 animate-float" style={{ animationDelay: '0s' }}></div>
          <div className="absolute -left-2 bottom-3 w-1.5 h-1.5 rounded-full bg-indigo-300 animate-float" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute left-6 -top-2 w-1 h-1 rounded-full bg-purple-400 animate-float" style={{ animationDelay: '1s' }}></div>
          <div className="absolute right-2 -bottom-1 w-1 h-1 rounded-full bg-indigo-200 animate-float" style={{ animationDelay: '1.5s' }}></div>
        </div>
        
        <h4 className="text-indigo-300 font-semibold text-xl mb-2">AI Processing</h4>
        <p className="text-white text-sm mb-4">
          {isPdfMode ? t('Analyzing subscription details from your PDF...') : t('Extracting subscription information from QR code...')}
        </p>
        
        {/* Text animation (typing effect) */}
        <div className="flex justify-center space-x-1 text-xs font-mono text-indigo-300 bg-gray-800 py-1 px-3 rounded-md">
          <span>AI</span>
          <span className="inline-flex">
            <span className="animate-blink">.</span>
            <span className="animate-blink" style={{ animationDelay: '0.3s' }}>.</span>
            <span className="animate-blink" style={{ animationDelay: '0.6s' }}>.</span>
          </span>
          <span className="typing-animation">analyzing</span>
        </div>
      </div>
    </div>
  );

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
            handleClose(); // Use enhanced close handler instead of direct onClose
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
  }, [invalidQRError]);

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
        
        // Try to access the camera with our cross-browser helper
        try {
          const stream = await getCamera({ 
            video: { 
              facingMode: 'environment' // Prefer back camera for scanning QR codes
            } 
          });
          
          // If we got here, camera access was successful
          console.log('Camera access granted');
          
          // Now try to enumerate devices if the API is available
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            console.log('Available video devices:', videoDevices);
            
            if (videoDevices.length === 0) {
              setError('No camera found on your device');
              return;
            }
            
            setDevices(videoDevices);
            setSelectedDeviceId(videoDevices[0].deviceId);
          } else {
            // If enumerate devices is not available, we'll just use the current stream
            console.log('enumerateDevices not supported, using default camera');
            // Create a fake device entry with the proper interface implementation
            setDevices([{
              deviceId: '',
              kind: 'videoinput' as MediaDeviceKind,
              groupId: '',
              label: 'Default Camera',
              toJSON: function() { return this; } // Implementing required toJSON method
            }]);
            setSelectedDeviceId('');
          }
          
          // Clean up initial stream
          stream.getTracks().forEach(track => track.stop());
        } catch (err: any) {
          console.error('Camera access error:', err);
          throw err; // Re-throw to be caught by the outer try/catch
        }
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
      console.log('QRScanner unmounting - cleaning up camera resources');
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      
      // Additional cleanup of any video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          console.log('Stopping track on unmount:', track.kind, track.label);
          track.stop();
        });
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Start/stop scanning when device changes or component unmounts
  useEffect(() => {
    if (!videoRef.current) return;
    
    // selectedDeviceId might be empty for browsers that don't support enumeration
    console.log('Starting scanner with device:', selectedDeviceId || 'default camera');
    setScanning(true);
    setError('');
    
    const startScanner = async () => {
      try {
        if (controlsRef.current) {
          console.log('Stopping previous scanner');
          controlsRef.current.stop();
          controlsRef.current = null;
        }
        
        console.log('Creating new scanner with enhanced configuration');
        const controls = await codeReader.decodeFromVideoDevice(
          // Use null for default camera if deviceId is empty to handle older browsers
          selectedDeviceId || undefined,
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
      console.log('Device changed or component unmounting - cleaning up QR scanner');
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
              onClick={handleClose}
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
    <div className="relative">
      {/* Global AI Processing Overlay - will show when isProcessingAI is true regardless of mode */}
      {isProcessingAI && <AIProcessingOverlay />}
      
      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-3 sm:p-5">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {t(isPdfMode ? 'Upload PDF' : 'Scan QR Code')}
            </h3>
            
            {/* Mode toggle button */}
            <button
              type="button"
              onClick={toggleMode}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isPdfMode ? (
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  {t('Switch to QR')}
                </span>
              ) : (
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  {t('Switch to PDF')}
                </span>
              )}
            </button>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          
          {/* Invalid QR error */}
          {invalidQRError && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm text-amber-800 dark:text-amber-200">{invalidQRError}</p>
              {rawQRContent && (
                <details className="mt-2">
                  <summary className="text-xs font-medium text-amber-600 dark:text-amber-300 cursor-pointer">
                    {t('Show Raw Content')}
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-950 rounded text-xs overflow-auto max-h-40">
                    {rawQRContent}
                  </pre>
                </details>
              )}
            </div>
          )}
          
          {isPdfMode ? (
            // PDF Mode
            <div>
              <div className="mb-4 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('Select PDF File')}
                </button>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handlePdfSelection}
                  accept="application/pdf"
                />
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                {t('The system will extract text from the PDF and analyze it to find subscription information.')}
                <br className="hidden sm:block" />
                {t('For best results, use PDFs with selectable text (not scanned images).')}
              </p>
            </div>
          ) : (
            // QR Scanner Mode
            <>
              <div className="mb-3">
                <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('Select Camera')}
                </label>
                <select
                  id="camera-select"
                  value={selectedDeviceId}
                  onChange={handleDeviceChange}
                  className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white dark:bg-gray-800 text-sm"
                >
                  {devices.length === 0 ? (
                    <option value="">{t('Loading cameras...')}</option>
                  ) : (
                    devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `${t('Camera')} ${devices.indexOf(device) + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>
              
              <div className="flex justify-center mb-3">
                <div className="relative w-full aspect-square max-h-[60vh] bg-black rounded-md overflow-hidden">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  {scanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="h-2/3 w-2/3 border-2 border-indigo-500 rounded-lg opacity-70"></div>
                      <div className="absolute h-8 w-8 border-t-2 border-l-2 border-indigo-500 top-1/6 left-1/6 rounded-tl-md"></div>
                      <div className="absolute h-8 w-8 border-t-2 border-r-2 border-indigo-500 top-1/6 right-1/6 rounded-tr-md"></div>
                      <div className="absolute h-8 w-8 border-b-2 border-l-2 border-indigo-500 bottom-1/6 left-1/6 rounded-bl-md"></div>
                      <div className="absolute h-8 w-8 border-b-2 border-r-2 border-indigo-500 bottom-1/6 right-1/6 rounded-br-md"></div>
                    </div>
                  )}
                  {!scanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <p className="text-white text-center px-4 text-sm">
                        {selectedDeviceId ? t('Camera initializing...') : t('Select a camera from the dropdown')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-center mb-3">
                <button
                  type="button"
                  onClick={handleRestartCamera}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {t('Restart Camera')}
                </button>
              </div>
              
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
                {scanning && !error
                  ? t('Position the QR code within the frame to scan') 
                  : t('Select a camera and start scanning')}
              </p>
              
              {/* Mobile browser compatibility notice */}
              <p className="text-xs text-amber-600 dark:text-amber-400 text-center mb-3">
                {t('If the camera appears to be inactive on your mobile device, please ensure you have granted camera permissions and try the "Restart Camera" button.')}
              </p>
            </>
          )}

          {/* Debug/Testing buttons in a more compact mobile-friendly layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <button
              type="button"
              onClick={handleDebugScan}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {t('Use Sample Data')}
            </button>
            <button
              type="button"
              onClick={handleInvalidQRTest}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 dark:text-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {t('Test Invalid QR')}
            </button>
            <button
              type="button"
              onClick={handleAIProcessingTest}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 dark:text-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {t('Test AI Processing')}
            </button>
          </div>
        </div>
        
        <div className="px-3 py-3 sm:px-4 sm:py-3 bg-gray-50 dark:bg-gray-700 rounded-b-lg flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
} 