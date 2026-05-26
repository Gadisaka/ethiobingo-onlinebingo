import React, { useState } from "react";
import { User, Sparkles, ArrowRight } from "lucide-react";
// import logo from '../assets/ethiobingo.jpg'

export default function NameInputModal({ onSubmit }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 30) {
      setError("Name must be less than 30 characters");
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      {/* Decorative background elements */}
      <div className="absolute -top-48 -right-32 h-[420px] w-[420px] rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-48 -left-24 h-[520px] w-[520px] rounded-full bg-teal-500/15 blur-[140px]" />

      <div className="relative w-full max-w-md mx-4">
        {/* Card */}
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/95 to-slate-800/95 p-8 shadow-[0_24px_60px_rgba(16,185,129,0.25)] backdrop-blur-sm">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 border-3 border-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                {/* <img src={logo} alt="Kiya Logo" className="rounded-full object-cover" /> */}
              </div>
              {/* <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-amber-900" />
              </div> */}
            </div>

            <div className="text-center">
              <h1 className="text-2xl font-bold text-emerald-500 mb-2">Kiya</h1>
              <h1 className="text-2xl font-bold text-white mb-2">
                እንኳን ደህና መጡ!
              </h1>
              <p className="text-sm text-emerald-200/70">
                ስም ኢዚህ በማስገባት ይመዝገቡ...
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-emerald-200/80 mb-2">
                ስም
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="ስም ኢዚህ ያስገቡ..."
                autoFocus
                className="w-full rounded-2xl border border-emerald-500/40 bg-slate-900/70 px-5 py-4 text-lg text-emerald-100 placeholder-emerald-300/40 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all"
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>

            <button
              type="submit"
              className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-lg font-bold text-white shadow-[0_20px_45px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_26px_60px_rgba(16,185,129,0.45)] active:scale-[0.98]"
            >
              Play
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-emerald-200/50">
            Your name will be saved for future visits
          </p>
        </div>
      </div>
    </div>
  );
}
