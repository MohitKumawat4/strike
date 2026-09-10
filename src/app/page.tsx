import type { Metadata } from "next";
import localFont from "next/font/local";
import LandingExperience from "./_components/landing-experience";

const geist = localFont({
  src: "./_fonts/geist-latin.woff2",
  display: "swap",
  variable: "--font-landing",
});

export const metadata: Metadata = {
  title: "Strike — Stay in the loop. Out of the inbox.",
  description: "Your inbox, distilled. Strike finds the emails that matter and turns them into clear, actionable text and voice briefs, delivered to WhatsApp.",
  openGraph: {
    title: "Strike — Stay in the loop. Out of the inbox.",
    description: "Less noise. Clear priorities. Email intelligence that gives your attention back.",
    type: "website",
  },
};

export default function LandingPage() {
  return <div className={geist.variable}><LandingExperience /></div>;
}
