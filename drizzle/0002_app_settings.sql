CREATE TABLE `appSettings` (
	`name` varchar(64) NOT NULL,
	`value` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appSettings_name` PRIMARY KEY(`name`)
);
