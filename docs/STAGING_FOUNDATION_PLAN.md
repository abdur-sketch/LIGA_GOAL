# PORTAL LOMBA — Staging Foundation Plan

Status: **DESIGNED, NOT PROVISIONED**. Tidak ada akun provider, billing, domain, certificate, bucket, atau deployment eksternal yang dibuat.

## Arsitektur minimum terisolasi

| Komponen | Local-first/free rehearsal | Staging yang wajib dipenuhi |
| --- | --- | --- |
| Application | Next.js production build di host/container lokal | Instance khusus staging, tidak berbagi process/user/network dengan production |
| PostgreSQL | PostgreSQL lokal, database dan role khusus | Database khusus staging, encrypted storage, private network, owner terpisah dari runtime role |
| Object storage | Emulator S3 lokal dengan bucket public/private/quarantine | Bucket terpisah, private by default, signed access, encryption, versioning/retention |
| HTTPS | Local CA/reverse proxy | Domain staging dan certificate valid; redirect HTTP, secure cookie, HSTS setelah tervalidasi |
| Secrets | File di luar Git mode `0600`, process env | Secret manager atau encrypted host store, rotation/revoke drill, audit akses |
| RLS | Runtime role `NOBYPASSRLS` | Runtime role minimum privilege; migration/backup role terpisah; runtime RLS suite wajib PASS |
| Monitoring | Structured log dan health check lokal | Uptime, 5xx, latency, DB pool, disk, backup, malware, audit alerts; retention terdefinisi |
| Backup | `pg_dump` custom-format + SHA-256 + restore drill | Encrypted scheduled backup, off-host copy, restore rehearsal, owner/RPO/RTO disetujui |
| Malware | Signature scanner/emulator fail-closed | Quarantine, approved scanner, timeout/failure fail-closed, alert dan manual review |
| Audit | Application/PostgreSQL audit events | Immutable/restricted sink, clock sync, retention dan access review |

## Network dan trust boundary

Hanya reverse proxy yang menerima trafik publik. PostgreSQL, object storage private/quarantine, metrics, dan admin endpoint berada pada private network. Public bucket hanya memuat objek yang telah melewati authorization/publication workflow. Egress aplikasi dibatasi ke dependency yang disetujui. Staging tidak memakai credential, database, bucket, webhook, atau email provider production.

## Data dan identity

- Gunakan hanya dataset sintetis dan domain email uji; jangan menyalin backup development.
- Tujuh akun sintetis dipisahkan: admin platform, organizer, verifier, judge, reviewer, approver, viewer.
- Delapan template: Sepak Bola, LCT, Sekolah, Seni, Keagamaan, Gebyar/Festival, E-sports, Custom.
- Password staging harus diinjeksi melalui secret store dan dirotasi setelah UAT; jangan ditulis di dokumen atau Git.
- Email, payment, dan notification menggunakan sandbox/local adapter. Live payment tetap nonaktif.

## Tahapan implementasi

1. **Local isolated rehearsal:** container/host lokal, PostgreSQL dan S3 emulator, runtime role, synthetic dataset, restore drill.
2. **Staging base:** pilih provider/free tier yang disetujui, buat private network, DNS/HTTPS, secrets, database, bucket, dan role terpisah.
3. **Security bootstrap:** RLS tests, scanner fail-closed, rate limit, audit sink, backup job, monitoring/alerts.
4. **Deploy candidate:** source checkpoint yang disetujui, immutable artifact, migration preflight, rollback artifact.
5. **Automated UAT:** full quality gates pada staging tanpa test skip.
6. **Human UAT:** checklist per role/template ditandatangani manusia; temuan ditutup atau diterima secara eksplisit.
7. **Pilot decision:** hanya setelah recovery drill, incident contact, capacity target, privacy/legal, dan owner sign-off.

## UAT acceptance matrix

Untuk setiap delapan template, operator harus membuktikan create event/cabang, public registration, verification, judge assignment per sesi, scoring, review, independent approval, publication, dan public result. Negative checks wajib membuktikan juri tidak melihat sesi lain, reviewer/penilai tidak self-approve, peserta tidak membaca PII pihak lain, cross-tenant request ditolak, dual approval tidak dapat dilewati, dan draft/unapproved result tidak publik.

Fixture lokal Phase 23 menyediakan 8 kompetisi, 8 sesi, 8 assignment juri aktif, public registration pada seluruh template, serta 7 akun sintetis. Ini persiapan, bukan human sign-off atau bukti staging.

## Keputusan pemilik yang diperlukan

- Provider/region dan apakah free tier memenuhi privacy, backup, log, dan recovery requirement.
- Domain staging, DNS owner, certificate owner, serta akses operator.
- RPO/RTO, retention, incident contacts, alert channel, SLO/capacity target.
- Secret manager, malware scanner, email sandbox, object storage, dan backup destination yang disetujui.
- Anggaran nol/berbayar dan batas yang tidak boleh dilewati; tidak ada layanan berbayar boleh diaktifkan otomatis.
