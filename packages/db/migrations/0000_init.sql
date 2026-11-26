CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"warn_limit" integer DEFAULT 2 NOT NULL,
	"interrupt_secs" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_status_check" CHECK ("schools"."status" in ('active', 'locked')),
	CONSTRAINT "schools_max_attempts_check" CHECK ("schools"."max_attempts" >= 1),
	CONSTRAINT "schools_warn_limit_check" CHECK ("schools"."warn_limit" >= 0),
	CONSTRAINT "schools_interrupt_secs_check" CHECK ("schools"."interrupt_secs" >= 1)
);
--> statement-breakpoint
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"role" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"subject_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_accounts_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "staff_accounts_role_check" CHECK ("staff_accounts"."role" in ('super_admin', 'school_admin', 'teacher')),
	CONSTRAINT "staff_accounts_scope_check" CHECK (("staff_accounts"."role" = 'super_admin' and "staff_accounts"."school_id" is null and "staff_accounts"."subject_id" is null)
        or ("staff_accounts"."role" = 'school_admin' and "staff_accounts"."school_id" is not null and "staff_accounts"."subject_id" is null)
        or ("staff_accounts"."role" = 'teacher' and "staff_accounts"."school_id" is not null and "staff_accounts"."subject_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "staff_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_school_name_key" UNIQUE("school_id","name"),
	CONSTRAINT "subjects_school_id_id_key" UNIQUE("school_id","id")
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_years_school_name_key" UNIQUE("school_id","name"),
	CONSTRAINT "academic_years_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "academic_years_dates_check" CHECK ("academic_years"."ends_on" > "academic_years"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_teacher_class_key" UNIQUE("teacher_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classes_school_year_name_key" UNIQUE("school_id","academic_year_id","name"),
	CONSTRAINT "classes_school_id_id_key" UNIQUE("school_id","id")
);
--> statement-breakpoint
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_student_class_key" UNIQUE("student_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"full_name" text,
	"date_of_birth" date,
	"hometown" text,
	"address" text,
	"guardian_name" text,
	"guardian_phone" text,
	"anonymized_at" timestamp with time zone,
	"code_voided" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_school_code_key" UNIQUE("school_id","code"),
	CONSTRAINT "students_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "students_anonymized_voids_code_check" CHECK ("students"."anonymized_at" is null or "students"."code_voided")
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "question_options_question_position_key" UNIQUE("question_id","position")
);
--> statement-breakpoint
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"content" text NOT NULL,
	"difficulty" text NOT NULL,
	"multi_select" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" in ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"max_attempts_snap" integer,
	"warn_limit_snap" integer,
	"interrupt_secs_snap" integer,
	"answers_published_at" timestamp with time zone,
	"scores_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_classes_exam_class_key" UNIQUE("exam_id","class_id"),
	CONSTRAINT "exam_classes_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "exam_classes_status_check" CHECK ("exam_classes"."status" in ('draft', 'dispatched', 'closed')),
	CONSTRAINT "exam_classes_dispatch_check" CHECK ("exam_classes"."status" = 'draft' or (
        "exam_classes"."dispatched_at" is not null
        and "exam_classes"."max_attempts_snap" is not null
        and "exam_classes"."warn_limit_snap" is not null
        and "exam_classes"."interrupt_secs_snap" is not null
        and ("exam_classes"."status" <> 'closed' or "exam_classes"."closed_at" is not null)
      ))
);
--> statement-breakpoint
ALTER TABLE "exam_classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "exam_options_question_position_key" UNIQUE("exam_question_id","position")
);
--> statement-breakpoint
ALTER TABLE "exam_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"source_question_id" uuid,
	"content" text NOT NULL,
	"difficulty" text NOT NULL,
	"multi_select" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "exam_questions_exam_position_key" UNIQUE("exam_id","position"),
	CONSTRAINT "exam_questions_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "exam_questions_difficulty_check" CHECK ("exam_questions"."difficulty" in ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
ALTER TABLE "exam_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"duration_minutes" integer NOT NULL,
	"draw_config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_code_key" UNIQUE("code"),
	CONSTRAINT "exams_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "exams_duration_check" CHECK ("exams"."duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"selected_option_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_answers_attempt_question_key" UNIQUE("attempt_id","exam_question_id")
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"started_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"end_reason" text,
	"score" numeric(4, 2),
	"question_order" jsonb,
	"option_orders" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_exam_class_student_no_key" UNIQUE("exam_class_id","student_id","attempt_no"),
	CONSTRAINT "attempts_school_id_id_key" UNIQUE("school_id","id"),
	CONSTRAINT "attempts_status_check" CHECK ("attempts"."status" in ('waiting', 'in_progress', 'submitted', 'interrupted')),
	CONSTRAINT "attempts_no_check" CHECK ("attempts"."attempt_no" >= 1),
	CONSTRAINT "attempts_in_progress_times_check" CHECK ("attempts"."status" <> 'in_progress' or ("attempts"."started_at" is not null and "attempts"."ends_at" is not null)),
	CONSTRAINT "attempts_submitted_time_check" CHECK ("attempts"."status" <> 'submitted' or "attempts"."submitted_at" is not null),
	CONSTRAINT "attempts_score_check" CHECK ("attempts"."score" is null or ("attempts"."score" >= 0 and "attempts"."score" <= 10))
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"student_id" uuid NOT NULL,
	"exam_class_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "student_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "student_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "waiting_presence" (
	"school_id" uuid NOT NULL,
	"exam_class_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waiting_presence_pkey" PRIMARY KEY("exam_class_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "waiting_presence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_staff_id_staff_accounts_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_subject_fk" FOREIGN KEY ("school_id","subject_id") REFERENCES "public"."subjects"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "public"."staff_accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_year_fk" FOREIGN KEY ("school_id","academic_year_id") REFERENCES "public"."academic_years"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_fk" FOREIGN KEY ("school_id","question_id") REFERENCES "public"."questions"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "public"."staff_accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_fk" FOREIGN KEY ("school_id","subject_id") REFERENCES "public"."subjects"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_exam_fk" FOREIGN KEY ("school_id","exam_id") REFERENCES "public"."exams"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_class_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_options" ADD CONSTRAINT "exam_options_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_options" ADD CONSTRAINT "exam_options_question_fk" FOREIGN KEY ("school_id","exam_question_id") REFERENCES "public"."exam_questions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_fk" FOREIGN KEY ("school_id","exam_id") REFERENCES "public"."exams"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_teacher_fk" FOREIGN KEY ("school_id","teacher_id") REFERENCES "public"."staff_accounts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_subject_fk" FOREIGN KEY ("school_id","subject_id") REFERENCES "public"."subjects"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_fk" FOREIGN KEY ("school_id","attempt_id") REFERENCES "public"."attempts"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_fk" FOREIGN KEY ("school_id","exam_question_id") REFERENCES "public"."exam_questions"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exam_class_fk" FOREIGN KEY ("school_id","exam_class_id") REFERENCES "public"."exam_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_sessions" ADD CONSTRAINT "student_sessions_exam_class_fk" FOREIGN KEY ("school_id","exam_class_id") REFERENCES "public"."exam_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_presence" ADD CONSTRAINT "waiting_presence_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_presence" ADD CONSTRAINT "waiting_presence_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiting_presence" ADD CONSTRAINT "waiting_presence_exam_class_fk" FOREIGN KEY ("school_id","exam_class_id") REFERENCES "public"."exam_classes"("school_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_staff_id_idx" ON "sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_accounts_username_key" ON "staff_accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_one_current_key" ON "academic_years" USING btree ("school_id") WHERE "academic_years"."is_current";--> statement-breakpoint
CREATE INDEX "questions_draw_idx" ON "questions" USING btree ("teacher_id","subject_id","difficulty");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_in_progress_key" ON "attempts" USING btree ("student_id") WHERE "attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "attempts_exam_class_status_idx" ON "attempts" USING btree ("exam_class_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "student_sessions_one_active_key" ON "student_sessions" USING btree ("student_id") WHERE "student_sessions"."revoked_at" is null;