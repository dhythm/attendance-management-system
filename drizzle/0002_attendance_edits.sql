CREATE TABLE "attendance_record_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"editor_user_id" uuid NOT NULL,
	"previous_clock_in_at" timestamp with time zone NOT NULL,
	"previous_clock_out_at" timestamp with time zone,
	"new_clock_in_at" timestamp with time zone NOT NULL,
	"new_clock_out_at" timestamp with time zone,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_record_edits_reason_not_blank" CHECK (char_length(btrim("attendance_record_edits"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_in_source" text DEFAULT 'clock' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "clock_out_source" text;--> statement-breakpoint
UPDATE "attendance_records" SET "clock_out_source" = 'clock' WHERE "clock_out_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_record_edits" ADD CONSTRAINT "attendance_record_edits_record_id_attendance_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."attendance_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_record_edits" ADD CONSTRAINT "attendance_record_edits_editor_user_id_users_id_fk" FOREIGN KEY ("editor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_record_edits_record_created_idx" ON "attendance_record_edits" USING btree ("record_id","created_at");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_clock_in_source_valid" CHECK ("attendance_records"."clock_in_source" IN ('clock', 'edit'));--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_clock_out_source_valid" CHECK ("attendance_records"."clock_out_source" IN ('clock', 'edit'));--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_clock_out_source_iff_clock_out" CHECK (("attendance_records"."clock_out_at" IS NULL) = ("attendance_records"."clock_out_source" IS NULL));