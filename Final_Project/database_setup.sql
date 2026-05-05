-- Run these statements as a MySQL admin user if the app user cannot access the database.
-- Replace the database name, username, and password with the values from your .env file.

CREATE DATABASE IF NOT EXISTS connect4_app;

CREATE USER IF NOT EXISTS 'connect4_user'@'%' IDENTIFIED BY 'replace_with_password';
GRANT ALL PRIVILEGES ON connect4_app.* TO 'connect4_user'@'%';
FLUSH PRIVILEGES;

USE connect4_app;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(64) NULL,
  games_won INT NOT NULL DEFAULT 0,
  games_lost INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL UNIQUE,
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  player1_wallet VARCHAR(64) NULL,
  player2_wallet VARCHAR(64) NULL,
  stake_eth DECIMAL(18, 8) NOT NULL DEFAULT 0,
  contract_address VARCHAR(64) NULL,
  contract_game_id VARCHAR(80) NULL,
  winner_id INT NULL,
  loser_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  moves_json LONGTEXT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  INDEX idx_games_players (player1_id, player2_id),
  CONSTRAINT fk_games_player1 FOREIGN KEY (player1_id) REFERENCES users(id),
  CONSTRAINT fk_games_player2 FOREIGN KEY (player2_id) REFERENCES users(id)
);
