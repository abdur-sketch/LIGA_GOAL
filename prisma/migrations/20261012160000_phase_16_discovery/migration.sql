-- CreateEnum
CREATE TYPE "AdministrativeAreaType" AS ENUM ('PROVINCE', 'REGENCY', 'CITY');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PublicEntityType" AS ENUM ('ORGANIZER', 'COMPETITION', 'REGION');

-- CreateTable
CREATE TABLE "RegionDataset" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegionDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdministrativeArea" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "AdministrativeAreaType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sourceDatasetId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministrativeArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdministrativeAreaRevision" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdministrativeAreaRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicSlugRedirect" (
    "id" TEXT NOT NULL,
    "entityType" "PublicEntityType" NOT NULL,
    "oldPath" TEXT NOT NULL,
    "newPath" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicSlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicOrganizerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "publicContactEmail" TEXT,
    "publicContactPhone" TEXT,
    "provinceId" TEXT,
    "cityId" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicOrganizerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionPublication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "provinceId" TEXT,
    "cityId" TEXT,
    "ageCategory" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "searchText" TEXT NOT NULL DEFAULT '',
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegionDataset_sourceVersion_key" ON "RegionDataset"("sourceVersion");

-- CreateIndex
CREATE INDEX "RegionDataset_isActive_effectiveAt_idx" ON "RegionDataset"("isActive", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdministrativeArea_code_key" ON "AdministrativeArea"("code");

-- CreateIndex
CREATE INDEX "AdministrativeArea_type_isActive_name_idx" ON "AdministrativeArea"("type", "isActive", "name");

-- CreateIndex
CREATE INDEX "AdministrativeArea_parentId_isActive_name_idx" ON "AdministrativeArea"("parentId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AdministrativeArea_parentId_slug_key" ON "AdministrativeArea"("parentId", "slug");

-- CreateIndex
CREATE INDEX "AdministrativeAreaRevision_datasetId_createdAt_idx" ON "AdministrativeAreaRevision"("datasetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdministrativeAreaRevision_areaId_datasetId_key" ON "AdministrativeAreaRevision"("areaId", "datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicSlugRedirect_oldPath_key" ON "PublicSlugRedirect"("oldPath");

-- CreateIndex
CREATE INDEX "PublicSlugRedirect_entityType_createdAt_idx" ON "PublicSlugRedirect"("entityType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicOrganizerProfile_organizationId_key" ON "PublicOrganizerProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicOrganizerProfile_publicSlug_key" ON "PublicOrganizerProfile"("publicSlug");

-- CreateIndex
CREATE INDEX "PublicOrganizerProfile_status_publishedAt_id_idx" ON "PublicOrganizerProfile"("status", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "PublicOrganizerProfile_provinceId_cityId_status_idx" ON "PublicOrganizerProfile"("provinceId", "cityId", "status");

-- CreateIndex
CREATE INDEX "PublicOrganizerProfile_organizationId_status_idx" ON "PublicOrganizerProfile"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionPublication_competitionId_key" ON "CompetitionPublication"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionPublication_publicSlug_key" ON "CompetitionPublication"("publicSlug");

-- CreateIndex
CREATE INDEX "CompetitionPublication_organizationId_status_publishedAt_idx" ON "CompetitionPublication"("organizationId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "CompetitionPublication_provinceId_cityId_status_publishedAt_idx" ON "CompetitionPublication"("provinceId", "cityId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "CompetitionPublication_status_popularityScore_publishedAt_i_idx" ON "CompetitionPublication"("status", "popularityScore", "publishedAt", "id");

-- AddForeignKey
ALTER TABLE "AdministrativeArea" ADD CONSTRAINT "AdministrativeArea_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeArea" ADD CONSTRAINT "AdministrativeArea_sourceDatasetId_fkey" FOREIGN KEY ("sourceDatasetId") REFERENCES "RegionDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeAreaRevision" ADD CONSTRAINT "AdministrativeAreaRevision_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeAreaRevision" ADD CONSTRAINT "AdministrativeAreaRevision_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "RegionDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrganizerProfile" ADD CONSTRAINT "PublicOrganizerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrganizerProfile" ADD CONSTRAINT "PublicOrganizerProfile_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrganizerProfile" ADD CONSTRAINT "PublicOrganizerProfile_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrganizerProfile" ADD CONSTRAINT "PublicOrganizerProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPublication" ADD CONSTRAINT "CompetitionPublication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPublication" ADD CONSTRAINT "CompetitionPublication_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPublication" ADD CONSTRAINT "CompetitionPublication_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPublication" ADD CONSTRAINT "CompetitionPublication_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "AdministrativeArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPublication" ADD CONSTRAINT "CompetitionPublication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Phase 16 search primitives and versioned national reference provenance.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

INSERT INTO "RegionDataset" (id,"sourceName","sourceVersion","sourceUrl","sourceChecksum","effectiveAt","isActive") VALUES
('region-kemendagri-300-2-2-2430-2025','Kementerian Dalam Negeri Republik Indonesia','Kepmendagri 300.2.2-2430 Tahun 2025','https://peraturan.bpk.go.id/Details/322912/keputusan-mendagri-no-30022-2430-tahun-2025','76775c72e819abf7f5b22cd258ba3eca59a2acb09bc99532f8b1e5d873fe56fb','2025-06-23T00:00:00.000Z',true);

-- Province and regency/city rows extracted from the cited legal reference.
-- Transformation checksum covers sorted code|name pairs; 38 provinces + 514 regencies/cities.
INSERT INTO "AdministrativeArea" (id,code,type,name,slug,"parentId","sourceDatasetId","updatedAt") VALUES
-- extractedRows=552 checksum=76775c72e819abf7f5b22cd258ba3eca59a2acb09bc99532f8b1e5d873fe56fb
('area-11','11','PROVINCE','Aceh','aceh',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-01','11.01','REGENCY','Kabupaten Aceh Selatan','kabupaten-aceh-selatan','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-02','11.02','REGENCY','Kabupaten Aceh Tenggara','kabupaten-aceh-tenggara','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-03','11.03','REGENCY','Kabupaten Aceh Timur','kabupaten-aceh-timur','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-04','11.04','REGENCY','Kabupaten Aceh Tengah','kabupaten-aceh-tengah','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-05','11.05','REGENCY','Kabupaten Aceh Barat','kabupaten-aceh-barat','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-06','11.06','REGENCY','Kabupaten Aceh Besar','kabupaten-aceh-besar','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-07','11.07','REGENCY','Kabupaten Pidie','kabupaten-pidie','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-08','11.08','REGENCY','Kabupaten Aceh Utara','kabupaten-aceh-utara','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-09','11.09','REGENCY','Kabupaten Simeulue','kabupaten-simeulue','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-10','11.10','REGENCY','Kabupaten Aceh Singkil','kabupaten-aceh-singkil','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-11','11.11','REGENCY','Kabupaten Bireuen','kabupaten-bireuen','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-12','11.12','REGENCY','Kabupaten Aceh Barat Daya','kabupaten-aceh-barat-daya','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-13','11.13','REGENCY','Kabupaten Gayo Lues','kabupaten-gayo-lues','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-14','11.14','REGENCY','Kabupaten Aceh Jaya','kabupaten-aceh-jaya','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-15','11.15','REGENCY','Kabupaten Nagan Raya','kabupaten-nagan-raya','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-16','11.16','REGENCY','Kabupaten Aceh Tamiang','kabupaten-aceh-tamiang','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-17','11.17','REGENCY','Kabupaten Bener Meriah','kabupaten-bener-meriah','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-18','11.18','REGENCY','Kabupaten Pidie Jaya','kabupaten-pidie-jaya','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-71','11.71','CITY','Kota Banda Aceh','kota-banda-aceh','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-72','11.72','CITY','Kota Sabang','kota-sabang','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-73','11.73','CITY','Kota Lhokseumawe','kota-lhokseumawe','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-74','11.74','CITY','Kota Langsa','kota-langsa','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-11-75','11.75','CITY','Kota Subulussalam','kota-subulussalam','area-11','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12','12','PROVINCE','Sumatera Utara','sumatera-utara',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-01','12.01','REGENCY','Kabupaten Tapanuli Tengah','kabupaten-tapanuli-tengah','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-02','12.02','REGENCY','Kabupaten Tapanuli Utara','kabupaten-tapanuli-utara','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-03','12.03','REGENCY','Kabupaten Tapanuli Selatan','kabupaten-tapanuli-selatan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-04','12.04','REGENCY','Kabupaten Nias','kabupaten-nias','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-05','12.05','REGENCY','Kabupaten Langkat','kabupaten-langkat','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-06','12.06','REGENCY','Kabupaten Karo','kabupaten-karo','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-07','12.07','REGENCY','Kabupaten Deli Serdang','kabupaten-deli-serdang','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-08','12.08','REGENCY','Kabupaten Simalungun','kabupaten-simalungun','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-09','12.09','REGENCY','Kabupaten Asahan','kabupaten-asahan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-10','12.10','REGENCY','Kabupaten Labuhanbatu','kabupaten-labuhanbatu','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-11','12.11','REGENCY','Kabupaten Dairi','kabupaten-dairi','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-12','12.12','REGENCY','Kabupaten Toba','kabupaten-toba','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-13','12.13','REGENCY','Kabupaten Mandailing Natal','kabupaten-mandailing-natal','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-14','12.14','REGENCY','Kabupaten Nias Selatan','kabupaten-nias-selatan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-15','12.15','REGENCY','Kabupaten Pakpak Bharat','kabupaten-pakpak-bharat','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-16','12.16','REGENCY','Kabupaten Humbang Hasundutan','kabupaten-humbang-hasundutan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-17','12.17','REGENCY','Kabupaten Samosir','kabupaten-samosir','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-18','12.18','REGENCY','Kabupaten Serdang Bedagai','kabupaten-serdang-bedagai','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-19','12.19','REGENCY','Kabupaten Batu Bara','kabupaten-batu-bara','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-20','12.20','REGENCY','Kabupaten Padang Lawas Utara','kabupaten-padang-lawas-utara','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-21','12.21','REGENCY','Kabupaten Padang Lawas','kabupaten-padang-lawas','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-22','12.22','REGENCY','Kabupaten Labuhanbatu Selatan','kabupaten-labuhanbatu-selatan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-23','12.23','REGENCY','Kabupaten Labuhanbatu Utara','kabupaten-labuhanbatu-utara','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-24','12.24','REGENCY','Kabupaten Nias Utara','kabupaten-nias-utara','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-25','12.25','REGENCY','Kabupaten Nias Barat','kabupaten-nias-barat','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-71','12.71','CITY','Kota Medan','kota-medan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-72','12.72','CITY','Kota Pematangsiantar','kota-pematangsiantar','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-73','12.73','CITY','Kota Sibolga','kota-sibolga','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-74','12.74','CITY','Kota Tanjungbalai','kota-tanjungbalai','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-75','12.75','CITY','Kota Binjai','kota-binjai','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-76','12.76','CITY','Kota Tebing Tinggi','kota-tebing-tinggi','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-77','12.77','CITY','Kota Padangsidimpuan','kota-padangsidimpuan','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-12-78','12.78','CITY','Kota Gunungsitoli','kota-gunungsitoli','area-12','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13','13','PROVINCE','Sumatera Barat','sumatera-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-01','13.01','REGENCY','Kabupaten Pesisir Selatan','kabupaten-pesisir-selatan','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-02','13.02','REGENCY','Kabupaten Solok','kabupaten-solok','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-03','13.03','REGENCY','Kabupaten Sijunjung','kabupaten-sijunjung','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-04','13.04','REGENCY','Kabupaten Tanah Datar','kabupaten-tanah-datar','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-05','13.05','REGENCY','Kabupaten Padang Pariaman','kabupaten-padang-pariaman','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-06','13.06','REGENCY','Kabupaten Agam','kabupaten-agam','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-07','13.07','REGENCY','Kabupaten Lima Puluh Kota','kabupaten-lima-puluh-kota','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-08','13.08','REGENCY','Kabupaten Pasaman','kabupaten-pasaman','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-09','13.09','REGENCY','Kabupaten Kepulauan Mentawai','kabupaten-kepulauan-mentawai','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-10','13.10','REGENCY','Kabupaten Dharmasraya','kabupaten-dharmasraya','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-11','13.11','REGENCY','Kabupaten Solok Selatan','kabupaten-solok-selatan','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-12','13.12','REGENCY','Kabupaten Pasaman Barat','kabupaten-pasaman-barat','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-71','13.71','CITY','Kota Padang','kota-padang','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-72','13.72','CITY','Kota Solok','kota-solok','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-73','13.73','CITY','Kota Sawahlunto','kota-sawahlunto','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-74','13.74','CITY','Kota Padang Panjang','kota-padang-panjang','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-75','13.75','CITY','Kota Bukittinggi','kota-bukittinggi','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-76','13.76','CITY','Kota Payakumbuh','kota-payakumbuh','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-13-77','13.77','CITY','Kota Pariaman','kota-pariaman','area-13','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14','14','PROVINCE','Riau','riau',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-01','14.01','REGENCY','Kabupaten Kampar','kabupaten-kampar','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-02','14.02','REGENCY','Kabupaten Indragiri Hulu','kabupaten-indragiri-hulu','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-03','14.03','REGENCY','Kabupaten Bengkalis','kabupaten-bengkalis','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-04','14.04','REGENCY','Kabupaten Indragiri Hilir','kabupaten-indragiri-hilir','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-05','14.05','REGENCY','Kabupaten Pelalawan','kabupaten-pelalawan','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-06','14.06','REGENCY','Kabupaten Rokan Hulu','kabupaten-rokan-hulu','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-07','14.07','REGENCY','Kabupaten Rokan Hilir','kabupaten-rokan-hilir','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-08','14.08','REGENCY','Kabupaten Siak','kabupaten-siak','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-09','14.09','REGENCY','Kabupaten Kuantan Singingi','kabupaten-kuantan-singingi','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-10','14.10','REGENCY','Kabupaten Kepulauan Meranti','kabupaten-kepulauan-meranti','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-71','14.71','CITY','Kota Pekanbaru','kota-pekanbaru','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-14-72','14.72','CITY','Kota Dumai','kota-dumai','area-14','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15','15','PROVINCE','Jambi','jambi',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-01','15.01','REGENCY','Kabupaten Kerinci','kabupaten-kerinci','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-02','15.02','REGENCY','Kabupaten  Merangin','kabupaten-merangin','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-03','15.03','REGENCY','Kabupaten Sarolangun','kabupaten-sarolangun','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-04','15.04','REGENCY','Kabupaten Batanghari','kabupaten-batanghari','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-05','15.05','REGENCY','Kabupaten  Muaro Jambi','kabupaten-muaro-jambi','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-06','15.06','REGENCY','Kabupaten Tanjung Jabung Barat','kabupaten-tanjung-jabung-barat','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-07','15.07','REGENCY','Kabupaten Tanjung Jabung Timur','kabupaten-tanjung-jabung-timur','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-08','15.08','REGENCY','Kabupaten Bungo','kabupaten-bungo','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-09','15.09','REGENCY','Kabupaten Tebo','kabupaten-tebo','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-71','15.71','CITY','Kota Jambi','kota-jambi','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-15-72','15.72','CITY','Kota Sungai Penuh','kota-sungai-penuh','area-15','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16','16','PROVINCE','Sumatera Selatan','sumatera-selatan',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-01','16.01','REGENCY','Kabupaten Ogan Komering Ulu','kabupaten-ogan-komering-ulu','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-02','16.02','REGENCY','Kabupaten Ogan Komering','kabupaten-ogan-komering','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-03','16.03','REGENCY','Kabupaten Muara Enim','kabupaten-muara-enim','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-04','16.04','REGENCY','Kabupaten Lahat','kabupaten-lahat','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-05','16.05','REGENCY','Kabupaten Musi Rawas','kabupaten-musi-rawas','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-06','16.06','REGENCY','Kabupaten Musi Banyuasin','kabupaten-musi-banyuasin','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-07','16.07','REGENCY','Kabupaten Banyuasin','kabupaten-banyuasin','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-08','16.08','REGENCY','Kabupaten Ogan Komering Ulu Timur','kabupaten-ogan-komering-ulu-timur','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-09','16.09','REGENCY','Kabupaten Ogan Komering Ulu Selatan','kabupaten-ogan-komering-ulu-selatan','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-10','16.10','REGENCY','Kabupaten Ogan Ilir','kabupaten-ogan-ilir','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-11','16.11','REGENCY','Kabupaten Empat Lawang','kabupaten-empat-lawang','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-12','16.12','REGENCY','Kabupaten Penukal Abab Lematang Ilir','kabupaten-penukal-abab-lematang-ilir','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-13','16.13','REGENCY','Kabupaten Musi Rawas Utara','kabupaten-musi-rawas-utara','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-71','16.71','CITY','Kota Palembang','kota-palembang','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-72','16.72','CITY','Kota Pagar Alam','kota-pagar-alam','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-73','16.73','CITY','Kota Lubuk Linggau','kota-lubuk-linggau','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-16-74','16.74','CITY','Kota Prabumulih','kota-prabumulih','area-16','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17','17','PROVINCE','Bengkulu','bengkulu',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-01','17.01','REGENCY','Kabupaten Bengkulu Selatan','kabupaten-bengkulu-selatan','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-02','17.02','REGENCY','Kabupaten Rejang Lebong','kabupaten-rejang-lebong','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-03','17.03','REGENCY','Kabupaten Bengkulu Utara','kabupaten-bengkulu-utara','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-04','17.04','REGENCY','Kabupaten Kaur','kabupaten-kaur','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-05','17.05','REGENCY','Kabupaten Seluma','kabupaten-seluma','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-06','17.06','REGENCY','Kabupaten Mukomuko','kabupaten-mukomuko','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-07','17.07','REGENCY','Kabupaten Lebong','kabupaten-lebong','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-08','17.08','REGENCY','Kabupaten Kepahiang','kabupaten-kepahiang','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-09','17.09','REGENCY','Kabupaten Bengkulu Tengah','kabupaten-bengkulu-tengah','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-17-71','17.71','CITY','Kota Bengkulu','kota-bengkulu','area-17','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18','18','PROVINCE','Lampung','lampung',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-01','18.01','REGENCY','Kabupaten Lampung Selatan','kabupaten-lampung-selatan','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-02','18.02','REGENCY','Kabupaten Lampung Tengah','kabupaten-lampung-tengah','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-03','18.03','REGENCY','Kabupaten Lampung Utara','kabupaten-lampung-utara','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-04','18.04','REGENCY','Kabupaten Lampung Barat','kabupaten-lampung-barat','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-05','18.05','REGENCY','Kabupaten Tulang Bawang','kabupaten-tulang-bawang','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-06','18.06','REGENCY','Kabupaten Tanggamus','kabupaten-tanggamus','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-07','18.07','REGENCY','Kabupaten Lampung Timur','kabupaten-lampung-timur','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-08','18.08','REGENCY','Kabupaten Way Kanan','kabupaten-way-kanan','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-09','18.09','REGENCY','Kabupaten Pesawaran','kabupaten-pesawaran','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-10','18.10','REGENCY','Kabupaten Pringsewu','kabupaten-pringsewu','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-11','18.11','REGENCY','Kabupaten Mesuji','kabupaten-mesuji','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-12','18.12','REGENCY','Kabupaten Tulang Bawang Barat','kabupaten-tulang-bawang-barat','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-13','18.13','REGENCY','Kabupaten Pesisir Barat','kabupaten-pesisir-barat','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-71','18.71','CITY','Kota Bandar Lampung','kota-bandar-lampung','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-18-72','18.72','CITY','Kota Metro','kota-metro','area-18','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19','19','PROVINCE','Kepulauan Bangka Belitung','kepulauan-bangka-belitung',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-01','19.01','REGENCY','Kabupaten Bangka','kabupaten-bangka','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-02','19.02','REGENCY','Kabupaten Belitung','kabupaten-belitung','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-03','19.03','REGENCY','Kabupaten Bangka Selatan','kabupaten-bangka-selatan','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-04','19.04','REGENCY','Kabupaten Bangka Tengah','kabupaten-bangka-tengah','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-05','19.05','REGENCY','Kabupaten Bangka Barat','kabupaten-bangka-barat','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-06','19.06','REGENCY','Kabupaten Belitung Timur','kabupaten-belitung-timur','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-19-71','19.71','CITY','Kota Pangkal Pinang','kota-pangkal-pinang','area-19','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21','21','PROVINCE','Kepulauan Riau','kepulauan-riau',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-01','21.01','REGENCY','Kabupaten Bintan','kabupaten-bintan','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-02','21.02','REGENCY','Kabupaten Karimun','kabupaten-karimun','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-03','21.03','REGENCY','Kabupaten Natuna','kabupaten-natuna','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-04','21.04','REGENCY','Kabupaten Lingga','kabupaten-lingga','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-05','21.05','REGENCY','Kabupaten Kepulauan Anambas','kabupaten-kepulauan-anambas','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-71','21.71','CITY','Kota Batam','kota-batam','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-21-72','21.72','CITY','Kota Tanjung Pinang','kota-tanjung-pinang','area-21','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31','31','PROVINCE','Daerah Khusus Ibukota Jakarta','daerah-khusus-ibukota-jakarta',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-01','31.01','REGENCY','Kabupaten Administrasi Kepulauan Seribu','kabupaten-administrasi-kepulauan-seribu','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-71','31.71','CITY','Kota Administrasi Jakarta Pusat','kota-administrasi-jakarta-pusat','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-72','31.72','CITY','Kota Administrasi Jakarta Utara ','kota-administrasi-jakarta-utara','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-73','31.73','CITY','Kota Administrasi Jakarta Barat','kota-administrasi-jakarta-barat','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-74','31.74','CITY','Kota Administrasi Jakarta Selatan','kota-administrasi-jakarta-selatan','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-31-75','31.75','CITY','Kota Administrasi Jakarta Timur','kota-administrasi-jakarta-timur','area-31','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32','32','PROVINCE','Jawa Barat','jawa-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-01','32.01','REGENCY','Kabupaten Bogor','kabupaten-bogor','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-02','32.02','REGENCY','Kabupaten Sukabumi','kabupaten-sukabumi','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-03','32.03','REGENCY','Kabupaten Cianjur','kabupaten-cianjur','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-04','32.04','REGENCY','Kabupaten Bandung','kabupaten-bandung','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-05','32.05','REGENCY','Kabupaten Garut','kabupaten-garut','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-06','32.06','REGENCY','Kabupaten Tasikmalaya','kabupaten-tasikmalaya','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-07','32.07','REGENCY','Kabupaten Ciamis','kabupaten-ciamis','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-08','32.08','REGENCY','Kabupaten Kuningan','kabupaten-kuningan','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-09','32.09','REGENCY','Kabupaten Cirebon','kabupaten-cirebon','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-10','32.10','REGENCY','Kabupaten Majalengka','kabupaten-majalengka','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-11','32.11','REGENCY','Kabupaten Sumedang','kabupaten-sumedang','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-12','32.12','REGENCY','Kabupaten Indramayu','kabupaten-indramayu','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-13','32.13','REGENCY','Kabupaten Subang','kabupaten-subang','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-14','32.14','REGENCY','Kabupaten Purwakarta','kabupaten-purwakarta','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-15','32.15','REGENCY','Kabupaten Karawang','kabupaten-karawang','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-16','32.16','REGENCY','Kabupaten Bekasi','kabupaten-bekasi','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-17','32.17','REGENCY','Kabupaten Bandung Barat','kabupaten-bandung-barat','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-18','32.18','REGENCY','Kabupaten Pangandaran','kabupaten-pangandaran','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-71','32.71','CITY','Kota Bogor','kota-bogor','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-72','32.72','CITY','Kota Sukabumi','kota-sukabumi','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-73','32.73','CITY','Kota Bandung','kota-bandung','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-74','32.74','CITY','Kota Cirebon','kota-cirebon','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-75','32.75','CITY','Kota Bekasi','kota-bekasi','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-76','32.76','CITY','Kota Depok','kota-depok','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-77','32.77','CITY','Kota Cimahi','kota-cimahi','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-78','32.78','CITY','Kota Tasikmalaya','kota-tasikmalaya','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-32-79','32.79','CITY','Kota Banjar','kota-banjar','area-32','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33','33','PROVINCE','Jawa Tengah','jawa-tengah',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-01','33.01','REGENCY','Kabupaten Cilacap','kabupaten-cilacap','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-02','33.02','REGENCY','Kabupaten Banyumas','kabupaten-banyumas','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-03','33.03','REGENCY','Kabupaten Purbalingga','kabupaten-purbalingga','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-04','33.04','REGENCY','Kabupaten Banjarnegara','kabupaten-banjarnegara','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-05','33.05','REGENCY','Kabupaten Kebumen','kabupaten-kebumen','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-06','33.06','REGENCY','Kabupaten Purworejo','kabupaten-purworejo','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-07','33.07','REGENCY','Kabupaten Wonosobo','kabupaten-wonosobo','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-08','33.08','REGENCY','Kabupaten Magelang','kabupaten-magelang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-09','33.09','REGENCY','Kabupaten Boyolali','kabupaten-boyolali','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-10','33.10','REGENCY','Kabupaten Klaten','kabupaten-klaten','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-11','33.11','REGENCY','Kabupaten Sukoharjo','kabupaten-sukoharjo','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-12','33.12','REGENCY','Kabupaten Wonogiri','kabupaten-wonogiri','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-13','33.13','REGENCY','Kabupaten Karanganyar','kabupaten-karanganyar','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-14','33.14','REGENCY','Kabupaten Sragen','kabupaten-sragen','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-15','33.15','REGENCY','Kabupaten Grobogan','kabupaten-grobogan','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-16','33.16','REGENCY','Kabupaten Blora','kabupaten-blora','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-17','33.17','REGENCY','Kabupaten Rembang','kabupaten-rembang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-18','33.18','REGENCY','Kabupaten Pati','kabupaten-pati','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-19','33.19','REGENCY','Kabupaten Kudus','kabupaten-kudus','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-20','33.20','REGENCY','Kabupaten Jepara','kabupaten-jepara','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-21','33.21','REGENCY','Kabupaten Demak','kabupaten-demak','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-22','33.22','REGENCY','Kabupaten Semarang','kabupaten-semarang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-23','33.23','REGENCY','Kabupaten Temanggung','kabupaten-temanggung','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-24','33.24','REGENCY','Kabupaten Kendal','kabupaten-kendal','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-25','33.25','REGENCY','Kabupaten Batang','kabupaten-batang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-26','33.26','REGENCY','Kabupaten Pekalongan','kabupaten-pekalongan','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-27','33.27','REGENCY','Kabupaten Pemalang','kabupaten-pemalang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-28','33.28','REGENCY','Kabupaten Tegal','kabupaten-tegal','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-29','33.29','REGENCY','Kabupaten Brebes','kabupaten-brebes','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-71','33.71','CITY','Kota Magelang','kota-magelang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-72','33.72','CITY','Kota Surakarta','kota-surakarta','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-73','33.73','CITY','Kota Salatiga','kota-salatiga','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-74','33.74','CITY','Kota Semarang','kota-semarang','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-75','33.75','CITY','Kota Pekalongan','kota-pekalongan','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-33-76','33.76','CITY','Kota Tegal','kota-tegal','area-33','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34','34','PROVINCE','Daerah Istimewa Yogyakarta','daerah-istimewa-yogyakarta',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34-01','34.01','REGENCY','Kabupaten Kulon Progo','kabupaten-kulon-progo','area-34','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34-02','34.02','REGENCY','Kabupaten Bantul','kabupaten-bantul','area-34','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34-03','34.03','REGENCY','Kabupaten Gunungkidul','kabupaten-gunungkidul','area-34','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34-04','34.04','REGENCY','Kabupaten Sleman','kabupaten-sleman','area-34','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-34-71','34.71','CITY','Kota Yogyakarta','kota-yogyakarta','area-34','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35','35','PROVINCE','Jawa Timur','jawa-timur',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-01','35.01','REGENCY','Kabupaten Pacitan','kabupaten-pacitan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-02','35.02','REGENCY','Kabupaten Ponorogo','kabupaten-ponorogo','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-03','35.03','REGENCY','Kabupaten Trenggalek','kabupaten-trenggalek','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-04','35.04','REGENCY','Kabupaten Tulungagung','kabupaten-tulungagung','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-05','35.05','REGENCY','Kabupaten Blitar','kabupaten-blitar','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-06','35.06','REGENCY','Kabupaten Kediri','kabupaten-kediri','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-07','35.07','REGENCY','Kabupaten Malang','kabupaten-malang','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-08','35.08','REGENCY','Kabupaten Lumajang','kabupaten-lumajang','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-09','35.09','REGENCY','Kabupaten Jember','kabupaten-jember','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-10','35.10','REGENCY','Kabupaten Banyuwangi','kabupaten-banyuwangi','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-11','35.11','REGENCY','Kabupaten Bondowoso','kabupaten-bondowoso','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-12','35.12','REGENCY','Kabupaten Situbondo','kabupaten-situbondo','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-13','35.13','REGENCY','Kabupaten Probolinggo','kabupaten-probolinggo','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-14','35.14','REGENCY','Kabupaten Pasuruan','kabupaten-pasuruan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-15','35.15','REGENCY','Kabupaten Sidoarjo','kabupaten-sidoarjo','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-16','35.16','REGENCY','Kabupaten Mojokerto','kabupaten-mojokerto','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-17','35.17','REGENCY','Kabupaten Jombang','kabupaten-jombang','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-18','35.18','REGENCY','Kabupaten Nganjuk','kabupaten-nganjuk','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-19','35.19','REGENCY','Kabupaten Madiun','kabupaten-madiun','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-20','35.20','REGENCY','Kabupaten Magetan','kabupaten-magetan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-21','35.21','REGENCY','Kabupaten Ngawi','kabupaten-ngawi','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-22','35.22','REGENCY','Kabupaten Bojonegoro','kabupaten-bojonegoro','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-23','35.23','REGENCY','Kabupaten Tuban','kabupaten-tuban','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-24','35.24','REGENCY','Kabupaten Lamongan','kabupaten-lamongan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-25','35.25','REGENCY','Kabupaten Gresik','kabupaten-gresik','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-26','35.26','REGENCY','Kabupaten Bangkalan','kabupaten-bangkalan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-27','35.27','REGENCY','Kabupaten Sampang','kabupaten-sampang','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-28','35.28','REGENCY','Kabupaten Pamekasan','kabupaten-pamekasan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-29','35.29','REGENCY','Kabupaten Sumenep','kabupaten-sumenep','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-71','35.71','CITY','Kota Kediri','kota-kediri','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-72','35.72','CITY','Kota Blitar','kota-blitar','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-73','35.73','CITY','Kota Malang','kota-malang','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-74','35.74','CITY','Kota Probolinggo','kota-probolinggo','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-75','35.75','CITY','Kota Pasuruan','kota-pasuruan','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-76','35.76','CITY','Kota Mojokerto','kota-mojokerto','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-77','35.77','CITY','Kota Madiun','kota-madiun','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-78','35.78','CITY','Kota Surabaya','kota-surabaya','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-35-79','35.79','CITY','Kota Batu','kota-batu','area-35','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36','36','PROVINCE','Banten','banten',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-01','36.01','REGENCY','Kabupaten Pandeglang','kabupaten-pandeglang','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-02','36.02','REGENCY','Kabupaten Lebak','kabupaten-lebak','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-03','36.03','REGENCY','Kabupaten Tangerang','kabupaten-tangerang','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-04','36.04','REGENCY','Kabupaten Serang','kabupaten-serang','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-71','36.71','CITY','Kota Tangerang','kota-tangerang','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-72','36.72','CITY','Kota Cilegon','kota-cilegon','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-73','36.73','CITY','Kota Serang','kota-serang','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-36-74','36.74','CITY','Kota Tangerang Selatan','kota-tangerang-selatan','area-36','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51','51','PROVINCE','Bali','bali',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-01','51.01','REGENCY','Kabupaten Jembrana','kabupaten-jembrana','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-02','51.02','REGENCY','Kabupaten Tabanan','kabupaten-tabanan','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-03','51.03','REGENCY','Kabupaten Badung','kabupaten-badung','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-04','51.04','REGENCY','Kabupaten Gianyar','kabupaten-gianyar','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-05','51.05','REGENCY','Kabupaten Klungkung','kabupaten-klungkung','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-06','51.06','REGENCY','Kabupaten Bangli','kabupaten-bangli','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-07','51.07','REGENCY','Kabupaten Karangasem','kabupaten-karangasem','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-08','51.08','REGENCY','Kabupaten Buleleng','kabupaten-buleleng','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-51-71','51.71','CITY','Kota Denpasar','kota-denpasar','area-51','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52','52','PROVINCE','Nusa Tenggara Barat','nusa-tenggara-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-01','52.01','REGENCY','Kabupaten Lombok Barat','kabupaten-lombok-barat','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-02','52.02','REGENCY','Kabupaten Lombok Tengah','kabupaten-lombok-tengah','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-03','52.03','REGENCY','Kabupaten Lombok Timur','kabupaten-lombok-timur','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-04','52.04','REGENCY','Kabupaten Sumbawa','kabupaten-sumbawa','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-05','52.05','REGENCY','Kabupaten Dompu','kabupaten-dompu','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-06','52.06','REGENCY','Kabupaten Bima','kabupaten-bima','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-07','52.07','REGENCY','Kabupaten Sumbawa Barat','kabupaten-sumbawa-barat','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-08','52.08','REGENCY','Kabupaten Lombok Utara','kabupaten-lombok-utara','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-71','52.71','CITY','Kota Mataram','kota-mataram','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-52-72','52.72','CITY','Kota Bima','kota-bima','area-52','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53','53','PROVINCE','Nusa Tenggara Timur','nusa-tenggara-timur',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-01','53.01','REGENCY','Kabupaten Kupang','kabupaten-kupang','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-02','53.02','REGENCY','Kabupaten Timor Tengah Selatan','kabupaten-timor-tengah-selatan','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-03','53.03','REGENCY','Kabupaten Timor Tengah Utara','kabupaten-timor-tengah-utara','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-04','53.04','REGENCY','Kabupaten Belu','kabupaten-belu','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-05','53.05','REGENCY','Kabupaten Alor','kabupaten-alor','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-06','53.06','REGENCY','Kabupaten Flores Timur','kabupaten-flores-timur','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-07','53.07','REGENCY','Kabupaten Sikka','kabupaten-sikka','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-08','53.08','REGENCY','Kabupaten Ende','kabupaten-ende','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-09','53.09','REGENCY','Kabupaten Ngada','kabupaten-ngada','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-10','53.10','REGENCY','Kabupaten Manggarai','kabupaten-manggarai','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-11','53.11','REGENCY','Kabupaten Sumba Timur','kabupaten-sumba-timur','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-12','53.12','REGENCY','Kabupaten Sumba Barat','kabupaten-sumba-barat','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-13','53.13','REGENCY','Kabupaten Lembata','kabupaten-lembata','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-14','53.14','REGENCY','Kabupaten Rote Ndao','kabupaten-rote-ndao','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-15','53.15','REGENCY','Kabupaten Manggarai Barat','kabupaten-manggarai-barat','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-16','53.16','REGENCY','Kabupaten Nagekeo','kabupaten-nagekeo','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-17','53.17','REGENCY','Kabupaten Sumba Tengah','kabupaten-sumba-tengah','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-18','53.18','REGENCY','Kabupaten Sumba Barat Daya','kabupaten-sumba-barat-daya','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-19','53.19','REGENCY','Kabupaten Manggarai Timur','kabupaten-manggarai-timur','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-20','53.20','REGENCY','Kabupaten Sabu Raijua','kabupaten-sabu-raijua','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-21','53.21','REGENCY','Kabupaten Malaka','kabupaten-malaka','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-53-71','53.71','CITY','Kota Kupang','kota-kupang','area-53','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61','61','PROVINCE','Kalimantan Barat','kalimantan-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-01','61.01','REGENCY','Kabupaten Sambas','kabupaten-sambas','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-02','61.02','REGENCY','Kabupaten Mempawah','kabupaten-mempawah','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-03','61.03','REGENCY','Kabupaten Sanggau','kabupaten-sanggau','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-04','61.04','REGENCY','Kabupaten Ketapang','kabupaten-ketapang','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-05','61.05','REGENCY','Kabupaten Sintang','kabupaten-sintang','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-06','61.06','REGENCY','Kabupaten Kapuas Hulu','kabupaten-kapuas-hulu','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-07','61.07','REGENCY','Kabupaten Bengkayang','kabupaten-bengkayang','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-08','61.08','REGENCY','Kabupaten Landak','kabupaten-landak','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-09','61.09','REGENCY','Kabupaten Sekadau','kabupaten-sekadau','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-10','61.10','REGENCY','Kabupaten Melawi','kabupaten-melawi','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-11','61.11','REGENCY','Kabupaten Kayong Utara','kabupaten-kayong-utara','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-12','61.12','REGENCY','Kabupaten Kubu Raya','kabupaten-kubu-raya','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-71','61.71','CITY','Kota Pontianak','kota-pontianak','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-61-72','61.72','CITY','Kota Singkawang','kota-singkawang','area-61','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62','62','PROVINCE','Kalimantan Tengah','kalimantan-tengah',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-01','62.01','REGENCY','Kabupaten Kotawaringin Barat','kabupaten-kotawaringin-barat','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-02','62.02','REGENCY','Kabupaten Kotawaringin Timur','kabupaten-kotawaringin-timur','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-03','62.03','REGENCY','Kabupaten Kapuas','kabupaten-kapuas','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-04','62.04','REGENCY','Kabupaten Barito Selatan','kabupaten-barito-selatan','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-05','62.05','REGENCY','Kabupaten Barito Utara','kabupaten-barito-utara','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-06','62.06','REGENCY','Kabupaten Katingan','kabupaten-katingan','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-07','62.07','REGENCY','Kabupaten Seruyan','kabupaten-seruyan','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-08','62.08','REGENCY','Kabupaten Sukamara','kabupaten-sukamara','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-09','62.09','REGENCY','Kabupaten Lamandau','kabupaten-lamandau','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-10','62.10','REGENCY','Kabupaten Gunung Mas','kabupaten-gunung-mas','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-11','62.11','REGENCY','Kabupaten Pulang Pisau','kabupaten-pulang-pisau','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-12','62.12','REGENCY','Kabupaten Murung Raya','kabupaten-murung-raya','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-13','62.13','REGENCY','Kabupaten Barito Timur','kabupaten-barito-timur','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-62-71','62.71','CITY','Kota Palangkaraya','kota-palangkaraya','area-62','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63','63','PROVINCE','Kalimantan Selatan','kalimantan-selatan',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-01','63.01','REGENCY','Kabupaten Tanah Laut','kabupaten-tanah-laut','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-02','63.02','REGENCY','Kabupaten Kotabaru','kabupaten-kotabaru','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-03','63.03','REGENCY','Kabupaten Banjar','kabupaten-banjar','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-04','63.04','REGENCY','Kabupaten Barito Kuala','kabupaten-barito-kuala','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-05','63.05','REGENCY','Kabupaten Tapin','kabupaten-tapin','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-06','63.06','REGENCY','Kabupaten Hulu Sungai Selatan','kabupaten-hulu-sungai-selatan','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-07','63.07','REGENCY','Kabupaten Hulu Sungai Tengah','kabupaten-hulu-sungai-tengah','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-08','63.08','REGENCY','Kabupaten Hulu Sungai Utara','kabupaten-hulu-sungai-utara','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-09','63.09','REGENCY','Kabupaten Tabalong','kabupaten-tabalong','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-10','63.10','REGENCY','Kabupaten Tanah Bumbu','kabupaten-tanah-bumbu','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-11','63.11','REGENCY','Kabupaten Balangan','kabupaten-balangan','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-71','63.71','CITY','Kota Banjarmasin','kota-banjarmasin','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-63-72','63.72','CITY','Kota Banjarbaru','kota-banjarbaru','area-63','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64','64','PROVINCE','Kalimantan Timur','kalimantan-timur',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-01','64.01','REGENCY','Kabupaten Paser','kabupaten-paser','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-02','64.02','REGENCY','Kabupaten Kutai Kartanegara','kabupaten-kutai-kartanegara','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-03','64.03','REGENCY','Kabupaten Berau','kabupaten-berau','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-07','64.07','REGENCY','Kabupaten Kutai Barat','kabupaten-kutai-barat','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-08','64.08','REGENCY','Kabupaten Kutai Timur','kabupaten-kutai-timur','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-09','64.09','REGENCY','Kabupaten Penajam Paser Utara','kabupaten-penajam-paser-utara','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-11','64.11','REGENCY','Kabupaten Mahakam Ulu','kabupaten-mahakam-ulu','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-71','64.71','CITY','Kota Balikpapan','kota-balikpapan','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-72','64.72','CITY','Kota Samarinda','kota-samarinda','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-64-74','64.74','CITY','Kota Bontang','kota-bontang','area-64','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65','65','PROVINCE','Kalimantan Utara','kalimantan-utara',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65-01','65.01','REGENCY','Kabupaten Bulungan','kabupaten-bulungan','area-65','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65-02','65.02','REGENCY','Kabupaten Malinau','kabupaten-malinau','area-65','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65-03','65.03','REGENCY','Kabupaten Nunukan','kabupaten-nunukan','area-65','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65-04','65.04','REGENCY','Kabupaten Tana Tidung','kabupaten-tana-tidung','area-65','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-65-71','65.71','CITY','Kota Tarakan','kota-tarakan','area-65','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71','71','PROVINCE','Sulawesi Utara','sulawesi-utara',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-01','71.01','REGENCY','Kabupaten Bolaang Mongondow','kabupaten-bolaang-mongondow','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-02','71.02','REGENCY','Kabupaten Minahasa','kabupaten-minahasa','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-03','71.03','REGENCY','Kabupaten Kepulauan Sangihe','kabupaten-kepulauan-sangihe','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-04','71.04','REGENCY','Kabupaten Kepulauan Talaud','kabupaten-kepulauan-talaud','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-05','71.05','REGENCY','Kabupaten Minahasa Selatan','kabupaten-minahasa-selatan','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-06','71.06','REGENCY','Kabupaten Minahasa Utara','kabupaten-minahasa-utara','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-07','71.07','REGENCY','Kabupaten Minahasa Tenggara','kabupaten-minahasa-tenggara','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-08','71.08','REGENCY','Kabupaten Bolaang Mongondow Utara','kabupaten-bolaang-mongondow-utara','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-09','71.09','REGENCY','Kabupaten Kep. Siau Tagulandang Biaro','kabupaten-kep-siau-tagulandang-biaro','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-10','71.10','REGENCY','Kabupaten Bolaang Mongondow Timur','kabupaten-bolaang-mongondow-timur','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-11','71.11','REGENCY','Kabupaten Bolaang Mongondow Selatan','kabupaten-bolaang-mongondow-selatan','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-71','71.71','CITY','Kota Manado','kota-manado','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-72','71.72','CITY','Kota Bitung','kota-bitung','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-73','71.73','CITY','Kota Tomohon','kota-tomohon','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-71-74','71.74','CITY','Kota Kotamobagu','kota-kotamobagu','area-71','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72','72','PROVINCE','Sulawesi Tengah','sulawesi-tengah',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-01','72.01','REGENCY','Kabupaten Banggai','kabupaten-banggai','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-02','72.02','REGENCY','Kabupaten Poso','kabupaten-poso','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-03','72.03','REGENCY','Kabupaten Donggala','kabupaten-donggala','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-04','72.04','REGENCY','Kabupaten Toli-Toli','kabupaten-toli-toli','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-05','72.05','REGENCY','Kabupaten Buol','kabupaten-buol','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-06','72.06','REGENCY','Kabupaten Morowali','kabupaten-morowali','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-07','72.07','REGENCY','Kabupaten Banggai Kepulauan','kabupaten-banggai-kepulauan','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-08','72.08','REGENCY','Kabupaten Parigi Moutong','kabupaten-parigi-moutong','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-09','72.09','REGENCY','Kabupaten Tojo Una Una','kabupaten-tojo-una-una','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-10','72.10','REGENCY','Kabupaten Sigi','kabupaten-sigi','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-11','72.11','REGENCY','Kabupaten Banggai Laut','kabupaten-banggai-laut','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-12','72.12','REGENCY','Kabupaten Morowali Utara','kabupaten-morowali-utara','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-72-71','72.71','CITY','Kota Palu','kota-palu','area-72','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73','73','PROVINCE','Sulawesi Selatan','sulawesi-selatan',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-01','73.01','REGENCY','Kabupaten Kepulauan Selayar','kabupaten-kepulauan-selayar','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-02','73.02','REGENCY','Kabupaten Bulukumba','kabupaten-bulukumba','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-03','73.03','REGENCY','Kabupaten Bantaeng','kabupaten-bantaeng','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-04','73.04','REGENCY','Kabupaten Jeneponto','kabupaten-jeneponto','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-05','73.05','REGENCY','Kabupaten Takalar','kabupaten-takalar','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-06','73.06','REGENCY','Kabupaten Gowa','kabupaten-gowa','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-07','73.07','REGENCY','Kabupaten Sinjai','kabupaten-sinjai','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-08','73.08','REGENCY','Kabupaten Bone','kabupaten-bone','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-09','73.09','REGENCY','Kabupaten Maros','kabupaten-maros','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-10','73.10','REGENCY','Kabupaten Pangkajene dan Kepulauan','kabupaten-pangkajene-dan-kepulauan','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-11','73.11','REGENCY','Kabupaten Barru','kabupaten-barru','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-12','73.12','REGENCY','Kabupaten Soppeng','kabupaten-soppeng','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-13','73.13','REGENCY','Kabupaten Wajo','kabupaten-wajo','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-14','73.14','REGENCY','Kabupaten Sidenreng Rappang','kabupaten-sidenreng-rappang','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-15','73.15','REGENCY','Kabupaten Pinrang','kabupaten-pinrang','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-16','73.16','REGENCY','Kabupaten Enrekang','kabupaten-enrekang','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-17','73.17','REGENCY','Kabupaten Luwu','kabupaten-luwu','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-18','73.18','REGENCY','Kabupaten Tana Toraja','kabupaten-tana-toraja','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-22','73.22','REGENCY','Kabupaten Luwu Utara','kabupaten-luwu-utara','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-24','73.24','REGENCY','Kabupaten Luwu Timur','kabupaten-luwu-timur','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-26','73.26','REGENCY','Kabupaten Toraja Utara','kabupaten-toraja-utara','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-71','73.71','CITY','Kota Makassar','kota-makassar','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-72','73.72','CITY','Kota Parepare','kota-parepare','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-73-73','73.73','CITY','Kota Palopo','kota-palopo','area-73','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74','74','PROVINCE','Sulawesi Tenggara','sulawesi-tenggara',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-01','74.01','REGENCY','Kabupaten Kolaka','kabupaten-kolaka','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-02','74.02','REGENCY','Kabupaten Konawe','kabupaten-konawe','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-03','74.03','REGENCY','Kabupaten Muna','kabupaten-muna','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-04','74.04','REGENCY','Kabupaten Buton','kabupaten-buton','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-05','74.05','REGENCY','Kabupaten Konawe Selatan','kabupaten-konawe-selatan','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-06','74.06','REGENCY','Kabupaten Bombana','kabupaten-bombana','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-07','74.07','REGENCY','Kabupaten Wakatobi','kabupaten-wakatobi','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-08','74.08','REGENCY','Kabupaten Kolaka Utara','kabupaten-kolaka-utara','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-09','74.09','REGENCY','Kabupaten Konawe Utara','kabupaten-konawe-utara','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-10','74.10','REGENCY','Kabupaten Buton Utara','kabupaten-buton-utara','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-11','74.11','REGENCY','Kabupaten Kolaka Timur','kabupaten-kolaka-timur','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-12','74.12','REGENCY','Kabupaten Konawe Kepulauan','kabupaten-konawe-kepulauan','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-13','74.13','REGENCY','Kabupaten Muna Barat','kabupaten-muna-barat','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-14','74.14','REGENCY','Kabupaten Buton Tengah','kabupaten-buton-tengah','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-15','74.15','REGENCY','Kabupaten Buton Selatan','kabupaten-buton-selatan','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-71','74.71','CITY','Kota Kendari','kota-kendari','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-74-72','74.72','CITY','Kota Bau Bau','kota-bau-bau','area-74','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75','75','PROVINCE','Gorontalo','gorontalo',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-01','75.01','REGENCY','Kabupaten Gorontalo','kabupaten-gorontalo','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-02','75.02','REGENCY','Kabupaten Boalemo','kabupaten-boalemo','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-03','75.03','REGENCY','Kabupaten Bone Bolango','kabupaten-bone-bolango','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-04','75.04','REGENCY','Kabupaten Pohuwato','kabupaten-pohuwato','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-05','75.05','REGENCY','Kabupaten Gorontalo Utara','kabupaten-gorontalo-utara','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-75-71','75.71','CITY','Kota Gorontalo','kota-gorontalo','area-75','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76','76','PROVINCE','Sulawesi Barat','sulawesi-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-01','76.01','REGENCY','Kabupaten Pasangkayu','kabupaten-pasangkayu','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-02','76.02','REGENCY','Kabupaten Mamuju','kabupaten-mamuju','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-03','76.03','REGENCY','Kabupaten Mamasa','kabupaten-mamasa','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-04','76.04','REGENCY','Kabupaten Polewali Mandar','kabupaten-polewali-mandar','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-05','76.05','REGENCY','Kabupaten Majene','kabupaten-majene','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-76-06','76.06','REGENCY','Kabupaten Mamuju Tengah','kabupaten-mamuju-tengah','area-76','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81','81','PROVINCE','Maluku','maluku',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-01','81.01','REGENCY','Kabupaten Maluku Tengah','kabupaten-maluku-tengah','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-02','81.02','REGENCY','Kabupaten Maluku Tenggara','kabupaten-maluku-tenggara','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-03','81.03','REGENCY','Kabupaten Kepulauan Tanimbar','kabupaten-kepulauan-tanimbar','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-04','81.04','REGENCY','Kabupaten Buru','kabupaten-buru','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-05','81.05','REGENCY','Kabupaten Seram Bagian Timur','kabupaten-seram-bagian-timur','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-06','81.06','REGENCY','Kabupaten Seram Bagian Barat','kabupaten-seram-bagian-barat','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-07','81.07','REGENCY','Kabupaten Kepulauan Aru','kabupaten-kepulauan-aru','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-08','81.08','REGENCY','Kabupaten Maluku Barat Daya','kabupaten-maluku-barat-daya','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-09','81.09','REGENCY','Kabupaten Buru Selatan','kabupaten-buru-selatan','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-71','81.71','CITY','Kota Ambon','kota-ambon','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-81-72','81.72','CITY','Kota Tual','kota-tual','area-81','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82','82','PROVINCE','Maluku Utara','maluku-utara',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-01','82.01','REGENCY','Kabupaten Halmahera Barat','kabupaten-halmahera-barat','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-02','82.02','REGENCY','Kabupaten Halmahera Tengah','kabupaten-halmahera-tengah','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-03','82.03','REGENCY','Kabupaten Halmahera Utara','kabupaten-halmahera-utara','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-04','82.04','REGENCY','Kabupaten Halmahera Selatan','kabupaten-halmahera-selatan','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-05','82.05','REGENCY','Kabupaten Kepulauan Sula','kabupaten-kepulauan-sula','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-06','82.06','REGENCY','Kabupaten Halmahera Timur','kabupaten-halmahera-timur','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-07','82.07','REGENCY','Kabupaten Pulau Morotai','kabupaten-pulau-morotai','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-08','82.08','REGENCY','Kabupaten Pulau Taliabu','kabupaten-pulau-taliabu','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-71','82.71','CITY','Kota Ternate','kota-ternate','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-82-72','82.72','CITY','Kota Tidore Kepulauan','kota-tidore-kepulauan','area-82','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91','91','PROVINCE','Papua','papua',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-03','91.03','REGENCY','Kabupaten Jayapura','kabupaten-jayapura','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-05','91.05','REGENCY','Kabupaten Kepulauan Yapen','kabupaten-kepulauan-yapen','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-06','91.06','REGENCY','Kabupaten Biak Numfor','kabupaten-biak-numfor','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-10','91.10','REGENCY','Kabupaten Sarmi','kabupaten-sarmi','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-11','91.11','REGENCY','Kabupaten Keerom','kabupaten-keerom','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-15','91.15','REGENCY','Kabupaten Waropen','kabupaten-waropen','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-19','91.19','REGENCY','Kabupaten Supiori','kabupaten-supiori','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-20','91.20','REGENCY','Kabupaten Mamberamo Raya','kabupaten-mamberamo-raya','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-91-71','91.71','CITY','Kota Jayapura','kota-jayapura','area-91','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92','92','PROVINCE','Papua Barat','papua-barat',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-02','92.02','REGENCY','Kabupaten Manokwari','kabupaten-manokwari','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-03','92.03','REGENCY','Kabupaten Fak Fak','kabupaten-fak-fak','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-06','92.06','REGENCY','Kabupaten Teluk Bintuni','kabupaten-teluk-bintuni','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-07','92.07','REGENCY','Kabupaten Teluk Wondama','kabupaten-teluk-wondama','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-08','92.08','REGENCY','Kabupaten Kaimana','kabupaten-kaimana','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-11','92.11','REGENCY','Kabupaten Manokwari Selatan','kabupaten-manokwari-selatan','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-92-12','92.12','REGENCY','Kabupaten Pegunungan Arfak','kabupaten-pegunungan-arfak','area-92','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-93','93','PROVINCE','Papua Selatan','papua-selatan',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-93-01','93.01','REGENCY','Kabupaten Merauke','kabupaten-merauke','area-93','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-93-02','93.02','REGENCY','Kabupaten Boven Digoel','kabupaten-boven-digoel','area-93','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-93-03','93.03','REGENCY','Kabupaten Mappi','kabupaten-mappi','area-93','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-93-04','93.04','REGENCY','Kabupaten Asmat','kabupaten-asmat','area-93','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94','94','PROVINCE','Papua Tengah','papua-tengah',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-01','94.01','REGENCY','Kabupaten Nabire','kabupaten-nabire','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-02','94.02','REGENCY','Kabupaten Puncak Jaya','kabupaten-puncak-jaya','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-03','94.03','REGENCY','Kabupaten Paniai','kabupaten-paniai','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-04','94.04','REGENCY','Kabupaten Mimika','kabupaten-mimika','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-05','94.05','REGENCY','Kabupaten Puncak','kabupaten-puncak','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-06','94.06','REGENCY','Kabupaten Dogiyai','kabupaten-dogiyai','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-07','94.07','REGENCY','Kabupaten Intan Jaya','kabupaten-intan-jaya','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-94-08','94.08','REGENCY','Kabupaten Deiyai','kabupaten-deiyai','area-94','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95','95','PROVINCE','Papua Pegunungan','papua-pegunungan',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-01','95.01','REGENCY','Kabupaten Jayawijaya','kabupaten-jayawijaya','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-02','95.02','REGENCY','Kabupaten Pegunungan Bintang','kabupaten-pegunungan-bintang','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-03','95.03','REGENCY','Kabupaten Yahukimo','kabupaten-yahukimo','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-04','95.04','REGENCY','Kabupaten Tolikara','kabupaten-tolikara','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-05','95.05','REGENCY','Kabupaten Mamberamo Tengah','kabupaten-mamberamo-tengah','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-06','95.06','REGENCY','Kabupaten Yalimo','kabupaten-yalimo','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-07','95.07','REGENCY','Kabupaten Lanny Jaya','kabupaten-lanny-jaya','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-95-08','95.08','REGENCY','Kabupaten Nduga','kabupaten-nduga','area-95','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96','96','PROVINCE','Papua Barat Daya','papua-barat-daya',NULL,'region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-01','96.01','REGENCY','Kabupaten Sorong','kabupaten-sorong','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-02','96.02','REGENCY','Kabupaten Sorong Selatan','kabupaten-sorong-selatan','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-03','96.03','REGENCY','Kabupaten Raja Ampat','kabupaten-raja-ampat','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-04','96.04','REGENCY','Kabupaten Tambrauw','kabupaten-tambrauw','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-05','96.05','REGENCY','Kabupaten Maybrat','kabupaten-maybrat','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP),
('area-96-71','96.71','CITY','Kota Sorong','kota-sorong','area-96','region-kemendagri-300-2-2-2430-2025',CURRENT_TIMESTAMP);


INSERT INTO "AdministrativeAreaRevision" (id,"areaId","datasetId",snapshot)
SELECT 'region-rev-' || replace(code,'.','-'), id, "sourceDatasetId",
  jsonb_build_object('code',code,'name',name,'slug',slug,'type',type,'parentId',"parentId")
FROM "AdministrativeArea" WHERE "sourceDatasetId"='region-kemendagri-300-2-2-2430-2025';

-- Grandfather only data already public under the Phase 7 contract. No private contact is copied.
INSERT INTO "PublicOrganizerProfile" (id,"organizationId","publicSlug","displayName","logoUrl",status,"publishedAt","createdAt","updatedAt")
SELECT 'phase16-org-' || o.id,o.id,o.slug,o.name,o."logoUrl",'PUBLISHED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "Organization" o
WHERE o.status='ACTIVE' AND o."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "Competition" c WHERE c."organizationId"=o.id AND c."deletedAt" IS NULL AND c.status IN ('REGISTRATION','ONGOING','COMPLETED','ARCHIVED'))
ON CONFLICT ("organizationId") DO NOTHING;

WITH eligible AS (
  SELECT c.*,o.slug AS organization_slug,
    count(*) OVER (PARTITION BY c.slug) AS slug_count
  FROM "Competition" c JOIN "Organization" o ON o.id=c."organizationId"
  WHERE c."deletedAt" IS NULL AND c.status IN ('REGISTRATION','ONGOING','COMPLETED','ARCHIVED')
    AND o.status='ACTIVE' AND o."deletedAt" IS NULL
)
INSERT INTO "CompetitionPublication" (id,"organizationId","competitionId","publicSlug",status,"searchText","publishedAt","createdAt","updatedAt")
SELECT 'phase16-comp-' || e.id,e."organizationId",e.id,
  CASE WHEN e.slug_count=1 THEN e.slug ELSE e.slug || '--' || e.organization_slug END,
  'PUBLISHED',unaccent(lower(concat_ws(' ',e.name,e.description,e.category,e.location))),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM eligible e ON CONFLICT ("competitionId") DO NOTHING;

CREATE INDEX "CompetitionPublication_searchText_trgm_idx" ON "CompetitionPublication" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "Competition_name_trgm_idx" ON "Competition" USING GIN (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.phase16_refresh_competition_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "CompetitionPublication" cp SET "searchText"=unaccent(lower(concat_ws(' ',NEW.name,NEW.description,NEW.category,NEW.location,o.name,cp."ageCategory"))),"updatedAt"=CURRENT_TIMESTAMP
  FROM "Organization" o WHERE cp."competitionId"=NEW.id AND o.id=NEW."organizationId";
  RETURN NEW;
END $$;
CREATE TRIGGER phase16_competition_search_refresh AFTER UPDATE OF name,description,category,location ON "Competition" FOR EACH ROW EXECUTE FUNCTION public.phase16_refresh_competition_search();

CREATE OR REPLACE FUNCTION public.phase16_refresh_organizer_search() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "CompetitionPublication" cp SET "searchText"=unaccent(lower(concat_ws(' ',c.name,c.description,c.category,c.location,NEW.name,cp."ageCategory"))),"updatedAt"=CURRENT_TIMESTAMP
  FROM "Competition" c WHERE cp."organizationId"=NEW.id AND c.id=cp."competitionId";
  RETURN NEW;
END $$;
CREATE TRIGGER phase16_organizer_search_refresh AFTER UPDATE OF name ON "Organization" FOR EACH ROW EXECUTE FUNCTION public.phase16_refresh_organizer_search();

INSERT INTO "Permission" (id,key,description) VALUES
 ('phase16_public_profile_manage','organization.public_profile.manage','Mengelola dan mengajukan profil publik organisasi'),
 ('phase16_competition_publication_manage','competition.publication.manage','Mengelola dan mengajukan publikasi kompetisi')
ON CONFLICT (key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key IN ('organization-owner','e2e-owner') AND p.key IN ('organization.public_profile.manage','competition.publication.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "PlatformPermissionGrant" (id,"userId",permission,"grantedById",reason)
SELECT 'discovery_view_'||id,id,'discovery.moderate.view',id,'PHASE_16_DISCOVERY_MODERATION_BACKFILL' FROM "User" WHERE "isPlatformAdmin"=true ON CONFLICT DO NOTHING;
INSERT INTO "PlatformPermissionGrant" (id,"userId",permission,"grantedById",reason)
SELECT 'discovery_manage_'||id,id,'discovery.moderate.manage',id,'PHASE_16_DISCOVERY_MODERATION_BACKFILL' FROM "User" WHERE "isPlatformAdmin"=true ON CONFLICT DO NOTHING;

-- Global references are public-read/platform-write. Draft tenant projections are invisible in public mode.
ALTER TABLE "RegionDataset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY region_dataset_public_read ON "RegionDataset" FOR SELECT USING ("isActive" OR current_setting('app.access_mode',true) IN ('platform','job'));
CREATE POLICY region_dataset_platform_write ON "RegionDataset" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');
ALTER TABLE "AdministrativeArea" ENABLE ROW LEVEL SECURITY;
CREATE POLICY region_area_public_read ON "AdministrativeArea" FOR SELECT USING ("isActive" OR current_setting('app.access_mode',true) IN ('platform','job'));
CREATE POLICY region_area_platform_write ON "AdministrativeArea" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');
ALTER TABLE "AdministrativeAreaRevision" ENABLE ROW LEVEL SECURITY;
CREATE POLICY region_revision_platform_only ON "AdministrativeAreaRevision" FOR ALL USING (current_setting('app.access_mode',true) IN ('platform','job')) WITH CHECK (current_setting('app.access_mode',true)='platform');
ALTER TABLE "PublicSlugRedirect" ENABLE ROW LEVEL SECURITY;
CREATE POLICY redirect_public_read ON "PublicSlugRedirect" FOR SELECT USING (current_setting('app.access_mode',true) IN ('public','platform','job'));
CREATE POLICY redirect_platform_write ON "PublicSlugRedirect" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['PublicOrganizerProfile','CompetitionPublication'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY discovery_tenant_platform ON %I FOR ALL USING ("organizationId"=NULLIF(current_setting(''app.current_organization_id'',true),'''') OR current_setting(''app.access_mode'',true) IN (''platform'',''job'')) WITH CHECK ("organizationId"=NULLIF(current_setting(''app.current_organization_id'',true),'''') OR current_setting(''app.access_mode'',true)=''platform'')',t);
    EXECUTE format('CREATE POLICY discovery_public_published ON %I FOR SELECT USING (current_setting(''app.access_mode'',true)=''public'' AND status=''PUBLISHED'')',t);
  END LOOP;
END $$;
