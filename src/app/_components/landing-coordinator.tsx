"use client";

import { useState, useEffect } from "react";
import LandingLoader from "./landing-loader";
import LandingExperience from "./landing-experience";

export default function LandingCoordinator() {
  const [loading, setLoading] = useState(true);

  // Fallback in case onComplete doesn't fire for some reason
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {loading && <LandingLoader onComplete={() => setLoading(false)} />}
      <div style={{ opacity: loading ? 0 : 1, transition: "opacity 0.5s ease-in", visibility: loading ? "hidden" : "visible" }}>
        <LandingExperience />
      </div>
    </>
  );
}
