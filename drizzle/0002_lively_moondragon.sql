CREATE TABLE `total_batches` (
	`scope` text PRIMARY KEY NOT NULL,
	`store` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`import_id` text NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
UPDATE settings SET payload=json_set(payload,'$[0].name','JK · Shopping JK','$[1].name','RJ · Shopping Leblon','$[2].name','Ecomm · Ecommerce','$[3].id','BC','$[3].name','BC · Bela Cintra','$[3].status','open','$[3].opened','','$[4].name','Futura unidade 1','$[5].name','Futura unidade 2') WHERE id='stores' AND json_array_length(payload)=6 AND json_extract(payload,'$[0].id')='02' AND json_extract(payload,'$[1].id')='05' AND json_extract(payload,'$[2].id')='03' AND json_extract(payload,'$[3].id')='L3' AND json_extract(payload,'$[3].name')='Loja 3';
