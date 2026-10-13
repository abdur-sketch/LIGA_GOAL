# Source Checkpoint Plan — Phase 18

## Evidence lokal

- Baseline Git: `main` pada `4a7d06e69934d4eee635a35cf8885f81a9826ec7`; upstream identik.
- Baseline checkpoint Phase 18: `/tmp/liga-goal-phase18-checkpoint-20261013` (429 file).
- Final checkpoint: `/tmp/liga-goal-phase18-final-checkpoint-20261013` (438 file, termasuk implementasi dan seluruh deliverable Phase 18).
- Isi masing-masing: arsip working tree, daftar file, SHA-256 setiap source, dan SHA-256 arsip; file mode 0600.
- Scope memakai `git ls-files -co --exclude-standard`, sehingga perubahan tracked dan untracked Phase 12–18 masuk, sedangkan `.env`, `.git`, `.next`, dependency, dan artefak ignored tidak masuk.

Checkpoint `/tmp` bersifat sementara dan bukan backup jangka panjang. Salinan permanen hanya boleh ditempatkan pada storage terenkripsi yang disetujui pemilik.

## Strategi Git yang direkomendasikan — belum dijalankan

1. Pemilik meninjau `git status`, seluruh diff, sembilan dokumen, dan gate matrix.
2. Buat branch checkpoint khusus dari HEAD saat ini, misalnya `checkpoint/phase-18-local-pass`.
3. Commit Phase 12–18 secara terstruktur: docs/planning, migrations, Phase 13–17 product work, lalu Phase 18 safety tooling. Jangan memecah migration dari schema yang bergantung padanya.
4. Jalankan secret scan dan CI penuh terhadap commit final.
5. Buat annotated/signed tag hanya setelah review, misalnya `phase-18-local-pass`.
6. Push branch/tag hanya setelah izin eksplisit dan branch protection tersedia. Jangan langsung merge ke `main`.
7. PR wajib menyertakan migration plan, rollback/forward-fix, backup evidence, dan release-gate matrix.

## Review checklist

- `.env` tetap ignored dan tidak tracked.
- Tidak ada dump, credential, screenshot sensitif, `.next`, `test-results`, atau `/tmp` artifact dalam commit.
- 29 migration berurutan dan checksum diff direview.
- `next-env.d.ts` dipertahankan sesuai generator Next.js 16.
- CI menggunakan database test dan shadow yang berbeda serta allowlist eksplisit.
- Reviewer minimum: application owner, PostgreSQL/security reviewer, dan release owner.

## Recovery

Jika checkpoint Git yang disetujui bermasalah, jangan reset working tree pemilik. Buat worktree/clone terpisah dari commit terakhir yang diketahui baik, bandingkan manifest, lalu forward-fix. Arsip `/tmp` hanya fallback lokal sementara dan tidak menggantikan Git remote atau backup terenkripsi.
