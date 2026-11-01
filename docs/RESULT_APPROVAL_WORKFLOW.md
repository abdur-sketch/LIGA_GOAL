# Result Approval Workflow — Phase 21

## State machine

`DRAFT/REOPENED → SUBMITTED → REVIEWED → APPROVED → PUBLISHED`

- **SUBMITTED:** juri yang ditugaskan menghitung snapshot ranking dan mengajukannya.
- **REVIEWED:** aktor berpermission review memeriksa hasil; pengaju tidak boleh mereview miliknya sendiri.
- **APPROVED:** approver berwenang mengunci score/result; pengaju tidak boleh menyetujui hasil sendiri.
- **PUBLISHED:** hanya snapshot yang telah direview dan disetujui yang tampil pada portal publik.
- **REOPENED:** hasil terkunci hanya dibuka dengan permission khusus dan alasan wajib; versi bertambah dan approval lama dihapus.

Setiap transisi memakai advisory transaction lock, RBAC, tenant RLS, history append-only, serta audit log. Trigger `phase21_guard_approved_results` menolak perubahan score/result setelah approval kecuali operasi workflow resmi mengaktifkan transaction-local guard. Jalur publikasi Phase 19 lama telah diarahkan ke tahap submit sehingga tidak dapat melewati dual approval.

## Separation of duties

Minimal dua aktor berbeda wajib terlibat: submitter tidak boleh menjadi reviewer ataupun approver untuk hasil miliknya. Reviewer dan approver dapat dipisahkan menjadi tiga aktor untuk pilot berisiko tinggi. Publisher tetap memerlukan permission tersendiri. Rekomendasi pilot: gunakan juri, reviewer, dan approver yang berbeda.

## Koreksi

1. Approver menjalankan reopen dan mencatat alasan.
2. Hasil publik diturunkan menjadi draft; nilai kembali ke status dapat direvisi.
3. Juri memperbaiki nilai melalui assignment aktif.
4. Workflow diajukan, direview, disetujui, dan dipublikasikan ulang.
5. History versi lama tetap tersedia untuk audit.
