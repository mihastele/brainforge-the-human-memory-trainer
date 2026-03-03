<?php
/**
 * Brain Training PWA - Content Generation API
 * POST /api/generate.php
 * Body: { "category": "memory" } (optional — random if omitted)
 */
require_once __DIR__ . '/../config.php';
setApiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST required']);
    exit;
}

// ─── Parse Input ──────────────────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$categories = json_decode(CATEGORIES, true);
$categoryKeys = array_keys($categories);

$categoryKey = $input['category'] ?? $categoryKeys[array_rand($categoryKeys)];
if (!isset($categories[$categoryKey])) {
    $categoryKey = $categoryKeys[array_rand($categoryKeys)];
}
$categoryName = $categories[$categoryKey];

// ─── Prompt Templates ─────────────────────────────────────────
$systemPrompt = <<<PROMPT
You are BrainCoach, an expert neuroscience educator and cognitive trainer. You create engaging, well-structured brain training documents that are informative, practical, and immediately actionable.

FORMATTING RULES:
- Use Markdown formatting with clear headers (##, ###)
- Start with a compelling title using # heading
- Include a brief introduction explaining WHY this matters for the brain
- Use bullet points and numbered lists for clarity
- Include concrete examples and practice exercises
- End with a "Practice Challenge" section with 3-5 exercises
- Keep language accessible but intellectually stimulating
- Aim for 600-900 words — substantial but not overwhelming
- Use emoji sparingly for visual interest (1-2 per section max)
PROMPT;

$userPrompts = [
    'memory' => "Create a brain training document about MEMORY TECHNIQUES. Pick ONE specific technique from this list (vary your choice): Memory Palace method, Spaced Repetition strategy, Chunking technique, Association/Link method, Peg system, Story method, Name-Face association, Number-Shape system. Explain the science behind it, give step-by-step instructions, provide vivid worked examples, and include practice exercises the reader can do right now.",

    'mental_math' => "Create a brain training document about MENTAL MATH. Pick ONE specific skill from this list (vary your choice): rapid multiplication tricks, estimation techniques, percentage calculations, squaring numbers mentally, divisibility rules, adding large numbers, fraction shortcuts, logarithmic estimation. Explain the mental shortcut clearly, walk through multiple examples of increasing difficulty, and include timed practice problems.",

    'logic' => "Create a brain training document about LOGIC & REASONING. Pick ONE topic from this list (vary your choice): deductive reasoning puzzles, pattern recognition exercises, syllogism training, lateral thinking problems, analogical reasoning, if-then logic chains, Venn diagram reasoning, probability intuition. Present the core concept, provide worked examples, and include progressively harder challenges.",

    'vocabulary' => "Create a brain training document about VOCABULARY BUILDING. Pick ONE approach from this list (vary your choice): Greek/Latin root analysis, contextual word learning, synonym/antonym networks, etymological exploration, academic word families, idiomatic expressions, precise word choice exercises, word relationship mapping. Teach 8-12 words using your chosen method with memorable explanations and usage examples.",

    'mindfulness' => "Create a brain training document about MINDFULNESS & FOCUS. Pick ONE technique from this list (vary your choice): focused attention meditation, body scan practice, mindful breathing patterns (box breathing, 4-7-8, etc.), concentration games, single-tasking strategies, attention restoration techniques, flow state cultivation, sensory awareness exercises. Explain the neuroscience benefits, provide clear step-by-step instructions, and include a guided practice session.",

    'cognitive' => "Create a brain training document about COGNITIVE EXERCISES. Pick ONE type from this list (vary your choice): pattern completion challenges, spatial reasoning tasks, working memory drills, processing speed exercises, cognitive flexibility tasks (task-switching), abstract reasoning problems, visual-spatial puzzles described in text, creative divergent thinking prompts. Explain which cognitive skill is being trained and why, then provide a series of exercises.",
];

$userPrompt = $userPrompts[$categoryKey];

// ─── Call AIMLAPI ─────────────────────────────────────────────
$payload = [
    'model' => AIMLAPI_MODEL,
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $userPrompt],
    ],
    'temperature' => 0.85,
    'max_tokens' => 2048,
];

$ch = curl_init(AIMLAPI_BASE_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . AIMLAPI_KEY,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_TIMEOUT => 120,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'API request failed: ' . $curlError]);
    exit;
}

$data = json_decode($response, true);

if ($httpCode !== 200 || !isset($data['choices'][0]['message']['content'])) {
    http_response_code(502);
    echo json_encode([
        'error' => 'API returned an error',
        'details' => $data['error'] ?? $data ?? 'Unknown error',
        'httpCode' => $httpCode,
    ]);
    exit;
}

$content = trim($data['choices'][0]['message']['content']);

// ─── Extract Title ────────────────────────────────────────────
$title = $categoryName . ' Training';
if (preg_match('/^#\s+(.+)$/m', $content, $m)) {
    $title = trim($m[1]);
}

// ─── Save to Database ─────────────────────────────────────────
$db = getDB();
$stmt = $db->prepare("INSERT INTO documents (title, category, content, model_used, created_at) VALUES (?, ?, ?, ?, NOW())");
$model = AIMLAPI_MODEL;
$stmt->bind_param('ssss', $title, $categoryKey, $content, $model);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save document: ' . $stmt->error]);
    $stmt->close();
    $db->close();
    exit;
}

$docId = $stmt->insert_id;
$stmt->close();
$db->close();

// ─── Return Result ────────────────────────────────────────────
echo json_encode([
    'id' => $docId,
    'title' => $title,
    'category' => $categoryKey,
    'categoryName' => $categoryName,
    'content' => $content,
    'model_used' => $model,
    'created_at' => date('Y-m-d H:i:s'),
    'is_new' => true,
]);
