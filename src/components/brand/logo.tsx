import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-3", className)} aria-label={`${BRAND.name} beranda`}>
      <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,#39e49a,#f5c451)] text-background shadow-[0_0_24px_rgba(57,228,154,.24)]" aria-hidden="true">
        <svg viewBox="0 0 40 40" className="size-7" fill="none"><path d="M11 30V9h10.5a7 7 0 0 1 0 14H16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 30h8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
      </span>
      {!compact && <span className="font-display text-lg font-extrabold tracking-tight">PORTAL <span className="text-primary">LOMBA</span></span>}
    </Link>
  );
}
