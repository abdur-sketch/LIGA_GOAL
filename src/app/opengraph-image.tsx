import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name} — ${BRAND.tagline}`;

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "radial-gradient(circle at 85% 15%,#174a3d 0,#071019 48%)", color: "white" }}><div style={{ display: "flex", alignItems: "center", gap: 24 }}><div style={{ width: 88, height: 88, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 22, background: "linear-gradient(145deg,#39e49a,#f5c451)", color: "#071019", fontSize: 38, fontWeight: 900 }}>PL</div><div style={{ fontSize: 46, fontWeight: 900, letterSpacing: -2 }}>{BRAND.name}</div></div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ maxWidth: 880, fontSize: 72, lineHeight: 1.05, fontWeight: 900, letterSpacing: -4 }}>{BRAND.tagline}</div><div style={{ marginTop: 28, maxWidth: 900, fontSize: 26, lineHeight: 1.45, color: "#aab8c5" }}>{BRAND.description}</div></div></div>, size);
}
