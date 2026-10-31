# PORTAL LOMBA — GitHub Free Optimization Report

Tanggal: 31 Oktober 2026

Baseline: `main` / `ed2f978ac2b7ed64d7a5c2a346ad165cfb298f86`

Scope: local-only; tanpa production access, pembayaran, deployment, commit, atau push

## Executive result

Local-first CI selesai dan **PASS**. Repository tetap memakai satu workflow, seluruh security checks dipertahankan, dan tidak ada artifact maupun layanan berbayar baru. GitHub-hosted CI belum dapat divalidasi karena account billing lock menghentikan job sebelum runner mulai; status remote tetap **BLOCKED EXTERNAL**, bukan PASS.

## 1. Temuan audit

| Area | Temuan awal | Risiko |
|---|---|---|
| Billing | Run #8/#9 gagal dalam 2–3 detik karena account locked akibat billing issue | Tidak ada remote CI walaupun repository public |
| Repository | Public, branch `main` | Standard hosted runner masuk kategori gratis; source dan PR bersifat tidak tepercaya |
| Workflow | Satu job lengkap, npm cache, no artifact, no schedule | Struktur dasar baik, tetapi urutan lokal dan remote diduplikasi |
| Actions | Referensi tag `@v4` | Tag dapat bergerak; supply-chain assurance lebih lemah dari full SHA |
| Permissions | `contents: read` dan concurrency sudah ada | Baik |
| Runtime | `ubuntu-24.04`, timeout 60 menit | Stabil, tetapi timeout dapat dipersempit |
| Test DB | Workflow memakai database service tetap | Tidak ada runner lokal satu-perintah yang memprovision target disposable |
| Integration | Opt-in RLS/UAT/S3 membutuhkan environment manual | Risiko test skip bila environment tidak lengkap |
| Artifacts | Tidak ada upload artifact | Biaya/storage rendah |
| Local footprint | `node_modules` sekitar 886 MB; `.next` sekitar 721 MB saat audit | Jangan di-upload atau dijadikan artifact/cache penuh |
| Security | Audit dependency 0 vulnerability pada saat verifikasi | Advisory dapat berubah; audit wajib dipertahankan |

## 2. Perubahan

- Menambahkan `scripts/ci-local.mjs` sebagai orchestrator tunggal untuk quick/security/full.
- Menambahkan emulator S3 minimal lokal `scripts/s3-emulator.mjs`; tidak membutuhkan LocalStack cloud, MinIO hosted, atau dependency npm tambahan.
- Menambahkan `ci:quick`, `ci:security`, `ci:full`, dan `ci:local` pada `package.json`.
- Membuat database dan role runtime test unik per run, loopback-only, explicit allowlist, fail-closed, dan cleanup otomatis.
- Mengaktifkan seluruh integration opt-in: full UAT, concurrent write, runtime identity, RLS, object storage, dan restore.
- Menambahkan redaksi credential pada output command.
- Menyatukan workflow GitHub ke `npm run ci:full` agar urutan lokal/remote sama.
- Mem-pin `actions/checkout` dan `actions/setup-node` ke full SHA; menonaktifkan persisted checkout credential.
- Menurunkan timeout 60 menjadi 45 menit dan menambahkan manual dispatch.
- Mempertahankan npm download cache; tidak meng-cache `node_modules` atau `.next`.
- Menonaktifkan audit implisit pada `npm ci` yang redundan, tetapi mempertahankan audit eksplisit full pada level moderate.
- Menambahkan panduan `docs/GITHUB_FREE_SETUP.md`.

## 3. Efisiensi dan potensi biaya

| Komponen | Konfigurasi akhir | Potensi biaya tambahan |
|---|---|---:|
| Standard Ubuntu runner, public repo | GitHub-hosted `ubuntu-24.04` | $0 menurut kategori billing GitHub saat audit |
| Larger runner | Tidak digunakan | $0 |
| Artifact | Tidak ada upload | $0 |
| Cache | npm download cache saja, allowance terpisah 10 GB/repo | $0 selama kebijakan/allowance tidak dilampaui |
| Packages | Tidak publish | $0 |
| Codespaces | Tidak digunakan | $0 |
| S3 test | Emulator proses lokal | $0 |
| PostgreSQL test | Service GitHub atau PostgreSQL MacBook lokal | $0 tambahan |
| Self-hosted runner | Tidak diaktifkan | $0 GitHub; tidak ada listrik/risiko runner baru |

Target biaya tambahan adalah **$0**, bukan jaminan kontraktual. Repository harus tetap public, memakai standard runner, dan tidak mengaktifkan artifact/package/larger runner/layanan berbayar. Billing lock harus diselesaikan melalui Support sebelum remote CI dapat digunakan.

## 4. Bukti verifikasi lokal

| Gate | Result |
|---|---|
| Target runtime | **PASS — Node.js 22.23.4** |
| `ci:quick` | **PASS** |
| Environment validation | **PASS** |
| Prisma generate/validate | **PASS** |
| Fresh migration | **PASS 29/29** pada database disposable |
| Schema drift | **PASS — no difference detected** |
| Runtime role | **PASS — least privilege / NOBYPASSRLS** |
| Dependency audit production | **PASS — 0 vulnerability** |
| Dependency audit full | **PASS — 0 vulnerability** |
| ESLint | **PASS** |
| TypeScript | **PASS** |
| Unit | **PASS 77/77, 24 files** |
| Integration/security/RLS/UAT/S3 | **PASS 85/85, 22 files, 0 skip** |
| Playwright desktop/mobile | **PASS 52/52** |
| Production build | **PASS — Next.js 16.4.3, 93 page entries** |
| Temporary database cleanup | **PASS** |
| Temporary runtime role cleanup | **PASS** |

Final `ci:full` dijalankan ulang pada Node.js 22.23.4, sesuai target workflow. Durasi didominasi E2E serial sekitar 3,5 menit. Peringatan development server `destination stream errored`, `MaxListenersExceededWarning`, dan konflik `NO_COLOR`/`FORCE_COLOR` tetap non-failing; production build tidak gagal. Peringatan ini sudah menjadi risiko observability staging, bukan alasan menghapus test.

## 5. Self-hosted runner decision

**NO-GO pada MacBook utama dan repository public.** GitHub mendokumentasikan bahwa self-hosted runner tidak memiliki jaminan VM ephemeral bersih dan hampir tidak boleh dipakai untuk repository public. Mesin pengembangan berisi data/credential dengan blast radius terlalu besar. Self-hosted juga tidak boleh dianggap sebagai bypass billing lock.

Local-first CI dipilih sebagai fallback resmi. Tidak ada runner yang didaftarkan, daemon dipasang, port publik dibuka, atau secret GitHub dibuat.

## 6. Risiko tersisa

1. GitHub Actions run berikutnya akan tetap gagal sebelum start sampai GitHub membuka account billing lock.
2. Workflow baru belum pernah berjalan pada GitHub-hosted runner; klaim hanya local PASS.
3. Public pull request tetap merupakan kode tidak tepercaya. Workflow tidak memiliki write permission/secrets, tetapi dependency install dan test tetap mengeksekusi kode PR di VM GitHub ephemeral.
4. E2E development-server warnings perlu dipantau dan didiagnosis sebelum staging production-shaped.
5. GitHub quotas, pricing, dan included usage dapat berubah setelah tanggal laporan.
6. Runner lokal memerlukan hak `CREATEDB` dan `CREATEROLE`; gunakan instance PostgreSQL development khusus, bukan server shared/production.

## 7. Status akhir

- Local CI readiness: **GO**
- GitHub Free configuration: **READY, target $0**
- Remote GitHub Actions evidence: **BLOCKED — billing lock**
- Self-hosted runner: **NOT ENABLED / NOT RECOMMENDED**
- Production: **NO-GO**, tidak berubah
- Commit: **NOT PERFORMED**
- Push: **NOT PERFORMED**
- Deployment: **NOT PERFORMED**

Langkah pemilik berikutnya adalah menghubungi [GitHub Support](https://support.github.com/contact), meminta account unlock tanpa upgrade/pembelian, lalu menjalankan ulang workflow dan memverifikasi semua step. Panduan operasional lengkap tersedia di `docs/GITHUB_FREE_SETUP.md`.
