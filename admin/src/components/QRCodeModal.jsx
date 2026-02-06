import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { X, Download, QrCode } from "lucide-react";

const QRCodeModal = ({ isOpen, onClose, cashierCode, cashierName }) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const svg = document.getElementById("cashier-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      const link = document.createElement("a");
      link.download = `cashier-qr-${cashierCode}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <QrCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Your QR Code</h2>
            <p className="text-sm text-gray-500">Players can scan to subscribe</p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-4 p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200">
          <QRCodeSVG
            id="cashier-qr-code"
            value={cashierCode || ""}
            size={200}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            includeMargin={true}
          />
          <div className="text-center">
            <p className="text-sm text-gray-600">Cashier Code</p>
            <p className="text-2xl font-mono font-bold text-amber-600">{cashierCode}</p>
          </div>
        </div>

        {/* Cashier Name */}
        {cashierName && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {cashierName}
          </p>
        )}

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white font-semibold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25"
        >
          <Download className="h-5 w-5" />
          Download QR Code
        </button>

        {/* Instructions */}
        <p className="mt-4 text-xs text-center text-gray-400">
          Share this QR code with players. They can scan it to instantly subscribe to your games.
        </p>
      </div>
    </div>
  );
};

export default QRCodeModal;
