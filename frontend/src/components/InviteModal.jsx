import React, { useEffect, useState } from "react";
import { Copy, Share2, Users, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useInviteStore } from "../store/inviteStore";

export default function InviteModal() {
  const { user } = useAuth();
  const { isOpen, closeInvite } = useInviteStore();
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => closeInvite(), 300);
  };

  const referralCode =
    user?.referralNumber ||
    `kiya-${user?.phoneNumber?.slice(-4) || "2025"}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <div
        className={`relative z-10 w-full h-[90vh] bg-slate-950 rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="w-12" />
          <div className="w-12 h-1.5 bg-slate-800 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
          <h1 className="text-lg font-bold text-white mt-2">Invite Friends</h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="h-full overflow-y-auto pb-24 px-6 pt-8 space-y-6">
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-3xl p-8 text-center space-y-4 shadow-xl shadow-indigo-900/20">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Invite & Earn</h2>
            <p className="text-sky-100 text-lg">
              Get <span className="font-bold text-white">bonus</span> for every
              friend who joins and plays!
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-3xl p-6 border border-white/5 space-y-3">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider ml-1">
              Your Referral Code
            </label>
            <div className="flex gap-3">
              <div className="flex-1 bg-slate-950/80 rounded-2xl p-4 font-mono text-xl tracking-wider text-center border border-white/10 text-white shadow-inner">
                {referralCode}
              </div>
              <button
                onClick={handleCopy}
                className="p-4 bg-sky-500 rounded-2xl text-white hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 active:scale-95"
              >
                <Copy className="w-6 h-6" />
              </button>
            </div>
            {copied && (
              <p className="text-center text-emerald-400 text-sm font-medium animate-pulse">
                Copied to clipboard!
              </p>
            )}
          </div>

          <button className="w-full py-4 bg-white text-slate-950 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors shadow-xl active:scale-[0.98]">
            <Share2 className="w-5 h-5" /> Share Link
          </button>
        </div>
      </div>
    </div>
  );
}
