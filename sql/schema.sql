CREATE DATABASE IF NOT EXISTS mailcheck;
USE mailcheck;

CREATE TABLE IF NOT EXISTS verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  domain VARCHAR(253) NOT NULL,
  verdict ENUM('deliverable','risky','undeliverable') NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- recent-history listing
  INDEX idx_verifications_created (created_at),
  -- per-domain analytics / lookups
  INDEX idx_verifications_domain (domain)
) ENGINE=InnoDB;
