<?php
/**
 * Brain Training PWA - Database Setup
 * Run once: php setup_db.php  OR  visit http://localhost/mindfulness-pwa/setup_db.php
 */

// Connect without selecting a database
$conn = new mysqli('localhost', 'root', '');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
}

// Create database
$conn->query("CREATE DATABASE IF NOT EXISTS `brain_training` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
echo "✓ Database 'brain_training' ready.\n";

$conn->select_db('brain_training');

// Create documents table
$sql = "CREATE TABLE IF NOT EXISTS `documents` (
    `id`         INT AUTO_INCREMENT PRIMARY KEY,
    `title`      VARCHAR(255) NOT NULL,
    `category`   VARCHAR(100) NOT NULL,
    `content`    LONGTEXT NOT NULL,
    `model_used` VARCHAR(100) NOT NULL DEFAULT '',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_category` (`category`),
    INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

if ($conn->query($sql)) {
    echo "✓ Table 'documents' ready.\n";
} else {
    echo "✗ Error creating table: " . $conn->error . "\n";
}

$conn->close();
echo "\n✅ Database setup complete!\n";
