"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  LoaderCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useOrganization } from "./organization-context";
type Item = Record<string, unknown> & { id: string };
const obj = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const arr = (value: unknown) =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
const text = (value: unknown) => String(value ?? "—").replaceAll("_", " ");
export function FixtureDetail({ id }: { id: string }) {
  const { organizationId } = useOrganization();
  const [item, setItem] = useState<Item>();
  const [lookup, setLookup] = useState<{
    venues: Array<{ id: string; name: string }>;
    officials: Array<{ id: string; fullName: string }>;
  }>({ venues: [], officials: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [result, refs] = await Promise.all([
      fetch(
        `/api/admin/phase3/fixtures/${id}?organizationId=${organizationId}`,
      ).then((response) => response.json()),
      fetch(`/api/admin/phase3/lookups?organizationId=${organizationId}`).then(
        (response) => response.json(),
      ),
    ]);
    setItem(result.data);
    if (refs.data) setLookup(refs.data);
    setLoading(false);
  }, [id, organizationId]);
  useEffect(() => {
    const timeout = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  async function reschedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!window.confirm("Simpan perubahan jadwal?")) return;
    const response = await fetch(
      `/api/admin/phase3/fixtures/${id}/reschedule?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kickoffAt: form.get("kickoffAt")
            ? new Date(String(form.get("kickoffAt"))).toISOString()
            : null,
          venueId: form.get("venueId") || null,
          refereeId: form.get("refereeId") || null,
          reason: form.get("reason"),
          timezone: "Asia/Jakarta",
        }),
      },
    );
    const result = await response.json();
    setToast(response.ok ? "Jadwal berhasil diperbarui." : result.error);
    if (response.ok) await load();
  }
  async function cancel() {
    const reason = window.prompt("Alasan pembatalan:");
    if (!reason || !window.confirm("Batalkan pertandingan ini?")) return;
    const response = await fetch(
      `/api/admin/phase3/fixtures/${id}/cancel?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const result = await response.json();
    setToast(response.ok ? "Pertandingan dibatalkan." : result.error);
    if (response.ok) await load();
  }
  async function runAction(action: "postpone" | "publish") {
    const isPublish = action === "publish";
    const reason = isPublish
      ? undefined
      : window.prompt("Alasan penundaan pertandingan:");
    if (!isPublish && !reason) return;
    if (
      !window.confirm(
        isPublish
          ? "Terbitkan fixture ini ke jadwal publik?"
          : "Tunda pertandingan ini?",
      )
    )
      return;
    const response = await fetch(
      `/api/admin/phase3/fixtures/${id}/${action}?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isPublish ? {} : { reason }),
      },
    );
    const result = await response.json();
    setToast(
      response.ok
        ? isPublish
          ? "Fixture berhasil diterbitkan."
          : "Pertandingan berhasil ditunda."
        : result.error,
    );
    if (response.ok) await load();
  }
  if (loading || !item)
    return (
      <main className="grid min-h-80 place-items-center">
        <LoaderCircle className="animate-spin text-primary" />
      </main>
    );
  const home = obj(obj(item.homeTeam).club);
  const away = obj(obj(item.awayTeam).club);
  const caps = obj(item._capabilities) as Record<string, boolean>;
  const referee = arr(item.officialAssignments)[0];
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/fixtures"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted"
      >
        <ArrowLeft size={16} />
        Kembali
      </Link>
      <section className="mt-5 rounded-2xl border bg-surface/45 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Match #{text(item.matchNumber)} · Round {text(item.round)}
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold">
              {text(home.name)} <span className="text-muted">vs</span>{" "}
              {text(away.name)}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {text(obj(item.stage).name)} · {text(item.status)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {caps["fixture.publish"] && !item.publishedAt && (
              <button
                onClick={() => runAction("publish")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-background"
              >
                Terbitkan
              </button>
            )}
            {caps["fixture.reschedule"] &&
              item.status !== "CANCELLED" &&
              item.status !== "POSTPONED" && (
                <button
                  onClick={() => runAction("postpone")}
                  className="rounded-xl border px-4 py-2 text-sm font-bold"
                >
                  Tunda
                </button>
              )}
            {caps["fixture.cancel"] && item.status !== "CANCELLED" && (
              <button
                onClick={cancel}
                className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-bold text-red-300"
              >
                Batalkan
              </button>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Info
            icon={<CalendarClock size={17} />}
            label="Kickoff"
            value={
              item.kickoffAt
                ? new Date(String(item.kickoffAt)).toLocaleString("id-ID")
                : "Belum dijadwalkan"
            }
          />
          <Info
            icon={<MapPin size={17} />}
            label="Venue"
            value={obj(item.venue).name}
          />
          <Info
            icon={<ShieldCheck size={17} />}
            label="Wasit"
            value={obj(referee?.official).fullName}
          />
        </div>
      </section>
      {caps["fixture.reschedule"] && (
        <section className="mt-5 rounded-2xl border bg-surface/45 p-5">
          <h2 className="font-display text-lg font-bold">Reschedule</h2>
          <form
            onSubmit={reschedule}
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-sm font-bold">
              Kickoff
              <input
                name="kickoffAt"
                type="datetime-local"
                required
                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Venue
              <select
                name="venueId"
                required
                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
              >
                <option value="">Pilih…</option>
                {lookup.venues.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Wasit
              <select
                name="refereeId"
                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
              >
                <option value="">Belum ditentukan</option>
                {lookup.officials.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Alasan
              <input
                name="reason"
                required
                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
              />
            </label>
            <button className="h-11 rounded-xl bg-primary px-5 font-bold text-background sm:col-span-2 lg:col-span-4">
              Simpan jadwal
            </button>
          </form>
        </section>
      )}
      <section className="mt-5 rounded-2xl border bg-surface/45 p-5">
        <h2 className="font-display text-lg font-bold">Riwayat perubahan</h2>
        <div className="mt-4 space-y-3">
          {arr(item.scheduleHistory).length ? (
            arr(item.scheduleHistory).map((history) => (
              <article
                key={String(history.id)}
                className="rounded-xl border p-4"
              >
                <p className="font-bold">{text(history.action)}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(String(history.createdAt)).toLocaleString("id-ID")}{" "}
                  · {text(obj(history.actor).name)}
                  {history.reason ? ` · ${history.reason}` : ""}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted">
              Belum ada perubahan jadwal.
            </p>
          )}
        </div>
      </section>
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 rounded-xl border bg-surface px-5 py-4 text-sm shadow-2xl"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-2">{text(value)}</p>
    </div>
  );
}
