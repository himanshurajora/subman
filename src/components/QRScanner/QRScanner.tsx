import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Get list of video devices
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        
        // Select the first device by default
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      })
      .catch(err => {
        console.error('Error enumerating devices:', err);
        setError('Cannot access camera. Please check permissions.');
      });
      
    // Initialize code reader
    const reader = new BrowserQRCodeReader();
    setCodeReader(reader);
    
    // Cleanup on unmount
    return () => {
      if (codeReader) {
        // Stop any active scanning
        setScanning(false);
      }
    };
  }, []);

  useEffect(() => {
    async function startScanning() {
      if (!selectedDeviceId || scanning || !codeReader) return;

      try {
        setScanning(true);
        setError('');
        
        const videoElement = document.getElementById('video-preview') as HTMLVideoElement;
        
        if (!videoElement) {
          setError('Video element not found');
          return;
        }

        await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoElement,
          (result, error) => {
            if (result) {
              try {
                // Assuming QR code contains a JSON string with subscription data
                const qrData = JSON.parse(result.getText()) as QRCodeData;
                onScan(qrData);
                
                // Stop scanning after successful scan
                setScanning(false);
              } catch (parseError) {
                setError('Invalid QR code format');
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
        setError('Failed to start camera');
        setScanning(false);
      }
    }

    if (selectedDeviceId && codeReader && !scanning) {
      startScanning();
    }
  }, [selectedDeviceId, codeReader, onScan, scanning]);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(e.target.value);
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
            </div>
          )}
          
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
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${devices.indexOf(device) + 1}`}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-center mb-4">
            <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
              <video
                id="video-preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-ping h-16 w-16 border-2 border-indigo-500 rounded-full"></div>
                </div>
              )}
            </div>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            {t('Position the QR code within the frame to scan')}
          </p>
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