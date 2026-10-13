-- Public callers may observe only the positive VERIFIED fact, never evidence,
-- rejection reasons, reviewer identity, or other lifecycle states.
CREATE POLICY phase17_verification_public_badge ON "OrganizerVerification" FOR SELECT
USING (current_setting('app.access_mode',true)='public' AND status='VERIFIED');
