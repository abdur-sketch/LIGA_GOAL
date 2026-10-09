import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-3", className)} aria-label="LIGA GOAL beranda">
      <span className="grid size-10 place-items-center rounded-xl bg-primary text-background shadow-[0_0_24px_rgba(57,228,154,.24)]"><Trophy size={20} strokeWidth={2.5} /></span>
      {!compact && <span className="font-display text-lg font-extrabold tracking-tight">LIGA <span className="text-primary">GOAL</span></span>}
    </Link>
  );
}
