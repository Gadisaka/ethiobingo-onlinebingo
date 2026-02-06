import { useEffect, useState, useRef, useMemo } from "react";

// Generate wheel segments based on config values
// 12 visual segments mapped to 4 outcomes
// Segment 0 starts at the TOP of the wheel and goes CLOCKWISE
const generateWheelSegments = (pointsReward = 200, bonusCashReward = 50) => [
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: `+${pointsReward}`, outcome: "POINTS", color: "gold" },
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: "SPIN", outcome: "FREE_SPIN", color: "gold" },
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: `+${bonusCashReward}`, outcome: "BONUS_CASH", color: "gold" },
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: `+${pointsReward}`, outcome: "POINTS", color: "gold" },
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: "SPIN", outcome: "FREE_SPIN", color: "gold" },
  { label: "ZERO", outcome: "NO_PRIZE", color: "red" },
  { label: `+${bonusCashReward}`, outcome: "BONUS_CASH", color: "gold" },
];

const SEGMENT_COUNT = 12;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT; // 30° per segment

// Calculate the exact rotation needed to land on each segment's center
// When rotation = 0°, segment 0 starts at top (spans 0°-30°, center at 15°)
// CSS rotate(X deg) rotates the wheel X° clockwise
// When wheel rotates X° clockwise, the pointer (fixed at top) points to position (360-X)° on wheel
// For segment N: center is at position (N * 30 + 15)°
// To land pointer on segment N's center: 360 - X = N*30 + 15, so X = 360 - N*30 - 15 = 345 - N*30
const getRotationForSegment = (segmentIndex) => {
  const rotation = 345 - segmentIndex * SEGMENT_ANGLE;
  // Normalize to 0-360 range (for segment 11, 345-330=15, which is already positive)
  return rotation < 0 ? rotation + 360 : rotation;
};

export default function SpinWheel({ result, config }) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const spinCountRef = useRef(0);

  // Generate dynamic segments based on config
  const wheelSegments = useMemo(() => {
    const pointsReward = config?.spin_reward_points || 200;
    const bonusCashReward = config?.spin_reward_bonus_cash || 50;
    return generateWheelSegments(pointsReward, bonusCashReward);
  }, [config?.spin_reward_points, config?.spin_reward_bonus_cash]);

  useEffect(() => {
    if (!result) return;

    // Find all segments that match this outcome
    const matchingIndices = wheelSegments
      .map((seg, idx) => (seg.outcome === result ? idx : -1))
      .filter((idx) => idx >= 0);

    if (matchingIndices.length === 0) {
      console.warn("No matching segment for outcome:", result);
      return;
    }

    // Pick a random matching segment for visual variety
    const targetIndex =
      matchingIndices[Math.floor(Math.random() * matchingIndices.length)];

    // Calculate the exact rotation to land on this segment's center
    const targetAngle = getRotationForSegment(targetIndex);

    // Increment spin counter to ensure unique rotation each time
    spinCountRef.current += 1;

    // Each spin: add 4 full rotations (1440°) multiplied by spin count, plus target angle
    // This ensures the wheel always spins even if landing on same segment
    const fullSpins = 1440 * spinCountRef.current;
    const finalRotation = fullSpins + targetAngle;

    console.log(
      `Spin #${spinCountRef.current}: result=${result}, segment=${targetIndex} (${wheelSegments[targetIndex].label}), targetAngle=${targetAngle}°, finalRotation=${finalRotation}°`
    );

    setIsSpinning(true);
    setRotation(finalRotation);

    // Reset spinning state after animation completes
    setTimeout(() => {
      setIsSpinning(false);
    }, 4000);
  }, [result, wheelSegments]);

  return (
    <div className="relative w-64 h-64 mx-auto select-none">
      {/* Outer Shadow/Glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.5), 0 0 0 8px rgba(251,191,36,0.3)",
        }}
      />

      {/* Gold Outer Ring */}
      <div
        className="absolute -inset-2 rounded-full"
        style={{
          background:
            "linear-gradient(135deg, #fcd34d 0%, #f59e0b 30%, #d97706 50%, #f59e0b 70%, #fcd34d 100%)",
          boxShadow:
            "inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
        }}
      />

      {/* Inner ring shadow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.4)",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />

      {/* Spinning Wheel */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning
            ? "transform 4s cubic-bezier(0.2, 0.8, 0.3, 1)"
            : "none",
        }}
      >
        {/* SVG Wheel with segments */}
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
        >
          <defs>
            {/* Gradients for segments */}
            <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </linearGradient>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fdba74" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>
            {/* Highlight gradient for 3D effect */}
            <linearGradient id="highlight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {wheelSegments.map((segment, i) => {
            const startAngle = i * SEGMENT_ANGLE - 90; // -90 to start from top
            const endAngle = startAngle + SEGMENT_ANGLE;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const midRad = ((startAngle + endAngle) / 2) * (Math.PI / 180);

            const cx = 100;
            const cy = 100;
            const r = 100;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            // Text position (closer to edge)
            const textR = 70;
            const textX = cx + textR * Math.cos(midRad);
            const textY = cy + textR * Math.sin(midRad);
            const textRotation = (startAngle + endAngle) / 2 + 90;

            const largeArc = SEGMENT_ANGLE > 180 ? 1 : 0;
            const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return (
              <g key={i}>
                {/* Segment */}
                <path
                  d={pathD}
                  fill={`url(#${
                    segment.color === "red" ? "redGrad" : "goldGrad"
                  })`}
                  stroke="#fcd34d"
                  strokeWidth="0.5"
                />
                {/* Segment divider line */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={x1}
                  y2={y1}
                  stroke="#fcd34d"
                  strokeWidth="1.5"
                  opacity="0.8"
                />
                {/* Text Label */}
                <text
                  x={textX}
                  y={textY}
                  fill="#fef3c7"
                  fontSize="11"
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}

          {/* Center highlight overlay */}
          <circle
            cx="100"
            cy="100"
            r="100"
            fill="url(#highlight)"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* Center Hub - Teardrop/Gem Style */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        {/* Outer gold ring */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, #fcd34d 0%, #f59e0b 30%, #d97706 50%, #f59e0b 70%, #fcd34d 100%)",
            boxShadow:
              "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.4)",
          }}
        >
          {/* Inner red gem */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, #fca5a5 0%, #ef4444 30%, #dc2626 60%, #991b1b 100%)",
              boxShadow:
                "inset 0 2px 8px rgba(255,255,255,0.4), inset 0 -2px 8px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {/* Gem highlight */}
            <div
              className="w-4 h-4 rounded-full opacity-60"
              style={{
                background:
                  "radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, transparent 70%)",
                transform: "translate(-6px, -6px)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Pointer/Arrow at Top */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
        {/* Pointer shape - teardrop pointing down */}
        <div
          className="relative"
          style={{
            width: "28px",
            height: "36px",
          }}
        >
          {/* Gold border/shadow layer */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, #fcd34d 0%, #d97706 100%)",
              clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
              borderRadius: "4px 4px 50% 50%",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
            }}
          />
          {/* Red inner */}
          <div
            className="absolute"
            style={{
              top: "2px",
              left: "3px",
              right: "3px",
              bottom: "4px",
              background:
                "linear-gradient(180deg, #fca5a5 0%, #ef4444 30%, #dc2626 70%, #991b1b 100%)",
              clipPath: "polygon(50% 100%, 0% 0%, 100% 0%)",
              borderRadius: "2px 2px 50% 50%",
            }}
          />
          {/* Highlight */}
          <div
            className="absolute top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.9) 0%, transparent 70%)",
            }}
          />
        </div>
      </div>

      {/* Decorative lights around the wheel */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16 - 90;
        const rad = (angle * Math.PI) / 180;
        const r = 130;
        const x = 110 + r * Math.cos(rad);
        const y = 110 + r * Math.sin(rad);
        const isLit = i % 2 === 0;

        return (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-50%, -50%)",
              background: isLit
                ? "radial-gradient(circle, #fef08a 0%, #facc15 50%, #eab308 100%)"
                : "radial-gradient(circle, #fcd34d 0%, #d97706 100%)",
              boxShadow: isLit
                ? "0 0 8px 2px rgba(250,204,21,0.6)"
                : "0 0 4px 1px rgba(217,119,6,0.3)",
              opacity: isLit ? 1 : 0.6,
            }}
          />
        );
      })}
    </div>
  );
}
