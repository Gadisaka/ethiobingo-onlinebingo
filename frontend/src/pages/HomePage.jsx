import { Link } from "react-router-dom";
import {
  Gamepad2,
  Users,
  Star,
  Settings,
  RotateCw,
  Trophy,
  User,
} from "lucide-react";
import { useMemo } from "react";
// import logo from "../assets/logo.png";
import WalletBadge from "../components/WalletBadge";

// sky

export default function HomePage() {
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

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      {/* <WalletBadge /> */}
      {/* === Massive Background Shape === */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-sky-500/20 rounded-[55%_45%_60%_40%/60%_40%_55%_45%] blur-3xl animate-pulse" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-sky-400/30 rounded-[60%_40%_55%_45%/40%_60%_45%_55%] blur-[120px]" />
      </div>

      {/* === Faded Stars Background === */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute text-sky-200 fill-sky-200"
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

      {/* === Logo Section === */}
      <div className="flex flex-col items-center z-10">
        {/* <img
          src={logo}
          alt="logo"
          className="w-[300px] h-[170px] object-contain drop-shadow-[0_0_40px_rgba(56,189,248,0.4)]"
        /> */}
        {/* <h1 className="text-4xl md:text-5xl font-extrabold tracking-wide text-sky-400 mt-4">
          Sky Bingo
        </h1> */}
      </div>

      {/* === Buttons Section === */}
      <div className="flex flex-col items-center justify-center gap-6 mt-10 z-10 w-[90%] max-w-md">
        <Link
          to="/systemGames"
          className="group w-full bg-gradient-to-b from-sky-700/40 to-sky-900/60 border border-sky-400/50 hover:border-sky-300/90 text-white rounded-2xl py-6 flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(56,189,248,0.25)] hover:shadow-sky-400/40 transition-all duration-300"
        >
          <Gamepad2 className="w-10 h-10 text-sky-400 group-hover:scale-110 transition-transform duration-200" />
          <span className="text-2xl font-semibold tracking-wide">Play</span>
        </Link>

        <Link
          to="/friends"
          className="group w-full bg-gradient-to-b from-sky-700/20 to-sky-900/40 border border-sky-400/50 hover:border-sky-300/90 text-white rounded-2xl py-6 flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(56,189,248,0.25)] hover:shadow-sky-400/40 transition-all duration-300"
        >
          <Users className="w-10 h-10 text-sky-400 group-hover:scale-110 transition-transform duration-200" />
          <span className="text-2xl font-semibold tracking-wide">
            Play with Friends
          </span>
        </Link>
      </div>

      {/* === Footer === */}
      <div className="absolute bottom-6 text-sm text-sky-400/70 z-10">
        © 2025 Sky Bingo
      </div>
    </div>
  );
}
