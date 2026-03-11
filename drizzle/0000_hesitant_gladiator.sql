CREATE TABLE `sdhinventory_account` (
	`user_id` text(255) NOT NULL,
	`type` text(255) NOT NULL,
	`provider` text(255) NOT NULL,
	`provider_account_id` text(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text(255),
	`scope` text(255),
	`id_token` text,
	`session_state` text(255),
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `sdhinventory_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_asset` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`barcode` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`category` text(255) NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`current_employee_id` text(255),
	`current_room_id` text(255),
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_employee_id`) REFERENCES `sdhinventory_employee`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_room_id`) REFERENCES `sdhinventory_room`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_company_barcode_uidx` ON `sdhinventory_asset` (`company_id`,`barcode`);--> statement-breakpoint
CREATE INDEX `asset_company_status_idx` ON `sdhinventory_asset` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `asset_company_employee_idx` ON `sdhinventory_asset` (`company_id`,`current_employee_id`);--> statement-breakpoint
CREATE INDEX `asset_company_room_idx` ON `sdhinventory_asset` (`company_id`,`current_room_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_assignment_history` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`asset_id` text(255) NOT NULL,
	`from_employee_id` text(255),
	`to_employee_id` text(255),
	`from_room_id` text(255),
	`to_room_id` text(255),
	`changed_by_user_id` text(255) NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `sdhinventory_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by_user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assignment_company_asset_idx` ON `sdhinventory_assignment_history` (`company_id`,`asset_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_company` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sdhinventory_employee` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`user_id` text(255),
	`first_name` text(255) NOT NULL,
	`last_name` text(255) NOT NULL,
	`email` text(255) NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employee_email_company_uidx` ON `sdhinventory_employee` (`company_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `employee_user_uidx` ON `sdhinventory_employee` (`user_id`);--> statement-breakpoint
CREATE INDEX `employee_company_idx` ON `sdhinventory_employee` (`company_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_floor` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`office_id` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`office_id`) REFERENCES `sdhinventory_office`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `floor_company_office_idx` ON `sdhinventory_floor` (`company_id`,`office_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_office` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `office_company_idx` ON `sdhinventory_office` (`company_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_room` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`floor_id` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`floor_id`) REFERENCES `sdhinventory_floor`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `room_company_floor_idx` ON `sdhinventory_room` (`company_id`,`floor_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_session` (
	`session_token` text(255) PRIMARY KEY NOT NULL,
	`user_id` text(255) NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `sdhinventory_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`email_verified` integer DEFAULT (unixepoch()),
	`image` text(255),
	`company_id` text(255),
	`role` text DEFAULT 'EMPLOYEE' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_uidx` ON `sdhinventory_user` (`email`);--> statement-breakpoint
CREATE INDEX `user_company_idx` ON `sdhinventory_user` (`company_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_verification_cycle` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`name` text(255) NOT NULL,
	`status` text DEFAULT 'PLANNED' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_by_user_id` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `verification_cycle_company_status_idx` ON `sdhinventory_verification_cycle` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `sdhinventory_verification_event` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`company_id` text(255) NOT NULL,
	`cycle_id` text(255) NOT NULL,
	`asset_id` text(255) NOT NULL,
	`verified_by_user_id` text(255) NOT NULL,
	`method` text NOT NULL,
	`office_id` text(255),
	`floor_id` text(255),
	`room_id` text(255),
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `sdhinventory_company`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `sdhinventory_verification_cycle`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `sdhinventory_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by_user_id`) REFERENCES `sdhinventory_user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`office_id`) REFERENCES `sdhinventory_office`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`floor_id`) REFERENCES `sdhinventory_floor`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `sdhinventory_room`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `verification_event_cycle_asset_idx` ON `sdhinventory_verification_event` (`cycle_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `verification_event_company_cycle_idx` ON `sdhinventory_verification_event` (`company_id`,`cycle_id`);--> statement-breakpoint
CREATE TABLE `sdhinventory_verification_token` (
	`identifier` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
