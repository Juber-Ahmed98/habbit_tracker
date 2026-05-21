import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHydrator } from "@/components/AppHydrator";
import { OnboardingGate } from "@/components/OnboardingGate";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "Habit Tracker",
  description: "A personal habit tracker across fitness, work, deen, and lifestyle.",
  applicationName: "Habit Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#22252a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Don't disable pinch-zoom — §12 a11y for low-vision users. Lighthouse
  // flags `user-scalable=no` as a meta-viewport failure.
};

// Inline script: pick the persisted theme (or system) before paint so we
// never flash the wrong palette. Runs before React hydration.
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full bg-bg text-text">
        <AppHydrator />
        <OnboardingGate />
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
