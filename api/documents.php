<?php
/**
 * Brain Training PWA - Document Retrieval API
 * GET /api/documents.php?action=random|latest|get|list
 */
require_once __DIR__ . '/../config.php';
setApiHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'GET required']);
    exit;
}

$action = $_GET['action'] ?? 'random';
$db = getDB();

switch ($action) {

    // ─── Smart Serve: past doc OR generate new ────────────────
    case 'random':
        $countResult = $db->query("SELECT COUNT(*) as cnt FROM documents");
        $count = $countResult->fetch_assoc()['cnt'];

        if ($count === 0) {
            // No documents yet — must generate
            $db->close();
            echo json_encode(['generate_new' => true, 'reason' => 'No documents in library yet']);
            exit;
        }

        // Roll the dice: NEW_GENERATION_CHANCE% new, rest from library
        if (rand(1, 100) <= NEW_GENERATION_CHANCE) {
            $db->close();
            echo json_encode(['generate_new' => true, 'reason' => 'Fresh content selected']);
            exit;
        }

        // Serve a random past document
        $stmt = $db->prepare("SELECT * FROM documents ORDER BY RAND() LIMIT 1");
        $stmt->execute();
        $result = $stmt->get_result();
        $doc = $result->fetch_assoc();
        $stmt->close();
        $db->close();

        $doc['is_new'] = false;
        $categories = json_decode(CATEGORIES, true);
        $doc['categoryName'] = $categories[$doc['category']] ?? $doc['category'];
        echo json_encode($doc);
        break;

    // ─── Latest N documents ───────────────────────────────────
    case 'latest':
        $limit = min((int) ($_GET['limit'] ?? 10), 50);
        $stmt = $db->prepare("SELECT id, title, category, created_at FROM documents ORDER BY created_at DESC LIMIT ?");
        $stmt->bind_param('i', $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $docs = [];
        $categories = json_decode(CATEGORIES, true);
        while ($row = $result->fetch_assoc()) {
            $row['categoryName'] = $categories[$row['category']] ?? $row['category'];
            $docs[] = $row;
        }
        $stmt->close();
        $db->close();
        echo json_encode(['documents' => $docs, 'count' => count($docs)]);
        break;

    // ─── Get specific document ────────────────────────────────
    case 'get':
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid document ID required']);
            $db->close();
            exit;
        }
        $stmt = $db->prepare("SELECT * FROM documents WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $doc = $result->fetch_assoc();
        $stmt->close();
        $db->close();

        if (!$doc) {
            http_response_code(404);
            echo json_encode(['error' => 'Document not found']);
            exit;
        }
        $categories = json_decode(CATEGORIES, true);
        $doc['categoryName'] = $categories[$doc['category']] ?? $doc['category'];
        echo json_encode($doc);
        break;

    // ─── Paginated list ───────────────────────────────────────
    case 'list':
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = DOCUMENTS_PER_PAGE;
        $offset = ($page - 1) * $perPage;

        $categoryFilter = $_GET['category'] ?? null;

        $countSql = "SELECT COUNT(*) as cnt FROM documents";
        $listSql = "SELECT id, title, category, created_at FROM documents";

        if ($categoryFilter) {
            $countSql .= " WHERE category = ?";
            $listSql .= " WHERE category = ?";
        }
        $listSql .= " ORDER BY created_at DESC LIMIT ? OFFSET ?";

        // Count total
        $countStmt = $db->prepare($countSql);
        if ($categoryFilter)
            $countStmt->bind_param('s', $categoryFilter);
        $countStmt->execute();
        $total = $countStmt->get_result()->fetch_assoc()['cnt'];
        $countStmt->close();

        // Fetch page
        $listStmt = $db->prepare($listSql);
        if ($categoryFilter) {
            $listStmt->bind_param('sii', $categoryFilter, $perPage, $offset);
        } else {
            $listStmt->bind_param('ii', $perPage, $offset);
        }
        $listStmt->execute();
        $result = $listStmt->get_result();
        $docs = [];
        $categories = json_decode(CATEGORIES, true);
        while ($row = $result->fetch_assoc()) {
            $row['categoryName'] = $categories[$row['category']] ?? $row['category'];
            $docs[] = $row;
        }
        $listStmt->close();
        $db->close();

        echo json_encode([
            'documents' => $docs,
            'page' => $page,
            'perPage' => $perPage,
            'total' => (int) $total,
            'totalPages' => ceil($total / $perPage),
        ]);
        break;

    // ─── Stats ────────────────────────────────────────────────
    case 'stats':
        $result = $db->query("SELECT COUNT(*) as total, COUNT(DISTINCT category) as categories FROM documents");
        $stats = $result->fetch_assoc();

        $catResult = $db->query("SELECT category, COUNT(*) as count FROM documents GROUP BY category ORDER BY count DESC");
        $catCounts = [];
        $categories = json_decode(CATEGORIES, true);
        while ($row = $catResult->fetch_assoc()) {
            $row['categoryName'] = $categories[$row['category']] ?? $row['category'];
            $catCounts[] = $row;
        }
        $db->close();

        echo json_encode([
            'totalDocuments' => (int) $stats['total'],
            'totalCategories' => (int) $stats['categories'],
            'byCategory' => $catCounts,
        ]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action. Use: random, latest, get, list, stats']);
        $db->close();
}
