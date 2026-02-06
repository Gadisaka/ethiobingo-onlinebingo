import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Star, ArrowLeft, Mail, Shield } from "lucide-react";

const SignupForm = ({ onSwitchToLogin }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [name, setName] = useState("");
  const [pinDigits, setPinDigits] = useState(["", "", "", "", "", ""]);
  const [confirmPinDigits, setConfirmPinDigits] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const pinInputRefs = useRef([]);
  const confirmPinInputRefs = useRef([]);
  const otpInputRefs = useRef([]);
  const navigate = useNavigate();

  const { sendOTP, signup, logout } = useAuth();

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

  const handlePinChange = (index, value, isConfirm = false) => {
    if (value && !/^\d$/.test(value)) return;

    if (isConfirm) {
      const newDigits = [...confirmPinDigits];
      newDigits[index] = value;
      setConfirmPinDigits(newDigits);
      if (value && index < 5) {
        confirmPinInputRefs.current[index + 1]?.focus();
      }
    } else {
      const newDigits = [...pinDigits];
      newDigits[index] = value;
      setPinDigits(newDigits);
      if (value && index < 5) {
        pinInputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handlePinKeyDown = (index, e, isConfirm = false) => {
    if (e.key === "Backspace") {
      const digits = isConfirm ? confirmPinDigits : pinDigits;
      const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
      if (!digits[index] && index > 0) {
        refs.current[index - 1]?.focus();
      }
    }
  };

  const handlePinPaste = (e, isConfirm = false) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newDigits = pastedData
        .split("")
        .concat(Array(6 - pastedData.length).fill(""));
      if (isConfirm) {
        setConfirmPinDigits(newDigits);
        const nextIndex = Math.min(pastedData.length, 5);
        confirmPinInputRefs.current[nextIndex]?.focus();
      } else {
        setPinDigits(newDigits);
        const nextIndex = Math.min(pastedData.length, 5);
        pinInputRefs.current[nextIndex]?.focus();
      }
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newDigits = pastedData
        .split("")
        .concat(Array(6 - pastedData.length).fill(""));
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pastedData.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const pin = pinDigits.join("");
    const confirmPin = confirmPinDigits.join("");

    if (pin.length !== 6) {
      setError("PIN must be 6 digits");
      setLoading(false);
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      setLoading(false);
      return;
    }

    const result = await sendOTP(phoneNumber);

    if (result.success) {
      setOtpSent(true);
      if (result.otp) {
        // Auto-fill OTP in development
        if (import.meta.env.DEV) {
          setOtpDigits(result.otp.split(""));
        }
      }
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const otp = otpDigits.join("");
    const pin = pinDigits.join("");

    if (otp.length !== 6) {
      setError("Please enter a 6-digit OTP");
      setLoading(false);
      return;
    }

    const result = await signup(phoneNumber, otp, pin, name);

    if (result.success) {
      // Logout the user since signup auto-logs them in, then redirect to login
      logout();
      navigate("/auth");
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otpSent) {
      otpInputRefs.current[0]?.focus();
    }
  }, [otpSent]);

  if (otpSent) {
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

        {/* === OTP Verification Form === */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="bg-gradient-to-b from-emerald-900/40 to-emerald-900/60 backdrop-blur-sm border border-emerald-400/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
            <h2 className="text-3xl font-extrabold text-center mb-8 text-emerald-300 tracking-wide">
              Verify OTP
            </h2>

            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-emerald-300 mb-2"
                >
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-black/40 border border-emerald-400/50 rounded-xl text-white placeholder-emerald-500/50 focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/30 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-emerald-300 mb-4 text-center">
                  Enter 6-digit OTP Code
                </label>
                <div className="flex justify-center gap-1 md:gap-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="md:w-14 md:h-14 w-12 h-12 text-center text-2xl font-bold bg-black/40 border border-emerald-400/50 rounded-xl text-white focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/30 transition-all"
                    />
                  ))}
                </div>
                <p className="text-sm text-emerald-400/70 mt-3 text-center">
                  OTP sent to {phoneNumber}
                  {import.meta.env.DEV && otpDigits.join("") && (
                    <span className="block text-emerald-300 font-mono mt-1">
                      Dev OTP: {otpDigits.join("")}
                    </span>
                  )}
                </p>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="flex-1 bg-gradient-to-b from-emerald-800/30 to-emerald-900/40 border border-emerald-500/40 hover:border-emerald-400/60 text-white rounded-xl py-4 flex items-center justify-center gap-2 transition-all duration-300 font-semibold"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otpDigits.join("").length !== 6}
                  className="flex-1 bg-gradient-to-b from-emerald-700/40 to-emerald-900/60 border border-emerald-400/50 hover:border-emerald-300/90 text-white rounded-xl py-4 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-emerald-400/40 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Shield className="w-5 h-5" />
                  {loading ? "Verifying..." : "Complete Signup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

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

      {/* === Signup Form === */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-gradient-to-b from-emerald-900/40 to-emerald-900/60 backdrop-blur-sm border border-emerald-400/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <h2 className="text-3xl font-extrabold text-center mb-8 text-emerald-300 tracking-wide">
            Sign Up
          </h2>

          <form onSubmit={handleSendOTP} className="space-y-6">
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

            <div>
              <label className="block text-sm font-semibold text-emerald-300 mb-4 text-center">
                Create 6-digit PIN
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
                    onChange={(e) =>
                      handlePinChange(index, e.target.value, false)
                    }
                    onKeyDown={(e) => handlePinKeyDown(index, e, false)}
                    onPaste={(e) => handlePinPaste(e, false)}
                    className="md:w-14 md:h-14 w-12 h-12 text-center text-2xl font-bold bg-black/40 border border-emerald-400/50 rounded-xl text-white focus:outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/30 transition-all"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-emerald-300 mb-4 text-center">
                Confirm 6-digit PIN
              </label>
              <div className="flex justify-center gap-1 md:gap-2">
                {confirmPinDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (confirmPinInputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handlePinChange(index, e.target.value, true)
                    }
                    onKeyDown={(e) => handlePinKeyDown(index, e, true)}
                    onPaste={(e) => handlePinPaste(e, true)}
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

            <button
              type="submit"
              disabled={
                loading ||
                pinDigits.join("").length !== 6 ||
                confirmPinDigits.join("").length !== 6
              }
              className="group w-full bg-gradient-to-b from-emerald-700/40 to-emerald-900/60 border border-emerald-400/50 hover:border-emerald-300/90 text-white rounded-xl py-4 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-emerald-400/40 transition-all duration-300 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
              <Mail className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchToLogin}
              className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
            >
              Already have an account? Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupForm;
