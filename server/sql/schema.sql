-- Retain Sample Management — MySQL 8.0+ schema (idempotent)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  display_name VARCHAR(120) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','quality_engineer','viewer') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS import_batches (
  id CHAR(36) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NULL,
  mode ENUM('skip','update') NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  inserted INT NOT NULL DEFAULT 0,
  updated INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  invalid INT NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  created_by_email VARCHAR(190) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- expiration_date is a STORED generated column: retention = production date + 13 months,
-- always consistent, indexable, and impossible to forget to update.
CREATE TABLE IF NOT EXISTS samples (
  id CHAR(36) NOT NULL PRIMARY KEY,
  specification VARCHAR(120) NULL,
  five_l_number VARCHAR(120) NOT NULL,
  customer VARCHAR(190) NULL,
  paper_type VARCHAR(120) NULL,
  machine VARCHAR(60) NULL,
  shift VARCHAR(20) NULL,
  inspector VARCHAR(120) NULL,
  production_date DATE NOT NULL,
  expiration_date DATE GENERATED ALWAYS AS (DATE_ADD(production_date, INTERVAL 13 MONTH)) STORED,
  remark TEXT NULL,
  storage_location ENUM('Rack','Transit Area','Dump Trash') NOT NULL DEFAULT 'Rack',
  rack_detail VARCHAR(120) NULL,
  dup_key VARCHAR(400) NOT NULL,
  disposed_at DATETIME NULL,
  disposed_by CHAR(36) NULL,
  import_batch_id CHAR(36) NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_samples_dup (dup_key),
  KEY ix_samples_5l (five_l_number),
  KEY ix_samples_exp (expiration_date),
  KEY ix_samples_prod (production_date),
  KEY ix_samples_loc (storage_location),
  KEY ix_samples_customer (customer),
  KEY ix_samples_machine (machine),
  KEY ix_samples_disposed (disposed_at),
  KEY ix_samples_batch (import_batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sample_movements (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sample_id CHAR(36) NOT NULL,
  five_l_number VARCHAR(120) NULL,
  kind ENUM('create','move','dispose') NOT NULL DEFAULT 'move',
  old_location VARCHAR(40) NULL,
  new_location VARCHAR(40) NOT NULL,
  old_rack_detail VARCHAR(120) NULL,
  new_rack_detail VARCHAR(120) NULL,
  moved_by CHAR(36) NULL,
  moved_by_name VARCHAR(190) NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(500) NULL,
  KEY ix_mv_sample (sample_id, moved_at),
  KEY ix_mv_time (moved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- No FK on sample_id for movements/disposals/audit: history must survive deletion of a sample.
CREATE TABLE IF NOT EXISTS disposals (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sample_id CHAR(36) NOT NULL,
  five_l_number VARCHAR(120) NULL,
  specification VARCHAR(120) NULL,
  customer VARCHAR(190) NULL,
  machine VARCHAR(60) NULL,
  production_date DATE NULL,
  expiration_date DATE NULL,
  previous_location VARCHAR(40) NULL,
  disposed_by CHAR(36) NULL,
  disposed_by_name VARCHAR(190) NULL,
  disposed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(500) NULL,
  KEY ix_disp_time (disposed_at),
  KEY ix_disp_sample (sample_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(40) NOT NULL,
  record_id VARCHAR(40) NULL,
  action VARCHAR(30) NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  user_id CHAR(36) NULL,
  user_email VARCHAR(190) NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_audit_time (changed_at),
  KEY ix_audit_record (record_id),
  KEY ix_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sample_id CHAR(36) NOT NULL,
  threshold SMALLINT NOT NULL,           -- 30 | 14 | 7 | 0 (days before due)
  message VARCHAR(500) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_by CHAR(36) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notif (sample_id, threshold),
  KEY ix_notif_read (is_read, created_at),
  CONSTRAINT fk_notif_sample FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
