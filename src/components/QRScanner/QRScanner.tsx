import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserQRCodeReader } from '@zxing/browser';
import { QRCodeData } from '../../types';

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
  const [codeReader, setCodeReader] = useState<BrowserQRCodeReader | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Check for camera permissions
  useEffect(() => {
    // First check if permission is already granted
    navigator.permissions?.query({ name: 'camera' as PermissionName })
      .then(permissionStatus => {
        setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
        
        permissionStatus.onchange = () => {
          setCameraPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
        };
      })
      .catch(err => {
        console.error('Permission API not supported, will try direct camera access', err);
      });
  }, []);

  // Initialize camera
  useEffect(() => {
    // Don't try to access camera if permission is denied
    if (cameraPermission === 'denied') {
      setError('Camera permission denied. Please enable camera access in your browser settings.');
      return;
    }

    const initCamera = async () => {
      try {
        // Get list of video devices
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          setError('No camera detected on your device.');
          return;
        }
        
        setDevices(videoDevices);
        
        // Select the first device by default
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
        
        // Initialize code reader
        const reader = new BrowserQRCodeReader();
        setCodeReader(reader);
      } catch (err) {
        console.error('Error initializing camera:', err);
        setError('Cannot access camera. Please check permissions and try again.');
      }
    };

    initCamera();
    
    // Cleanup on unmount
    return () => {
      if (codeReader) {
        setScanning(false);
      }
    };
  }, [cameraPermission]);

  // Start scanning when device is selected
  useEffect(() => {
    if (!selectedDeviceId || !codeReader) return;
    
    const startScan = async () => {
      try {
        setScanning(true);
        setError('');
        
        if (!videoRef.current) {
          setError('Video element not found');
          setScanning(false);
          return;
        }

        // Try to get a video stream first to check permissions
        try {
          // This will trigger the browser permission popup if not already granted
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              deviceId: selectedDeviceId,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
          
          // Manually set the stream to the video element as a fallback
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => console.error("Could not play video:", err));
          
        } catch (err: any) {
          if (err.name === 'NotAllowedError') {
            setError('Camera access denied. Please enable camera access in your browser settings.');
          } else {
            setError(`Camera error: ${err.message}`);
          }
          setScanning(false);
          return;
        }

        // Now start the QR scanning
        await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          (result, error) => {
            if (result) {
              try {
                // Assuming QR code contains a JSON string with subscription data
                const qrData = JSON.parse(result.getText()) as QRCodeData;
                onScan(qrData);
                
                // Stop scanning after successful scan
                setScanning(false);
              } catch (parseError) {
                setError('Invalid QR code format. Please scan a valid subscription QR code.');
                console.error('Error parsing QR data:', parseError);
              }
            }
            
            if (error && !(error instanceof Error)) {
              console.error('QR scan error:', error);
            }
          }
        );
      } catch (err) {
        console.error('Error starting QR scanner:', err);
        setError('Failed to start camera. Please refresh and try again.');
        setScanning(false);
      }
    };

    // Auto-start scanning when a device is selected
    startScan();
    
    // Cleanup function
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [selectedDeviceId, codeReader, onScan]);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Always stop current scanning before changing device
    setScanning(false);
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Give a small delay before starting with new device
    setTimeout(() => {
      setSelectedDeviceId(e.target.value);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('subscription.scanQR')}
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
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900 p-3 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              {cameraPermission === 'denied' && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  Please check your browser settings to allow camera access and refresh this page.
                </p>
              )}
            </div>
          )}
          
          {cameraPermission !== 'denied' && (
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
                  disabled={scanning}
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
                    id="video-preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-ping h-16 w-16 border-2 border-indigo-500 rounded-full"></div>
                    </div>
                  )}
                  {!scanning && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <p className="text-white text-center px-4">
                        {selectedDeviceId ? "Camera initializing..." : "Select a camera from the dropdown"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Remove the Start Scanning button since we're auto-starting */}
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => {
                    // Reset the scanning state to restart the camera
                    setScanning(false);
                    setTimeout(() => setScanning(true), 300);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Restart Camera
                </button>
              </div>
            </>
          )}
          
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            {scanning 
              ? t('Position the QR code within the frame to scan') 
              : t('Select a camera and start scanning')}
          </p>

          {/* Debug/Testing button */}
          <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={handleDebugScan}
              className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-200 dark:bg-indigo-900 dark:hover:bg-indigo-800 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Use Sample Data (For Testing)
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