DELETE FROM user_equipped
WHERE slot = 'header_bg'
   OR cosmetic_id IN (SELECT id FROM cosmetics WHERE slot = 'header_bg');
--> statement-breakpoint
DELETE FROM user_cosmetics
WHERE cosmetic_id IN (SELECT id FROM cosmetics WHERE slot = 'header_bg');
--> statement-breakpoint
DELETE FROM cosmetics WHERE slot = 'header_bg';
