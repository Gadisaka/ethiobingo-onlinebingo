import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../constant";
import SpinWheel from "../components/SpinWheel";
import { useAuth } from "../context/AuthContext";
import { Flame, ShoppingBag, Sparkles, ArrowLeft, Zap } from "lucide-react";

export default function SpinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availableSpins, setAvailableSpins] = useState(0);
  const [points, setPoints] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const fetchState = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/points`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setAvailableSpins(Number(res.data?.spins?.available || 0));
      setPoints(Number(res.data?.points || 0));
      setBonusBalance(Number(res.data?.bonus || 0));
      setConfig(res.data?.config || null);
    } catch (e) {
      console.error("Failed to fetch spin state", e);
      // If unauthorized, redirect to auth
      if (e.response?.status === 401) {
        navigate("/auth");
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchState();
      // Refresh state periodically
      const interval = setInterval(fetchState, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const buySpin = async () => {
    try {
      setLoading(true);
      setMessage("");
      const res = await axios.post(
        `${API_URL}/api/spins/buy`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setAvailableSpins(res.data?.available_spins || 0);
      setPoints(res.data?.points || points);
      setMessage("Spin purchased successfully! 🎉");
      // Refresh state after purchase
      setTimeout(fetchState, 500);
    } catch (e) {
      setMessage(
        e.response?.data?.message || "Unable to buy spin. Need more points?"
      );
    } finally {
      setLoading(false);
    }
  };

  const playSpin = async () => {
    try {
      setLoading(true);
      setSpinning(true);
      setMessage("");
      setResult(null);

      const res = await axios.post(
        `${API_URL}/api/spins/play`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setResult(res.data?.outcome);
      setAvailableSpins(res.data?.available_spins || 0);
      setPoints(res.data?.points ?? points);
      setBonusBalance(res.data?.bonus_balance ?? bonusBalance);

      // Delay showing result message until animation completes
      setTimeout(() => {
        const { outcome, reward } = res.data || {};
        const msg =
          outcome === "FREE_SPIN"
            ? "You won a free spin! 🎁"
            : outcome === "BONUS_CASH"
            ? `+${reward?.bonus_cash || 0} bonus cash! 💰`
            : outcome === "POINTS"
            ? `+${reward?.points || 0} points! ⭐`
            : "No prize this time. Try again! 🎲";
        setMessage(msg);
        // Refresh state after spin
        fetchState();
      }, 2500);
    } catch (e) {
      setMessage(e.response?.data?.message || "Spin failed. Please try again.");
      setSpinning(false);
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 2600);
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-8 pb-4"></div>

      {/* Main Content */}
      <div className="relative z-10 px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          {/* Wheel Container */}
          <div className="relative mb-8 flex justify-center">
            <div className="relative scale-110 sm:scale-125">
              {/* Ambient Glow behind wheel */}
              <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full animate-pulse" />
              <SpinWheel result={result} config={config} />
            </div>
          </div>

          {/* Stats Row - Glass Pills */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Spins
              </div>
              <div className="font-black text-white text-2xl flex items-center justify-center gap-1 leading-none">
                <Flame className="w-5 h-5 text-amber-500 fill-amber-500/20" />
                {availableSpins}
              </div>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Points
              </div>
              <div className="font-bold text-sky-300 text-xl leading-none">
                {points}
              </div>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Bonus
              </div>
              <div className="font-bold text-emerald-400 text-xl leading-none">
                {bonusBalance}
              </div>
            </div>
          </div>

          {/* Message Area */}
          <div className="h-12 flex items-center justify-center mb-6">
            {message && (
              <div className="px-6 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm font-bold text-amber-300 animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {message}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={buySpin}
              disabled={loading || spinning}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-200 py-4 rounded-2xl font-bold text-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none border border-white/5 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center leading-tight gap-1">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Buy Spin
                </span>
                <span className="text-[11px] text-sky-300/80 font-medium tracking-wide">
                  {config?.spin_cost_points || 500} PTS
                </span>
              </div>
            </button>
            <button
              onClick={playSpin}
              disabled={loading || spinning || availableSpins <= 0}
              className="flex-[1.5] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white py-4 rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(168,85,247,0.4)] transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-t border-white/20 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
              <span className="relative flex items-center justify-center gap-2">
                {spinning ? (
                  "SPINNING..."
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> SPIN NOW
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
