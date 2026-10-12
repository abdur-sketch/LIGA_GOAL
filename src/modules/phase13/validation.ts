import { z } from "zod";

const normalizedEmail = z
  .string()
  .trim()
  .email("Format email tidak valid.")
  .max(254)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(12, "Password minimal 12 karakter.")
  .max(128)
  .regex(/[a-z]/, "Password harus memiliki huruf kecil.")
  .regex(/[A-Z]/, "Password harus memiliki huruf besar.")
  .regex(/[0-9]/, "Password harus memiliki angka.")
  .regex(/[^A-Za-z0-9]/, "Password harus memiliki simbol.");

export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: normalizedEmail,
  password: passwordSchema,
  website: z.string().max(0).optional().default(""),
  startedAt: z.number().int().positive().optional(),
});

export const verificationSchema = z.object({
  token: z.string().min(32).max(256),
});

export const resendVerificationSchema = z.object({ email: normalizedEmail });

export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(3).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  organizerType: z.enum(["COMMUNITY", "CLUB_ASSOCIATION", "SCHOOL", "CORPORATE", "GOVERNMENT", "FEDERATION", "OTHER"]),
  region: z.string().trim().min(2).max(120),
  contactEmail: normalizedEmail,
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsVersion: z.string().min(1).max(50),
  privacyVersion: z.string().min(1).max(50),
  idempotencyKey: z.string().uuid(),
});

export const invitationSchema = z.object({
  email: normalizedEmail,
  roleId: z.string().min(1).max(100),
});

export const invitationActionSchema = z.object({
  token: z.string().min(32).max(256),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
