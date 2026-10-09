"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useOrganization } from "./organization-context";

type Item = Record<string, unknown> & { id: string; _canUpdate?: boolean };
type Option = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "url"
    | "file"
    | "number"
    | "date"
    | "textarea"
    | "select"
    | "checkbox"
    | "csv";
  required?: boolean;
  options?: Option[];
  source?: string;
  sourceLabel?: string;
  placeholder?: string;
};
export type Column = {
  key: string;
  label: string;
  format?: "date" | "status" | "boolean";
};
export type ManagerConfig = {
  resource: string;
  title: string;
  description: string;
  singular: string;
  fields: Field[];
  columns: Column[];
  statuses?: Option[];
  organizationScoped?: boolean;
};

function nested(item: Item, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      item,
    );
}
function display(value: unknown, format?: Column["format"]) {
  if (value == null || value === "") return "—";
  if (format === "date")
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
      new Date(String(value)),
    );
  if (format === "boolean") return value ? "Aktif" : "Nonaktif";
  if (format === "status")
    return String(value).replaceAll("_", " ").toLowerCase();
  return String(value);
}

export function ResourceManager({ config }: { config: ManagerConfig }) {
  const { organizationId, loading: organizationLoading } = useOrganization();
  const scoped = config.organizationScoped !== false;
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [capabilities, setCapabilities] = useState({
    create: false,
    update: false,
    delete: false,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Item | null | undefined>();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [dynamicOptions, setDynamicOptions] = useState<
    Record<string, Option[]>
  >({});

  const load = useCallback(async () => {
    if (scoped && !organizationId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      search,
    });
    if (status) params.set("status", status);
    if (scoped) params.set("organizationId", organizationId);
    try {
      const response = await fetch(`/api/admin/${config.resource}?${params}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setItems(result.data);
      setMeta(result.meta);
      setCapabilities(result.capabilities || {});
      if (page > result.meta.totalPages) setPage(result.meta.totalPages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [config.resource, organizationId, page, scoped, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    if (!organizationId) return;
    const sources = [
      ...new Set(config.fields.map((field) => field.source).filter(Boolean)),
    ] as string[];
    Promise.all(
      sources.map(async (source) => {
        const response = await fetch(
          `/api/admin/${source}?organizationId=${organizationId}&pageSize=100`,
        );
        const result = await response.json();
        return [source, response.ok ? result.data : []] as const;
      }),
    ).then((results) => {
      setDynamicOptions(
        Object.fromEntries(
          results.map(([source, data]) => [
            source,
            data.map((item: Item) => ({
              value: item.id,
              label: String(item.name || item.fullName || item.slug || item.id),
            })),
          ]),
        ),
      );
    });
  }, [config.fields, organizationId]);

  const canEdit = useCallback(
    (item: Item) =>
      config.resource === "organizations"
        ? Boolean(item._canUpdate)
        : capabilities.update,
    [capabilities.update, config.resource],
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = form.get(field.name);
      if (field.type === "file") {
        const file = raw instanceof File && raw.size > 0 ? raw : null;
        if (!file) {
          payload[field.name] = editing
            ? nested(editing, field.name) || ""
            : "";
          continue;
        }
        const upload = new FormData();
        upload.set("file", file);
        const uploadOrganizationId = scoped
          ? organizationId
          : editing?.id || "";
        let response: Response;
        try {
          response = await fetch(
            `/api/admin/uploads?organizationId=${uploadOrganizationId}`,
            { method: "POST", body: upload },
          );
        } catch {
          setToast("Koneksi unggah gambar gagal.");
          setSaving(false);
          return;
        }
        const result = await response.json();
        if (!response.ok) {
          setToast(result.error || "Unggah gambar gagal.");
          setSaving(false);
          return;
        }
        payload[field.name] = result.data.url;
      } else if (field.type === "checkbox") payload[field.name] = raw === "on";
      else if (field.type === "number")
        payload[field.name] = raw === "" ? null : Number(raw);
      else if (field.type === "date")
        payload[field.name] = raw === "" ? null : raw;
      else if (field.type === "csv")
        payload[field.name] = String(raw || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      else payload[field.name] = raw;
    }
    const params = scoped ? `?organizationId=${organizationId}` : "";
    const url = `/api/admin/${config.resource}${editing ? `/${editing.id}` : ""}${params}`;
    try {
      const response = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.details) setFieldErrors(result.details);
        throw new Error(result.error);
      }
      setEditing(undefined);
      setToast(
        `${config.singular} berhasil ${editing ? "diperbarui" : "dibuat"}.`,
      );
      await load();
    } catch (cause) {
      setToast(
        cause instanceof Error ? cause.message : "Perubahan gagal disimpan.",
      );
    } finally {
      setSaving(false);
      window.setTimeout(() => setToast(""), 4000);
    }
  }
  async function remove(item: Item) {
    if (
      !window.confirm(
        `Arsipkan ${config.singular.toLowerCase()} ini? Histori tidak akan dihapus.`,
      )
    )
      return;
    const params = scoped ? `?organizationId=${organizationId}` : "";
    const response = await fetch(
      `/api/admin/${config.resource}/${item.id}${params}`,
      { method: "DELETE" },
    );
    const result = await response.json();
    setToast(response.ok ? `${config.singular} diarsipkan.` : result.error);
    if (response.ok) await load();
    window.setTimeout(() => setToast(""), 4000);
  }
  const emptyMessage = useMemo(
    () =>
      scoped && !organizationId
        ? "Pilih organisasi aktif terlebih dahulu."
        : `Belum ada ${config.title.toLowerCase()}.`,
    [config.title, organizationId, scoped],
  );

  return (
    <section className="rounded-2xl border bg-surface/45 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{config.title}</h2>
          <p className="mt-1 text-sm text-muted">{config.description}</p>
        </div>
        {capabilities.create && (!scoped || organizationId) && (
          <button
            onClick={() => setEditing(null)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-background"
          >
            <Plus size={17} />
            Tambah {config.singular}
          </button>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-xl border bg-background/35 px-4">
          <Search size={17} className="text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Cari ${config.title.toLowerCase()}…`}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        {config.statuses && (
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-xl border bg-background px-4 text-sm"
          >
            <option value="">Semua status</option>
            {config.statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {error ? (
        <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">
          <p>{error}</p>
          <button onClick={load} className="mt-3 font-bold underline">
            Coba lagi
          </button>
        </div>
      ) : loading || organizationLoading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse rounded-xl bg-white/5"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-sm text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted">
                {config.columns.map((column) => (
                  <th key={column.key} className="px-3 py-3 font-bold">
                    {column.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <>
                    {config.columns.map((column) => (
                      <td key={column.key} className="px-3 py-4">
                        <span
                          className={
                            column.format === "status"
                              ? "inline-flex rounded-full bg-white/5 px-2.5 py-1 text-xs capitalize text-muted"
                              : ""
                          }
                        >
                          {display(nested(item, column.key), column.format)}
                        </span>
                      </td>
                    ))}
                  </>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-1">
                      {canEdit(item) && (
                        <button
                          onClick={() => setEditing(item)}
                          aria-label={`Edit ${config.singular}`}
                          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-white"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {(config.resource === "organizations"
                        ? canEdit(item)
                        : capabilities.delete) && (
                        <button
                          onClick={() => remove(item)}
                          aria-label={`Arsipkan ${config.singular}`}
                          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-5 flex items-center justify-between text-xs text-muted">
        <span>{meta.total} data</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="grid size-9 place-items-center rounded-lg border disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <button
            disabled={page >= meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="grid size-9 place-items-center rounded-lg border disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {editing !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border bg-surface p-5 sm:rounded-3xl sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {editing ? "Ubah data" : "Data baru"}
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold">
                  {config.singular}
                </h3>
              </div>
              <button
                onClick={() => setEditing(undefined)}
                className="grid size-10 place-items-center rounded-xl border"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
              {config.fields.map((field) => {
                const value = editing ? nested(editing, field.name) : undefined;
                const options =
                  field.options ||
                  (field.source ? dynamicOptions[field.source] : undefined);
                return (
                  <label
                    key={field.name}
                    className={field.type === "textarea" ? "sm:col-span-2" : ""}
                  >
                    <span className="mb-2 block text-sm font-semibold">
                      {field.label}
                      {field.required && " *"}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        name={field.name}
                        defaultValue={String(value || "")}
                        required={field.required}
                        rows={4}
                        className="w-full rounded-xl border bg-background/50 p-3 text-sm outline-none focus:border-primary/60"
                      />
                    ) : field.type === "select" ? (
                      <select
                        name={field.name}
                        defaultValue={String(value ?? "")}
                        required={field.required}
                        className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      >
                        <option value="">Pilih</option>
                        {options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <input
                        name={field.name}
                        type="checkbox"
                        defaultChecked={Boolean(value)}
                        className="size-5 accent-primary"
                      />
                    ) : (
                      <input
                        name={field.name}
                        type={
                          field.type === "csv" ? "text" : field.type || "text"
                        }
                        defaultValue={
                          field.type === "file"
                            ? undefined
                            : field.type === "date" && value
                              ? new Date(String(value))
                                  .toISOString()
                                  .slice(0, 10)
                              : Array.isArray(value)
                                ? value.join(", ")
                                : String(value ?? "")
                        }
                        required={field.required}
                        placeholder={field.placeholder}
                        accept={
                          field.type === "file"
                            ? "image/png,image/jpeg,image/webp"
                            : undefined
                        }
                        className="h-11 w-full rounded-xl border bg-background/50 px-3 text-sm outline-none file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-bold focus:border-primary/60"
                      />
                    )}
                    {fieldErrors[field.name] && (
                      <span className="mt-1 block text-xs text-red-300">
                        {fieldErrors[field.name].join(" ")}
                      </span>
                    )}
                  </label>
                );
              })}
              <div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditing(undefined)}
                  className="h-11 rounded-xl border px-5 text-sm font-bold"
                >
                  Batal
                </button>
                <button
                  disabled={saving}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-background disabled:opacity-60"
                >
                  {saving && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border bg-navy px-5 py-4 text-sm font-semibold shadow-2xl"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
