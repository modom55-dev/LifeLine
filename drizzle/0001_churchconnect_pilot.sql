CREATE TABLE `churchBulletins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`churchId` int NOT NULL,
	`draft` json NOT NULL,
	`published` json,
	`revision` int NOT NULL DEFAULT 1,
	`savedAt` datetime(3) NOT NULL,
	`publishedAt` datetime(3),
	CONSTRAINT `churchBulletins_id` PRIMARY KEY(`id`),
	CONSTRAINT `churchBulletins_churchId_unique` UNIQUE(`churchId`)
);
--> statement-breakpoint
CREATE TABLE `churches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(180) NOT NULL,
	`location` varchar(180) NOT NULL,
	`serviceTime` varchar(40) NOT NULL,
	`ownerOpenId` varchar(64),
	`activationKeyHash` varchar(64),
	`activationExpiresAt` datetime(3),
	`ownerClaimedAt` datetime(3),
	`seedVersion` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `churches_id` PRIMARY KEY(`id`),
	CONSTRAINT `churches_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `pilotInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`churchId` int NOT NULL,
	`label` varchar(120) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` datetime(3) NOT NULL,
	`revokedAt` datetime(3),
	`createdAt` datetime(3) NOT NULL,
	CONSTRAINT `pilotInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `pilotInvites_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `churchBulletins` ADD CONSTRAINT `churchBulletins_churchId_churches_id_fk` FOREIGN KEY (`churchId`) REFERENCES `churches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pilotInvites` ADD CONSTRAINT `pilotInvites_churchId_churches_id_fk` FOREIGN KEY (`churchId`) REFERENCES `churches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `pilotInvites_churchId_idx` ON `pilotInvites` (`churchId`);