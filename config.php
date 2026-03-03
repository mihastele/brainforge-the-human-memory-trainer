<?php
/**
 * Brain Training PWA - Configuration
 */

// ─── MySQL Database ───────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'brain_training');

// ─── AIMLAPI Configuration ───────────────────────────────────
define('AIMLAPI_BASE_URL', 'https://api.aimlapi.com/v1/chat/completions');
define('AIMLAPI_KEY', 'YOUR_AIMLAPI_KEY_HERE'); // <-- Replace with your key

// Model: Mistral 7B Instruct — excellent quality/price ratio
define('AIMLAPI_MODEL', 'mistralai/Mistral-7B-Instruct-v0.2');

// ─── App Settings ─────────────────────────────────────────────
define('NEW_GENERATION_CHANCE', 30); // % chance to generate new vs serve past
define('DOCUMENTS_PER_PAGE', 20);

// ─── Content Categories ───────────────────────────────────────
define('CATEGORIES', json_encode([
    'memory'      => 'Memory Techniques',
    'mental_math' => 'Mental Math',
    'logic'       => 'Logic & Reasoning',
    'vocabulary'  => 'Vocabulary Building',
    'mindfulness' => 'Mindfulness & Focus',
    'cognitive'   => 'Cognitive Exercises',
]));

// ─── Database Connection ──────────────────────────────────────
function getDB(): mysqli {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

// ─── CORS + JSON Headers ─────────────────────────────────────
function setApiHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
