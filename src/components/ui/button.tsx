import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ className, variant = "primary", ...props }: Props) {
  return <button className={cn("inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50", variant === "primary" && "bg-primary text-background hover:bg-[#65efb3]", variant === "secondary" && "border bg-white/5 text-white hover:bg-white/10", variant === "ghost" && "text-muted hover:bg-white/5 hover:text-white", className)} {...props} />;
}
