import { CompetitionFormat, CompetitionStatus } from "@prisma/client";
import { z } from "zod";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
const optionalSlug = z.preprocess((value) => value === "" ? undefined : value, slug.optional());
const optionalText = (max: number) => z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(max).optional());

export const discoveryQuerySchema = z.object({
  q: optionalText(80),
  province: optionalSlug,
  city: optionalSlug,
  format: z.preprocess((value) => value === "" ? undefined : value, z.nativeEnum(CompetitionFormat).optional()),
  ageCategory: optionalText(40),
  status: z.preprocess((value) => value === "" ? undefined : value, z.nativeEnum(CompetitionStatus).optional()),
  season: optionalText(80),
  sort: z.enum(["newest", "upcoming", "popular"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
}).strict();

export const organizerDirectoryQuerySchema = z.object({
  q: optionalText(80),
  province: optionalSlug,
  city: optionalSlug,
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
}).strict();

const publicContact = z.preprocess((value) => value === "" ? null : value, z.string().trim().max(160).nullable().optional());
const httpUrl = z.string().trim().url().max(500).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "URL publik harus menggunakan HTTP atau HTTPS.");
const publicUrl = z.preprocess((value) => value === "" ? null : value, httpUrl.nullable().optional());
const publicEmail = z.preprocess((value) => value === "" ? null : value, z.string().trim().toLowerCase().email().max(254).nullable().optional());

export const organizerProfileInputSchema = z.object({
  organizationId: z.string().min(1),
  displayName: z.string().trim().min(3).max(120),
  description: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(2_000).nullable().optional()),
  logoUrl: publicUrl,
  websiteUrl: publicUrl,
  publicContactEmail: publicEmail,
  publicContactPhone: publicContact,
  provinceId: z.preprocess((value) => value === "" ? null : value, z.string().min(1).nullable().optional()),
  cityId: z.preprocess((value) => value === "" ? null : value, z.string().min(1).nullable().optional()),
}).strict();

export const competitionPublicationInputSchema = z.object({
  organizationId: z.string().min(1),
  competitionId: z.string().min(1),
  ageCategory: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(40).nullable().optional()),
  provinceId: z.preprocess((value) => value === "" ? null : value, z.string().min(1).nullable().optional()),
  cityId: z.preprocess((value) => value === "" ? null : value, z.string().min(1).nullable().optional()),
}).strict();

export const publicationActionSchema = z.object({
  organizationId: z.string().min(1),
  entity: z.enum(["organizer", "competition"]),
  id: z.string().min(1),
  action: z.enum(["submit", "unpublish"]),
}).strict();

export const moderationActionSchema = z.object({
  entity: z.enum(["organizer", "competition"]),
  id: z.string().min(1),
  action: z.enum(["publish", "unpublish", "suspend"]),
  reason: z.string().trim().min(8).max(500),
}).strict();
