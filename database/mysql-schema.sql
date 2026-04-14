CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('voucher_activation_delay_minutes', '1440')
ON DUPLICATE KEY UPDATE setting_value = setting_value;

CREATE TABLE IF NOT EXISTS spins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  phone_normalized VARCHAR(32) NOT NULL,
  device_fingerprint VARCHAR(255) NULL,
  reward_index INT NOT NULL,
  reward_id INT NOT NULL,
  reward_code VARCHAR(64) NULL,
  reward_label VARCHAR(255) NOT NULL,
  reward_type ENUM('voucher', 'item') NOT NULL,
  status ENUM('unused', 'used') NOT NULL DEFAULT 'unused',
  voucher_delay_minutes INT NOT NULL DEFAULT 0,
  voucher_usable_from DATETIME NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_spins_created_at (created_at),
  INDEX idx_spins_phone (phone),
  INDEX idx_spins_phone_normalized (phone_normalized),
  INDEX idx_spins_device_fingerprint (device_fingerprint),
  INDEX idx_spins_phone_voucher_status (phone_normalized, reward_type, status, created_at),
  INDEX idx_spins_reward_type (reward_type),
  INDEX idx_spins_status (status)
);

SET @db_name = DATABASE();

SELECT COUNT(*) INTO @has_phone_normalized
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND COLUMN_NAME = 'phone_normalized';

SET @sql_add_phone_normalized = IF(
  @has_phone_normalized = 0,
  'ALTER TABLE spins ADD COLUMN phone_normalized VARCHAR(32) NOT NULL DEFAULT '''' AFTER phone',
  'SELECT 1'
);

PREPARE stmt_add_phone_normalized FROM @sql_add_phone_normalized;
EXECUTE stmt_add_phone_normalized;
DEALLOCATE PREPARE stmt_add_phone_normalized;

SELECT COUNT(*) INTO @has_device_fingerprint
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND COLUMN_NAME = 'device_fingerprint';

SET @sql_add_device_fingerprint = IF(
  @has_device_fingerprint = 0,
  'ALTER TABLE spins ADD COLUMN device_fingerprint VARCHAR(255) NULL AFTER phone_normalized',
  'SELECT 1'
);

PREPARE stmt_add_device_fingerprint FROM @sql_add_device_fingerprint;
EXECUTE stmt_add_device_fingerprint;
DEALLOCATE PREPARE stmt_add_device_fingerprint;

SELECT COUNT(*) INTO @has_idx_phone_normalized
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND INDEX_NAME = 'idx_spins_phone_normalized';

SET @sql_add_idx_phone_normalized = IF(
  @has_idx_phone_normalized = 0,
  'ALTER TABLE spins ADD INDEX idx_spins_phone_normalized (phone_normalized)',
  'SELECT 1'
);

PREPARE stmt_add_idx_phone_normalized FROM @sql_add_idx_phone_normalized;
EXECUTE stmt_add_idx_phone_normalized;
DEALLOCATE PREPARE stmt_add_idx_phone_normalized;

SELECT COUNT(*) INTO @has_idx_phone_voucher
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND INDEX_NAME = 'idx_spins_phone_voucher_status';

SET @sql_add_idx_phone_voucher = IF(
  @has_idx_phone_voucher = 0,
  'ALTER TABLE spins ADD INDEX idx_spins_phone_voucher_status (phone_normalized, reward_type, status, created_at)',
  'SELECT 1'
);

PREPARE stmt_add_idx_phone_voucher FROM @sql_add_idx_phone_voucher;
EXECUTE stmt_add_idx_phone_voucher;
DEALLOCATE PREPARE stmt_add_idx_phone_voucher;

SELECT COUNT(*) INTO @has_uq_device_fingerprint
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND INDEX_NAME = 'uq_spins_device_fingerprint';

SET @sql_drop_uq_device_fingerprint = IF(
  @has_uq_device_fingerprint > 0,
  'ALTER TABLE spins DROP INDEX uq_spins_device_fingerprint',
  'SELECT 1'
);

PREPARE stmt_drop_uq_device_fingerprint FROM @sql_drop_uq_device_fingerprint;
EXECUTE stmt_drop_uq_device_fingerprint;
DEALLOCATE PREPARE stmt_drop_uq_device_fingerprint;

SELECT COUNT(*) INTO @has_idx_device_fingerprint
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_NAME = 'spins'
  AND INDEX_NAME = 'idx_spins_device_fingerprint';

SET @sql_add_idx_device_fingerprint = IF(
  @has_idx_device_fingerprint = 0,
  'ALTER TABLE spins ADD INDEX idx_spins_device_fingerprint (device_fingerprint)',
  'SELECT 1'
);

PREPARE stmt_add_idx_device_fingerprint FROM @sql_add_idx_device_fingerprint;
EXECUTE stmt_add_idx_device_fingerprint;
DEALLOCATE PREPARE stmt_add_idx_device_fingerprint;

UPDATE spins s
JOIN (
  SELECT
    id,
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(REPLACE(phone, ' ', ''), '.', ''),
            '-',
            ''
          ),
          '(',
          ''
        ),
        ')',
        ''
      ),
      '+',
      ''
    ) AS cleaned_phone
  FROM spins
) p ON p.id = s.id
SET s.phone_normalized =
  CASE
    WHEN p.cleaned_phone REGEXP '^84[0-9]{9}$' THEN p.cleaned_phone
    WHEN p.cleaned_phone REGEXP '^0[0-9]{9}$' THEN CONCAT('84', SUBSTRING(p.cleaned_phone, 2))
    ELSE p.cleaned_phone
  END
WHERE s.phone_normalized = '' OR s.phone_normalized IS NULL;

CREATE TABLE IF NOT EXISTS game_scores (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  game_type VARCHAR(32) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  phone_normalized VARCHAR(32) NOT NULL,
  score INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  lives_left INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_game_scores_type_score (game_type, score, created_at),
  INDEX idx_game_scores_phone (phone_normalized)
);
