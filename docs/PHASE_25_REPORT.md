# PORTAL LOMBA — Phase 25 Controlled Development Cutover & Release Candidate Preparation

Tanggal: 3 November 2026
Scope: lokal dan read-only terhadap database development. Tidak ada cutover, commit, push, deployment, perubahan billing, akses production, atau aktivasi layanan berbayar.

## Baseline dan audit worktree

`main`, local `HEAD`, dan local tracking ref `origin/main` sama-sama berada pada `ae5cbd412971539cd14e6429d80a89be53c53608`. Empat belas path Phase 23–24 belum di-commit dan seluruhnya sesuai scope:

| Path | Klasifikasi | Hasil audit |
| --- | --- | --- |
| `package.json` | Tooling lokal | Hanya menambah command load test dan UAT seeder yang guarded. |
| `scripts/phase23-workflow-load-test.ts` | QA/performance | Loopback, environment test, dan nama database test diwajibkan; data sintetis. |
| `scripts/seed-phase23-human-uat.ts` | QA/UAT | Loopback/test-only; password wajib dari environment; menolak fixture duplikat. |
| `docs/PHASE_23_REPORT.md` | Evidence | Sesuai hasil Phase 23. |
| `docs/RELEASE_CANDIDATE_CHECKLIST.md` | Release control | Gate eksternal tetap fail-closed. |
| `docs/MIGRATION_REMEDIATION_PLAN.md` | Migration safety | Tidak mengedit history, reset, atau menimpa database lama. |
| `docs/STAGING_INFRASTRUCTURE_REQUIREMENTS.md` | Staging plan | Tidak membuat provider atau billing. |
| `docs/HUMAN_UAT_EXECUTION_PACK.md` | Human UAT | Tidak membuat sign-off otomatis dan tidak menyimpan password. |
| `docs/INCIDENT_RESPONSE_RUNBOOK.md` | Operations | Menjaga evidence, containment, dan escalation. |
| `docs/PHASE_24_REPORT.md` | Evidence | Memuat hasil quality gate dan cutover rehearsal Phase 24. |
| `docs/SAFE_CUTOVER_RUNBOOK.md` | Cutover safety | Preflight, write freeze, post-check, dan rollback eksplisit. |
| `docs/STAGING_FOUNDATION_PLAN.md` | Architecture | Local-first; staging eksternal belum diprovision. |
| `docs/BACKUP_PROTECTION_REPORT.md` | Recovery evidence | Hash, permission, lokasi FileVault, dan lifecycle `/tmp` terdokumentasi. |
| `docs/PHASE_24_GO_NO_GO.md` | Decision record | Memisahkan local, cutover, RC, staging, pilot, dan production. |

`git diff --check` lulus. High-confidence scan tidak menemukan private key, GitHub token, AWS key, live payment key, atau Slack token. `.env`, dump, certificate/key, dan credential lokal tidak tracked. String secret/password pada runner adalah fixture sintetis atau nama environment variable, bukan credential nyata.

## Backup dan rollback verification

- Salinan aman: `~/Library/Application Support/Portal Lomba/Backups/phase23-pre-phase24/` pada disk sistem dengan FileVault.
- Directory `0700`; sepuluh artefak `0600`.
- Full dump 688.143 byte, 1.477 TOC entry.
- SHA-256: `ab69c13a7b4cf1aa3b1f25e6b4052258b1622967030100abd720db7a7bdc8c9f`.
- Restore/rebuild Phase 24: 129/129 row count dan logical hash identik, 379 FK tanpa orphan, migration final dan drift tervalidasi.
- Runbook mempertahankan database lama, melarang reset/manipulasi `_prisma_migrations`, serta menetapkan rollback ke database lama bila data, RLS, login, privacy flow, atau smoke test gagal.

Salinan ini belum off-host. RPO/RTO dan retention belum disetujui sehingga production recovery tetap NO-GO.

## Development database read-only preflight

Preflight dijalankan dengan `BEGIN READ ONLY` terhadap `liga_goal`; hanya metadata yang dibaca dan tidak ada isi peserta/pengguna dicetak.

| Pemeriksaan | Hasil |
| --- | --- |
| PostgreSQL / ukuran | 16.14 / 17.169.431 byte |
| Transaction mode | `read only` |
| Migration | 35 tercatat selesai; Prisma status menyatakan current |
| Phase 22 checksum DB | `3566b4f91aa22f503de8b6fdaf449d9e87e0cbcb09590b17eca8ca30818111cb` |
| Phase 22 checksum source | `4513d32a9b2e0ccfe14dfe9f1508cb9a73fd7f31541454adea21fd0b44c139b6` |
| Privacy function | Database 8 argumen; source final 9 argumen |
| Tables / constraints | 129 / 520; 0 unvalidated |
| Triggers | 22; 0 disabled |
| RLS | 123 tables / 158 policies |
| Active connection saat preflight | 1 |

Kesimpulan: database operasional lokal tampak konsisten, tetapi executable migration mismatch tetap nyata. `prisma migrate status` tidak cukup untuk menyatakan cutover selesai. Database development tidak diubah.

## Checkpoint commit plan

Checkpoint disiapkan sebagai satu commit lokal yang mencakup 14 path baseline ditambah dua dokumen Phase 25 ini. Pesan yang disiapkan:

`chore: prepare controlled development cutover and release candidate`

Sebelum commit, ulangi `git status`, secret/artifact scan, `git diff --check`, dan cocokkan manifest RC. Commit dan push tetap memerlukan persetujuan terpisah.

## Release Candidate lokal

RC dibentuk hanya setelah quality gate final dari snapshot worktree yang sama. Paket source lokal harus berasal dari `git archive HEAD` lalu ditimpa hanya dengan path worktree yang diaudit; pendekatan ini mengecualikan `.git`, `.env`, `node_modules`, dump, backup, dan artefak lokal sensitif. Archive, manifest file, dan SHA-256 disimpan di lokasi privat ber-FileVault di luar Git.

RC ini adalah artefak review lokal, bukan deployment artifact yang telah disetujui. Remote CI, staging provider, human sign-off, dan commit source masih merupakan gate terpisah.

## CI/CD readiness

Workflow `.github/workflows/ci.yml` memiliki:

- trigger `pull_request`, `push`, dan manual untuk `main`/`staging`;
- `contents: read`, checkout tanpa persisted credential, concurrency cancellation, dan timeout 45 menit;
- action checkout/setup-node dipin ke commit SHA;
- PostgreSQL 16 service, `npm ci`, Chromium install, dan `npm run ci:full`.

Workflow tidak berubah pada Phase 25. `actionlint` tidak tersedia pada host sehingga validasi tool tersebut **BLOCKED LOCALLY**; syntax/workflow tetap pernah tervalidasi pada baseline sebelumnya dan local CI runner diuji langsung. Remote run `41294282517` terverifikasi gagal sebelum step berjalan dengan anotasi bahwa akun terkunci karena masalah billing. Status remote: **BLOCKED — BILLING**, bukan application test failure.

## Human UAT role matrix

| Role sintetis | Tanggung jawab wajib | Negative test wajib |
| --- | --- | --- |
| Admin platform | Provision/check organization dan platform audit | Tidak mengambil alih scoring/approval tanpa permission eksplisit. |
| Organizer | Membuat kompetisi/cabang/sesi, membuka registrasi, menugaskan staff | Tidak menilai atau self-approve di luar role yang diberikan. |
| Verifier | Review participant registration dan request revision | Tidak melihat tenant lain atau mengubah nilai/hasil. |
| Judge | Menilai hanya sesi/cabang yang ditugaskan | Ditolak pada sesi lain, setelah revoke/expiry, dan saat mencoba approval sendiri. |
| Reviewer | Review hasil submitted | Tidak approve/publish dan tidak review hasil sendiri jika konflik actor. |
| Approver | Approve/reopen sesuai policy dan alasan audit | Tidak melewati review atau mengubah score yang terkunci. |
| Viewer | Melihat data operasional yang diizinkan/published | Tidak memperoleh PII, write access, draft result, atau cross-tenant data. |

## Human UAT template × role matrix

Setiap cell adalah aksi utama yang harus dibuktikan manusia; seluruh baris juga wajib menjalankan negative tests pada role matrix di atas.

| Template | Admin | Organizer | Verifier | Judge | Reviewer | Approver | Viewer/public |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sepak Bola | Tenant/audit | Musim, klub, jadwal | Roster | Match/session score | Review result | Approve/publish | Hanya hasil published |
| LCT | Tenant/audit | Tim, babak, sesi | Tim/peserta | Nilai sesi assigned | Review ranking | Approve/publish | Ranking published |
| Sekolah | Tenant/audit | Individu/instansi | Identitas sintetis | Nilai cabang | Review ranking | Approve/publish | Tanpa PII |
| Seni | Tenant/audit | Kriteria/jadwal | Berkas sintetis | Multi-criteria score | Review aggregate | Approve/publish | Hasil published |
| Keagamaan | Tenant/audit | Kategori/sesi | Eligibility sintetis | Nilai assigned | Review aggregate | Approve/publish | Tanpa data privat |
| Gebyar/Festival | Tenant/audit | Parent + beberapa cabang | Registrasi per cabang | Hanya cabang assigned | Review per cabang | Approve/publish | Navigasi parent/cabang |
| E-sports | Tenant/audit | Tim/bracket/sesi | Roster tim | Result assigned | Review bracket result | Approve/publish | Bracket published |
| Custom | Tenant/audit | Field/kriteria custom | Form custom | Score sesuai konfigurasi | Review result | Approve/publish | Field public allowlist |

Human UAT belum dieksekusi dan tidak ada sign-off otomatis. Dataset harus tetap sintetis.

## Quality gates Phase 25

`CI_LOCAL_SKIP_BROWSER_INSTALL=1 npm run ci:full` dijalankan pada database dan runtime role disposable baru dan berakhir dengan marker `PORTAL LOMBA ci:full PASS`.

| Gate | Hasil |
| --- | --- |
| Environment validation / Prisma generate | PASS / PASS |
| Dependency audit | PASS — 0 vulnerability |
| ESLint / TypeScript | PASS / PASS |
| Unit | 91 PASS, 0 FAIL, 0 SKIP |
| Integration, security, runtime RLS | 109 PASS, 0 FAIL, 0 SKIP |
| Playwright desktop/mobile | 64 PASS, 0 FAIL, 0 SKIP |
| Automated regression total | 264 PASS, 0 FAIL, 0 SKIP |
| Fresh migration / schema drift | 35/35 PASS / no difference |
| Production build | PASS — 100 static pages |
| Secret/artifact scan | PASS — tidak ada high-confidence secret atau tracked local artifact |
| `git diff --check` | PASS |

Chromium install dilewati karena browser lokal sudah tersedia; seluruh 64 E2E tetap dijalankan. Runner membersihkan database dan role sementara setelah selesai. Log evidence privat: `/tmp/portal-lomba-phase25-ci-full.log`.

## Blocker dan approval boundary

1. Cutover development memerlukan izin eksplisit, write freeze, backup terbaru, dan keputusan rollback owner.
2. Checkpoint commit dan push adalah dua izin terpisah; keduanya belum diberikan.
3. GitHub Actions tetap billing-locked; remote CI evidence tidak tersedia.
4. Staging eksternal, HTTPS, secrets, storage, scanner, monitoring, backup, dan runtime role belum diprovision.
5. Human UAT 8×7, privacy/legal, RPO/RTO, SLO/capacity, incident contact, dan pilot sign-off belum selesai.
6. Production dan layanan berbayar tetap di luar scope.

## Phase 25 conclusion

Local technical readiness dan checkpoint review readiness adalah **GO**. Development cutover tetap **CONDITIONAL GO — AWAITING EXPLICIT APPROVAL**. Local RC source archive dapat dibuat dari worktree final ini dan dicatat melalui sibling manifest/checksum di lokasi FileVault; pembuatan archive tidak mengubah Git atau memberi izin deployment.
