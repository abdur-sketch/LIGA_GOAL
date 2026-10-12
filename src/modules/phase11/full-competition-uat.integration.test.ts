import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { eligibilityAt } from "@/modules/phase6/eligibility";
import {
  generateFixturePreview,
  publishGeneration,
  validateGeneration,
} from "@/modules/phase3/service";
import {
  confirmLineup,
  correctEvent,
  createEvent,
  getMatchSnapshot,
  publicRealtimeMessages,
  requestOfficialCorrection,
  reviewMatch,
  reviewOfficialCorrection,
  saveLineup,
  transitionMatch,
} from "@/modules/phase4/service";
import { getStatisticsForExport } from "@/modules/phase5/service";
import {
  actionTransfer,
  createTransfer,
  createTransferWindow,
} from "@/modules/phase6/service";
import {
  getPublicCompetition,
  getPublicMatch,
  getPublicStatistics,
} from "@/modules/phase7/service";

const enabled = process.env.PHASE11_FULL_UAT === "1";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const platform = (id: string) => ({
  id,
  isActive: true,
  isPlatformAdmin: true,
  deletedAt: null,
});

describe
  .skipIf(!enabled)
  .sequential("Phase 11 single-chain 25-step competition UAT", () => {
    it("uses one organization, competition, and season from creation through the public portal", async () => {
      const evidence: Array<{
        step: number;
        assertion: string;
        value: unknown;
      }> = [];
      const record = (step: number, assertion: string, value: unknown) =>
        evidence.push({ step, assertion, value });

      const organization = await db.organization.create({
        data: {
          name: "Phase 11 UAT",
          slug: `phase11-uat-${suffix}`,
          status: "ACTIVE",
        },
      });
      record(1, "organization created", organization.id);
      const otherOrganization = await db.organization.create({
        data: {
          name: "Phase 11 Other",
          slug: `phase11-other-${suffix}`,
          status: "ACTIVE",
        },
      });
      const [operatorUser, approverUser, outsiderUser] = await Promise.all([
        db.user.create({
          data: {
            name: "UAT Operator",
            email: `uat-operator-${suffix}@test.invalid`,
            passwordHash: "test",
            isPlatformAdmin: true,
          },
        }),
        db.user.create({
          data: {
            name: "UAT Approver",
            email: `uat-approver-${suffix}@test.invalid`,
            passwordHash: "test",
            isPlatformAdmin: true,
          },
        }),
        db.user.create({
          data: {
            name: "UAT Outsider",
            email: `uat-outsider-${suffix}@test.invalid`,
            passwordHash: "test",
          },
        }),
      ]);
      const operator = platform(operatorUser.id);
      const approver = platform(approverUser.id);
      const outsider = {
        id: outsiderUser.id,
        isActive: true,
        isPlatformAdmin: false,
        deletedAt: null,
      };

      const competition = await db.competition.create({
        data: {
          organizationId: organization.id,
          name: "Phase 11 Championship",
          slug: `phase11-championship-${suffix}`,
          format: "SINGLE_ROUND_ROBIN",
          status: "ONGOING",
        },
      });
      await db.publicOrganizerProfile.create({ data: { organizationId: organization.id, publicSlug: organization.slug, displayName: organization.name, status: "PUBLISHED", publishedAt: new Date(), reviewedById: operatorUser.id } });
      await db.competitionPublication.create({ data: { organizationId: organization.id, competitionId: competition.id, publicSlug: competition.slug, status: "PUBLISHED", searchText: competition.name.toLowerCase(), publishedAt: new Date(), reviewedById: operatorUser.id } });
      record(2, "competition created", competition.id);
      await db.competitionRule.createMany({
        data: [
          {
            competitionId: competition.id,
            key: "match_rules",
            value: {
              playersOnField: 5,
              substitutesLimit: 2,
              publicLineup: true,
              separationOfDuties: true,
            },
          },
          {
            competitionId: competition.id,
            key: "discipline_rules",
            value: { yellowThreshold: 3, redCardMatchBans: 1 },
          },
          {
            competitionId: competition.id,
            key: "transfer_rules",
            value: {
              approvalOrder: ["SOURCE_CLUB", "DESTINATION_CLUB", "COMPETITION"],
            },
          },
        ],
      });
      const season = await db.season.create({
        data: {
          competitionId: competition.id,
          name: `2026-${suffix}`,
          startsAt: new Date("2026-01-01"),
          endsAt: new Date("2026-12-31"),
          status: "ACTIVE",
          isActive: true,
        },
      });
      record(3, "season created", season.id);
      const stage = await db.stage.create({
        data: {
          organizationId: organization.id,
          seasonId: season.id,
          name: "League",
          sortOrder: 1,
          type: "ROUND_ROBIN",
          format: "SINGLE_ROUND_ROBIN",
          publishedAt: new Date(),
        },
      });
      const knockoutStage = await db.stage.create({
        data: {
          organizationId: organization.id,
          seasonId: season.id,
          name: "Finals",
          sortOrder: 2,
          type: "KNOCKOUT",
          format: "SINGLE_ELIMINATION",
          publishedAt: new Date(),
        },
      });
      const clubs = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          db.club.create({
            data: {
              organizationId: organization.id,
              name: `UAT Club ${index + 1}`,
              shortName: `U${index + 1}`,
              slug: `uat-club-${index + 1}-${suffix}`,
            },
          }),
        ),
      );
      for (const club of clubs)
        await db.competitionClub.create({
          data: {
            organizationId: organization.id,
            competitionId: competition.id,
            seasonId: season.id,
            clubId: club.id,
            status: "APPROVED",
          },
        });
      record(
        4,
        "four clubs registered",
        await db.competitionClub.count({
          where: {
            competitionId: competition.id,
            seasonId: season.id,
            status: "APPROVED",
          },
        }),
      );

      const registrations = new Map<
        string,
        Array<{ id: string; playerId: string; jerseyNumber: number }>
      >();
      for (const [clubIndex, club] of clubs.entries()) {
        const clubRegistrations = [];
        for (let playerIndex = 1; playerIndex <= 6; playerIndex += 1) {
          const player = await db.player.create({
            data: {
              organizationId: organization.id,
              activeClubId: club.id,
              fullName: `UAT ${club.shortName} Player ${playerIndex}`,
              dateOfBirth: new Date("2000-01-01"),
              status: "ACTIVE",
              privateProfile: {
                create: {
                  legalFullName: `PRIVATE ${club.shortName} ${playerIndex}`,
                  privateNotes: "never public",
                },
              },
            },
          });
          const registration = await db.playerRegistration.create({
            data: {
              organizationId: organization.id,
              competitionId: competition.id,
              seasonId: season.id,
              clubId: club.id,
              playerId: player.id,
              idempotencyKey: `uat-registration-${clubIndex}-${playerIndex}-${suffix}`,
              jerseyNumber: playerIndex,
              status: "APPROVED",
              verificationStatus: "VERIFIED",
              eligibilityStatus: "ELIGIBLE",
              approvedById: approverUser.id,
              approvedAt: new Date(),
              rosterEntry: {
                create: {
                  organizationId: organization.id,
                  seasonId: season.id,
                  clubId: club.id,
                  jerseyNumber: playerIndex,
                  status: "ACTIVE",
                },
              },
            },
          });
          clubRegistrations.push({
            id: registration.id,
            playerId: player.id,
            jerseyNumber: playerIndex,
          });
        }
        registrations.set(club.id, clubRegistrations);
      }
      record(
        5,
        "twenty-four players registered",
        await db.playerRegistration.count({
          where: { competitionId: competition.id, seasonId: season.id },
        }),
      );
      const documented = registrations.get(clubs[0].id)![0];
      const document = await db.playerDocument.create({
        data: {
          organizationId: organization.id,
          playerId: documented.playerId,
          registrationId: documented.id,
          type: "IDENTITY",
          storageKey: `${organization.id}/${suffix}.pdf`,
          originalName: "identity.pdf",
          mimeType: "application/pdf",
          sizeBytes: 128,
          verificationStatus: "APPROVED",
          uploadedById: operatorUser.id,
          verifications: {
            create: {
              verifierId: approverUser.id,
              status: "APPROVED",
              notes: "Synthetic UAT document",
            },
          },
        },
      });
      expect(document.verificationStatus).toBe("APPROVED");
      record(6, "document verified", document.id);
      const documentedEligibility = await eligibilityAt(
        organization.id,
        documented.playerId,
        season.id,
        clubs[0].id,
        new Date("2026-05-01T10:00:00Z"),
      );
      expect(documentedEligibility.result).toBe("ELIGIBLE");
      record(7, "eligibility validated", documentedEligibility.result);

      const group = await db.group.create({
        data: {
          organizationId: organization.id,
          stageId: stage.id,
          name: "Group A",
        },
      });
      await db.groupMembership.createMany({
        data: clubs.map((club, index) => ({
          organizationId: organization.id,
          groupId: group.id,
          stageId: stage.id,
          clubId: club.id,
          seed: index + 1,
        })),
      });
      expect(
        await db.groupMembership.count({ where: { groupId: group.id } }),
      ).toBe(4);
      record(8, "group created", group.id);
      const venue = await db.venue.create({
        data: {
          organizationId: organization.id,
          name: "UAT Stadium",
          status: "AVAILABLE",
        },
      });
      const referee = await db.official.create({
        data: {
          organizationId: organization.id,
          fullName: "UAT Referee",
          email: `uat-referee-${suffix}@test.invalid`,
        },
      });
      const generation = await generateFixturePreview(
        operator,
        organization.id,
        {
          competitionId: competition.id,
          seasonId: season.id,
          stageId: stage.id,
          idempotencyKey: `uat-generation-${suffix}`,
          format: "SINGLE_ROUND_ROBIN",
          drawMethod: "SEEDED",
          clubIds: clubs.map((club) => club.id),
          kickoffStart: "2026-05-01T10:00:00.000Z",
          daysBetweenRounds: 7,
          venueIds: [venue.id],
          refereeIds: [referee.id],
          config: {
            numberOfGroups: 1,
            qualifiersPerGroup: 1,
            rounds: 1,
            homeAway: false,
            drawMethod: "SEEDED",
            tieBreakers: ["points", "goal_difference", "goals_for"],
            knockoutLegs: 1,
            extraTime: true,
            penaltyShootout: true,
            thirdPlace: false,
            minimumRestHours: 24,
            matchDurationMinutes: 120,
            timezone: "Asia/Jakarta",
          },
        },
      );
      expect(generation.drafts).toHaveLength(6);
      await validateGeneration(operator, organization.id, generation.id);
      record(9, "six fixtures generated", generation.drafts.length);
      const publication = await publishGeneration(
        operator,
        organization.id,
        generation.id,
        { idempotencyKey: `uat-publication-${suffix}` },
      );
      if (!publication) throw new Error("Fixture publication was not created.");
      expect(publication.fixtureCount).toBe(6);
      record(10, "fixtures published", publication.id);
      const match = await db.match.findFirstOrThrow({
        where: { fixtureDraft: { generationId: generation.id } },
        include: { homeTeam: true, awayTeam: true },
      });
      const home = registrations.get(match.homeTeam.clubId)!;
      const away = registrations.get(match.awayTeam.clubId)!;
      const lineup = (teamId: string, entries: typeof home) => ({
        teamId,
        formation: "1-2-1",
        players: entries.map((entry, index) => ({
          registrationId: entry.id,
          playerId: entry.playerId,
          role: index < 5 ? ("STARTER" as const) : ("SUBSTITUTE" as const),
          shirtNumber: entry.jerseyNumber,
          isCaptain: index === 0,
          isGoalkeeper: index === 0,
        })),
      });
      await saveLineup(
        operator,
        organization.id,
        match.id,
        lineup(match.homeTeamId, home),
      );
      await saveLineup(
        operator,
        organization.id,
        match.id,
        lineup(match.awayTeamId, away),
      );
      await confirmLineup(
        operator,
        organization.id,
        match.id,
        match.homeTeamId,
      );
      await confirmLineup(
        operator,
        organization.id,
        match.id,
        match.awayTeamId,
      );
      expect(
        (await db.match.findUniqueOrThrow({ where: { id: match.id } })).status,
      ).toBe("LINEUP_CONFIRMED");
      record(11, "both lineups confirmed", match.id);

      let current = await db.match.findUniqueOrThrow({
        where: { id: match.id },
      });
      current = await transitionMatch(operator, organization.id, match.id, {
        status: "LIVE_FIRST_HALF",
        expectedVersion: current.version,
      });
      record(12, "match started", current.status);
      const goal = await createEvent(operator, organization.id, match.id, {
        idempotencyKey: `uat-goal-${suffix}`,
        eventType: "GOAL",
        period: "FIRST_HALF",
        teamId: match.homeTeamId,
        playerId: home[0].playerId,
        relatedPlayerId: home[1].playerId,
        minute: 12,
        expectedVersion: current.version,
      });
      current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
      const assist = await createEvent(operator, organization.id, match.id, {
        idempotencyKey: `uat-assist-${suffix}`,
        eventType: "ASSIST",
        period: "FIRST_HALF",
        teamId: match.homeTeamId,
        playerId: home[1].playerId,
        relatedPlayerId: home[0].playerId,
        minute: 12,
        expectedVersion: current.version,
      });
      expect(goal.score.home).toBe(1);
      expect(assist.event.eventType).toBe("ASSIST");
      record(13, "goal and assist recorded", [goal.event.id, assist.event.id]);
      const duplicate = await createEvent(operator, organization.id, match.id, {
        idempotencyKey: `uat-goal-${suffix}`,
        eventType: "GOAL",
        period: "FIRST_HALF",
        teamId: match.homeTeamId,
        playerId: home[0].playerId,
        relatedPlayerId: home[1].playerId,
        minute: 12,
        expectedVersion: 1,
      });
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.event.id).toBe(goal.event.id);
      current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
      const red = await createEvent(operator, organization.id, match.id, {
        idempotencyKey: `uat-red-${suffix}`,
        eventType: "RED_CARD",
        period: "FIRST_HALF",
        teamId: match.awayTeamId,
        playerId: away[0].playerId,
        minute: 35,
        expectedVersion: current.version,
      });
      current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
      await createEvent(operator, organization.id, match.id, {
        idempotencyKey: `uat-sub-${suffix}`,
        eventType: "SUBSTITUTION",
        period: "FIRST_HALF",
        teamId: match.awayTeamId,
        playerId: away[1].playerId,
        relatedPlayerId: away[5].playerId,
        minute: 40,
        expectedVersion: current.version,
      });
      expect(red.event.eventType).toBe("RED_CARD");
      record(14, "card and substitution recorded", red.event.id);
      current = await db.match.findUniqueOrThrow({ where: { id: match.id } });
      for (const status of [
        "HALF_TIME",
        "LIVE_SECOND_HALF",
        "FINISHED_PENDING_APPROVAL",
      ] as const)
        current = await transitionMatch(operator, organization.id, match.id, {
          status,
          expectedVersion: current.version,
        });
      expect(current.status).toBe("FINISHED_PENDING_APPROVAL");
      record(15, "match finished", current.status);
      const pendingResult = await getMatchSnapshot(
        approver,
        organization.id,
        match.id,
      );
      expect(pendingResult.status).toBe("FINISHED_PENDING_APPROVAL");
      record(
        16,
        "result reviewed",
        `${pendingResult.homeScore}-${pendingResult.awayScore}`,
      );

      const finalTie = await db.bracketTie.create({
        data: {
          organizationId: organization.id,
          competitionId: competition.id,
          stageId: knockoutStage.id,
          round: 2,
          position: 1,
          label: "Final",
          slots: {
            create: [
              {
                organizationId: organization.id,
                side: "HOME",
                sourceLabel: "Winner",
              },
              {
                organizationId: organization.id,
                side: "AWAY",
                sourceLabel: "Other finalist",
              },
            ],
          },
        },
      });
      await db.bracketTie.create({
        data: {
          organizationId: organization.id,
          competitionId: competition.id,
          stageId: knockoutStage.id,
          round: 1,
          position: 1,
          label: "Semifinal",
          matchId: match.id,
          nextTieId: finalTie.id,
          nextSide: "HOME",
          slots: {
            create: [
              {
                organizationId: organization.id,
                side: "HOME",
                clubId: match.homeTeam.clubId,
              },
              {
                organizationId: organization.id,
                side: "AWAY",
                clubId: match.awayTeam.clubId,
              },
            ],
          },
        },
      });
      await expect(
        reviewMatch(operator, organization.id, match.id, { action: "approve" }),
      ).rejects.toBeInstanceOf(ApiError);
      const official = await reviewMatch(approver, organization.id, match.id, {
        action: "approve",
        refereeNotes: "UAT verified",
      });
      expect(official.match.status).toBe("OFFICIAL");
      record(
        17,
        "official result approved by separate actor",
        official.match.status,
      );
      const snapshot = await db.statisticsSnapshot.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          competitionId: competition.id,
          seasonId: season.id,
          stageId: stage.id,
          status: "PUBLISHED",
        },
        include: {
          standings: { orderBy: { position: "asc" } },
          playerStatistics: { orderBy: { goals: "desc" } },
        },
      });
      expect(snapshot.standings[0].clubId).toBe(match.homeTeam.clubId);
      record(18, "standings verified", snapshot.standings[0].points);
      expect(snapshot.playerStatistics[0].playerId).toBe(home[0].playerId);
      expect(snapshot.playerStatistics[0].goals).toBe(1);
      record(19, "top scorer verified", snapshot.playerStatistics[0].playerId);
      const suspension = await db.suspension.findFirstOrThrow({
        where: {
          organizationId: organization.id,
          playerId: away[0].playerId,
          status: "ACTIVE",
        },
      });
      expect(suspension.remainingMatchBans).toBe(1);
      record(20, "automatic suspension verified", suspension.id);
      const nextMatch = await db.match.findFirstOrThrow({
        where: {
          id: { not: match.id },
          status: "SCHEDULED",
          OR: [
            { homeTeam: { clubId: match.awayTeam.clubId } },
            { awayTeam: { clubId: match.awayTeam.clubId } },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
      });
      const suspendedTeamId =
        nextMatch.homeTeam.clubId === match.awayTeam.clubId
          ? nextMatch.homeTeamId
          : nextMatch.awayTeamId;
      await expect(
        saveLineup(
          operator,
          organization.id,
          nextMatch.id,
          lineup(suspendedTeamId, away),
        ),
      ).rejects.toMatchObject({ status: 422 });
      record(
        21,
        "suspended player rejected from next lineup",
        away[0].playerId,
      );

      const destination = clubs.find(
        (club) => club.id !== match.homeTeam.clubId,
      )!;
      const window = await createTransferWindow(operator, {
        organizationId: organization.id,
        competitionId: competition.id,
        seasonId: season.id,
        name: `UAT Window ${suffix}`,
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 86_400_000),
        registrationDeadline: new Date(Date.now() + 86_400_000),
        status: "OPEN",
        rules: {},
      });
      const draft = await createTransfer(operator, {
        organizationId: organization.id,
        competitionId: competition.id,
        seasonId: season.id,
        playerId: home[0].playerId,
        sourceClubId: match.homeTeam.clubId,
        destinationClubId: destination.id,
        transferWindowId: window.id,
        type: "PERMANENT",
        effectiveAt: new Date(Date.now() - 1_000),
        supportingDocs: [],
        idempotencyKey: `uat-transfer-${suffix}`,
      });
      let transfer = await actionTransfer(operator, organization.id, draft.id, {
        action: "submit",
        expectedVersion: draft.version,
        overrideWindow: false,
      });
      transfer = await actionTransfer(operator, organization.id, draft.id, {
        action: "review",
        expectedVersion: transfer.version,
        overrideWindow: false,
      });
      for (const step of [
        "SOURCE_CLUB",
        "DESTINATION_CLUB",
        "COMPETITION",
      ] as const)
        transfer = await actionTransfer(approver, organization.id, draft.id, {
          action: "approve",
          step,
          expectedVersion: transfer.version,
          overrideWindow: false,
        });
      transfer = await actionTransfer(approver, organization.id, draft.id, {
        action: "complete",
        expectedVersion: transfer.version,
        overrideWindow: false,
      });
      expect(transfer.status).toBe("COMPLETED");
      record(22, "transfer completed", transfer.id);
      const historical = await db.playerStatisticsRow.findFirstOrThrow({
        where: { snapshotId: snapshot.id, playerId: home[0].playerId },
      });
      expect(historical.clubId).toBe(match.homeTeam.clubId);
      record(23, "historical statistics retain former club", historical.clubId);
      const progressed = await db.bracketSlot.findFirstOrThrow({
        where: { tieId: finalTie.id, side: "HOME" },
      });
      const exportData = await getStatisticsForExport(approver, {
        organizationId: organization.id,
        competitionId: competition.id,
        seasonId: season.id,
        stageId: stage.id,
      });
      expect(progressed.clubId).toBe(match.homeTeam.clubId);
      expect(exportData.snapshot?.id).toBe(snapshot.id);
      record(24, "bracket progressed and export resolved", [
        progressed.clubId,
        exportData.snapshot?.id,
      ]);
      const [publicCompetition, publicMatch, publicStatistics, realtime] =
        await Promise.all([
          getPublicCompetition(competition.slug),
          getPublicMatch(match.id),
          getPublicStatistics(competition.id),
          publicRealtimeMessages(match.id, BigInt(0)),
        ]);
      expect(publicCompetition.competition.id).toBe(competition.id);
      expect(publicMatch.status).toBe("OFFICIAL");
      expect(publicStatistics?.id).toBe(snapshot.id);
      expect(JSON.stringify(publicMatch)).not.toContain("PRIVATE");
      expect(realtime.snapshot.payload.status).toBe("OFFICIAL");
      record(
        25,
        "public portal exposes official sanitized data",
        publicMatch.id,
      );

      await expect(
        getMatchSnapshot(outsider, otherOrganization.id, match.id),
      ).rejects.toMatchObject({ status: 403 });
      const correction = await requestOfficialCorrection(
        operator,
        organization.id,
        match.id,
        { reason: "Phase 11 official correction evidence" },
      );
      await reviewOfficialCorrection(approver, organization.id, correction.id, {
        action: "approve",
        notes: "approved",
      });
      await correctEvent(operator, organization.id, match.id, goal.event.id, {
        minute: 13,
        reason: "Correct official event minute",
      });
      await reviewMatch(approver, organization.id, match.id, {
        action: "approve",
      });
      expect(await db.matchResult.count({ where: { matchId: match.id } })).toBe(
        2,
      );
      expect(evidence.map((item) => item.step)).toEqual(
        Array.from({ length: 25 }, (_, index) => index + 1),
      );
      console.info(
        "PHASE11_FULL_UAT",
        JSON.stringify({
          organizationId: organization.id,
          competitionId: competition.id,
          seasonId: season.id,
          evidence,
        }),
      );
    }, 120_000);
  });
