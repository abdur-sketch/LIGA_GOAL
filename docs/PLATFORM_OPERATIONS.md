# Platform Operations — Phase 17

## Permission model

Semua operasi nasional memerlukan `isPlatformAdmin` dan grant khusus; tenant RBAC tidak dapat menggantikannya.

| Capability | Grant |
|---|---|
| Health/operations overview | `platform.operations.view` |
| Suspend/reactivate tenant | `platform.organizations.manage` |
| User/membership oversight | `platform.users.view` |
| Audit feed | `platform.audit.view` |
| Verification queue/action | `organizer.verification.view/manage` |
| Abuse queue/action/note | `abuse.moderate.view/manage` |

## Consoles

- `/admin`: national operations center.
- `/admin/platform-organizations`: directory tenant, plan, verification, membership/competition count, suspend/reactivate.
- `/admin/users`: user and active membership oversight; token/password/session tidak diambil.
- `/admin/verification`: verification queue.
- `/admin/abuse`: abuse queue dan moderation actions.
- `/admin/operations`: failed jobs, delayed realtime outbox, failed statistics, reconciliation.
- `/admin/audit`: 100 audit metadata terbaru tanpa payload before/after.
- Existing `/admin/subscriptions`, `/admin/finance`, dan `/admin/discovery` tetap digunakan, bukan diduplikasi.

## Health definitions

- Failed job: `BackgroundJob.status ∈ {failed, dead}`.
- Delayed realtime outbox: `PENDING` lebih dari lima menit.
- Failed statistics: `StatisticsRecomputeJob.status=FAILED`.
- Reconciliation: selain `MATCHED/RESOLVED`.
- Audit activity: jumlah event 24 jam.

Panel ini adalah indikator triase lokal. Credential, job payload, webhook body, tax profile, private medical data, dan token tidak ditampilkan.

## Suspension semantics

Suspend organisasi mengubah `Organization.status`, public organizer profile, competition publications, dan verification visibility. Data kompetisi, pertandingan, invoice, transaction, subscription, serta audit tidak dihapus. Reactivation mengaktifkan tenant tetapi tidak otomatis memublikasikan konten: moderator harus meninjau ulang secara eksplisit.

## Runbook ringkas

1. Validasi operator dan explicit grant.
2. Buka indikator dan audit metadata.
3. Ambil case/report terkait; jangan menyalin PII ke notes.
4. Catat alasan faktual minimal delapan karakter.
5. Terapkan tindakan paling sempit (unpublish competition sebelum suspend organizer bila cukup).
6. Verifikasi public visibility dan data preservation.
7. Pantau appeal dan lakukan review oleh operator berbeda bila memungkinkan.
