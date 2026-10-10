CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PublicFollowType" AS ENUM ('COMPETITION', 'CLUB', 'MATCH');
CREATE TYPE "NotificationType" AS ENUM ('MATCH_STARTING_SOON', 'MATCH_STARTED', 'GOAL_SCORED', 'HALF_TIME', 'FULL_TIME', 'OFFICIAL_RESULT', 'SCHEDULE_CHANGED', 'MATCH_POSTPONED', 'MATCH_CANCELLED', 'COMPETITION_ANNOUNCEMENT');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'SKIPPED');

ALTER TABLE "Article"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Berita',
  ADD COLUMN "coverUrl" TEXT,
  ADD COLUMN "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Article" a SET "organizationId" = c."organizationId", "status" = CASE WHEN a."publishedAt" IS NULL THEN 'DRAFT'::"ArticleStatus" ELSE 'PUBLISHED'::"ArticleStatus" END FROM "Competition" c WHERE a."competitionId" = c."id";

DROP INDEX IF EXISTS "Article_slug_key";
CREATE UNIQUE INDEX "Article_organizationId_slug_key" ON "Article"("organizationId", "slug");
CREATE INDEX "Article_organizationId_status_publishedAt_idx" ON "Article"("organizationId", "status", "publishedAt");
CREATE INDEX "Article_competitionId_status_idx" ON "Article"("competitionId", "status");

ALTER TABLE "Article" ADD CONSTRAINT "Article_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ArticleRevision" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "articleId" TEXT NOT NULL, "actorId" TEXT,
  "version" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArticleRevision_articleId_version_key" ON "ArticleRevision"("articleId", "version");
CREATE INDEX "ArticleRevision_organizationId_articleId_createdAt_idx" ON "ArticleRevision"("organizationId", "articleId", "createdAt");
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleRevision" ADD CONSTRAINT "ArticleRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PublicFollow" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "anonymousKey" TEXT NOT NULL, "type" "PublicFollowType" NOT NULL, "targetId" TEXT NOT NULL,
  "competitionId" TEXT, "clubId" TEXT, "matchId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicFollow_organizationId_anonymousKey_type_targetId_key" ON "PublicFollow"("organizationId", "anonymousKey", "type", "targetId");
CREATE INDEX "PublicFollow_organizationId_type_targetId_idx" ON "PublicFollow"("organizationId", "type", "targetId");
ALTER TABLE "PublicFollow" ADD CONSTRAINT "PublicFollow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicFollow" ADD CONSTRAINT "PublicFollow_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicFollow" ADD CONSTRAINT "PublicFollow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicFollow" ADD CONSTRAINT "PublicFollow_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "anonymousKey" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "eventTypes" JSONB NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_organizationId_anonymousKey_key" ON "NotificationPreference"("organizationId", "anonymousKey");
CREATE INDEX "NotificationPreference_anonymousKey_enabled_idx" ON "NotificationPreference"("anonymousKey", "enabled");
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT, "clubId" TEXT, "matchId" TEXT, "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL, "body" TEXT NOT NULL, "sourceKey" TEXT NOT NULL, "publishedAt" TIMESTAMP(3), "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_organizationId_sourceKey_key" ON "Notification"("organizationId", "sourceKey");
CREATE INDEX "Notification_organizationId_publishedAt_idx" ON "Notification"("organizationId", "publishedAt");
CREATE INDEX "Notification_matchId_type_idx" ON "Notification"("matchId", "type");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "notificationId" TEXT NOT NULL, "anonymousKey" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0, "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3), "retryAt" TIMESTAMP(3), "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_anonymousKey_key" ON "NotificationDelivery"("notificationId", "anonymousKey");
CREATE INDEX "NotificationDelivery_organizationId_anonymousKey_readAt_createdAt_idx" ON "NotificationDelivery"("organizationId", "anonymousKey", "readAt", "createdAt");
CREATE INDEX "NotificationDelivery_status_retryAt_idx" ON "NotificationDelivery"("status", "retryAt");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "anonymousKey" TEXT NOT NULL, "endpointHash" TEXT NOT NULL, "encryptedData" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_organizationId_endpointHash_key" ON "PushSubscription"("organizationId", "endpointHash");
CREATE INDEX "PushSubscription_organizationId_anonymousKey_enabled_idx" ON "PushSubscription"("organizationId", "anonymousKey", "enabled");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('phase7_article_view', 'article.view', 'Melihat berita'),
  ('phase7_article_create', 'article.create', 'Membuat berita'),
  ('phase7_article_update', 'article.update', 'Mengubah berita'),
  ('phase7_article_publish', 'article.publish', 'Menerbitkan berita'),
  ('phase7_article_archive', 'article.archive', 'Mengarsipkan berita'),
  ('phase7_notification_view', 'notification.view', 'Melihat notifikasi'),
  ('phase7_notification_manage', 'notification.manage', 'Mengelola notifikasi'),
  ('phase7_notification_send', 'notification.send', 'Mengirim notifikasi')
ON CONFLICT ("key") DO NOTHING;
