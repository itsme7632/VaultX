import { useEffect, useState } from "react";
import wxLogo from "/wx-logo.png";

interface Props {
  onFadeStart: () => void;
  onComplete: () => void;
}

export function SplashScreen({ onFadeStart, onComplete }: Props) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 50);
    const t2 = setTimeout(() => {
      setPhase("exit");
      onFadeStart();
    }, 1800);
    const t3 = setTimeout(onComplete, 2400);
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
        backgroundColor: "#060d1a",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        opacity: phase === "exit" ? 0 : 1,
        transition: phase === "exit" ? "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Deep navy radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse 70% 55% at 50% 48%, rgba(29,78,216,0.12) 0%, rgba(59,130,246,0.06) 40%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo container */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "splashLogoIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}>
        {/* Outer glow ring */}
        <div style={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          animation: "splashGlowPulse 2.4s ease-in-out infinite",
        }} />
        {/* Mid glow */}
        <div style={{
          position: "absolute",
          width: 110,
          height: 110,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 70%)",
          animation: "splashGlowPulse 2.4s ease-in-out 0.4s infinite",
        }} />

        {/* WX Logo image */}
        <img
          src={wxLogo}
          alt="Wexora"
          style={{
            width: 88,
            height: 88,
            borderRadius: 22,
            objectFit: "cover",
            boxShadow: "0 0 0 1px rgba(96,165,250,0.2), 0 10px 40px rgba(29,78,216,0.5), 0 2px 12px rgba(0,0,0,0.7)",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>

      {/* Text block */}
      <div style={{
        marginTop: 32,
        textAlign: "center",
        animation: "splashTextIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.35s both",
      }}>
        <div style={{
          color: "#ffffff",
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "Inter, sans-serif",
          letterSpacing: "0.06em",
          lineHeight: 1,
          textTransform: "uppercase",
        }}>WEXORA</div>
        <div style={{
          color: "rgba(147,197,253,0.55)",
          fontSize: 11,
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
          letterSpacing: "0.12em",
          marginTop: 8,
          textTransform: "uppercase",
        }}>Global Opportunities. Smarter Growth.</div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 52px)",
        width: 60,
        height: 2,
        borderRadius: 99,
        backgroundColor: "rgba(59,130,246,0.12)",
        overflow: "hidden",
        animation: "splashTextIn 0.4s ease 0.5s both",
      }}>
        <div style={{
          height: "100%",
          borderRadius: 99,
          backgroundColor: "rgba(96,165,250,0.65)",
          animation: "splashBarFill 1.7s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both",
        }} />
      </div>
    </div>
  );
}
