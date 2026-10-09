import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "LIGA GOAL — Semua Liga, Satu Platform", template: "%s | LIGA GOAL" },
  description: "Platform manajemen kompetisi sepak bola dan live score yang profesional, transparan, dan real-time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" data-scroll-behavior="smooth" className={`${inter.variable} ${sora.variable}`}><body>{children}</body></html>;
}
