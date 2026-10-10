import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { actionArticle, createArticle, createNotification, listAdminArticles, listNotifications, listPublicArticles, listPublicPlayers, setPublicFollow } from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId = ""; let otherOrganizationId = ""; let actorId = ""; let competitionId = ""; let minorId = "";
const actor = () => ({ id: actorId, isActive: true, isPlatformAdmin: false, deletedAt: null });

describe.sequential("Phase 7 portal security and publishing", () => {
  beforeAll(async () => {
    const [organization, other] = await Promise.all([db.organization.create({ data: { name: "Portal Tenant", slug: `portal-${suffix}`, status: "ACTIVE" } }), db.organization.create({ data: { name: "Other Portal", slug: `portal-other-${suffix}`, status: "ACTIVE" } })]);
    organizationId = organization.id; otherOrganizationId = other.id;
    const permissionKeys = ["article.view", "article.create", "article.update", "article.publish", "article.archive", "notification.view", "notification.manage", "notification.send"];
    const permissions = await Promise.all(permissionKeys.map((key) => db.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    const role = await db.role.create({ data: { organizationId, name: "Publisher", key: `publisher-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
    const user = await db.user.create({ data: { name: "Publisher", email: `publisher-${suffix}@test.invalid`, passwordHash: "test", memberships: { create: { organizationId, roleId: role.id } } } }); actorId = user.id;
    const competition = await db.competition.create({ data: { organizationId, name: "Public League", slug: `public-league-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "ONGOING" } }); competitionId = competition.id;
    const minor = await db.player.create({ data: { organizationId, fullName: "Private Minor", dateOfBirth: new Date("2012-01-01"), status: "ACTIVE" } }); minorId = minor.id;
    await db.player.create({ data: { organizationId, fullName: "Public Adult", dateOfBirth: new Date("1990-01-01"), status: "ACTIVE" } });
  });

  it("keeps drafts private, publishes explicitly, and writes revisions", async () => {
    const article = await createArticle(actor(), { organizationId, competitionId, title: "Final Resmi", slug: `final-resmi-${suffix}`, excerpt: "Ringkasan", body: "Isi aman", category: "Hasil" });
    expect((await listPublicArticles()).some((item) => item.id === article.id)).toBe(false);
    await actionArticle(actor(), article.id, { organizationId, action: "publish" });
    expect((await listPublicArticles()).some((item) => item.id === article.id)).toBe(true);
    expect(await db.articleRevision.count({ where: { articleId: article.id } })).toBe(1);
  });

  it("protects minors unless approved parental consent exists", async () => {
    expect((await listPublicPlayers()).some((player) => player.id === minorId)).toBe(false);
    await db.playerDocument.create({ data: { organizationId, playerId: minorId, type: "PARENTAL_CONSENT", storageKey: `consent-${suffix}`, originalName: "consent.pdf", mimeType: "application/pdf", sizeBytes: 100, verificationStatus: "APPROVED", uploadedById: actorId } });
    expect((await listPublicPlayers()).some((player) => player.id === minorId)).toBe(true);
  });

  it("prevents cross-tenant CMS access", async () => {
    await expect(listAdminArticles(actor(), otherOrganizationId)).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
  });

  it("deduplicates follows and notification sources", async () => {
    const anonymousKey = `visitor-${suffix}`;
    const follow = { organizationId, anonymousKey, type: "COMPETITION" as const, targetId: competitionId, follow: true };
    await setPublicFollow(follow); await setPublicFollow(follow);
    expect(await db.publicFollow.count({ where: { organizationId, anonymousKey, targetId: competitionId } })).toBe(1);
    const raw = { organizationId, competitionId, type: "COMPETITION_ANNOUNCEMENT" as const, title: "Pengumuman", body: "Jadwal terbaru", sourceKey: `announcement-${suffix}` };
    const first = await createNotification(actor(), raw); const second = await createNotification(actor(), raw);
    expect(second.id).toBe(first.id);
    const notifications = await listNotifications(organizationId, anonymousKey);
    expect(notifications.filter((item) => item.id === first.id)).toHaveLength(1);
    expect(await db.notificationDelivery.count({ where: { notificationId: first.id, anonymousKey } })).toBe(1);
  });
});
