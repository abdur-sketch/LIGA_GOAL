"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Radio,
  RefreshCw,
  Shield,
  UsersRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOrganization } from "./organization-context";

type Item = Record<string, unknown> & { id: string };
type Mode = "list" | "detail" | "lineup" | "live" | "review";
const obj = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const arr = (value: unknown) => (Array.isArray(value) ? (value as Item[]) : []);
const text = (value: unknown) => String(value ?? "—").replaceAll("_", " ");

function Club({
  team,
  score,
}: {
  team: Record<string, unknown>;
  score?: unknown;
}) {
  const club = obj(team.club);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-col sm:text-center">
      {club.logoUrl ? (
        <span
          role="img"
          aria-label={`Logo ${text(club.name)}`}
          className="size-12 shrink-0 rounded-2xl border bg-cover bg-center sm:size-16"
          style={{ backgroundImage: `url(${String(club.logoUrl)})` }}
        />
      ) : (
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border bg-white/5 font-bold sm:size-16">
          {text(club.name).slice(0, 2)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-display font-bold">
          {text(club.name || team.name)}
        </p>
        {score !== undefined && (
          <p className="font-display text-4xl font-black text-primary sm:text-5xl">
            {text(score)}
          </p>
        )}
      </div>
    </div>
  );
}

export function MatchCenter({ mode, id }: { mode: Mode; id?: string }) {
  const { organizationId } = useOrganization();
  const [data, setData] = useState<Item | Item[]>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    if (!organizationId) return;
    setSyncing(true);
    const path = id
      ? `/api/admin/phase4/matches/${id}`
      : "/api/admin/phase4/matches";
    const response = await fetch(`${path}?organizationId=${organizationId}`, {
      cache: "no-store",
    });
    const result = await response.json();
    setData(result.data || []);
    if (!response.ok) setMessage(result.error);
    setLoading(false);
    setSyncing(false);
  }, [id, organizationId]);
  useEffect(() => {
    const timeout = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!id || !organizationId || mode === "lineup") return;
    let active = true;
    let last = "0";
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/admin/phase4/matches/${id}/realtime?organizationId=${organizationId}&after=${last}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        const messages = arr(result.data?.messages);
        if (messages.length) {
          last = String(messages.at(-1)?.sequence || last);
          if (active) await load();
        }
      } catch {
        /* reconnect on the next interval */
      }
    };
    const interval = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [id, load, mode, organizationId]);
  if (loading)
    return (
      <main className="grid min-h-80 place-items-center">
        <LoaderCircle className="animate-spin text-primary" />
      </main>
    );
  if (mode === "list")
    return <MatchList items={Array.isArray(data) ? data : []} />;
  if (!data || Array.isArray(data))
    return (
      <main className="p-6">
        <p className="rounded-xl border p-5">
          {message || "Pertandingan tidak ditemukan."}
        </p>
      </main>
    );
  const props = { item: data, organizationId, reload: load, setMessage };
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/matches"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted"
        >
          <ArrowLeft size={16} />
          Match Center
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 ${online ? "text-emerald-300" : "text-red-300"}`}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? "Online" : "Offline"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-muted">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing" : "Synced"}
          </span>
        </div>
      </div>
      <ScoreHeader item={data} />
      <nav className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {[
          ["detail", "Ringkasan"],
          ["lineup", "Lineup"],
          ["live", "Live"],
          ["review", "Review"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "detail"
                ? `/admin/matches/${id}`
                : `/admin/matches/${id}/${key}`
            }
            className={`whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold ${mode === key ? "bg-primary text-background" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {mode === "detail" && <Detail {...props} />}
      {mode === "lineup" && <Lineup {...props} />}
      {mode === "live" && <Live {...props} />}
      {mode === "review" && <Review {...props} />}
      {message && (
        <div
          role="status"
          className="fixed bottom-5 right-5 max-w-sm rounded-xl border bg-surface px-5 py-4 text-sm shadow-2xl"
        >
          {message}
        </div>
      )}
    </main>
  );
}

function MatchList({ items }: { items: Item[] }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Live operations
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">Match Center</h1>
        <p className="mt-2 text-sm text-muted">
          Kelola lineup, event pertandingan, live score, dan hasil resmi.
        </p>
      </div>
      <div className="mt-7 grid gap-4 xl:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/matches/${item.id}`}
              className="rounded-2xl border bg-surface/45 p-5 transition hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {text(obj(item.competition).name)} · #{text(item.matchNumber)}
                </p>
                <span className="rounded-full border px-3 py-1 text-[11px] font-bold">
                  {text(item.status)}
                </span>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Club team={obj(item.homeTeam)} score={item.homeScore} />
                <span className="font-bold text-muted">—</span>
                <Club team={obj(item.awayTeam)} score={item.awayScore} />
              </div>
              <p className="mt-5 text-center text-xs text-muted">
                {item.kickoffAt
                  ? new Date(String(item.kickoffAt)).toLocaleString("id-ID")
                  : "Kickoff belum ditentukan"}{" "}
                · {text(obj(item.venue).name)}
              </p>
            </Link>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed p-10 text-center text-muted">
            Belum ada fixture terbit untuk Match Center.
          </p>
        )}
      </div>
    </main>
  );
}

function ScoreHeader({ item }: { item: Item }) {
  return (
    <section className="rounded-2xl border bg-surface/50 p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          {text(obj(item.stage).name)} · {text(item.status)}
        </p>
        <span className="rounded-full border px-3 py-1 text-xs font-bold">
          {text(obj(item.clockState).period || "PRE MATCH")}
        </span>
      </div>
      <div className="flex items-center gap-4 sm:gap-10">
        <Club team={obj(item.homeTeam)} score={item.homeScore} />
        <span className="font-display text-2xl font-black text-muted">:</span>
        <Club team={obj(item.awayTeam)} score={item.awayScore} />
      </div>
      {(Number(item.shootoutHome) > 0 || Number(item.shootoutAway) > 0) && (
        <p className="mt-4 text-center text-sm">
          Penalti {text(item.shootoutHome)}–{text(item.shootoutAway)}
        </p>
      )}
    </section>
  );
}

type PanelProps = {
  item: Item;
  organizationId: string;
  reload: () => Promise<void>;
  setMessage: (value: string) => void;
};

function Detail({ item, organizationId, reload, setMessage }: PanelProps) {
  const caps = obj(item._capabilities);
  async function transition(status: string) {
    if (!window.confirm(`Ubah status pertandingan menjadi ${text(status)}?`))
      return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/transition?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedVersion: item.version }),
      },
    );
    const result = await response.json();
    setMessage(response.ok ? "Status pertandingan diperbarui." : result.error);
    if (response.ok) await reload();
  }
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <article className="rounded-2xl border bg-surface/40 p-5">
        <h2 className="font-display text-xl font-bold">Kontrol pertandingan</h2>
        <p className="mt-2 text-sm text-muted">
          Transisi hanya tersedia jika sah menurut state machine.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {arr(item.availableTransitions).map((entry) => {
            const status = String(entry);
            const allowed =
              status === "FINISHED_PENDING_APPROVAL"
                ? caps["match.finish"]
                : caps["match.operate"];
            return allowed && status !== "OFFICIAL" ? (
              <button
                key={status}
                onClick={() => transition(status)}
                className="rounded-xl border px-4 py-2 text-sm font-bold hover:border-primary"
              >
                {text(status)}
              </button>
            ) : null;
          })}
        </div>
      </article>
      <article className="rounded-2xl border bg-surface/40 p-5">
        <h2 className="font-display text-xl font-bold">Informasi</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <Row
            label="Kickoff"
            value={
              item.kickoffAt
                ? new Date(String(item.kickoffAt)).toLocaleString("id-ID")
                : "—"
            }
          />
          <Row label="Venue" value={obj(item.venue).name} />
          <Row label="Timezone" value={item.timezone} />
          <Row label="Versi snapshot" value={item.version} />
        </dl>
      </article>
    </section>
  );
}

function Lineup({ item, organizationId, reload, setMessage }: PanelProps) {
  const teams = [obj(item.homeTeam), obj(item.awayTeam)] as Array<
    Record<string, unknown> & { id?: string }
  >;
  const [teamId, setTeamId] = useState(String(teams[0].id || ""));
  const [eligible, setEligible] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Record<string, "STARTER" | "SUBSTITUTE">>(
    {},
  );
  const [captainId, setCaptainId] = useState("");
  const [goalkeeperId, setGoalkeeperId] = useState("");
  useEffect(() => {
    if (!teamId) return;
    fetch(
      `/api/admin/phase4/matches/${item.id}/eligible?organizationId=${organizationId}&teamId=${teamId}`,
    )
      .then((r) => r.json())
      .then((r) => setEligible(r.data || []));
  }, [item.id, organizationId, teamId]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const players = eligible
      .filter((entry) => selected.has(String(obj(entry.player).id)))
      .map((entry, index) => ({
        registrationId: entry.id,
        playerId: String(obj(entry.player).id),
        role: roles[String(obj(entry.player).id)] || "STARTER",
        shirtNumber: Number(
          form.get(`shirt-${String(obj(entry.player).id)}`) ||
            entry.jerseyNumber ||
            index + 1,
        ),
        position: obj(entry.player).primaryPosition || undefined,
        isCaptain: captainId === String(obj(entry.player).id),
        isGoalkeeper: goalkeeperId === String(obj(entry.player).id),
      }));
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/lineups?organizationId=${organizationId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          formation: form.get("formation"),
          players,
          reason: form.get("reason") || undefined,
        }),
      },
    );
    const result = await response.json();
    setMessage(response.ok ? "Lineup tersimpan." : result.error);
    if (response.ok) await reload();
  }
  async function confirm() {
    if (
      !window.confirm(
        "Konfirmasi lineup? Perubahan berikutnya wajib memiliki alasan.",
      )
    )
      return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/lineups/confirm?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      },
    );
    const result = await response.json();
    setMessage(response.ok ? "Lineup dikonfirmasi." : result.error);
    if (response.ok) await reload();
  }
  return (
    <section className="mt-5 rounded-2xl border bg-surface/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Manajemen lineup</h2>
          <p className="mt-1 text-sm text-muted">
            Pilih pemain eligible dari roster musim aktif.
          </p>
        </div>
        <select
          value={teamId}
          onChange={(event) => {
            setTeamId(event.target.value);
            setSelected(new Set());
            setRoles({});
            setCaptainId("");
            setGoalkeeperId("");
          }}
          className="h-11 rounded-xl border bg-background px-3"
        >
          {teams.map((team) => (
            <option key={String(team.id)} value={String(team.id)}>
              {text(obj(team.club).name)}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={save}>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {eligible.map((entry) => {
            const player = obj(entry.player);
            const playerId = String(player.id);
            return (
              <div key={entry.id} className="rounded-xl border p-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${text(player.fullName)}`}
                    checked={selected.has(playerId)}
                    onChange={(event) => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(playerId);
                        else next.delete(playerId);
                        return next;
                      });
                      if (event.target.checked)
                        setRoles((current) => ({
                          ...current,
                          [playerId]: "STARTER",
                        }));
                      else {
                        if (captainId === playerId) setCaptainId("");
                        if (goalkeeperId === playerId) setGoalkeeperId("");
                      }
                    }}
                  />
                  <span>
                    <strong>{text(player.fullName)}</strong>
                    <small className="block text-muted">
                      #{text(entry.jerseyNumber)} ·{" "}
                      {text(player.primaryPosition)}
                    </small>
                  </span>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <select
                    aria-label={`Peran ${text(player.fullName)}`}
                    disabled={!selected.has(playerId)}
                    value={roles[playerId] || "STARTER"}
                    onChange={(event) =>
                      setRoles((current) => ({
                        ...current,
                        [playerId]: event.target.value as
                          "STARTER" | "SUBSTITUTE",
                      }))
                    }
                    className="h-9 rounded-lg border bg-background px-2 disabled:opacity-40"
                  >
                    <option value="STARTER">Starter</option>
                    <option value="SUBSTITUTE">Cadangan</option>
                  </select>
                  <input
                    name={`shirt-${playerId}`}
                    aria-label={`Nomor ${text(player.fullName)}`}
                    type="number"
                    min="1"
                    max="99"
                    disabled={!selected.has(playerId)}
                    defaultValue={Number(entry.jerseyNumber || 1)}
                    className="h-9 rounded-lg border bg-background px-2 disabled:opacity-40"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="captain"
                      disabled={!selected.has(playerId)}
                      checked={captainId === playerId}
                      onChange={() => setCaptainId(playerId)}
                    />
                    Kapten
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="goalkeeper"
                      disabled={!selected.has(playerId)}
                      checked={goalkeeperId === playerId}
                      onChange={() => setGoalkeeperId(playerId)}
                    />
                    Kiper
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {!eligible.length && (
          <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted">
            Belum ada pemain eligible pada tim ini.
          </p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            name="formation"
            required
            defaultValue="4-3-3"
            aria-label="Formasi"
            className="h-11 rounded-xl border bg-background px-3"
          />
          <input
            name="reason"
            aria-label="Alasan revisi"
            placeholder="Alasan revisi (jika dikonfirmasi)"
            className="h-11 rounded-xl border bg-background px-3"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-xl bg-primary px-5 py-2.5 font-bold text-background">
            Simpan lineup
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-xl border px-5 py-2.5 font-bold"
          >
            Konfirmasi
          </button>
        </div>
      </form>
    </section>
  );
}

function Live({ item, organizationId, reload, setMessage }: PanelProps) {
  const caps = obj(item._capabilities);
  const events = arr(item.events);
  async function quick(eventType: string) {
    const team = window.prompt(
      `Team ID untuk ${text(eventType)}:\nHome: ${obj(item.homeTeam).id}\nAway: ${obj(item.awayTeam).id}`,
      String(obj(item.homeTeam).id),
    );
    if (
      !team ||
      !window.confirm(`Catat ${text(eventType)} untuk tim terpilih?`)
    )
      return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/events?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          eventType,
          period: obj(item.clockState).period || "FIRST_HALF",
          teamId: team,
          minute: Number(window.prompt("Menit pertandingan:", "1") || 0),
          addedTime: 0,
          expectedVersion: item.version,
        }),
      },
    );
    const result = await response.json();
    setMessage(response.ok ? `${text(eventType)} tersimpan.` : result.error);
    if (response.ok) await reload();
  }
  async function undo(eventId: string) {
    const reason = window.prompt("Alasan koreksi/undo event:");
    if (
      !reason ||
      !window.confirm("Batalkan event ini? Skor akan dihitung ulang.")
    )
      return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/events/${eventId}?organizationId=${organizationId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isValid: false, reason }),
      },
    );
    const result = await response.json();
    setMessage(
      response.ok ? "Event dibatalkan dan skor dihitung ulang." : result.error,
    );
    if (response.ok) await reload();
  }
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
      <article className="rounded-2xl border bg-surface/40 p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Radio className="text-red-400" />
          Quick actions
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["GOAL", "Goal"],
            ["YELLOW_CARD", "Kartu kuning"],
            ["RED_CARD", "Kartu merah"],
            ["SUBSTITUTION", "Pergantian"],
          ].map(([type, label]) => (
            <button
              disabled={!caps["match.operate"]}
              key={type}
              onClick={() => quick(type)}
              className={`min-h-20 rounded-2xl border p-3 font-bold disabled:opacity-40 ${type === "GOAL" ? "bg-primary text-background" : type === "RED_CARD" ? "border-red-400/40 text-red-300" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Shield size={14} />
          Aksi kritis meminta konfirmasi sebelum dikirim.
        </p>
      </article>
      <article className="rounded-2xl border bg-surface/40 p-5">
        <h2 className="font-display text-xl font-bold">Event timeline</h2>
        <div className="mt-4 space-y-3">
          {events.length ? (
            events.toReversed().map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <p className="font-bold">
                    {text(event.eventType)} · {text(event.minute)}
                    {Number(event.addedTime) ? `+${event.addedTime}` : ""}&apos;
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {text(obj(event.team).name)} ·{" "}
                    {text(obj(event.player).fullName)}
                  </p>
                </div>
                {Boolean(caps["match.event.correct"]) && (
                  <button
                    onClick={() => undo(event.id)}
                    className="text-xs font-bold text-red-300"
                  >
                    Koreksi
                  </button>
                )}
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted">
              Belum ada event pertandingan.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

function Review({ item, organizationId, reload, setMessage }: PanelProps) {
  const caps = obj(item._capabilities);
  const events = arr(item.events);
  const lineups = arr(item.lineups);
  async function review(action: "approve" | "reject") {
    const notes =
      window.prompt(
        action === "approve"
          ? "Catatan approval (opsional):"
          : "Alasan penolakan:",
      ) || undefined;
    if (
      !window.confirm(
        action === "approve"
          ? "Sahkan hasil pertandingan sebagai OFFICIAL?"
          : "Kembalikan hasil untuk koreksi?",
      )
    )
      return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/review?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      },
    );
    const result = await response.json();
    setMessage(
      response.ok
        ? action === "approve"
          ? "Hasil resmi disahkan."
          : "Hasil dikembalikan untuk koreksi."
        : result.error,
    );
    if (response.ok) await reload();
  }
  async function requestCorrection() {
    const reason = window.prompt("Jelaskan alasan koreksi hasil resmi:");
    if (!reason) return;
    const response = await fetch(
      `/api/admin/phase4/matches/${item.id}/corrections?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const result = await response.json();
    setMessage(response.ok ? "Permintaan koreksi resmi dibuat." : result.error);
    if (response.ok) await reload();
  }
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-3">
      <article className="rounded-2xl border bg-surface/40 p-5">
        <Activity className="text-primary" />
        <h2 className="mt-3 font-display text-xl font-bold">Verifikasi skor</h2>
        <p className="mt-4 text-3xl font-black">
          {text(item.homeScore)} – {text(item.awayScore)}
        </p>
        <p className="mt-2 text-sm text-muted">
          Dihitung dari {events.length} event valid.
        </p>
      </article>
      <article className="rounded-2xl border bg-surface/40 p-5">
        <UsersRound className="text-primary" />
        <h2 className="mt-3 font-display text-xl font-bold">
          Verifikasi lineup
        </h2>
        <p className="mt-4 text-3xl font-black">
          {lineups.filter((entry) => entry.status === "CONFIRMED").length}/2
        </p>
        <p className="mt-2 text-sm text-muted">Lineup terkonfirmasi.</p>
      </article>
      <article className="rounded-2xl border bg-surface/40 p-5">
        <CheckCircle2 className="text-primary" />
        <h2 className="mt-3 font-display text-xl font-bold">Keputusan</h2>
        {item.status === "FINISHED_PENDING_APPROVAL" &&
        caps["match.approve"] ? (
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => review("approve")}
              className="rounded-xl bg-primary px-4 py-2.5 font-bold text-background"
            >
              Sahkan hasil
            </button>
            <button
              onClick={() => review("reject")}
              className="rounded-xl border border-red-400/40 px-4 py-2.5 font-bold text-red-300"
            >
              Tolak untuk koreksi
            </button>
          </div>
        ) : item.status === "OFFICIAL" && caps["match.official.correct"] ? (
          <button
            onClick={requestCorrection}
            className="mt-4 rounded-xl border px-4 py-2.5 font-bold"
          >
            Request correction
          </button>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Pertandingan belum siap untuk approval.
          </p>
        )}
      </article>
    </section>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-bold">{text(value)}</dd>
    </div>
  );
}
