import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    if (scannerRef.current) return;

    try {
      setError(null);
      setIsScanning(true);
      
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          // Stop scanning immediately after successful read
          await stopScanner();
          setIsProcessing(true);
          
          try {
            // The QR code contains the cashier code
            const result = await onScanSuccess(decodedText.trim());
            if (result.success) {
              setSuccess(result.message || "Successfully subscribed!");
              setTimeout(() => {
                onClose();
              }, 1500);
            } else {
              setError(result.message || "Failed to subscribe");
              // Restart scanner after error
              setTimeout(() => {
                setError(null);
                startScanner();
              }, 2000);
            }
          } catch (err) {
            setError(err.message || "An error occurred");
            setTimeout(() => {
              setError(null);
              startScanner();
            }, 2000);
          } finally {
            setIsProcessing(false);
          }
        },
        (errorMessage) => {
          // Ignore scan errors (no QR found)
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError("Camera access denied or not available");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stopScanner();
    setError(null);
    setSuccess(null);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-3xl bg-slate-900 p-6 shadow-2xl border border-emerald-500/30">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-emerald-300/60 hover:bg-emerald-500/20 hover:text-emerald-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-emerald-100">Scan QR Code</h2>
            <p className="text-sm text-emerald-300/60">Point camera at cashier's QR</p>
          </div>
        </div>

        {/* Scanner Container */}
        <div 
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl bg-black aspect-square border-2 border-emerald-500/40"
        >
          <div id="qr-reader" className="w-full h-full" />
          
          {/* Scanning overlay */}
          {isScanning && !error && !success && !isProcessing && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner markers */}
              <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              
              {/* Scanning line animation */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
                <p className="text-emerald-200 text-sm">Processing...</p>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {success && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/80">
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <p className="text-emerald-100 text-center font-semibold">{success}</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !success && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/80">
              <div className="flex flex-col items-center gap-3 px-4">
                <div className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-white" />
                </div>
                <p className="text-red-100 text-center text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="mt-4 text-xs text-center text-emerald-300/50">
          Position the QR code within the frame to automatically scan and subscribe
        </p>
      </div>
    </div>
  );
};

export default QRScannerModal;
