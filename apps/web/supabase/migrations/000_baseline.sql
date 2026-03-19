


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."category" AS ENUM (
    'cafe',
    'restaurant',
    'photospot',
    'street',
    'bar',
    'culture',
    'nature',
    'shopping'
);


ALTER TYPE "public"."category" OWNER TO "postgres";


CREATE TYPE "public"."city" AS ENUM (
    'seoul',
    'busan',
    'jeju',
    'gyeongju',
    'jeonju',
    'gangneung',
    'sokcho',
    'yeosu',
    'incheon'
);


ALTER TYPE "public"."city" OWNER TO "postgres";


CREATE TYPE "public"."nationality" AS ENUM (
    'KR',
    'JP',
    'US',
    'CN',
    'ES',
    'RU',
    'OTHER'
);


ALTER TYPE "public"."nationality" OWNER TO "postgres";


CREATE TYPE "public"."place_type" AS ENUM (
    'normal',
    'hidden_spot'
);


ALTER TYPE "public"."place_type" OWNER TO "postgres";


CREATE TYPE "public"."post_type" AS ENUM (
    'visited',
    'want'
);


ALTER TYPE "public"."post_type" OWNER TO "postgres";


CREATE TYPE "public"."rating" AS ENUM (
    'must_go',
    'worth_it',
    'neutral',
    'not_great',
    'never'
);


ALTER TYPE "public"."rating" OWNER TO "postgres";


CREATE TYPE "public"."trust_action" AS ENUM (
    'visited_post',
    'want_post',
    'hidden_spot_registered',
    'post_saved_by_other',
    'place_saved_by_other',
    'hidden_spot_reposted',
    'daily_bonus',
    'reported',
    'fake_place'
);


ALTER TYPE "public"."trust_action" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_trust_points"("p_user_id" "uuid", "p_action" "public"."trust_action", "p_ref_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_points INTEGER;
BEGIN
  v_points := CASE p_action
    WHEN 'visited_post'            THEN 2
    WHEN 'want_post'               THEN 1
    WHEN 'hidden_spot_registered'  THEN 8
    WHEN 'post_saved_by_other'     THEN 1
    WHEN 'place_saved_by_other'    THEN 1
    WHEN 'hidden_spot_reposted'    THEN 3
    WHEN 'daily_bonus'             THEN 1
    WHEN 'reported'                THEN -10
    WHEN 'fake_place'              THEN -20
    ELSE 0
  END;

  INSERT INTO trust_logs (user_id, action_type, points, ref_id)
  VALUES (p_user_id, p_action, v_points, p_ref_id);

  UPDATE profiles
  SET trust_score = GREATEST(0, trust_score + v_points)
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."apply_trust_points"("p_user_id" "uuid", "p_action" "public"."trust_action", "p_ref_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_join_new"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_organizer UUID;
  v_place_name TEXT;
  v_scheduled TEXT;
  v_meetup_id UUID;
BEGIN
  v_meetup_id := NEW.meetup_id;

  SELECT pm.organizer_id,
         p.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
  INTO   v_organizer, v_place_name, v_scheduled
  FROM   place_meetups pm
  JOIN   places p ON p.id = pm.place_id
  WHERE  pm.id = v_meetup_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_organizer,
    'join_new',
    '새 번개 신청',
    v_place_name || ' · ' || v_scheduled,
    jsonb_build_object('meetup_id', v_meetup_id, 'join_id', NEW.id)
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notify_join_new"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_join_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_place_name TEXT;
  v_scheduled  TEXT;
  v_type       TEXT;
  v_title      TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT p.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
  INTO   v_place_name, v_scheduled
  FROM   place_meetups pm
  JOIN   places p ON p.id = pm.place_id
  WHERE  pm.id = NEW.meetup_id;

  CASE NEW.status
    WHEN 'accepted'  THEN v_type := 'join_accepted';  v_title := '번개 수락됨';
    WHEN 'rejected'  THEN v_type := 'join_rejected';  v_title := '번개 거절됨';
    WHEN 'unmatched' THEN v_type := 'join_unmatched'; v_title := '번개 언매치됨';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.applicant_id,
    v_type,
    v_title,
    v_place_name || ' · ' || v_scheduled,
    jsonb_build_object('meetup_id', NEW.meetup_id, 'join_id', NEW.id)
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notify_join_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notify_message_new"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sender_nick TEXT;
  v_place_name  TEXT;
  r             RECORD;
BEGIN
  SELECT nick.nickname, p.name
  INTO   v_sender_nick, v_place_name
  FROM   profiles nick
  JOIN   place_meetups pm ON pm.id = NEW.meetup_id
  JOIN   places p ON p.id = pm.place_id
  WHERE  nick.id = NEW.sender_id;

  FOR r IN
    SELECT organizer_id AS uid
    FROM   place_meetups
    WHERE  id = NEW.meetup_id AND organizer_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.uid,
      'message_new',
      v_place_name || ' 스레드',
      v_sender_nick || ': ' || left(NEW.content, 40),
      jsonb_build_object('meetup_id', NEW.meetup_id, 'message_id', NEW.id)
    );
  END LOOP;

  FOR r IN
    SELECT applicant_id AS uid
    FROM   meetup_joins
    WHERE  meetup_id = NEW.meetup_id
      AND  status = 'accepted'
      AND  applicant_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.uid,
      'message_new',
      v_place_name || ' 스레드',
      v_sender_nick || ': ' || left(NEW.content, 40),
      jsonb_build_object('meetup_id', NEW.meetup_id, 'message_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_notify_message_new"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role        user_role;
  v_nickname    TEXT;
  v_base        TEXT;
  v_counter     INT := 0;
  v_locale      TEXT;
  v_nationality nationality;
BEGIN
  v_role := CASE NEW.email
    WHEN 'siwol406@gmail.com' THEN 'admin'::user_role
    ELSE 'user'::user_role
  END;

  v_base := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_base := substring(v_base, 1, 14);

  v_nickname := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname) LOOP
    v_counter := v_counter + 1;
    v_nickname := substring(v_base, 1, 12) || v_counter::TEXT;
  END LOOP;

  v_locale := lower(coalesce(NEW.raw_user_meta_data->>'locale', ''));
  v_nationality := CASE
    WHEN v_locale LIKE 'ko%'               THEN 'KR'::nationality
    WHEN v_locale LIKE 'ja%'               THEN 'JP'::nationality
    WHEN v_locale IN ('zh-tw', 'zh-hant')  THEN 'OTHER'::nationality
    WHEN v_locale LIKE 'zh%'               THEN 'CN'::nationality
    WHEN v_locale LIKE 'es%'               THEN 'ES'::nationality
    WHEN v_locale LIKE 'ru%'               THEN 'RU'::nationality
    WHEN v_locale LIKE 'en%'               THEN 'US'::nationality
    ELSE                                        'OTHER'::nationality
  END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, nickname, nationality, avatar_url, role, trust_score)
    VALUES (
      NEW.id,
      v_nickname,
      v_nationality,
      NEW.raw_user_meta_data->>'avatar_url',
      v_role,
      CASE WHEN NEW.email = 'siwol406@gmail.com' THEN 8000 ELSE 4 END
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_place_avg_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_place_id UUID;
BEGIN
  target_place_id := COALESCE(NEW.place_id, OLD.place_id);

  UPDATE places SET avg_rating = (
    SELECT AVG(CASE rating
      WHEN 'must_go'  THEN 4
      WHEN 'worth_it' THEN 3
      WHEN 'neutral'  THEN 2
      WHEN 'not_great' THEN 1
    END)
    FROM posts
    WHERE place_id = target_place_id
      AND type = 'visited'
      AND rating IS NOT NULL
  )
  WHERE id = target_place_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_place_avg_rating"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'accepted'::"text" NOT NULL,
    CONSTRAINT "follows_check" CHECK (("follower_id" <> "following_id")),
    CONSTRAINT "follows_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "response" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    CONSTRAINT "inquiries_category_check" CHECK (("category" = ANY (ARRAY['bug'::"text", 'account'::"text", 'content'::"text", 'points'::"text", 'suggestion'::"text", 'other'::"text"]))),
    CONSTRAINT "inquiries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetup_joins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meetup_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "join_count" integer DEFAULT 1 NOT NULL,
    "join_gender" "text",
    "join_age_groups" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meetup_joins_join_gender_check" CHECK (("join_gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'mixed'::"text"]))),
    CONSTRAINT "meetup_joins_message_check" CHECK (("char_length"("message") <= 80)),
    CONSTRAINT "meetup_joins_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'unmatched'::"text"])))
);


ALTER TABLE "public"."meetup_joins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetup_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meetup_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "meetup_messages_content_check" CHECK (("char_length"("content") <= 300))
);


ALTER TABLE "public"."meetup_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['meetup_today'::"text", 'join_new'::"text", 'join_accepted'::"text", 'join_rejected'::"text", 'join_unmatched'::"text", 'message_new'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."place_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_meetups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "place_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "host_count" integer DEFAULT 1 NOT NULL,
    "host_gender" "text",
    "host_age_groups" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "activities" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "vibe" "text",
    "description" "text",
    "wanted_gender" "text",
    "wanted_age_groups" "text"[],
    "wanted_count" integer,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "wanted_nationalities" "text"[],
    CONSTRAINT "place_meetups_description_check" CHECK (("char_length"("description") <= 100)),
    CONSTRAINT "place_meetups_host_gender_check" CHECK (("host_gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'mixed'::"text"]))),
    CONSTRAINT "place_meetups_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'expired'::"text"]))),
    CONSTRAINT "place_meetups_vibe_check" CHECK (("vibe" = ANY (ARRAY['casual'::"text", 'fun'::"text", 'serious'::"text"]))),
    CONSTRAINT "place_meetups_wanted_gender_check" CHECK (("wanted_gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'any'::"text"])))
);


ALTER TABLE "public"."place_meetups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."place_saves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."place_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "address" "text",
    "city" "public"."city" NOT NULL,
    "category" "public"."category" NOT NULL,
    "place_type" "public"."place_type" DEFAULT 'normal'::"public"."place_type" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "district" "text",
    "google_place_id" "text",
    "google_rating" numeric(2,1),
    "google_review_count" integer,
    "avg_rating" numeric(3,2),
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_saves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_saves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "place_id" "uuid" NOT NULL,
    "type" "public"."post_type" NOT NULL,
    "rating" "public"."rating",
    "memo" "text",
    "photos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recommended_menu" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "visited_requires_rating" CHECK ((("type" <> 'visited'::"public"."post_type") OR ("rating" IS NOT NULL)))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "nationality" "public"."nationality" DEFAULT 'KR'::"public"."nationality" NOT NULL,
    "avatar_url" "text",
    "is_public" boolean DEFAULT true NOT NULL,
    "trust_score" integer DEFAULT 4 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "onboarded" boolean DEFAULT false NOT NULL,
    "birth_year" smallint,
    "accommodation_name" "text",
    "accommodation_address" "text",
    "gender" "text",
    "birth_date" "date",
    "gender_changed_at" timestamp with time zone,
    "bio" "text",
    CONSTRAINT "profiles_bio_check" CHECK (("char_length"("bio") <= 120)),
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'place'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_courses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT '나의 코스'::"text" NOT NULL,
    "place_ids" "text"[] NOT NULL,
    "origin_name" "text" NOT NULL,
    "transport" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "days" integer DEFAULT 1 NOT NULL,
    "city" "text",
    "style" "text" DEFAULT 'balanced'::"text",
    "companion" "text" DEFAULT 'friends'::"text",
    "start_hour" integer DEFAULT 10,
    "course_data" "jsonb",
    "is_public" boolean DEFAULT true,
    CONSTRAINT "saved_courses_transport_check" CHECK (("transport" = ANY (ARRAY['walking'::"text", 'transit'::"text", 'driving'::"text"])))
);


ALTER TABLE "public"."saved_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trust_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action_type" "public"."trust_action" NOT NULL,
    "points" integer NOT NULL,
    "ref_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trust_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetup_joins"
    ADD CONSTRAINT "meetup_joins_meetup_id_applicant_id_key" UNIQUE ("meetup_id", "applicant_id");



ALTER TABLE ONLY "public"."meetup_joins"
    ADD CONSTRAINT "meetup_joins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetup_messages"
    ADD CONSTRAINT "meetup_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_likes"
    ADD CONSTRAINT "place_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_likes"
    ADD CONSTRAINT "place_likes_user_id_place_id_key" UNIQUE ("user_id", "place_id");



ALTER TABLE ONLY "public"."place_meetups"
    ADD CONSTRAINT "place_meetups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_saves"
    ADD CONSTRAINT "place_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."place_saves"
    ADD CONSTRAINT "place_saves_user_id_place_id_key" UNIQUE ("user_id", "place_id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_name_lat_lng_key" UNIQUE ("name", "lat", "lng");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."post_saves"
    ADD CONSTRAINT "post_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_saves"
    ADD CONSTRAINT "post_saves_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_nickname_unique" UNIQUE ("nickname");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_courses"
    ADD CONSTRAINT "saved_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trust_logs"
    ADD CONSTRAINT "trust_logs_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "trg_notify_join_new" AFTER INSERT ON "public"."meetup_joins" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_join_new"();



CREATE OR REPLACE TRIGGER "trg_notify_join_status" AFTER UPDATE ON "public"."meetup_joins" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_join_status"();



CREATE OR REPLACE TRIGGER "trg_notify_message_new" AFTER INSERT ON "public"."meetup_messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notify_message_new"();



CREATE OR REPLACE TRIGGER "trg_update_avg_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_place_avg_rating"();



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetup_joins"
    ADD CONSTRAINT "meetup_joins_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetup_joins"
    ADD CONSTRAINT "meetup_joins_meetup_id_fkey" FOREIGN KEY ("meetup_id") REFERENCES "public"."place_meetups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetup_messages"
    ADD CONSTRAINT "meetup_messages_meetup_id_fkey" FOREIGN KEY ("meetup_id") REFERENCES "public"."place_meetups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetup_messages"
    ADD CONSTRAINT "meetup_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_likes"
    ADD CONSTRAINT "place_likes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_likes"
    ADD CONSTRAINT "place_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_meetups"
    ADD CONSTRAINT "place_meetups_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_meetups"
    ADD CONSTRAINT "place_meetups_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_saves"
    ADD CONSTRAINT "place_saves_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."place_saves"
    ADD CONSTRAINT "place_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_saves"
    ADD CONSTRAINT "post_saves_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_saves"
    ADD CONSTRAINT "post_saves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."saved_courses"
    ADD CONSTRAINT "saved_courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trust_logs"
    ADD CONSTRAINT "trust_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "joins_delete" ON "public"."meetup_joins" FOR DELETE USING (("auth"."uid"() = "applicant_id"));



CREATE POLICY "joins_insert" ON "public"."meetup_joins" FOR INSERT WITH CHECK ((("auth"."uid"() = "applicant_id") AND (( SELECT "profiles"."is_public"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true) AND (( SELECT "profiles"."trust_score"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) >= 3) AND ("auth"."uid"() <> ( SELECT "place_meetups"."organizer_id"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id"))) AND (( SELECT "place_meetups"."status"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id")) = 'open'::"text") AND (( SELECT "place_meetups"."scheduled_at"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id")) > "now"()) AND ((( SELECT "place_meetups"."wanted_nationalities"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id")) IS NULL) OR (( SELECT ("profiles"."nationality")::"text" AS "nationality"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) IN ( SELECT "unnest"("place_meetups"."wanted_nationalities") AS "unnest"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id"))))));



CREATE POLICY "joins_select" ON "public"."meetup_joins" FOR SELECT USING ((("auth"."uid"() = "applicant_id") OR ("auth"."uid"() = ( SELECT "place_meetups"."organizer_id"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id")))));



CREATE POLICY "joins_update" ON "public"."meetup_joins" FOR UPDATE USING (("auth"."uid"() = ( SELECT "place_meetups"."organizer_id"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_joins"."meetup_id"))));



ALTER TABLE "public"."meetup_joins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetup_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetups_delete" ON "public"."place_meetups" FOR DELETE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "meetups_insert" ON "public"."place_meetups" FOR INSERT WITH CHECK ((("auth"."uid"() = "organizer_id") AND (( SELECT "profiles"."is_public"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = true) AND (( SELECT "profiles"."trust_score"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) >= 3)));



CREATE POLICY "meetups_select" ON "public"."place_meetups" FOR SELECT USING (true);



CREATE POLICY "meetups_update" ON "public"."place_meetups" FOR UPDATE USING (("auth"."uid"() = "organizer_id"));



CREATE POLICY "messages_insert" ON "public"."meetup_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND (("auth"."uid"() = ( SELECT "place_meetups"."organizer_id"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_messages"."meetup_id"))) OR ("auth"."uid"() IN ( SELECT "meetup_joins"."applicant_id"
   FROM "public"."meetup_joins"
  WHERE (("meetup_joins"."meetup_id" = "meetup_messages"."meetup_id") AND ("meetup_joins"."status" = 'accepted'::"text"))))) AND ("date"((( SELECT "place_meetups"."scheduled_at"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_messages"."meetup_id")) AT TIME ZONE 'Asia/Seoul'::"text")) <= "date"(("now"() AT TIME ZONE 'Asia/Seoul'::"text")))));



CREATE POLICY "messages_select" ON "public"."meetup_messages" FOR SELECT USING ((("auth"."uid"() = ( SELECT "place_meetups"."organizer_id"
   FROM "public"."place_meetups"
  WHERE ("place_meetups"."id" = "meetup_messages"."meetup_id"))) OR ("auth"."uid"() IN ( SELECT "meetup_joins"."applicant_id"
   FROM "public"."meetup_joins"
  WHERE (("meetup_joins"."meetup_id" = "meetup_messages"."meetup_id") AND ("meetup_joins"."status" = 'accepted'::"text"))))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."place_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "place_likes_delete" ON "public"."place_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "place_likes_insert" ON "public"."place_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "place_likes_select" ON "public"."place_likes" FOR SELECT USING (true);



ALTER TABLE "public"."place_meetups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."place_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trust_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "공개 포스팅 조회 가능" ON "public"."posts" FOR SELECT USING ((("deleted_at" IS NULL) AND (("is_public" = true) OR ("auth"."uid"() = "user_id"))));



CREATE POLICY "공개 프로필 조회 가능" ON "public"."profiles" FOR SELECT USING ((("is_public" = true) OR ("auth"."uid"() = "id")));



CREATE POLICY "로그인 유저 문의 가능" ON "public"."inquiries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "로그인 유저 신고 가능" ON "public"."reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "로그인 유저 장소 등록 가능" ON "public"."places" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "로그인 유저 포스팅 생성 가능" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 trust 로그 조회" ON "public"."trust_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 문의 조회" ON "public"."inquiries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 신고 내역 조회" ON "public"."reports" FOR SELECT USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "본인 장소 저장 삭제" ON "public"."place_saves" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 장소 저장 생성" ON "public"."place_saves" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 장소 저장 조회" ON "public"."place_saves" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 좋아요 삭제" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 좋아요 생성" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 코스만 삭제" ON "public"."saved_courses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 코스만 삽입" ON "public"."saved_courses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 팔로우 삭제" ON "public"."follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "본인 팔로우 생성" ON "public"."follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "본인 포스팅 저장 삭제" ON "public"."post_saves" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 포스팅 저장 생성" ON "public"."post_saves" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 포스팅 저장 조회" ON "public"."post_saves" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 포스팅만 삭제 가능" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 포스팅만 수정/삭제 가능" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "본인 프로필 생성 가능" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "본인 프로필만 수정 가능" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "본인이 등록한 장소만 수정 가능" ON "public"."places" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "어드민 trust 로그 전체 조회" ON "public"."trust_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 문의 수정 가능" ON "public"."inquiries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 문의 전체 조회" ON "public"."inquiries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 삭제 장소 조회" ON "public"."places" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 삭제 포스팅 조회" ON "public"."posts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 신고 수정 가능" ON "public"."reports" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "어드민 신고 전체 조회" ON "public"."reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "장소 전체 조회 가능" ON "public"."places" FOR SELECT USING (("deleted_at" IS NULL));



CREATE POLICY "좋아요 조회 가능" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "코스 조회" ON "public"."saved_courses" FOR SELECT USING ((("is_public" = true) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "팔로우 조회" ON "public"."follows" FOR SELECT USING ((("auth"."uid"() = "follower_id") OR ("auth"."uid"() = "following_id")));



CREATE POLICY "팔로우 조회 가능" ON "public"."follows" FOR SELECT USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."apply_trust_points"("p_user_id" "uuid", "p_action" "public"."trust_action", "p_ref_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_trust_points"("p_user_id" "uuid", "p_action" "public"."trust_action", "p_ref_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_trust_points"("p_user_id" "uuid", "p_action" "public"."trust_action", "p_ref_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_join_new"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_join_new"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_join_new"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_join_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_join_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_join_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notify_message_new"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notify_message_new"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notify_message_new"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_place_avg_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_place_avg_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_place_avg_rating"() TO "service_role";


















GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."meetup_joins" TO "anon";
GRANT ALL ON TABLE "public"."meetup_joins" TO "authenticated";
GRANT ALL ON TABLE "public"."meetup_joins" TO "service_role";



GRANT ALL ON TABLE "public"."meetup_messages" TO "anon";
GRANT ALL ON TABLE "public"."meetup_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."meetup_messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."place_likes" TO "anon";
GRANT ALL ON TABLE "public"."place_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."place_likes" TO "service_role";



GRANT ALL ON TABLE "public"."place_meetups" TO "anon";
GRANT ALL ON TABLE "public"."place_meetups" TO "authenticated";
GRANT ALL ON TABLE "public"."place_meetups" TO "service_role";



GRANT ALL ON TABLE "public"."place_saves" TO "anon";
GRANT ALL ON TABLE "public"."place_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."place_saves" TO "service_role";



GRANT ALL ON TABLE "public"."places" TO "anon";
GRANT ALL ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."post_saves" TO "anon";
GRANT ALL ON TABLE "public"."post_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."post_saves" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."saved_courses" TO "anon";
GRANT ALL ON TABLE "public"."saved_courses" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_courses" TO "service_role";



GRANT ALL ON TABLE "public"."trust_logs" TO "anon";
GRANT ALL ON TABLE "public"."trust_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."trust_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































