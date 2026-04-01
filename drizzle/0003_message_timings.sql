CREATE TABLE IF NOT EXISTS `message_timings` (
	`id` integer PRIMARY KEY NOT NULL,
	`chatId` text NOT NULL,
	`messageId` text NOT NULL,
	`phaseKey` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`startedAt` text,
	`completedAt` text,
	`durationMs` integer,
	`detail` text,
	`updatedAt` text NOT NULL
);
