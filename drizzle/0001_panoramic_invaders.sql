ALTER TABLE `sdhinventory_verification_event` ADD `result` text DEFAULT 'VERIFIED' NOT NULL;--> statement-breakpoint
DELETE FROM `sdhinventory_verification_event`
WHERE rowid IN (
	SELECT rowid
	FROM (
		SELECT
			rowid,
			ROW_NUMBER() OVER (
				PARTITION BY `company_id`, `cycle_id`, `asset_id`
				ORDER BY `created_at` DESC, rowid DESC
			) AS duplicate_rank
		FROM `sdhinventory_verification_event`
	)
	WHERE duplicate_rank > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX `verification_event_company_cycle_asset_uidx` ON `sdhinventory_verification_event` (`company_id`,`cycle_id`,`asset_id`);
