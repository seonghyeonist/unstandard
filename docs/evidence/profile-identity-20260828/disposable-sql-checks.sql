-- Executed only on the newly-created disposable branch. The successful sentinel rolls back all fixtures.
-- Predicate compiled from introduction-policy.ts using Drizzle PgDialect; not a hand-recreated filter.
DO $profile_checks$
DECLARE allowed_count integer; failed boolean;
BEGIN
  BEGIN
    INSERT INTO users (id, name, email, email_verified, invite_finalized_at) VALUES
      ('profile-test-male','synthetic','profile-test-male@example.com',true,now()),
      ('profile-test-female','synthetic','profile-test-female@example.com',true,now()),
      ('profile-test-same','synthetic','profile-test-same@example.com',true,now());
    INSERT INTO profiles (user_id,nickname,onboarded_at) SELECT id,'synthetic',now() FROM users WHERE id IN ('profile-test-male','profile-test-female','profile-test-same');
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Legacy/missing basics exposure'; END IF;
    INSERT INTO profile_basics (user_id,gender,age,region,introduction_scope_accepted,introduction_scope_version,profile_consent_version,consented_at)
    VALUES ('profile-test-male','male',22,'서울',true,'alpha-opposite-gender-v1','alpha-basic-profile-v1',now()),
      ('profile-test-female','female',22,'서울',true,'alpha-opposite-gender-v1','alpha-basic-profile-v1',now()),
      ('profile-test-same','male',22,'서울',true,'alpha-opposite-gender-v1','alpha-basic-profile-v1',now());
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Unverified exposure'; END IF;
    INSERT INTO identity_verifications(user_id,request_id,profile_revision,status,provider,notice_version,requested_at,expires_at,verified_at)
      SELECT user_id, gen_random_uuid(),revision,'verified','synthetic-test-only','alpha-identity-v1',now(),now()+interval '10 minutes',now()
      FROM profile_basics WHERE user_id IN ('profile-test-male','profile-test-female','profile-test-same');
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 1 THEN RAISE EXCEPTION 'Opposite-gender eligibility or same-gender/self exclusion failed: %', allowed_count; END IF;
    UPDATE profile_basics SET introduction_scope_accepted=false WHERE user_id='profile-test-female';
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Consent withdrawal exposure'; END IF;
    UPDATE profile_basics SET introduction_scope_accepted=true,revision=gen_random_uuid() WHERE user_id='profile-test-female';
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Stale verification exposure'; END IF;
    UPDATE identity_verifications SET profile_revision=(SELECT revision FROM profile_basics WHERE user_id='profile-test-female') WHERE user_id='profile-test-female';
    UPDATE profile_basics SET updated_at=now()-interval '365 days' WHERE user_id='profile-test-female';
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Stale age exposure'; END IF;
    UPDATE profile_basics SET updated_at=now() WHERE user_id='profile-test-female';
    INSERT INTO blocks(blocker_user_id,blocked_user_id) VALUES ('profile-test-female','profile-test-male');
    SELECT count(*) INTO allowed_count FROM profiles target WHERE (target.user_id <> 'profile-test-male'
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = 'profile-test-male' AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (
    SELECT 1 FROM profile_basics pb
    JOIN identity_verifications iv ON iv.user_id = pb.user_id
    JOIN profiles ep ON ep.user_id = pb.user_id
    WHERE pb.user_id = target.user_id AND ep.onboarded_at IS NOT NULL
      AND pb.gender IN ('male','female') AND pb.age BETWEEN 19 AND 120
      AND pb.introduction_scope_accepted = true
      AND pb.profile_consent_version = 'alpha-basic-profile-v1'
      AND pb.introduction_scope_version = 'alpha-opposite-gender-v1'
      AND pb.updated_at <= now() AND pb.updated_at > now() - interval '365 days'
      AND iv.notice_version = 'alpha-identity-v1' AND iv.status = 'verified' AND iv.verified_at IS NOT NULL AND iv.verified_at <= now()
      AND iv.profile_revision = pb.revision
  )
    AND EXISTS (SELECT 1 FROM profile_basics a JOIN profile_basics b ON a.gender <> b.gender
      WHERE a.user_id = 'profile-test-male' AND b.user_id = target.user_id)
    AND NOT EXISTS (SELECT 1 FROM blocks bl WHERE
      (bl.blocker_user_id = 'profile-test-male' AND bl.blocked_user_id = target.user_id) OR
      (bl.blocker_user_id = target.user_id AND bl.blocked_user_id = 'profile-test-male')));
    IF allowed_count <> 0 THEN RAISE EXCEPTION 'Blocked pair exposure'; END IF;
    failed := false;
    BEGIN UPDATE profile_basics SET age=18 WHERE user_id='profile-test-male'; EXCEPTION WHEN check_violation THEN failed:=true; END;
    IF NOT failed THEN RAISE EXCEPTION 'Underage accepted'; END IF;
    failed := false;
    BEGIN UPDATE profile_basics SET region='precise-address' WHERE user_id='profile-test-male'; EXCEPTION WHEN check_violation THEN failed:=true; END;
    IF NOT failed THEN RAISE EXCEPTION 'Precise region accepted'; END IF;
    failed := false;
    BEGIN UPDATE identity_verifications SET verified_at=null WHERE user_id='profile-test-male'; EXCEPTION WHEN check_violation THEN failed:=true; END;
    IF NOT failed THEN RAISE EXCEPTION 'Invalid verified state accepted'; END IF;
    DELETE FROM profile_basics WHERE user_id='profile-test-female';
    IF EXISTS(SELECT 1 FROM identity_verifications WHERE user_id='profile-test-female') THEN RAISE EXCEPTION 'Withdrawal residual'; END IF;
    DELETE FROM users WHERE id='profile-test-male';
    IF EXISTS(SELECT 1 FROM profile_basics WHERE user_id='profile-test-male') OR EXISTS(SELECT 1 FROM identity_verifications WHERE user_id='profile-test-male') THEN RAISE EXCEPTION 'Deletion residual'; END IF;
    RAISE SQLSTATE 'ZP001' USING MESSAGE='rollback all successful test fixtures';
  EXCEPTION WHEN SQLSTATE 'ZP001' THEN NULL;
  END;
END $profile_checks$;
