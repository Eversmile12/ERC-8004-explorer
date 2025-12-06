import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "8004 Agents - ERC-8004 Agent Registry",
  description: "Discover and explore registered AI agents on the ERC-8004 protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <footer className="border-t border-white/5 bg-[#0a0a0b] py-6 text-center text-sm text-white/40">
          Built with 💻 by{" "}
          <a
            href="https://x.com/VittoStack"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white transition-colors"
          >
            Vitto
          </a>
        </footer>
      </body>
    </html>
  );
}
