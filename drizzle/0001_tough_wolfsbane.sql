CREATE TABLE `analytics_daily_visitors` (
	`day` text NOT NULL,
	`visitor` text NOT NULL,
	`opens` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_day` ON `analytics_daily_visitors` (`day`);--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_visitor_day` ON `analytics_daily_visitors` (`day`,`visitor`);