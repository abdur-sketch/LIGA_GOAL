"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Organization = { id: string; name: string; slug: string; status: string };
type Value = { organizations: Organization[]; organizationId: string; setOrganizationId: (id: string) => void; loading: boolean };
const Context = createContext<Value>({ organizations: [], organizationId: "", setOrganizationId: () => undefined, loading: true });

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationIdState] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/organizations?pageSize=100").then(async (response) => {
      if (!response.ok) throw new Error("Gagal memuat organisasi");
      return response.json();
    }).then((result) => {
      setOrganizations(result.data);
      const saved = window.localStorage.getItem("liga-goal.organization");
      const selected = result.data.some((item: Organization) => item.id === saved) ? saved : result.data[0]?.id;
      setOrganizationIdState(selected || "");
    }).finally(() => setLoading(false));
  }, []);
  function setOrganizationId(id: string) { setOrganizationIdState(id); window.localStorage.setItem("liga-goal.organization", id); }
  const value = useMemo(() => ({ organizations, organizationId, setOrganizationId, loading }), [organizations, organizationId, loading]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOrganization() { return useContext(Context); }

export function OrganizationSelect() {
  const { organizations, organizationId, setOrganizationId, loading } = useOrganization();
  return <label className="hidden sm:block"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Organisasi aktif</span><select aria-label="Organisasi aktif" disabled={loading} value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="mt-1 max-w-56 bg-transparent text-sm font-bold outline-none"><option value="">Pilih organisasi</option>{organizations.map((organization) => <option key={organization.id} value={organization.id} className="bg-surface">{organization.name}</option>)}</select></label>;
}
