import type { Metadata } from "next";
import { Fredoka, Baloo_2 } from "next/font/google";
import "./globals.css";

// Fredoka: bubbly, rounded display face for headings & buttons.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Baloo 2: friendly, rounded, still legible at body-text sizes.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Mindtrace — Catch the Pets",
  description: "A camera-based pulse & wellness catch game for kids.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-sky-100">{children}</body>
    </html>
  );
}
