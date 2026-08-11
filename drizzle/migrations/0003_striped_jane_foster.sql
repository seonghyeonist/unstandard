ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_count_nonnegative" CHECK ("rate_limits"."count" >= 0);--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_category_check" CHECK ("support_requests"."category" IN ('technical', 'safety', 'privacy', 'account', 'other'));--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_status_check" CHECK ("support_requests"."status" IN ('OPEN', 'IN_PROGRESS', 'CLOSED'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.delete_user_linked_residuals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.reports
  WHERE
    (target_type = 'profile' AND target_id IN (
      SELECT id::text FROM public.profiles WHERE user_id = OLD.id
    ))
    OR
    (target_type = 'answer' AND target_id IN (
      SELECT id::text FROM public.answers WHERE user_id = OLD.id
    ));

  DELETE FROM public.alpha_invites
  WHERE consumed_by_user_id = OLD.id
     OR email_normalized = lower(trim(OLD.email));

  DELETE FROM public.verifications
  WHERE value = OLD.id OR identifier = OLD.email;

  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_delete_linked_residuals
BEFORE DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.delete_user_linked_residuals();
