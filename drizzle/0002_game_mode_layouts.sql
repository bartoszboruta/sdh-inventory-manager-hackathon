CREATE TABLE `sdhinventory_office_layout` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`office_id` text(255) NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`base_layer_json` text DEFAULT '{}' NOT NULL,
	`asset_layer_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`office_id`) REFERENCES `sdhinventory_office`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `office_layout_company_office_idx` ON `sdhinventory_office_layout` (`company_id`,`office_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `office_layout_company_office_uidx` ON `sdhinventory_office_layout` (`company_id`,`office_id`);
