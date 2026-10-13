# Moderation and Abuse — Phase 17

## Intake

Pengunjung dapat melaporkan profil organizer atau competition publication yang sedang published. Payload dibatasi category allowlist, deskripsi 20–2.000 karakter, serta email opsional. IP/user-agent tidak disimpan; keduanya digabung lalu SHA-256 untuk rate-limit context. Response untuk target nonpublik bersifat generik.

Database check/trigger memastikan target competition berada di organization yang dilaporkan. Public RLS bersifat insert-only dengan status awal `OPEN`, tanpa assignee/resolution.

## Queue dan action

Lifecycle report: `OPEN → IN_REVIEW → ACTIONED | DISMISSED`. Actions:

- review: klaim/lanjutkan investigasi;
- dismiss: tutup dengan alasan;
- unpublish competition: perubahan visibility paling sempit;
- suspend organizer: menutup seluruh public projections tenant;
- internal note: append-only record dengan author dan waktu.

Action memakai optimistic version check dan audit trail. UI tidak menampilkan reporter contact; akses lanjutan ke data itu harus dirancang dengan purpose limitation.

## Appeal

Tenant terkait dapat membuat satu appeal per report `ACTIONED` melalui model `ModerationAppeal`. RLS memastikan tenant lain tidak dapat membaca/membuat appeal tersebut. Operator berizin dapat mempertahankan atau mengabulkan appeal; keputusan itu tidak otomatis mereaktivasi tenant. SLA dan segregation of duties merupakan blocker Phase 18.

## Data preservation

Moderation tidak hard-delete organization, competition, match, finance, subscription, atau audit. Suspension mengubah access/public projections saja. Unpublish tidak mengubah hasil pertandingan resmi.

## Abuse prevention

- database-backed mutation rate limit: lima laporan/fingerprint/jam;
- hanya target published aktif;
- input strict dan bounded;
- explicit platform grants;
- default-deny RLS;
- no public list/read API untuk report;
- notes/alasan dilarang memuat credential atau dokumen identitas.
