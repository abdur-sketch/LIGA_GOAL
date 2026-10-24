import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  applicationName: BRAND.shortName,
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s | ${BRAND.name}` },
  description: BRAND.description,
  keywords: ["portal lomba", "manajemen kompetisi", "perlombaan", "turnamen", "hasil kompetisi"],
  openGraph: { title: `${BRAND.name} — ${BRAND.tagline}`, description: BRAND.description, siteName: BRAND.name, locale: "id_ID", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${BRAND.name} — ${BRAND.tagline}` }] },
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.tagline, images: ["/opengraph-image"] },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" data-scroll-behavior="smooth" className={`${inter.variable} ${sora.variable}`}><body>{children}</body></html>;
}
