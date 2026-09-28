"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface LandingLoaderProps {
  onComplete: () => void;
}

export default function LandingLoader({ onComplete }: LandingLoaderProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth progress counter simulation
    const duration = 1200; // ms
    const interval = 20; // ms
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + step);
      });
    }, interval);

    // Call onComplete after 100% and a small pause
    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration + 400);

    return () => {
      clearInterval(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: "var(--font-dashboard, system-ui, sans-serif)",
        }}
      >
        <motion.div
          animate={{ scale: [0.9, 1.1, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
            marginBottom: "24px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Zap size={32} style={{ color: "#fff", fill: "#fff" }} />
        </motion.div>
        
        <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255, 255, 255, 0.6)", marginBottom: "8px" }}>
          Initializing Strike
        </div>
        
        <div style={{ fontSize: "42px", fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-1px" }}>
          {Math.floor(progress)}%
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
