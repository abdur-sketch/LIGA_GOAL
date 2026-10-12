-- Phase 11: narrowly scoped multi-organization discovery. The authenticated
-- user can discover only their active membership and its organization; all
-- tenant detail still requires a subsequent tenant transaction.

CREATE POLICY identity_own_membership_select ON public."OrganizationMember"
  FOR SELECT
  USING (
    current_setting('app.access_mode', true) = 'membership'
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "isActive" = true
  );

CREATE POLICY identity_member_organization_select ON public."Organization"
  FOR SELECT
  USING (
    current_setting('app.access_mode', true) = 'membership'
    AND EXISTS (
      SELECT 1
      FROM public."OrganizationMember" member
      WHERE member."organizationId" = "Organization".id
        AND member."userId" = NULLIF(current_setting('app.current_user_id', true), '')
        AND member."isActive" = true
    )
  );
