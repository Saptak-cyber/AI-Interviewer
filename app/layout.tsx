import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Interviewer — FAANG-level Interview Practice",
  description:
    "Practice technical interviews with an AI interviewer. DSA, System Design, Behavioral, and more. Get real-time feedback and improve your skills.",
  keywords: ["interview", "coding interview", "FAANG", "AI", "practice", "DSA", "system design"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
