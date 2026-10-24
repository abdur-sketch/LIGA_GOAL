import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";

export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center px-6" role="status" aria-busy="true" aria-live="polite">
      <div className="text-center">
        <Logo className="justify-center" />
        <div className="mx-auto mt-8 size-9 animate-spin rounded-full border-2 border-white/15 border-t-primary" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted">Menyiapkan {BRAND.shortName}…</p>
      </div>
    </div>
  );
}
