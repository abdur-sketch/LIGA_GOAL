import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseSafety, describeDatabaseUrl } from "../../src/lib/database-safety";

const permissions = [
  "organization.view",
  "organization.update",
  "organization.manage_members",
  "organization.invitation.manage",
  "organization.billing.view",
  "organization.plan_usage.view",
  "organization.billing.manage",
  "organization.refund.request",
  "organization.public_profile.manage",
  "organization.moderation.appeal",
  "competition.view",
  "competition.create",
  "competition.update",
  "competition.delete",
  "competition.publication.manage",
  "season.view",
  "season.create",
  "season.update",
  "season.delete",
  "club.view",
  "club.create",
  "club.update",
  "club.verify",
  "venue.view",
  "venue.create",
  "venue.update",
  "venue.delete",
  "official.view",
  "official.create",
  "official.update",
  "official.delete",
  "player.view",
  "player.create",
  "player.update",
  "player.archive",
  "registration.view",
  "registration.create",
  "registration.submit",
  "registration.verify",
  "registration.approve",
  "registration.reject",
  "squad.view",
  "squad.manage",
  "player_document.view",
  "player_document.upload",
  "player_document.verify",
  "fixture.view",
  "fixture.generate",
  "fixture.create",
  "fixture.update",
  "fixture.publish",
  "fixture.reschedule",
  "fixture.cancel",
  "group.view",
  "group.manage",
  "bracket.view",
  "bracket.manage",
  "schedule.view",
  "schedule.manage",
  "match.view",
  "match.lineup.manage",
  "match.lineup.confirm",
  "match.operate",
  "match.event.correct",
  "match.finish",
  "match.review",
  "match.approve",
  "match.official.correct",
  "match.realtime.publish",
  "standings.view",
  "standings.recompute",
  "standings.adjust",
  "statistics.view",
  "statistics.recompute",
  "statistics.export",
  "leaderboard.view",
  "transfer.view",
  "transfer.request",
  "transfer.review",
  "transfer.approve",
  "transfer.cancel",
  "transfer_window.view",
  "transfer_window.manage",
  "availability.view",
  "availability.manage",
  "injury.view",
  "injury.manage",
  "injury.clearance",
  "discipline.view",
  "discipline.manage",
  "discipline.approve",
  "discipline.appeal",
  "suspension.view",
  "suspension.manage",
  "article.view",
  "article.create",
  "article.update",
  "article.publish",
  "article.archive",
  "notification.view",
  "notification.manage",
  "notification.send",
  "report.view",
  "report.export",
  "audit.view",
];

export default async function globalSetup() {
  const setupUrl = process.env.E2E_SETUP_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!setupUrl || !process.env.DATABASE_URL) throw new Error("DATABASE_URL dan E2E_SETUP_DATABASE_URL wajib tersedia untuk E2E.");
  assertDatabaseSafety({
    operation: "test",
    environment: process.env.LIGA_GOAL_ENVIRONMENT,
    databaseUrl: setupUrl,
    allowedDatabases: process.env.DATABASE_NAME_ALLOWLIST,
    allowedHosts: process.env.DATABASE_HOST_ALLOWLIST,
    mutationConfirmation: process.env.CONFIRM_DATABASE_MUTATION,
  });
  const appTarget = describeDatabaseUrl(process.env.DATABASE_URL);
  const setupTarget = describeDatabaseUrl(setupUrl);
  if (appTarget.host !== setupTarget.host || appTarget.databaseName !== setupTarget.databaseName) {
    throw new Error("E2E setup dan aplikasi wajib menunjuk database test yang sama.");
  }
  const db = new PrismaClient({
    datasources: {
      db: {
        url: setupUrl,
      },
    },
  });
  try {
    const user = await db.user.upsert({
      where: { email: "e2e-admin@ligagoal.test" },
      update: {
        passwordHash: await hash("E2E-password-123!", 10),
        isActive: true,
        isPlatformAdmin: true,
        emailVerifiedAt: new Date(),
      },
      create: {
        name: "E2E Admin",
        email: "e2e-admin@ligagoal.test",
        passwordHash: await hash("E2E-password-123!", 10),
        isPlatformAdmin: true,
        emailVerifiedAt: new Date(),
      },
    });
    for (const permission of ["finance.billing.view", "finance.billing.manage", "discovery.moderate.view", "discovery.moderate.manage", "platform.operations.view", "platform.organizations.manage", "platform.users.view", "platform.audit.view", "organizer.verification.view", "organizer.verification.manage", "abuse.moderate.view", "abuse.moderate.manage"]) {
      await db.platformPermissionGrant.upsert({
        where: { userId_permission: { userId: user.id, permission } },
        update: {},
        create: { userId: user.id, permission, grantedById: user.id, reason: "E2E_FINANCE_SANDBOX" },
      });
    }
    const organization = await db.organization.upsert({
      where: { slug: "e2e-liga-goal" },
      update: { status: "ACTIVE", deletedAt: null, ownerId: user.id },
      create: {
        name: "E2E Liga Goal",
        slug: "e2e-liga-goal",
        status: "ACTIVE",
        ownerId: user.id,
      },
    });
    const enterprisePlan = await db.planVersion.findUniqueOrThrow({ where: { id: "pv_enterprise_v1" } });
    await db.organizationSubscription.upsert({
      where: { organizationId: organization.id },
      update: { planVersionId: enterprisePlan.id, status: "ACTIVE", reason: "E2E_UNLIMITED_REGRESSION" },
      create: { organizationId: organization.id, planVersionId: enterprisePlan.id, status: "ACTIVE", assignedById: user.id, reason: "E2E_UNLIMITED_REGRESSION" },
    });
    const role = await db.role.upsert({
      where: {
        organizationId_key: {
          organizationId: organization.id,
          key: "e2e-owner",
        },
      },
      update: {},
      create: {
        organizationId: organization.id,
        name: "E2E Owner",
        key: "e2e-owner",
        isSystem: true,
      },
    });
    for (const key of permissions) {
      const permission = await db.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key },
      });
      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    await db.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: { roleId: role.id, isActive: true },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roleId: role.id,
      },
    });
    const competition = await db.competition.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: "e2e-phase-3",
        },
      },
      update: { status: "REGISTRATION", format: "SINGLE_ROUND_ROBIN" },
      create: {
        organizationId: organization.id,
        name: "E2E Phase 3",
        slug: "e2e-phase-3",
        status: "REGISTRATION",
        format: "SINGLE_ROUND_ROBIN",
      },
    });
    const province = await db.administrativeArea.findFirstOrThrow({ where: { code: "31", type: "PROVINCE", isActive: true } });
    const city = await db.administrativeArea.findFirstOrThrow({ where: { code: "31.71", isActive: true } });
    await db.publicOrganizerProfile.upsert({
      where: { organizationId: organization.id },
      update: { status: "PUBLISHED", displayName: organization.name, provinceId: province.id, cityId: city.id, publishedAt: new Date(), reviewedById: user.id },
      create: { organizationId: organization.id, publicSlug: organization.slug, displayName: organization.name, description: "Penyelenggara fixture E2E nasional.", status: "PUBLISHED", provinceId: province.id, cityId: city.id, publishedAt: new Date(), reviewedById: user.id },
    });
    await db.organizerVerification.upsert({
      where: { organizationId: organization.id },
      update: { status: "VERIFIED", reviewedAt: new Date(), reviewedById: user.id, reviewReason: "E2E verified fixture" },
      create: { organizationId: organization.id, status: "VERIFIED", reviewedAt: new Date(), reviewedById: user.id, reviewReason: "E2E verified fixture" },
    });
    await db.competitionPublication.upsert({
      where: { competitionId: competition.id },
      update: { status: "PUBLISHED", provinceId: province.id, cityId: city.id, searchText: "e2e phase 3 liga goal jakarta", publishedAt: new Date(), reviewedById: user.id },
      create: { organizationId: organization.id, competitionId: competition.id, publicSlug: competition.slug, status: "PUBLISHED", provinceId: province.id, cityId: city.id, searchText: "e2e phase 3 liga goal jakarta", publishedAt: new Date(), reviewedById: user.id },
    });
    const season = await db.season.upsert({
      where: {
        competitionId_name: {
          competitionId: competition.id,
          name: "Phase 3 2026",
        },
      },
      update: {
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        status: "ACTIVE",
      },
      create: {
        competitionId: competition.id,
        name: "Phase 3 2026",
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        status: "ACTIVE",
        isActive: true,
      },
    });
    const clubs = await Promise.all(
      ["Alpha", "Bravo", "Charlie", "Delta"].map(async (name) =>
        db.club.upsert({
          where: {
            organizationId_slug: {
              organizationId: organization.id,
              slug: `e2e-${name.toLowerCase()}`,
            },
          },
          update: { deletedAt: null, isActive: true },
          create: {
            organizationId: organization.id,
            name: `${name} FC`,
            shortName: name.slice(0, 3).toUpperCase(),
            slug: `e2e-${name.toLowerCase()}`,
          },
        }),
      ),
    );
    for (const club of clubs)
      await db.competitionClub.upsert({
        where: { seasonId_clubId: { seasonId: season.id, clubId: club.id } },
        update: { status: "APPROVED" },
        create: {
          organizationId: organization.id,
          competitionId: competition.id,
          seasonId: season.id,
          clubId: club.id,
          status: "APPROVED",
        },
      });
    await db.stage.upsert({
      where: { seasonId_sortOrder: { seasonId: season.id, sortOrder: 1 } },
      update: {
        name: "Round Robin",
        type: "ROUND_ROBIN",
        format: "SINGLE_ROUND_ROBIN",
      },
      create: {
        organizationId: organization.id,
        seasonId: season.id,
        name: "Round Robin",
        sortOrder: 1,
        type: "ROUND_ROBIN",
        format: "SINGLE_ROUND_ROBIN",
      },
    });
    await db.stage.upsert({
      where: { seasonId_sortOrder: { seasonId: season.id, sortOrder: 2 } },
      update: { name: "Group Stage", type: "GROUP", format: "GROUP_STAGE" },
      create: {
        organizationId: organization.id,
        seasonId: season.id,
        name: "Group Stage",
        sortOrder: 2,
        type: "GROUP",
        format: "GROUP_STAGE",
      },
    });
    await db.stage.upsert({
      where: { seasonId_sortOrder: { seasonId: season.id, sortOrder: 3 } },
      update: {
        name: "Knockout",
        type: "KNOCKOUT",
        format: "SINGLE_ELIMINATION",
      },
      create: {
        organizationId: organization.id,
        seasonId: season.id,
        name: "Knockout",
        sortOrder: 3,
        type: "KNOCKOUT",
        format: "SINGLE_ELIMINATION",
      },
    });
    if (
      !(await db.venue.findFirst({
        where: { organizationId: organization.id, name: "E2E Stadium" },
      }))
    )
      await db.venue.create({
        data: {
          organizationId: organization.id,
          name: "E2E Stadium",
          status: "AVAILABLE",
          timezone: "Asia/Jakarta",
        },
      });
    await db.official.upsert({
      where: {
        organizationId_email: {
          organizationId: organization.id,
          email: "referee@e2e.test",
        },
      },
      update: { isActive: true },
      create: {
        organizationId: organization.id,
        fullName: "E2E Referee",
        email: "referee@e2e.test",
      },
    });
    const liveStage = await db.stage.findUniqueOrThrow({
      where: { seasonId_sortOrder: { seasonId: season.id, sortOrder: 1 } },
    });
    const teams = await Promise.all(
      clubs.slice(0, 2).map((club) =>
        db.team.upsert({
          where: {
            competitionId_clubId: {
              competitionId: competition.id,
              clubId: club.id,
            },
          },
          update: { name: club.name },
          create: {
            competitionId: competition.id,
            clubId: club.id,
            name: club.name,
          },
        }),
      ),
    );
    await db.match.upsert({
      where: {
        seasonId_matchNumber: { seasonId: season.id, matchNumber: 900 },
      },
      update: {
        status: "SCHEDULED",
        publishedAt: new Date(),
        homeScore: 0,
        awayScore: 0,
      },
      create: {
        organizationId: organization.id,
        competitionId: competition.id,
        seasonId: season.id,
        stageId: liveStage.id,
        homeTeamId: teams[0].id,
        awayTeamId: teams[1].id,
        matchNumber: 900,
        round: 1,
        kickoffAt: new Date("2026-12-01T12:00:00Z"),
        status: "SCHEDULED",
        publishedAt: new Date(),
        createdById: user.id,
      },
    });
  } finally {
    await db.$disconnect();
  }
}
