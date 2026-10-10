import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const permissions = [
  "organization.view",
  "organization.update",
  "organization.manage_members",
  "competition.view",
  "competition.create",
  "competition.update",
  "competition.delete",
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
  const db = new PrismaClient();
  try {
    const user = await db.user.upsert({
      where: { email: "e2e-admin@ligagoal.test" },
      update: {
        passwordHash: await hash("E2E-password-123!", 10),
        isActive: true,
        isPlatformAdmin: true,
      },
      create: {
        name: "E2E Admin",
        email: "e2e-admin@ligagoal.test",
        passwordHash: await hash("E2E-password-123!", 10),
        isPlatformAdmin: true,
      },
    });
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
