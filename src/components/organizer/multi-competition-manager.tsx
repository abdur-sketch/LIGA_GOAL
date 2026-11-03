"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, Plus, Scale, Trophy, Users } from "lucide-react";

type Template = { id: string; code: string; name: string; description: string; kind: string; participantMode: string; scoringMethod: string };
type Participant = { id: string; name: string; type: string; slug: string };
type Entry = { id: string; participant: { id: string; name: string; type: string } };
type Session = { id: string; name: string; sequence: number; status: string; entries: Array<{ entryId: string }> };
type Criterion = { id: string; name: string; code: string; weight: number; maxScore: number | null };
type Competition = {
  id: string; name: string; status: string; parentCompetitionId: string | null;
  genericProfile: { kind: string; participantMode: string; scoringMethod: string; template: { code: string; name: string } | null } | null;
  genericEntries: Entry[]; genericSessions: Session[]; scoringCriteria: Criterion[];
  _count: { genericEntries: number; genericSessions: number; branches: number };
};

type Props = { organization: { id: string; name: string }; templates: Template[]; competitions: Competition[]; participants: Participant[] };

function value(form: FormData, key: string) { return String(form.get(key) || ""); }
function optional(form: FormData, key: string) { return value(form, key) || undefined; }
function token(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }

export function MultiCompetitionManager({ organization, templates, competitions, participants }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(competitions[0]?.id ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const selected = useMemo(() => competitions.find((item) => item.id === selectedId), [competitions, selectedId]);

  async function submit(action: string, data: Record<string, unknown>, form?: HTMLFormElement) {
    setPending(action); setMessage(null);
    try {
      const response = await fetch("/api/organizer/competitions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Permintaan gagal.");
      if (action === "create-competition" && payload.data?.id) setSelectedId(String(payload.data.id));
      form?.reset(); setMessage({ type: "ok", text: "Perubahan tersimpan dan audit trail dibuat." }); router.refresh();
    } catch (error) { setMessage({ type: "error", text: error instanceof Error ? error.message : "Permintaan gagal." }); }
    finally { setPending(null); }
  }

  return <div className="space-y-8">
    {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.type === "ok" ? "border-primary/30 bg-primary/10 text-primary" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{message.text}</div>}

    <section className="rounded-3xl border bg-surface/60 p-6">
      <div className="flex items-start gap-4"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Plus /></span><div><h2 className="font-display text-xl font-bold">Buat lomba dari template</h2><p className="mt-1 text-sm text-muted">Pilih jenis lomba. Sistem menyiapkan mode peserta, metode penilaian, dan kriteria awal tanpa mengubah modul sepak bola.</p></div></div>
      <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("create-competition", { organizationId: organization.id, templateCode: value(form, "templateCode"), name: value(form, "name"), slug: value(form, "slug"), description: optional(form, "description"), category: optional(form, "category"), location: optional(form, "location"), parentCompetitionId: optional(form, "parentCompetitionId"), startsAt: optional(form, "startsAt"), endsAt: optional(form, "endsAt"), idempotencyKey: token("competition") }, event.currentTarget); }}>
        <label className="md:col-span-2"><span className="label">Template</span><select className="field" name="templateCode" required>{templates.map((item) => <option value={item.code} key={item.id}>{item.name} — {item.participantMode} / {item.scoringMethod}</option>)}</select></label>
        <label><span className="label">Nama lomba</span><input className="field" name="name" required minLength={3} maxLength={160} placeholder="LCT Tingkat Kabupaten 2026" /></label>
        <label><span className="label">Slug</span><input className="field" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="lct-kabupaten-2026" /></label>
        <label className="md:col-span-2"><span className="label">Deskripsi</span><textarea className="field min-h-24" name="description" maxLength={4000} /></label>
        <label><span className="label">Kategori</span><input className="field" name="category" placeholder="LCT / Akademik / Seni" /></label>
        <label><span className="label">Lokasi</span><input className="field" name="location" placeholder="Kabupaten / sekolah / venue" /></label>
        <label><span className="label">Acara induk (opsional)</span><select className="field" name="parentCompetitionId"><option value="">Bukan cabang</option>{competitions.filter((item) => item.genericProfile?.kind === "FESTIVAL").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Mulai</span><input className="field" type="date" name="startsAt" /></label><label><span className="label">Selesai</span><input className="field" type="date" name="endsAt" /></label></div>
        <button className="btn-primary md:col-span-2" disabled={pending !== null}>{pending === "create-competition" ? "Membuat…" : "Buat kompetisi"}</button>
      </form>
    </section>

    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {competitions.map((competition) => <button type="button" key={competition.id} onClick={() => setSelectedId(competition.id)} className={`rounded-2xl border p-5 text-left transition ${selectedId === competition.id ? "border-primary bg-primary/10" : "bg-surface/60 hover:border-primary/40"}`}><div className="flex items-center justify-between gap-3"><strong className="font-display">{competition.name}</strong><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold">{competition.genericProfile?.template?.name || "Sepak Bola"}</span></div><p className="mt-3 text-xs text-muted">{competition._count.genericEntries} peserta · {competition._count.genericSessions} sesi · {competition._count.branches} cabang</p></button>)}
      {!competitions.length && <p className="text-sm text-muted">Belum ada kompetisi.</p>}
    </section>

    {selected && <>
      <div className="rounded-2xl border bg-navy/70 p-5"><p className="text-xs font-bold uppercase tracking-widest text-primary">Workspace lomba</p><h2 className="mt-2 font-display text-2xl font-bold">{selected.name}</h2><p className="mt-2 text-sm text-muted">{selected.genericProfile?.kind} · {selected.genericProfile?.participantMode} · {selected.genericProfile?.scoringMethod}</p></div>
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel icon={<Users />} title="Master peserta" description="Simpan individu, regu, atau instansi sekali lalu daftarkan ke cabang lomba.">
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("create-participant", { organizationId: organization.id, type: value(form, "type"), name: value(form, "name"), slug: value(form, "slug"), displayName: optional(form, "displayName"), institution: optional(form, "institution"), contactEmail: optional(form, "contactEmail"), contactPhone: optional(form, "contactPhone") }, event.currentTarget); }}><select className="field" name="type"><option value="TEAM">Regu / tim</option><option value="INDIVIDUAL">Individu</option><option value="INSTITUTION">Sekolah / instansi</option></select><input className="field" name="name" required placeholder="Nama peserta atau regu" /><input className="field" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="slug-peserta" /><input className="field" name="institution" placeholder="Asal sekolah / instansi" /><button className="btn-secondary" disabled={pending !== null}>Tambah peserta</button></form>
        </Panel>
        <Panel icon={<ClipboardList />} title="Pendaftaran peserta" description="Hubungkan master peserta ke kompetisi terpilih dengan pemeriksaan mode individu/tim.">
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("register-entry", { organizationId: organization.id, competitionId: selected.id, participantId: value(form, "participantId"), entryName: optional(form, "entryName"), idempotencyKey: token("entry") }, event.currentTarget); }}><select className="field" name="participantId" required><option value="">Pilih peserta</option>{participants.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.type}</option>)}</select><input className="field" name="entryName" placeholder="Nama tampil khusus (opsional)" /><button className="btn-secondary" disabled={pending !== null}>Daftarkan ke lomba</button></form>
          <ul className="mt-4 space-y-2 text-sm">{selected.genericEntries.map((entry) => <li className="rounded-lg border px-3 py-2" key={entry.id}>{entry.participant.name} <span className="text-xs text-muted">· {entry.participant.type}</span></li>)}</ul>
        </Panel>
        <Panel icon={<CalendarDays />} title="Babak, sesi, dan agenda" description="Bisa dipakai untuk babak LCT, sesi penjurian, presentasi, atau agenda Gebyar.">
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("create-session", { organizationId: organization.id, competitionId: selected.id, name: value(form, "name"), sequence: Number(value(form, "sequence")), startsAt: optional(form, "startsAt"), endsAt: optional(form, "endsAt"), entryIds: form.getAll("entryIds").map(String) }, event.currentTarget); }}><input className="field" name="name" required placeholder="Penyisihan / Final / Penampilan 1" /><input className="field" type="number" min={1} name="sequence" required placeholder="Urutan" /><div className="grid gap-2 rounded-xl border p-3">{selected.genericEntries.map((entry) => <label className="flex items-center gap-2 text-sm" key={entry.id}><input type="checkbox" name="entryIds" value={entry.id} />{entry.participant.name}</label>)}</div><div className="grid grid-cols-2 gap-3"><input className="field" type="datetime-local" name="startsAt" /><input className="field" type="datetime-local" name="endsAt" /></div><button className="btn-secondary" disabled={pending !== null}>Tambah sesi</button></form>
          <ul className="mt-4 space-y-2 text-sm">{selected.genericSessions.map((session) => <li className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" key={session.id}><span>{session.sequence}. {session.name} <span className="text-xs text-muted">· {session.status}</span></span><button type="button" className="text-xs font-bold text-primary hover:underline" disabled={pending !== null} onClick={() => void submit("publish-session", { organizationId: organization.id, competitionId: selected.id, sessionId: session.id })}>Terbitkan</button></li>)}</ul>
        </Panel>
        <Panel icon={<Scale />} title="Kriteria penilaian" description="Bobot dapat digunakan untuk rubrik juri; LCT dapat memakai event nilai dan penalti.">
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("create-criterion", { organizationId: organization.id, competitionId: selected.id, name: value(form, "name"), code: value(form, "code"), weight: Number(value(form, "weight")), maxScore: optional(form, "maxScore") }, event.currentTarget); }}><input className="field" name="name" required placeholder="Kreativitas / Jawaban benar" /><input className="field" name="code" required pattern="[A-Za-z0-9_]{2,40}" placeholder="KREATIVITAS" /><div className="grid grid-cols-2 gap-3"><input className="field" name="weight" type="number" step="0.01" min="0.01" defaultValue="1" /><input className="field" name="maxScore" type="number" step="0.01" min="0.01" placeholder="Nilai maksimum" /></div><button className="btn-secondary" disabled={pending !== null}>Tambah kriteria</button></form>
          <ul className="mt-4 space-y-2 text-sm">{selected.scoringCriteria.map((criterion) => <li className="rounded-lg border px-3 py-2" key={criterion.id}>{criterion.name} <span className="text-xs text-muted">· bobot {criterion.weight}{criterion.maxScore ? ` · maks ${criterion.maxScore}` : ""}</span></li>)}</ul>
        </Panel>
        <Panel icon={<Trophy />} title="Nilai dan hasil" description="Nilai bersifat idempotent, tercatat atas nama operator, lalu dipublikasikan sebagai ranking resmi.">
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void submit("record-score", { organizationId: organization.id, sessionId: value(form, "sessionId"), entryId: value(form, "entryId"), criterionId: optional(form, "criterionId"), score: Number(value(form, "score")), penalty: Number(value(form, "penalty") || 0), notes: optional(form, "notes"), idempotencyKey: token("score") }, event.currentTarget); }}><select className="field" name="sessionId" required><option value="">Pilih sesi</option>{selected.genericSessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="field" name="entryId" required><option value="">Pilih peserta</option>{selected.genericEntries.map((item) => <option key={item.id} value={item.id}>{item.participant.name}</option>)}</select><select className="field" name="criterionId"><option value="">Nilai umum</option>{selected.scoringCriteria.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><input className="field" name="score" type="number" step="0.01" required placeholder="Nilai" /><input className="field" name="penalty" type="number" step="0.01" min="0" defaultValue="0" placeholder="Penalti" /></div><button className="btn-secondary" disabled={pending !== null}>Simpan nilai</button></form>
          <div className="mt-4 grid gap-2">{selected.genericSessions.map((session) => <button type="button" className="btn-primary justify-center" key={session.id} disabled={pending !== null} onClick={() => void submit("publish-results", { organizationId: organization.id, competitionId: selected.id, sessionId: session.id })}>Ajukan hasil {session.name} untuk review</button>)}</div>
        </Panel>
      </section>
    </>}
  </div>;
}

function Panel({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border bg-surface/60 p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-primary">{icon}</span><div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{description}</p></div></div><div className="mt-5">{children}</div></article>;
}
