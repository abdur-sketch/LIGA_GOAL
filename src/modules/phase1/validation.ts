import { z } from "zod";

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);
const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === "" ||
      /^https?:\/\//.test(value) ||
      /^\/api\/media\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(value),
    "URL atau asset gambar tidak valid.",
  )
  .optional()
  .nullable()
  .transform((value) => value || null);
const optionalEmail = z
  .string()
  .trim()
  .email()
  .max(254)
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((value) => value || null);
const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.",
  );
const date = z.coerce.date();

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  logoUrl: optionalUrl,
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  address: optionalText(500),
  ownerId: optionalText(64),
  status: z
    .enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"])
    .default("ACTIVE"),
});

export const competitionSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug,
    logoUrl: optionalUrl,
    description: optionalText(4000),
    category: optionalText(100),
    location: optionalText(200),
    regulations: optionalText(20_000),
    format: z.enum([
      "SINGLE_ROUND_ROBIN",
      "DOUBLE_ROUND_ROBIN",
      "GROUP_STAGE",
      "SINGLE_ELIMINATION",
      "GROUP_AND_KNOCKOUT",
    ]),
    status: z
      .enum(["DRAFT", "REGISTRATION", "ONGOING", "COMPLETED", "ARCHIVED"])
      .default("DRAFT"),
    startsAt: date.optional().nullable(),
    endsAt: date.optional().nullable(),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.endsAt >= data.startsAt,
    {
      message: "Tanggal selesai harus setelah tanggal mulai.",
      path: ["endsAt"],
    },
  );

export const seasonSchema = z
  .object({
    competitionId: z.string().cuid(),
    name: z.string().trim().min(2).max(100),
    startsAt: date,
    endsAt: date,
    status: z
      .enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .default("DRAFT"),
    isActive: z.boolean().default(false),
    regulations: optionalText(20_000),
    winPoints: z.coerce.number().int().min(-20).max(20).default(3),
    drawPoints: z.coerce.number().int().min(-20).max(20).default(1),
    lossPoints: z.coerce.number().int().min(-20).max(20).default(0),
    tieBreakers: z
      .array(
        z.enum([
          "points",
          "goal_difference",
          "goals_for",
          "head_to_head",
          "fair_play",
        ]),
      )
      .min(1),
  })
  .refine((data) => data.endsAt >= data.startsAt, {
    message: "Tanggal selesai harus setelah tanggal mulai.",
    path: ["endsAt"],
  });

export const clubSchema = z.object({
  name: z.string().trim().min(2).max(140),
  shortName: z.string().trim().min(2).max(20),
  slug,
  logoUrl: optionalUrl,
  city: optionalText(120),
  foundedYear: z.coerce
    .number()
    .int()
    .min(1850)
    .max(new Date().getFullYear())
    .optional()
    .nullable(),
  description: optionalText(4000),
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  homeVenueId: optionalText(64),
  isActive: z.boolean().default(true),
});

export const venueSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: optionalText(500),
  city: optionalText(120),
  capacity: z.coerce.number().int().min(0).max(500_000).optional().nullable(),
  surfaceType: optionalText(80),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "INACTIVE"]).default("AVAILABLE"),
  photoUrl: optionalUrl,
  timezone: z.string().trim().min(3).max(80).default("Asia/Jakarta"),
});

export const officialSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: optionalEmail,
  phone: optionalText(40),
  photoUrl: optionalUrl,
  isActive: z.boolean().default(true),
});

export const participationSchema = z.object({
  competitionId: z.string().cuid(),
  seasonId: z.string().cuid(),
  clubId: z.string().cuid(),
  status: z.enum(["PENDING", "APPROVED", "WITHDRAWN"]).default("PENDING"),
});

export const assignmentSchema = z
  .object({
    officialId: z.string().cuid(),
    seasonId: z.string().cuid(),
    clubId: z.string().cuid().optional().nullable(),
    role: z.enum([
      "HEAD_COACH",
      "ASSISTANT_COACH",
      "CLUB_MANAGER",
      "REFEREE",
      "ASSISTANT_REFEREE",
      "MATCH_COMMISSIONER",
      "OTHER",
    ]),
    startsAt: date,
    endsAt: date.optional().nullable(),
    notes: optionalText(1000),
  })
  .refine((data) => !data.endsAt || data.endsAt >= data.startsAt, {
    message: "Tanggal akhir penugasan tidak valid.",
    path: ["endsAt"],
  });

export const membershipSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  roleKey: z.string().trim().min(2).max(80),
  isActive: z.boolean().default(true),
});

export const schemas = {
  organizations: organizationSchema,
  memberships: membershipSchema,
  competitions: competitionSchema,
  seasons: seasonSchema,
  clubs: clubSchema,
  venues: venueSchema,
  officials: officialSchema,
  participations: participationSchema,
  assignments: assignmentSchema,
} as const;

export type ResourceName = keyof typeof schemas;
