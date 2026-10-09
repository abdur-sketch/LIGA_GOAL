"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import { useOrganization } from "./organization-context";

type Mode = "fixtures" | "generate" | "groups" | "brackets" | "schedule";
type Item = Record<string, unknown> & { id: string };
type Option = { id: string; name: string; [key: string]: unknown };
type Lookups = {
  competitions: Option[];
  seasons: Option[];
  stages: Option[];
  clubs: Option[];
  venues: Option[];
  officials: Array<{ id: string; fullName: string }>;
  capabilities?: Record<string, boolean>;
};
const empty: Lookups = {
  competitions: [],
  seasons: [],
  stages: [],
  clubs: [],
  venues: [],
  officials: [],
};
const titles = {
  fixtures: [
    "Fixture pertandingan",
    "Buat, ubah, tunda, dan batalkan pertandingan tanpa menghilangkan histori.",
  ],
  generate: [
    "Generator fixture",
    "Alur draft, preview, validation, lalu publish secara transaksional.",
  ],
  groups: [
    "Manajemen grup",
    "Atur grup, peserta, seed, dan drawing sebelum fixture dibuat.",
  ],
  brackets: [
    "Tournament bracket",
    "Bagan knockout responsif dengan slot bye dan progression source.",
  ],
  schedule: [
    "Kalender pertandingan",
    "Jadwal terbit dengan indikator venue, kickoff, dan status pertandingan.",
  ],
} as const;
const obj = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const arr = (value: unknown) =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
const text = (value: unknown) => String(value ?? "—").replaceAll("_", " ");
async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
  return result;
}

export function Phase3Console({ mode }: { mode: Mode }) {
  const { organizationId, loading: orgLoading } = useOrganization();
  const [lookup, setLookup] = useState<Lookups>(empty);
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [caps, setCaps] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<Item>();
  const [stageId, setStageId] = useState("");
  const resource = mode === "generate" ? "generations" : mode;
  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        organizationId,
        page: String(page),
        pageSize: "20",
        search,
      });
      if (status) params.set("status", status);
      if (stageId && mode === "groups") params.set("stageId", stageId);
      if (mode === "brackets") {
        if (stageId) {
          const result = await api(
            `/api/admin/phase3/brackets/${stageId}?${params}`,
          );
          setItems(result.data.ties);
          setSelected(result.data.stage);
        } else setItems([]);
      } else {
        const result = await api(`/api/admin/phase3/${resource}?${params}`);
        setItems(result.data);
        setMeta(
          result.meta || { page: 1, totalPages: 1, total: result.data.length },
        );
        setCaps(result.capabilities || {});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Data gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [mode, organizationId, page, resource, search, stageId, status]);
  useEffect(() => {
    const timeout = window.setTimeout(load, 100);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    if (!organizationId) return;
    api(`/api/admin/phase3/lookups?organizationId=${organizationId}`)
      .then((result) => {
        setLookup(result.data);
        setCaps((current) => ({ ...current, ...result.data.capabilities }));
        if (mode === "brackets" && !stageId)
          setStageId(
            result.data.stages.find(
              (stage: Option) => stage.type === "KNOCKOUT",
            )?.id || "",
          );
      })
      .catch(() => undefined);
  }, [mode, organizationId, stageId]);
  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 4500);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      if (modal === "fixture") await createFixture(form);
      else if (modal === "stage") await createStage(form);
      else if (modal === "generate") await generate(form);
      else if (modal === "group") await createGroup(form);
      else if (modal === "draw") await drawGroups(form);
      else if (modal === "bracket") await createBracket(form);
      setModal("");
      notice("Data berhasil disimpan.");
      await load();
    } catch (cause) {
      notice(cause instanceof Error ? cause.message : "Perubahan gagal.");
    }
  }
  async function createFixture(form: FormData) {
    await api(`/api/admin/phase3/fixtures?organizationId=${organizationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: form.get("competitionId"),
        seasonId: form.get("seasonId"),
        stageId: form.get("stageId"),
        groupId: null,
        homeClubId: form.get("homeClubId"),
        awayClubId: form.get("awayClubId"),
        venueId: form.get("venueId") || null,
        refereeId: form.get("refereeId") || null,
        kickoffAt: form.get("kickoffAt")
          ? new Date(String(form.get("kickoffAt"))).toISOString()
          : null,
        timezone: "Asia/Jakarta",
      }),
    });
  }
  async function createStage(form: FormData) {
    await api(`/api/admin/phase3/stages?organizationId=${organizationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seasonId: form.get("seasonId"),
        name: form.get("name"),
        sortOrder: Number(form.get("sortOrder")),
        type: form.get("type"),
        format: form.get("format"),
        settings: {},
      }),
    });
  }
  async function generate(form: FormData) {
    const clubs = form.getAll("clubIds").map(String).filter(Boolean);
    await api(
      `/api/admin/phase3/generations?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId: form.get("competitionId"),
          seasonId: form.get("seasonId"),
          stageId: form.get("stageId"),
          format: form.get("format"),
          drawMethod: form.get("drawMethod"),
          clubIds: clubs.length ? clubs : undefined,
          idempotencyKey: crypto.randomUUID(),
          kickoffStart: form.get("kickoffStart")
            ? new Date(String(form.get("kickoffStart"))).toISOString()
            : null,
          daysBetweenRounds: Number(form.get("daysBetweenRounds") || 7),
          venueIds: form.get("venueId") ? [String(form.get("venueId"))] : [],
          refereeIds: form.get("refereeId")
            ? [String(form.get("refereeId"))]
            : [],
          config: {
            numberOfGroups: 1,
            qualifiersPerGroup: 1,
            rounds: form.get("format") === "DOUBLE_ROUND_ROBIN" ? 2 : 1,
            homeAway: form.get("format") === "DOUBLE_ROUND_ROBIN",
            drawMethod: form.get("drawMethod"),
            tieBreakers: ["points", "goal_difference", "goals_for"],
            knockoutLegs: 1,
            extraTime: true,
            penaltyShootout: true,
            thirdPlace: false,
            minimumRestHours: 24,
            matchDurationMinutes: 120,
            timezone: "Asia/Jakarta",
          },
        }),
      },
    );
  }
  async function createGroup(form: FormData) {
    await api(`/api/admin/phase3/groups?organizationId=${organizationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageId: form.get("stageId"),
        name: form.get("name"),
        confirmPublishedChange: false,
      }),
    });
  }
  async function drawGroups(form: FormData) {
    await api(
      `/api/admin/phase3/groups/${form.get("stageId")}/draw?organizationId=${organizationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubIds: form.getAll("clubIds").map(String),
          seeded: form.get("seeded") === "on",
          confirmPublishedChange: false,
        }),
      },
    );
  }
  async function createBracket(form: FormData) {
    const clubIds = form.getAll("clubIds").map(String).filter(Boolean);
    await api(`/api/admin/phase3/brackets?organizationId=${organizationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitionId: form.get("competitionId"),
        stageId: form.get("stageId"),
        clubIds,
        seeded: form.get("seeded") === "on",
        legs: Number(form.get("legs") || 1),
        thirdPlace: form.get("thirdPlace") === "on",
      }),
    });
    setStageId(String(form.get("stageId")));
  }
  async function generationAction(id: string, action: "validate" | "publish") {
    try {
      const body =
        action === "publish" ? { idempotencyKey: crypto.randomUUID() } : {};
      await api(
        `/api/admin/phase3/generations/${id}/${action}?organizationId=${organizationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      notice(
        action === "publish"
          ? "Fixture berhasil diterbitkan."
          : "Validasi selesai.",
      );
      await load();
    } catch (cause) {
      notice(cause instanceof Error ? cause.message : "Aksi gagal.");
    }
  }
  async function openPreview(id: string) {
    try {
      setSelected(
        (
          await api(
            `/api/admin/phase3/generations/${id}?organizationId=${organizationId}`,
          )
        ).data,
      );
    } catch (cause) {
      notice(cause instanceof Error ? cause.message : "Preview gagal dimuat.");
    }
  }
  async function assignClub(groupId: string, clubId: string) {
    if (!clubId) return;
    try {
      await api(
        `/api/admin/phase3/groups/${groupId}/members?organizationId=${organizationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clubId, confirmPublishedChange: false }),
        },
      );
      notice("Klub ditambahkan ke grup.");
      await load();
    } catch (cause) {
      notice(cause instanceof Error ? cause.message : "Gagal menambah klub.");
    }
  }
  const knockoutStages = lookup.stages.filter(
    (stage) => stage.type === "KNOCKOUT",
  );
  return (
    <section className="rounded-2xl border bg-surface/45 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{titles[mode][0]}</h1>
          <p className="mt-1 text-sm text-muted">{titles[mode][1]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "fixtures" &&
            (caps["fixture.generate"] || caps["fixture.create"]) && (
              <>
                {caps["fixture.generate"] && (
                  <Link
                    href="/admin/fixtures/generate"
                    className="inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold"
                  >
                    <Send size={16} />
                    Generator
                  </Link>
                )}
                {caps["fixture.create"] && (
                  <Primary
                    onClick={() => setModal("fixture")}
                    label="Fixture manual"
                  />
                )}
              </>
            )}
          {mode === "generate" && (
            <>
              {caps["fixture.create"] && (
                <Primary onClick={() => setModal("stage")} label="Buat stage" />
              )}
              {caps["fixture.generate"] && (
                <Primary
                  onClick={() => setModal("generate")}
                  label="Generate preview"
                />
              )}
            </>
          )}
          {mode === "groups" && (caps.manage || caps["group.manage"]) && (
            <>
              <Primary onClick={() => setModal("group")} label="Buat grup" />
              <Primary onClick={() => setModal("draw")} label="Auto draw" />
            </>
          )}
          {mode === "brackets" && caps["bracket.manage"] && (
            <Primary onClick={() => setModal("bracket")} label="Buat bracket" />
          )}
        </div>
      </div>
      {mode === "brackets" && (
        <select
          aria-label="Stage bracket"
          value={stageId}
          onChange={(event) => setStageId(event.target.value)}
          className="mt-5 h-11 rounded-xl border bg-background px-4"
        >
          <option value="">Pilih stage knockout</option>
          {knockoutStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      )}
      {mode !== "brackets" && (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border px-4">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari…"
              className="w-full bg-transparent outline-none"
            />
          </label>
          {["fixtures", "generate"].includes(mode) && (
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border bg-background px-4"
            >
              <option value="">Semua status</option>
              {(mode === "generate"
                ? ["PREVIEW", "VALIDATED", "PUBLISHED"]
                : ["DRAFT", "SCHEDULED", "POSTPONED", "CANCELLED"]
              ).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}
        </div>
      )}
      {error ? (
        <ErrorState message={error} retry={load} />
      ) : loading || orgLoading ? (
        <Loading />
      ) : mode === "brackets" ? (
        <BracketView ties={items} />
      ) : mode === "schedule" ? (
        <ScheduleView items={items} />
      ) : mode === "groups" ? (
        <GroupView items={items} clubs={lookup.clubs} assign={assignClub} />
      ) : mode === "generate" ? (
        <GenerationView
          items={items}
          open={openPreview}
          action={generationAction}
          capabilities={caps}
        />
      ) : (
        <FixtureView items={items} />
      )}
      {mode !== "brackets" && items.length > 0 && (
        <div className="mt-5 flex items-center justify-between text-sm text-muted">
          <span>{meta.total} data</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="grid size-9 place-items-center rounded-lg border disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {meta.page}/{meta.totalPages}
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="grid size-9 place-items-center rounded-lg border disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      {selected && mode === "generate" && (
        <PreviewModal
          item={selected}
          close={() => setSelected(undefined)}
          action={generationAction}
          capabilities={caps}
        />
      )}{" "}
      {modal && (
        <FormModal
          mode={modal}
          lookup={lookup}
          submit={submit}
          close={() => setModal("")}
        />
      )}{" "}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border bg-surface px-5 py-4 text-sm shadow-2xl"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
function Primary({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-background"
    >
      <Plus size={16} />
      {label}
    </button>
  );
}
function Loading() {
  return (
    <div className="mt-6 space-y-3">
      {[1, 2, 3].map((value) => (
        <div key={value} className="h-18 animate-pulse rounded-xl bg-white/5" />
      ))}
    </div>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-red-400/20 p-5 text-red-300">
      {message}
      <button onClick={retry} className="ml-3 font-bold underline">
        Coba lagi
      </button>
    </div>
  );
}
function FixtureView({ items }: { items: Item[] }) {
  if (!items.length) return <Empty />;
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-200 text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-muted">
            <th className="p-3">#</th>
            <th className="p-3">Pertandingan</th>
            <th className="p-3">Kickoff</th>
            <th className="p-3">Venue</th>
            <th className="p-3">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-white/5">
              <td className="p-3">{text(item.matchNumber)}</td>
              <td className="p-3 font-bold">
                {text(obj(obj(item.homeTeam).club).name)}{" "}
                <span className="text-muted">vs</span>{" "}
                {text(obj(obj(item.awayTeam).club).name)}
              </td>
              <td className="p-3">
                {item.kickoffAt
                  ? new Date(String(item.kickoffAt)).toLocaleString("id-ID")
                  : "Belum diatur"}
              </td>
              <td className="p-3">{text(obj(item.venue).name)}</td>
              <td className="p-3 capitalize">
                {text(item.status).toLowerCase()}
              </td>
              <td className="p-3 text-right">
                <Link
                  href={`/admin/fixtures/${item.id}`}
                  className="font-bold text-primary"
                >
                  Detail
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function GenerationView({
  items,
  open,
  action,
  capabilities,
}: {
  items: Item[];
  open: (id: string) => void;
  action: (id: string, action: "validate" | "publish") => void;
  capabilities: Record<string, boolean>;
}) {
  if (!items.length) return <Empty />;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-primary">
                {text(item.format)}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold">
                {text(obj(item.stage).name)}
              </h3>
              <p className="text-sm text-muted">
                {text(obj(item.season).name)} · {text(obj(item._count).drafts)}{" "}
                pertandingan
              </p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs">
              {text(item.status)}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => open(item.id)}
              className="rounded-lg border px-3 py-2 text-sm font-bold"
            >
              Preview
            </button>
            {item.status === "PREVIEW" && capabilities["fixture.generate"] && (
              <button
                onClick={() => action(item.id, "validate")}
                className="rounded-lg border px-3 py-2 text-sm font-bold text-primary"
              >
                Validasi
              </button>
            )}
            {item.status === "VALIDATED" && capabilities["fixture.publish"] && (
              <button
                onClick={() => action(item.id, "publish")}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-background"
              >
                Publish
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
function GroupView({
  items,
  clubs,
  assign,
}: {
  items: Item[];
  clubs: Option[];
  assign: (group: string, club: string) => void;
}) {
  if (!items.length) return <Empty />;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border p-5">
          <h3 className="font-display text-lg font-bold">{text(item.name)}</h3>
          <p className="text-xs text-muted">
            {text(obj(item.stage).name)} ·{" "}
            {text(obj(obj(item.stage).season).name)}
          </p>
          <div className="mt-4 space-y-2">
            {arr(item.memberships).map((member) => (
              <div
                key={String(member.id)}
                className="rounded-lg bg-white/5 px-3 py-2 text-sm"
              >
                {text(obj(member.club).name)}
                {member.seed ? ` · seed ${member.seed}` : ""}
              </div>
            ))}
          </div>
          <select
            aria-label={`Tambah klub ke ${item.name}`}
            defaultValue=""
            onChange={(event) => {
              assign(item.id, event.target.value);
              event.target.value = "";
            }}
            className="mt-4 h-10 w-full rounded-lg border bg-background px-3"
          >
            <option value="">Tambah klub…</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </article>
      ))}
    </div>
  );
}
function BracketView({ ties }: { ties: Item[] }) {
  if (!ties.length) return <Empty text="Pilih stage atau buat bracket baru." />;
  const rounds = [...new Set(ties.map((tie) => Number(tie.round)))];
  return (
    <div className="mt-6 overflow-x-auto pb-4">
      <div className="flex min-w-max gap-6">
        {rounds.map((round) => (
          <section key={round} className="w-70 shrink-0">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">
              Round {round}
            </h3>
            <div className="flex flex-col justify-around gap-5">
              {ties
                .filter((tie) => Number(tie.round) === round)
                .map((tie) => (
                  <article
                    key={tie.id}
                    className="rounded-xl border bg-background/40 p-4"
                  >
                    <p className="mb-3 text-xs font-bold text-primary">
                      {text(tie.label)} {text(tie.position)}
                    </p>
                    {arr(tie.slots).map((slot) => (
                      <div
                        key={String(slot.id)}
                        className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                      >
                        {obj(slot.club).logoUrl ? (
                          <span
                            role="img"
                            aria-label={`Logo ${text(obj(slot.club).name)}`}
                            className="size-7 rounded-full border bg-cover bg-center"
                            style={{
                              backgroundImage: `url(${String(obj(slot.club).logoUrl)})`,
                            }}
                          />
                        ) : (
                          <span className="grid size-7 place-items-center rounded-full border text-[10px]">
                            {text(obj(slot.club).name).slice(0, 2)}
                          </span>
                        )}
                        <span>
                          {obj(slot.club).name
                            ? text(obj(slot.club).name)
                            : text(slot.sourceLabel)}
                        </span>
                      </div>
                    ))}
                    <p className="mt-3 text-xs capitalize text-muted">
                      {text(tie.status).toLowerCase()}
                    </p>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
function ScheduleView({ items }: { items: Item[] }) {
  const grouped = useMemo(
    () =>
      Map.groupBy(items, (item) =>
        item.kickoffAt
          ? new Date(String(item.kickoffAt)).toLocaleDateString("id-ID", {
              dateStyle: "full",
            })
          : "Belum dijadwalkan",
      ),
    [items],
  );
  if (!items.length) return <Empty />;
  return (
    <div className="mt-6 space-y-6">
      {[...grouped].map(([date, matches]) => (
        <section key={date}>
          <h3 className="mb-3 font-display text-lg font-bold">{date}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {matches.map((match) => (
              <article key={match.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">
                    {text(obj(obj(match.homeTeam).club).name)}{" "}
                    <span className="text-muted">vs</span>{" "}
                    {text(obj(obj(match.awayTeam).club).name)}
                  </p>
                  <span className="text-xs text-primary">
                    {match.kickoffAt
                      ? new Date(String(match.kickoffAt)).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" },
                        )
                      : "—"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {text(obj(match.venue).name)} · {text(match.status)}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
function PreviewModal({
  item,
  close,
  action,
  capabilities,
}: {
  item: Item;
  close: () => void;
  action: (id: string, action: "validate" | "publish") => void;
  capabilities: Record<string, boolean>;
}) {
  const warnings = arr(item.warnings);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Preview fixture</h2>
            <p className="text-sm text-muted">
              {text(item.fixtureCount)} pertandingan · {text(item.roundCount)}{" "}
              round
            </p>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {warnings.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
            <AlertTriangle className="mr-2 inline" size={16} />
            {warnings.length} konflik atau warning ditemukan.
          </div>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <tbody>
              {arr(item.drafts).map((draft) => (
                <tr key={String(draft.id)} className="border-b">
                  <td className="p-3">R{String(draft.round)}</td>
                  <td className="p-3 font-bold">
                    {text(obj(draft.homeClub).name)} vs{" "}
                    {text(obj(draft.awayClub).name)}
                  </td>
                  <td className="p-3">
                    {draft.kickoffAt
                      ? new Date(String(draft.kickoffAt)).toLocaleString(
                          "id-ID",
                        )
                      : "Tanpa kickoff"}
                  </td>
                  <td className="p-3">{text(obj(draft.venue).name)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {item.status === "PREVIEW" && capabilities["fixture.generate"] && (
            <button
              onClick={() => action(item.id, "validate")}
              className="rounded-xl border px-4 py-2 font-bold"
            >
              Validasi
            </button>
          )}
          {item.status === "VALIDATED" && capabilities["fixture.publish"] && (
            <button
              onClick={() => {
                if (window.confirm("Publikasikan fixture ini?"))
                  action(item.id, "publish");
              }}
              className="rounded-xl bg-primary px-4 py-2 font-bold text-background"
            >
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function FormModal({
  mode,
  lookup,
  submit,
  close,
}: {
  mode: string;
  lookup: Lookups;
  submit: (event: React.FormEvent<HTMLFormElement>) => void;
  close: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-surface p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            {mode === "fixture"
              ? "Fixture manual"
              : mode === "stage"
                ? "Stage baru"
                : mode === "generate"
                  ? "Generate preview"
                  : mode === "group"
                    ? "Grup baru"
                    : mode === "draw"
                      ? "Automatic group draw"
                      : "Bracket baru"}
          </h2>
          <button type="button" onClick={close}>
            <X />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {mode === "stage" ? (
            <StageFields lookup={lookup} />
          ) : mode === "fixture" ? (
            <FixtureFields lookup={lookup} />
          ) : mode === "generate" ? (
            <GenerateFields lookup={lookup} />
          ) : mode === "group" ? (
            <GroupFields lookup={lookup} />
          ) : mode === "draw" ? (
            <DrawFields lookup={lookup} />
          ) : (
            <BracketFields lookup={lookup} />
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="h-11 rounded-xl border px-5 font-bold"
          >
            Batal
          </button>
          <button className="h-11 rounded-xl bg-primary px-5 font-bold text-background">
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
}
const Field = ({
  name,
  label,
  type = "text",
  required = true,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
}) => (
  <label className="text-sm font-bold">
    {label}
    <input
      name={name}
      type={type}
      required={required}
      defaultValue={defaultValue}
      className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
    />
  </label>
);
const Select = ({
  name,
  label,
  items,
  required = true,
}: {
  name: string;
  label: string;
  items: Array<[string, string]>;
  required?: boolean;
}) => (
  <label className="text-sm font-bold">
    {label}
    <select
      name={name}
      required={required}
      className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-normal"
    >
      <option value="">Pilih…</option>
      {items.map(([value, labelText]) => (
        <option key={value} value={value}>
          {labelText}
        </option>
      ))}
    </select>
  </label>
);
function StageFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="seasonId"
        label="Musim"
        items={lookup.seasons.map((item) => [item.id, item.name])}
      />
      <Field name="name" label="Nama stage" />
      <Field name="sortOrder" label="Urutan" type="number" defaultValue={1} />
      <Select
        name="type"
        label="Jenis"
        items={[
          ["ROUND_ROBIN", "Round robin"],
          ["GROUP", "Group"],
          ["KNOCKOUT", "Knockout"],
        ]}
      />
      <Select
        name="format"
        label="Format"
        items={[
          ["SINGLE_ROUND_ROBIN", "Single round robin"],
          ["DOUBLE_ROUND_ROBIN", "Double round robin"],
          ["GROUP_STAGE", "Group stage"],
          ["SINGLE_ELIMINATION", "Single elimination"],
          ["GROUP_AND_KNOCKOUT", "Group + knockout"],
        ]}
      />
    </>
  );
}
function FixtureFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="competitionId"
        label="Kompetisi"
        items={lookup.competitions.map((item) => [item.id, item.name])}
      />
      <Select
        name="seasonId"
        label="Musim"
        items={lookup.seasons.map((item) => [item.id, item.name])}
      />
      <Select
        name="stageId"
        label="Stage"
        items={lookup.stages.map((item) => [item.id, item.name])}
      />
      <Select
        name="homeClubId"
        label="Klub home"
        items={lookup.clubs.map((item) => [item.id, item.name])}
      />
      <Select
        name="awayClubId"
        label="Klub away"
        items={lookup.clubs.map((item) => [item.id, item.name])}
      />
      <Select
        name="venueId"
        label="Venue"
        required={false}
        items={lookup.venues.map((item) => [item.id, item.name])}
      />
      <Select
        name="refereeId"
        label="Wasit"
        required={false}
        items={lookup.officials.map((item) => [item.id, item.fullName])}
      />
      <Field
        name="kickoffAt"
        label="Kickoff"
        type="datetime-local"
        required={false}
      />
    </>
  );
}
function GenerateFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="competitionId"
        label="Kompetisi"
        items={lookup.competitions.map((item) => [item.id, item.name])}
      />
      <Select
        name="seasonId"
        label="Musim"
        items={lookup.seasons.map((item) => [item.id, item.name])}
      />
      <Select
        name="stageId"
        label="Stage"
        items={lookup.stages.map((item) => [item.id, item.name])}
      />
      <Select
        name="format"
        label="Format"
        items={[
          ["SINGLE_ROUND_ROBIN", "Single round robin"],
          ["DOUBLE_ROUND_ROBIN", "Double round robin"],
          ["GROUP_STAGE", "Group stage"],
          ["SINGLE_ELIMINATION", "Single elimination"],
        ]}
      />
      <Select
        name="drawMethod"
        label="Draw"
        items={[
          ["RANDOM", "Random"],
          ["SEEDED", "Seeded"],
          ["MANUAL", "Manual"],
        ]}
      />
      <Select
        name="venueId"
        label="Venue awal"
        required={false}
        items={lookup.venues.map((item) => [item.id, item.name])}
      />
      <Select
        name="refereeId"
        label="Wasit awal"
        required={false}
        items={lookup.officials.map((item) => [item.id, item.fullName])}
      />
      <Field
        name="kickoffStart"
        label="Kickoff pertama"
        type="datetime-local"
        required={false}
      />
      <Field
        name="daysBetweenRounds"
        label="Jeda antar round (hari)"
        type="number"
        defaultValue={7}
      />
      <label className="text-sm font-bold sm:col-span-2">
        Klub peserta
        <select
          name="clubIds"
          multiple
          required
          className="mt-2 h-40 w-full rounded-xl border bg-background p-3 font-normal"
        >
          {lookup.clubs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-muted">
          Gunakan Ctrl/Cmd untuk memilih beberapa klub.
        </span>
      </label>
    </>
  );
}
function GroupFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="stageId"
        label="Stage grup"
        items={lookup.stages
          .filter((item) => item.type === "GROUP")
          .map((item) => [item.id, item.name])}
      />
      <Field name="name" label="Nama grup" />
    </>
  );
}
function DrawFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="stageId"
        label="Stage grup"
        items={lookup.stages
          .filter((item) => item.type === "GROUP")
          .map((item) => [item.id, item.name])}
      />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input name="seeded" type="checkbox" />
        Gunakan urutan seed
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Klub
        <select
          name="clubIds"
          multiple
          required
          className="mt-2 h-44 w-full rounded-xl border bg-background p-3 font-normal"
        >
          {lookup.clubs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
function BracketFields({ lookup }: { lookup: Lookups }) {
  return (
    <>
      <Select
        name="competitionId"
        label="Kompetisi"
        items={lookup.competitions.map((item) => [item.id, item.name])}
      />
      <Select
        name="stageId"
        label="Stage knockout"
        items={lookup.stages
          .filter((item) => item.type === "KNOCKOUT")
          .map((item) => [item.id, item.name])}
      />
      <Select
        name="legs"
        label="Jumlah leg"
        items={[
          ["1", "Satu leg"],
          ["2", "Dua leg"],
        ]}
      />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input name="seeded" type="checkbox" />
        Seeded bracket
      </label>
      <label className="flex items-center gap-2 text-sm font-bold">
        <input name="thirdPlace" type="checkbox" />
        Third-place match
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Klub
        <select
          name="clubIds"
          multiple
          required
          className="mt-2 h-40 w-full rounded-xl border bg-background p-3 font-normal"
        >
          {lookup.clubs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
function Empty({ text: message = "Belum ada data." }: { text?: string }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted">
      {message}
    </div>
  );
}
