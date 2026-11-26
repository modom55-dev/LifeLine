CREATE TABLE `connectionCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`churchId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(254),
	`phone` varchar(40),
	`firstTime` boolean NOT NULL DEFAULT false,
	`interests` json NOT NULL,
	`prayerRequest` text,
	`followUpOk` boolean NOT NULL DEFAULT false,
	`createdAt` datetime(3) NOT NULL,
	`readAt` datetime(3),
	CONSTRAINT `connectionCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `outboundMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int,
	`channel` enum('email','sms') NOT NULL,
	`kind` varchar(40) NOT NULL,
	`recipient` varchar(254) NOT NULL,
	`subject` varchar(200),
	`body` text NOT NULL,
	`sendAfter` datetime(3) NOT NULL,
	`sentAt` datetime(3),
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(300),
	`createdAt` datetime(3) NOT NULL,
	CONSTRAINT `outboundMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `churches` ADD `launchedAt` datetime(3);--> statement-breakpoint
ALTER TABLE `connectionCards` ADD CONSTRAINT `connectionCards_churchId_churches_id_fk` FOREIGN KEY (`churchId`) REFERENCES `churches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `outboundMessages` ADD CONSTRAINT `outboundMessages_cardId_connectionCards_id_fk` FOREIGN KEY (`cardId`) REFERENCES `connectionCards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `connectionCards_churchId_idx` ON `connectionCards` (`churchId`);--> statement-breakpoint
CREATE INDEX `outboundMessages_due_idx` ON `outboundMessages` (`sentAt`,`sendAfter`);