import type { ManagerConfig } from "./resource-manager";

const competitionStatuses = [
  { value: "DRAFT", label: "Draft" },
  { value: "REGISTRATION", label: "Registrasi" },
  { value: "ONGOING", label: "Berjalan" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "ARCHIVED", label: "Arsip" },
];
const seasonStatuses = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "ARCHIVED", label: "Arsip" },
];

export const organizationsConfig: ManagerConfig = {
  resource: "organizations",
  title: "Organisasi",
  singular: "Organisasi",
  description: "Tenant, owner, kontak, dan status platform.",
  organizationScoped: false,
  statuses: [
    { value: "ACTIVE", label: "Aktif" },
    { value: "PENDING", label: "Menunggu" },
    { value: "SUSPENDED", label: "Nonaktif" },
    { value: "ARCHIVED", label: "Arsip" },
  ],
  columns: [
    { key: "name", label: "Nama" },
    { key: "slug", label: "Slug" },
    { key: "owner.name", label: "Owner" },
    { key: "status", label: "Status", format: "status" },
    { key: "_count.memberships", label: "Anggota" },
  ],
  fields: [
    { name: "name", label: "Nama", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "ownerId", label: "ID owner (opsional)" },
    { name: "contactEmail", label: "Email kontak", type: "email" },
    { name: "contactPhone", label: "Telepon" },
    { name: "logoUrl", label: "Logo (PNG/JPEG/WebP)", type: "file" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "ACTIVE", label: "Aktif" },
        { value: "PENDING", label: "Menunggu" },
        { value: "SUSPENDED", label: "Nonaktif" },
        { value: "ARCHIVED", label: "Arsip" },
      ],
    },
    { name: "address", label: "Alamat", type: "textarea" },
  ],
};

export const membershipsConfig: ManagerConfig = {
  resource: "memberships",
  title: "Anggota organisasi",
  singular: "Anggota",
  description:
    "Tambahkan pengguna yang sudah terdaftar dan tentukan role organisasinya.",
  columns: [
    { key: "user.name", label: "Nama" },
    { key: "user.email", label: "Email" },
    { key: "role.name", label: "Role" },
    { key: "isActive", label: "Aktif", format: "boolean" },
  ],
  fields: [
    { name: "email", label: "Email pengguna", type: "email", required: true },
    {
      name: "roleKey",
      label: "Role key",
      required: true,
      placeholder: "organization-owner",
    },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ],
};

export const competitionsConfig: ManagerConfig = {
  resource: "competitions",
  title: "Kompetisi",
  singular: "Kompetisi",
  description: "Format, regulasi, periode, dan status kompetisi.",
  statuses: competitionStatuses,
  columns: [
    { key: "name", label: "Nama" },
    { key: "category", label: "Kategori" },
    { key: "format", label: "Format", format: "status" },
    { key: "status", label: "Status", format: "status" },
    { key: "_count.seasons", label: "Musim" },
  ],
  fields: [
    { name: "name", label: "Nama", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "category", label: "Kategori" },
    { name: "location", label: "Lokasi" },
    {
      name: "format",
      label: "Format",
      type: "select",
      required: true,
      options: [
        { value: "SINGLE_ROUND_ROBIN", label: "Single round robin" },
        { value: "DOUBLE_ROUND_ROBIN", label: "Double round robin" },
        { value: "GROUP_STAGE", label: "Fase grup" },
        { value: "SINGLE_ELIMINATION", label: "Eliminasi" },
        { value: "GROUP_AND_KNOCKOUT", label: "Grup + knockout" },
      ],
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: competitionStatuses,
    },
    { name: "startsAt", label: "Tanggal mulai", type: "date" },
    { name: "endsAt", label: "Tanggal selesai", type: "date" },
    { name: "logoUrl", label: "Logo (PNG/JPEG/WebP)", type: "file" },
    { name: "description", label: "Deskripsi", type: "textarea" },
    { name: "regulations", label: "Regulasi", type: "textarea" },
  ],
};

export const seasonsConfig: ManagerConfig = {
  resource: "seasons",
  title: "Musim",
  singular: "Musim",
  description: "Periode, sistem poin, tie-breaker, dan aktivasi musim.",
  statuses: seasonStatuses,
  columns: [
    { key: "name", label: "Nama" },
    { key: "competition.name", label: "Kompetisi" },
    { key: "startsAt", label: "Mulai", format: "date" },
    { key: "status", label: "Status", format: "status" },
    { key: "isActive", label: "Aktif", format: "boolean" },
  ],
  fields: [
    {
      name: "competitionId",
      label: "Kompetisi",
      type: "select",
      source: "competitions",
      required: true,
    },
    { name: "name", label: "Nama musim", required: true },
    { name: "startsAt", label: "Tanggal mulai", type: "date", required: true },
    { name: "endsAt", label: "Tanggal selesai", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: seasonStatuses,
    },
    { name: "isActive", label: "Jadikan musim aktif", type: "checkbox" },
    { name: "winPoints", label: "Poin menang", type: "number", required: true },
    { name: "drawPoints", label: "Poin seri", type: "number", required: true },
    { name: "lossPoints", label: "Poin kalah", type: "number", required: true },
    {
      name: "tieBreakers",
      label: "Tie-breaker (pisahkan koma)",
      type: "csv",
      required: true,
      placeholder: "points, goal_difference, goals_for",
    },
    { name: "regulations", label: "Regulasi musim", type: "textarea" },
  ],
};

export const clubsConfig: ManagerConfig = {
  resource: "clubs",
  title: "Klub",
  singular: "Klub",
  description: "Identitas permanen klub, terpisah dari keikutsertaan musim.",
  columns: [
    { key: "name", label: "Nama" },
    { key: "shortName", label: "Singkat" },
    { key: "city", label: "Domisili" },
    { key: "homeVenue.name", label: "Stadion" },
    { key: "isActive", label: "Aktif", format: "boolean" },
  ],
  fields: [
    { name: "name", label: "Nama klub", required: true },
    { name: "shortName", label: "Nama singkat", required: true },
    { name: "slug", label: "Slug", required: true },
    { name: "city", label: "Domisili" },
    { name: "foundedYear", label: "Tahun berdiri", type: "number" },
    {
      name: "homeVenueId",
      label: "Stadion kandang",
      type: "select",
      source: "venues",
    },
    { name: "contactEmail", label: "Email", type: "email" },
    { name: "contactPhone", label: "Telepon" },
    { name: "logoUrl", label: "Logo (PNG/JPEG/WebP)", type: "file" },
    { name: "isActive", label: "Aktif", type: "checkbox" },
    { name: "description", label: "Deskripsi", type: "textarea" },
  ],
};

export const venuesConfig: ManagerConfig = {
  resource: "venues",
  title: "Venue",
  singular: "Venue",
  description: "Stadion dan lapangan siap untuk pemeriksaan bentrok jadwal.",
  statuses: [
    { value: "AVAILABLE", label: "Tersedia" },
    { value: "MAINTENANCE", label: "Perawatan" },
    { value: "INACTIVE", label: "Nonaktif" },
  ],
  columns: [
    { key: "name", label: "Nama" },
    { key: "city", label: "Kota" },
    { key: "capacity", label: "Kapasitas" },
    { key: "surfaceType", label: "Lapangan" },
    { key: "status", label: "Status", format: "status" },
  ],
  fields: [
    { name: "name", label: "Nama", required: true },
    { name: "city", label: "Kota" },
    { name: "capacity", label: "Kapasitas", type: "number" },
    { name: "surfaceType", label: "Jenis lapangan" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "AVAILABLE", label: "Tersedia" },
        { value: "MAINTENANCE", label: "Perawatan" },
        { value: "INACTIVE", label: "Nonaktif" },
      ],
    },
    { name: "timezone", label: "Zona waktu", required: true },
    { name: "photoUrl", label: "Foto venue", type: "file" },
    { name: "address", label: "Alamat", type: "textarea" },
  ],
};

export const officialsConfig: ManagerConfig = {
  resource: "officials",
  title: "Ofisial",
  singular: "Ofisial",
  description: "Identitas personel independen dari riwayat penugasannya.",
  columns: [
    { key: "fullName", label: "Nama" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telepon" },
    { key: "_count.assignments", label: "Penugasan" },
    { key: "isActive", label: "Aktif", format: "boolean" },
  ],
  fields: [
    { name: "fullName", label: "Nama lengkap", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Telepon" },
    { name: "photoUrl", label: "Foto ofisial", type: "file" },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ],
};

export const participationsConfig: ManagerConfig = {
  resource: "participations",
  title: "Keikutsertaan klub",
  singular: "Keikutsertaan",
  description:
    "Daftarkan identitas klub yang sama ke kompetisi dan musim tanpa duplikasi.",
  statuses: [
    { value: "PENDING", label: "Menunggu" },
    { value: "APPROVED", label: "Disetujui" },
    { value: "WITHDRAWN", label: "Mundur" },
  ],
  columns: [
    { key: "club.name", label: "Klub" },
    { key: "competition.name", label: "Kompetisi" },
    { key: "season.name", label: "Musim" },
    { key: "status", label: "Status", format: "status" },
  ],
  fields: [
    {
      name: "competitionId",
      label: "Kompetisi",
      type: "select",
      source: "competitions",
      required: true,
    },
    {
      name: "seasonId",
      label: "Musim",
      type: "select",
      source: "seasons",
      required: true,
    },
    {
      name: "clubId",
      label: "Klub",
      type: "select",
      source: "clubs",
      required: true,
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      options: [
        { value: "PENDING", label: "Menunggu" },
        { value: "APPROVED", label: "Disetujui" },
        { value: "WITHDRAWN", label: "Mundur" },
      ],
    },
  ],
};

export const assignmentsConfig: ManagerConfig = {
  resource: "assignments",
  title: "Riwayat penugasan",
  singular: "Penugasan",
  description: "Peran personel pada musim dan klub tertentu.",
  columns: [
    { key: "official.fullName", label: "Personel" },
    { key: "role", label: "Peran", format: "status" },
    { key: "season.name", label: "Musim" },
    { key: "club.name", label: "Klub" },
    { key: "startsAt", label: "Mulai", format: "date" },
  ],
  fields: [
    {
      name: "officialId",
      label: "Ofisial",
      type: "select",
      source: "officials",
      required: true,
    },
    {
      name: "seasonId",
      label: "Musim",
      type: "select",
      source: "seasons",
      required: true,
    },
    {
      name: "clubId",
      label: "Klub (opsional)",
      type: "select",
      source: "clubs",
    },
    {
      name: "role",
      label: "Peran",
      type: "select",
      required: true,
      options: [
        { value: "HEAD_COACH", label: "Pelatih" },
        { value: "ASSISTANT_COACH", label: "Asisten pelatih" },
        { value: "CLUB_MANAGER", label: "Manajer klub" },
        { value: "REFEREE", label: "Wasit" },
        { value: "ASSISTANT_REFEREE", label: "Asisten wasit" },
        { value: "MATCH_COMMISSIONER", label: "Match commissioner" },
        { value: "OTHER", label: "Lainnya" },
      ],
    },
    { name: "startsAt", label: "Mulai", type: "date", required: true },
    { name: "endsAt", label: "Selesai", type: "date" },
    { name: "notes", label: "Catatan", type: "textarea" },
  ],
};
