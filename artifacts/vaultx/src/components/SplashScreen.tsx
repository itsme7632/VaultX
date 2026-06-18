import { useEffect, useState } from "react";

interface Props {
  onFadeStart: () => void;
  onComplete: () => void;
}

export function SplashScreen({ onFadeStart, onComplete }: Props) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    // Enter → hold after logo animation lands
    const t1 = setTimeout(() => setPhase("hold"), 50);
    // Hold → exit at 1.6s, simultaneously start fading in app
    const t2 = setTimeout(() => {
      setPhase("exit");
      onFadeStart();
    }, 1600);
    // Remove from DOM after exit animation finishes
    const t3 = setTimeout(onComplete, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onFadeStart, onComplete]);

  return (
    <div
      className="splash-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B1220",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        opacity: phase === "exit" ? 0 : 1,
        transition: phase === "exit" ? "opacity 0.55s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Ambient glow background */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo container */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "splashLogoIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}>
        {/* Outer glow ring — pulsing */}
        <div style={{
          position: "absolute",
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
          animation: "splashGlowPulse 2s ease-in-out infinite",
        }} />

        {/* Mid glow */}
        <div style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.22) 0%, transparent 70%)",
          animation: "splashGlowPulse 2s ease-in-out 0.3s infinite",
        }} />

        {/* Logo square */}
        <div style={{
          position: "relative",
          width: 80,
          height: 80,
          borderRadius: 22,
          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 1px rgba(96,165,250,0.25), 0 8px 32px rgba(59,130,246,0.45), 0 2px 8px rgba(0,0,0,0.6)",
        }}>
          {/* Inner highlight */}
          <div style={{
            position: "absolute",
            inset: 1,
            borderRadius: 21,
            background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)",
            pointerEvents: "none",
          }} />
          <span style={{
            color: "#ffffff",
            fontSize: 36,
            fontWeight: 900,
            fontFamily: "Inter, sans-serif",
            letterSpacing: "-1px",
            lineHeight: 1,
            position: "relative",
            zIndex: 1,
          }}>V</span>
        </div>
      </div>

      {/* Text block */}
      <div style={{
        marginTop: 28,
        textAlign: "center",
        animation: "splashTextIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both",
      }}>
        <div style={{
          color: "#ffffff",
          fontSize: 26,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}>VaultX</div>
        <div style={{
          color: "rgba(147,197,253,0.65)",
          fontSize: 12,
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
          letterSpacing: "0.08em",
          marginTop: 8,
          textTransform: "uppercase",
        }}>Secure Digital Asset Platform</div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 48px)",
        width: 56,
        height: 2,
        borderRadius: 99,
        backgroundColor: "rgba(59,130,246,0.15)",
        overflow: "hidden",
        animation: "splashTextIn 0.4s ease 0.5s both",
      }}>
        <div style={{
          height: "100%",
          borderRadius: 99,
          backgroundColor: "rgba(96,165,250,0.7)",
          animation: "splashBarFill 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both",
        }} />
      </div>
    </div>
  );
}
