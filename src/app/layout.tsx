import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Strike — Email Intelligence",
  description: "Personal email intelligence and delivery dashboard.",
  verification: {
    google: "RehSgEh4ekxxHcbGX34QIWsDzMA3VXm56r-ezzNDhZw",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
