import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Star, ArrowRight, ArrowLeft } from "lucide-react";

const LoginForm = ({ onSwitchToSignup }) => {
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pinDigits, setPinDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pinInputRefs = useRef([]);
  const navigate = useNavigate();

  const { login } = useAuth();

  // Generate star positions once
  const stars = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      size: Math.random() * 10 + 1,
      left: Math.random() * 100,
      top: Math.random() * 100,
      opacity: Math.random() * 0.4 + 0.5,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    }));
  }, []);

  const handleNext = (e) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
      setError("");
      setStep(2);
    }
  };

  const handlePinChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newPinDigits = [...pinDigits];
    newPinDigits[index] = value;
    setPinDigits(newPinDigits);

    // Auto-focus next input
    if (value && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newPinDigits = pastedData
        .split("")
        .concat(Array(6 - pastedData.length).fill(""));
      setPinDigits(newPinDigits);
      const nextIndex = Math.min(pastedData.length, 5);
      pinInputRefs.current[nextIndex]?.focus();
    }
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    const pin = pinDigits.join("");

    if (pin.length !== 6) {
      setError("Please enter a 6-digit PIN");
      return;
    }

    setLoading(true);
    setError("");

    const result = await login(phoneNumber, pin);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError("");
    setPinDigits(["", "", "", "", "", ""]);
  };

  // Focus first PIN input when step 2 is shown
  useEffect(() => {
    if (step === 2) {
      pinInputRefs.current[0]?.focus();
    }
  }, [step]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      {/* === Massive Background Shape === */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-emerald-500/20 rounded-[55%_45%_60%_40%/60%_40%_55%_45%] blur-3xl animate-pulse" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-emerald-400/30 rounded-[60%_40%_55%_45%/40%_60%_45%_55%] blur-[120px]" />
      </div>

      {/* === Faded Stars Background === */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute text-emerald-200 fill-emerald-200"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* === Login Form === */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-gradient-to-b from-emerald-900/40 to-emerald-900/60 backdrop-blur-sm border border-emerald-400/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <h2 className="text-3xl font-extrabold text-center mb-8 text-emerald-300 tracking-wide">
            {step === 1 ? "Login" : "Enter PIN"}
          </h2>

          {step === 1 ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div>
                <label
                  htmlFor="phoneNumber"
                  className="block text-sm font-semibold text-emerald-300 mb-2"
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+251XXXXXXXXX"
                  className="w-full px-4 py-3 bg-black/40 border border-emerald-400/50 rounded-xl text-white placeholder-emerald-500/50 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/30 transition-all"
                  required
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="group w-full bg-gradient-to-b from-emerald-700/40 to-emerald-900/60 border border-emerald-400/50 hover:border-emerald-300/90 text-white rounded-xl py-4 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-emerald-400/40 transition-all duration-300 font-semibold text-lg"
              >
                Next
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleContinue} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-emerald-300 mb-4 text-center">
                  Enter your 6-digit PIN
                </label>
                <div className="flex justify-center gap-1 md:gap-2">
                  {pinDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (pinInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="md:w-14 md:h-14 w-12 h-12 text-center text-2xl font-bold bg-black/40 border border-emerald-400/50 rounded-xl text-white focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/30 transition-all"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 bg-gradient-to-b from-emerald-800/30 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/60 text-white rounded-xl py-4 flex items-center justify-center gap-2 transition-all duration-300 font-semibold"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || pinDigits.join("").length !== 6}
                  className="flex-1 bg-gradient-to-b from-emerald-700/40 to-emerald-900/60 border border-emerald-400/50 hover:border-emerald-300/90 text-white rounded-xl py-4 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-emerald-400/40 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Logging in..." : "Continue"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToSignup}
              className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
            >
              Don't have an account? Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
