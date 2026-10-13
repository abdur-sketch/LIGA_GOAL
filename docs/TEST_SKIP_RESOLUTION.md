# Phase 17 Test Skip Resolution

Baseline mencatat 17 skip. Skip bukan dianggap PASS.

## Class A — wajib dijalankan lokal

| Test | Jumlah | Resolusi |
|---|---:|---|
| PostgreSQL runtime RLS core | 10 | Dijalankan dengan `liga_goal_runtime`; PASS |
| Phase 14 billing RLS | 1 | Dijalankan; PASS |
| Phase 15 finance RLS | 1 | Dijalankan; PASS |
| Phase 17 RLS | 3 test baru | Dijalankan; PASS |

Harness memerlukan `DATABASE_URL` owner untuk fixture dan `RLS_RUNTIME_DATABASE_URL` runtime. Percobaan pertama gagal karena parameter Prisma `?schema=public` tidak diterima `psql`, sehingga grant tidak diaplikasikan; setelah URL psql dibersihkan dan koneksi owner/runtime dipisah, targeted suite menghasilkan 30/30 PASS. Ini adalah kegagalan harness yang terselesaikan, bukan defect aplikasi.

## Class B — jalankan dengan emulator bila aman

| Test | Jumlah | Status |
|---|---:|---|
| S3 object store | 1 | Tidak dijalankan: emulator S3 tidak tersedia |
| S3 restore drill | 1 | Tidak dijalankan: emulator S3 tidak tersedia |

Tidak ada credential/provider nyata yang digunakan. Phase 18 perlu MinIO/LocalStack terisolasi dan bucket disposable.

## Class C — blocked external/provider/fixture

| Test | Jumlah | Alasan |
|---|---:|---|
| Phase 11 full 25-step UAT | 1 | Opt-in destructive/long fixture; tetap blocked pada baseline shared DB |
| Concurrent match operators | 1 | Memerlukan fixture match khusus dan opt-in |
| Membership runtime opt-in | 1 | Dapat dijalankan terpisah dengan flag; core membership behavior sudah tercakup runtime suite |

Run default final melaporkan 20 skip: 17 baseline ditambah tiga test Phase 17 RLS yang juga bersifat opt-in. Ketiga test baru tersebut dijalankan targeted dan PASS. Runtime coverage kritis dijalankan ulang secara targeted, bukan disembunyikan dengan menghapus `skipIf`.

## Insiden drift harness

Perintah drift awal memasang `liga_goal_phase17_baseline_20261013` sebagai source sekaligus shadow database. Operasi shadow menghapus metadata `_prisma_migrations` pada database uji terisolasi tersebut; pemeriksaan read-only sesudahnya memastikan tabel dan data aplikasi masih ada. Tidak ada database legacy, Phase 16, source, atau production yang terdampak.

Database baseline itu tidak dipakai lagi dan tidak di-reset. Pengujian pengganti memakai:

- `liga_goal_phase17_fresh_20261013`: seluruh 29 migration diterapkan dari kosong, PASS;
- `liga_goal_phase17_upgrade_20261013`: 25 migration baseline diterapkan lebih dahulu, kemudian empat migration Phase 17, PASS.

Pelajaran harness: shadow database harus disposable dan berbeda dari source/target audit; URL source, target, dan shadow harus divalidasi berbeda sebelum menjalankan drift.
