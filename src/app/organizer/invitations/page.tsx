import { redirect } from "next/navigation";
import { InvitationForm } from "@/components/organizer/invitation-form";
import { InvitationList } from "@/components/organizer/invitation-list";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";

export default async function InvitationsPage() { const actor = await getApiActor(); const data = await organizerOverview(actor); if (!data) redirect("/organizer/onboarding"); return <main className="mx-auto max-w-5xl p-5 py-10"><h1 className="font-display text-3xl font-bold">Undangan staf</h1><p className="mt-2 text-sm text-muted">Undangan berlaku 7 hari, sekali pakai, dan terikat ke email penerima.</p><InvitationForm organizationId={data.organization.id} roles={data.roles} /><InvitationList organizationId={data.organization.id} invitations={data.invitations} /></main>; }
