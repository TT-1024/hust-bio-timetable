CREATE TABLE `lesson_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`important` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text,
	`change_id` text
);
--> statement-breakpoint
CREATE TABLE `note_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`content` text NOT NULL,
	`important` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	`writer_hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `note_revision_history` ON `note_revisions` (`note_id`,`revision`);--> statement-breakpoint
CREATE INDEX `note_writer_updates` ON `note_revisions` (`writer_hash`,`updated_at`);