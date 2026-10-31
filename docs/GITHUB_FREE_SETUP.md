# PORTAL LOMBA — GitHub Free dan Local-First CI

Tanggal verifikasi: 31 Oktober 2026

Repository `abdur-sketch/LIGA_GOAL` terdeteksi **public** melalui GitHub API. Menurut dokumentasi resmi, standard GitHub-hosted runners pada repository public tetap gratis dan tidak mengurangi included compute usage. Larger runners tetap berbayar. GitHub Free menyediakan 500 MB artifact storage yang berbagi kuota dengan GitHub Packages dan cache Actions terpisah sebesar 10 GB per repository. Nilai, ketentuan, dan status akun dapat berubah; periksa kembali sebelum setiap perubahan release.

Sumber resmi:

- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub Actions billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Self-hosted runners](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners)
- [Security hardening for GitHub Actions](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions)

## Konfigurasi biaya tambahan $0

- Satu workflow utama: `.github/workflows/ci.yml`.
- Runner standard `ubuntu-24.04`; tidak memakai larger runner.
- Trigger hanya pull request, push ke `main`/`staging`, dan manual `workflow_dispatch`; tidak ada schedule.
- Permission `GITHUB_TOKEN` hanya `contents: read`.
- Run lama pada branch/ref yang sama dibatalkan melalui concurrency.
- Timeout job 45 menit.
- Cache hanya npm download cache melalui `actions/setup-node`; `node_modules`, `.next`, dan browser tidak di-upload.
- Tidak ada artifact, package publish, deployment, Codespaces, atau layanan eksternal berbayar.
- `npm ci` menonaktifkan audit otomatis yang duplikatif; `ci:full` tetap menjalankan audit eksplisit dengan threshold moderate.
- Third-party Actions tidak digunakan. `checkout` dan `setup-node` dipin ke full commit SHA dan checkout tidak mempertahankan credential Git.

Target $0 ini bergantung pada repository tetap public, runner tetap standard, tidak ada larger runner, tidak ada artifact/package berlebih, dan tidak ada perubahan billing oleh pemilik. Account billing lock tetap dapat mencegah job dimulai walaupun workload secara kategori gratis.

## Prasyarat CI lokal

- Node.js 22.
- PostgreSQL lokal pada loopback (`localhost`, `127.0.0.1`, atau `::1`).
- CLI `psql`, `createdb`, dan `dropdb`.
- User PostgreSQL lokal yang boleh membuat database dan role test sementara.
- Dependency sudah terpasang dengan `npm ci`.

Secara default runner membaca koneksi lokal dari `LOCAL_CI_ADMIN_DATABASE_URL`, lalu `DATABASE_URL`/`.env`, dan terakhir memakai user macOS saat ini pada database `postgres`. Untuk koneksi yang berbeda:

```bash
LOCAL_CI_ADMIN_DATABASE_URL='postgresql://user:password@127.0.0.1:5432/postgres' npm run ci:local
```

Host non-loopback ditolak. Nama database dibuat unik dengan pola `portal_lomba_ci_test_*`, dimasukkan ke allowlist eksplisit, lalu dihapus dengan `dropdb --force` pada blok cleanup. Role runtime unik dibuat sebagai `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, dan `NOBYPASSRLS`, lalu dihapus setelah database disposable dibersihkan. Password direduksi dari output command.

Fresh migration memakai `DESTRUCTIVE_MIGRATION_REVIEWED=YES` hanya di environment test disposable karena beberapa migration historis memuat pola yang ditandai scanner. Flag tersebut tidak diekspor ke shell pengguna dan tidak mengurangi proteksi staging/production.

## Perintah

```bash
npm run ci:quick
npm run ci:security
npm run ci:full
npm run ci:local
```

`ci:quick` menjalankan validasi environment/schema, audit dependency production, ESLint, TypeScript, dan unit test tanpa membuat database.

`ci:security` membuat database test sementara, menjalankan 29 fresh migration, drift detection, membuat runtime role RLS, menjalankan full dependency audit, unit test, integration/security/RLS/UAT, dan S3-compatible storage/restore menggunakan emulator lokal tanpa dependency eksternal.

`ci:full` menambahkan ESLint, TypeScript, instalasi Chromium bila diperlukan, seluruh E2E desktop/mobile, dan production build. `ci:local` adalah alias resmi ke `ci:full`.

Untuk runner GitHub, Chromium dan dependency OS dipasang oleh workflow, lalu `CI_LOCAL_SKIP_BROWSER_INSTALL=1` menghindari instalasi browser kedua di dalam script.

## Self-hosted runner MacBook

Keputusan saat ini: **jangan diaktifkan**.

GitHub menyatakan self-hosted runner tidak memakai biaya Actions, tetapi pemilik menanggung hardware, listrik, internet, patching, availability, dan cleanup. Panduan keamanan GitHub juga menyatakan self-hosted runner hampir tidak boleh digunakan untuk repository public karena kode pull request tidak tepercaya dapat mempertahankan kompromi pada mesin yang tidak ephemeral.

MacBook pengembangan dapat menyimpan SSH key, browser session, source lain, dan credential lokal. Menjadikannya runner public meningkatkan blast radius dan tidak dijamin melewati account billing lock. Local-first CI memberi hasil yang sama tanpa mendaftarkan daemon runner atau membuka mesin ke workload GitHub.

Jika kelak dipertimbangkan, syarat minimumnya adalah host/VM disposable khusus tanpa data pribadi, runner ephemeral/JIT, akses hanya ke repository yang disetujui, tanpa secret pada pull request tidak tepercaya, patching otomatis, egress restriction, dan teardown terverifikasi. Aktivasi tetap memerlukan persetujuan pemilik terpisah.

## Menyelesaikan billing lock

1. Buka run Actions yang gagal dan simpan URL serta anotasi `The job was not started because your account is locked due to a billing issue.`
2. Buka pengaturan billing GitHub dan catat transaksi US$10 yang declined, tanggal, serta account/repository terkait; jangan menambahkan payment method atau mengulang pembayaran tanpa keputusan pemilik.
3. Hubungi [GitHub Support](https://support.github.com/contact) dari account pemilik. Jelaskan bahwa repository public memakai standard runner, GitHub Free/Copilot Free aktif, dan job berhenti sebelum runner dimulai.
4. Sertakan URL run, commit SHA, screenshot/error, dan payment transaction reference tanpa mengirim nomor kartu, token, atau secret.
5. Minta konfirmasi apakah lock dapat dibuka tanpa upgrade paket atau pembelian Actions minutes.
6. Setelah GitHub mengonfirmasi pemulihan, jalankan ulang workflow secara manual dan verifikasi seluruh step benar-benar berjalan. Jangan menganggap status terselesaikan dari perubahan YAML saja.

## Operasi rutin

- Jalankan `npm run ci:quick` sebelum commit kecil.
- Jalankan `npm run ci:security` setelah perubahan auth, RBAC, RLS, storage, migration, dependency, atau billing sandbox.
- Jalankan `npm run ci:local` sebelum push/release candidate.
- Re-run `npm audit` sebelum release karena advisory dapat berubah.
- Pantau Actions usage/cache walaupun repository public; hapus cache lama bila mendekati 10 GB.
- Jangan meng-upload `.next`, `node_modules`, Playwright browser, dump database, trace, video, atau screenshot massal sebagai artifact default.
