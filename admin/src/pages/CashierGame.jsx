import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../constant";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import axios from "axios";
import { FRONTEND_URL } from "../constant";

const CashierGame = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const iframeRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [frontendToken, setFrontendToken] = useState(null);
  const [cashierCode, setCashierCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Generate frontend token and get/create cashier code
  useEffect(() => {
    const initializeCashierGame = async () => {
      if (!user || user.role !== "cashier") {
        setError("Only cashiers can access this page");
        setLoading(false);
        return;
      }

      try {
        // Generate frontend token for auto-login
        const tokenRes = await axios.post(
          `${API_URL}/api/auth/generate-frontend-token`
        );
        setFrontendToken(tokenRes.data.token);

        // Get or create cashier code
        const codeRes = await axios.get(
          `${API_URL}/api/cashier-subscription/my-code/${user.id || user._id}`
        );
        setCashierCode(codeRes.data.cashierCode);

        setLoading(false);
      } catch (err) {
        console.error("Error initializing cashier game:", err);
        setError(
          err.response?.data?.message || "Failed to initialize game view"
        );
        setLoading(false);
      }
    };

    initializeCashierGame();
  }, [user]);

  // Copy cashier code
  const handleCopyCode = () => {
    if (cashierCode) {
      navigator.clipboard.writeText(cashierCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset cashier code
  const handleResetCode = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset your code?\n\nThis will:\n• Generate a new code\n• Remove ALL subscribed players\n\nPlayers will need to subscribe again with your new code."
    );

    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/cashier-subscription/reset-code/${user.id || user._id}`
      );
      setCashierCode(res.data.cashierCode);
      alert(
        `Code reset successfully!\n\nYour new code: ${res.data.cashierCode}\n${res.data.subscribersRemoved} subscriber(s) removed.`
      );
    } catch (err) {
      console.error("Error resetting code:", err);
      alert(err.response?.data?.message || "Failed to reset code");
    } finally {
      setResetting(false);
    }
  };

  // Refresh iframe
  const handleRefresh = () => {
    if (iframeRef.current && frontendToken) {
      iframeRef.current.src = `${FRONTEND_URL}/token-login?token=${frontendToken}&redirect=/`;
    }
  };

  // Open in new tab
  const handleOpenInNewTab = () => {
    if (frontendToken) {
      window.open(
        `${FRONTEND_URL}/token-login?token=${frontendToken}&redirect=/`,
        "_blank"
      );
    }
  };

  if (!user || user.role !== "cashier") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">Access denied</p>
          <p className="text-gray-500 text-sm mt-1">
            Only cashiers can access this page
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-gray-600">Setting up game view...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Game Console</h1>
            <p className="text-gray-500 text-sm">
              Create and manage bingo games
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Cashier Code Display */}
          {cashierCode && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl px-4 py-2">
              <span className="text-sm text-gray-600">Your Code:</span>
              <span className="font-mono font-bold text-orange-600 text-lg">
                {cashierCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1.5 hover:bg-orange-100 rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-orange-600" />
                )}
              </button>
              <button
                onClick={handleResetCode}
                disabled={resetting}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                title="Reset code (removes all subscribers)"
              >
                <RotateCcw
                  className={`w-4 h-4 text-red-600 ${
                    resetting ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-blue-800 text-sm">
          <strong>Share your code ({cashierCode}) with players</strong> so they
          can subscribe to your games. When you create a game below, all
          subscribed players will receive an invitation to join.
        </p>
      </div>

      {/* Iframe Container */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <iframe
          ref={iframeRef}
          src={`${FRONTEND_URL}/token-login?token=${frontendToken}&redirect=/`}
          className="w-full border-0"
          style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
          title="Bingo Game Console"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
};

export default CashierGame;
