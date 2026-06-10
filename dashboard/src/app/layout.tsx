import type { Metadata } from "next";
import { Mulish } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "../context/DashboardContext";
import OnboardingModal from "../components/OnboardingModal";
import CommandPalette from "../components/CommandPalette";
import Sidebar from "../components/Sidebar";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Jarvis — Strategic Intelligence",
  description: "Jarvis, your personal strategic intelligence assistant for the Chief Strategy Officer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={mulish.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <DashboardProvider>
          <div className="dashboard-root">
            <Sidebar />
            {children}
            <OnboardingModal />
            <CommandPalette />
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
