import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "LIGA GOAL — Semua Liga, Satu Platform", template: "%s | LIGA GOAL" },
  description: "Platform manajemen kompetisi sepak bola dan live score yang profesional, transparan, dan real-time.",
  openGraph: { siteName: "LIGA GOAL", locale: "id_ID", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" data-scroll-behavior="smooth" className={`${inter.variable} ${sora.variable}`}><body>{children}</body></html>;
}
