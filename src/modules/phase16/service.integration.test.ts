import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import {
  discoveryModerationQueue,
  discoveryWorkspace,
  getPublicOrganizer,
  moderateDiscoveryPublication,
  organizerPublicationAction,
  publicSitemapDiscovery,
  saveCompetitionPublication,
  saveOrganizerPublicProfile,
  searchPublicCompetitions,
} from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const setup = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : db;
let ownerId = "",
  outsiderId = "",
  moderatorId = "",
  organizationId = "",
  otherOrganizationId = "",
  competitionId = "",
  profileId = "",
  publicationId = "",
  provinceId = "",
  cityId = "",
  provinceSlug = "",
  citySlug = "";
const actor = (id: string, isPlatformAdmin = false) => ({
  id,
  isActive: true,
  isPlatformAdmin,
  deletedAt: null,
});

describe.sequential("Phase 16 national discovery security", () => {
  afterAll(async () => { if (ownerUrl) await setup.$disconnect(); });
  beforeAll(async () => {
    const province = await setup.administrativeArea.findFirstOrThrow({
      where: { code: "31", type: "PROVINCE", isActive: true },
    });
    const city = await setup.administrativeArea.findFirstOrThrow({
      where: { code: "31.71", parentId: province.id, isActive: true },
    });
    provinceId = province.id;
    cityId = city.id;
    provinceSlug = province.slug;
    citySlug = city.slug;
    const [organization, other] = await Promise.all([
      setup.organization.create({
        data: {
          name: "Discovery Tenant",
          slug: `discovery-${suffix}`,
          status: "ACTIVE",
        },
      }),
      setup.organization.create({
        data: {
          name: "Discovery Other",
          slug: `discovery-other-${suffix}`,
          status: "ACTIVE",
        },
      }),
    ]);
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const permissions = await Promise.all(
      [
        "organization.public_profile.manage",
        "competition.publication.manage",
      ].map((key) =>
        setup.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
        }),
      ),
    );
    const role = await setup.role.create({
      data: {
        organizationId,
        name: "Discovery owner",
        key: `discovery-owner-${suffix}`,
        permissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
    });
    const [owner, outsider, moderator] = await Promise.all([
      setup.user.create({
        data: {
          name: "Owner",
          email: `owner-${suffix}@test.invalid`,
          passwordHash: "test",
          emailVerifiedAt: new Date(),
        },
      }),
      setup.user.create({
        data: {
          name: "Outsider",
          email: `outsider-${suffix}@test.invalid`,
          passwordHash: "test",
          emailVerifiedAt: new Date(),
        },
      }),
      setup.user.create({
        data: {
          name: "Moderator",
          email: `moderator-${suffix}@test.invalid`,
          passwordHash: "test",
          emailVerifiedAt: new Date(),
          isPlatformAdmin: true,
        },
      }),
    ]);
    ownerId = owner.id;
    outsiderId = outsider.id;
    moderatorId = moderator.id;
    await setup.organizationMember.create({
      data: { organizationId, userId: ownerId, roleId: role.id },
    });
    for (const permission of [
      "discovery.moderate.view",
      "discovery.moderate.manage",
    ])
      await setup.platformPermissionGrant.create({
        data: {
          userId: moderatorId,
          permission,
          grantedById: moderatorId,
          reason: "PHASE16_TEST",
        },
      });
    const competition = await setup.competition.create({
      data: {
        organizationId,
        name: "Líga Nusantara Test",
        slug: `liga-nusantara-${suffix}`,
        description: "Publik aman",
        format: "SINGLE_ROUND_ROBIN",
        status: "ONGOING",
      },
    });
    competitionId = competition.id;
  });

  it("provisions tenant-owned drafts and blocks cross-tenant access", async () => {
    const profile = await saveOrganizerPublicProfile(actor(ownerId), {
      organizationId,
      displayName: "Discovery Organizer",
      description: "Profil publik tanpa kontak privat",
      provinceId,
      cityId,
    });
    profileId = profile.id;
    const publication = await saveCompetitionPublication(actor(ownerId), {
      organizationId,
      competitionId,
      ageCategory: "Senior",
      provinceId,
      cityId,
    });
    publicationId = publication.id;
    expect(profile.status).toBe("DRAFT");
    expect(publication.status).toBe("DRAFT");
    await expect(
      discoveryWorkspace(actor(outsiderId), organizationId),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    await expect(
      saveCompetitionPublication(actor(ownerId), {
        organizationId: otherOrganizationId,
        competitionId,
        provinceId,
        cityId,
      }),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
  });

  it("keeps draft/pending content private and publishes only after explicit moderation", async () => {
    expect((await searchPublicCompetitions({ q: "Nusantara" })).total).toBe(0);
    await organizerPublicationAction(actor(ownerId), {
      organizationId,
      entity: "organizer",
      id: profileId,
      action: "submit",
    });
    await organizerPublicationAction(actor(ownerId), {
      organizationId,
      entity: "competition",
      id: publicationId,
      action: "submit",
    });
    expect((await searchPublicCompetitions({ q: "Nusantara" })).total).toBe(0);
    const queue = await discoveryModerationQueue(actor(moderatorId, true));
    expect(queue.organizers.some((item) => item.id === profileId)).toBe(true);
    await moderateDiscoveryPublication(actor(moderatorId, true), {
      entity: "organizer",
      id: profileId,
      action: "publish",
      reason: "Data profil layak dipublikasikan",
    });
    await moderateDiscoveryPublication(actor(moderatorId, true), {
      entity: "competition",
      id: publicationId,
      action: "publish",
      reason: "Data kompetisi layak dipublikasikan",
    });
    const result = await searchPublicCompetitions({
      q: "Liga Nusantara",
      province: provinceSlug,
      city: citySlug,
    });
    expect(result.items.some((item) => item.id === competitionId)).toBe(true);
  });

  it("requires explicit platform grants and never exposes organization-private contacts", async () => {
    await expect(
      discoveryModerationQueue(actor(ownerId, true)),
    ).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    const profile = await getPublicOrganizer(`discovery-${suffix}`);
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("owner-");
    expect(serialized).not.toContain("passwordHash");
  });

  it("uses stable pagination and excludes unpublished content from sitemap", async () => {
    const first = await searchPublicCompetitions({
      sort: "newest",
      page: 1,
      pageSize: 1,
    });
    const repeated = await searchPublicCompetitions({
      sort: "newest",
      page: 1,
      pageSize: 1,
    });
    expect(first.items.map((item) => item.id)).toEqual(
      repeated.items.map((item) => item.id),
    );
    expect(
      (await publicSitemapDiscovery()).competitions.some((item) =>
        item.publicSlug.includes(`liga-nusantara-${suffix}`),
      ),
    ).toBe(true);
    await organizerPublicationAction(actor(ownerId), {
      organizationId,
      entity: "competition",
      id: publicationId,
      action: "unpublish",
    });
    expect(
      (await publicSitemapDiscovery()).competitions.some((item) =>
        item.publicSlug.includes(`liga-nusantara-${suffix}`),
      ),
    ).toBe(false);
  });
});
