/* ═══════════════════════════════════════════════════════════════
   BrainForge — App Logic
   Supports both static hosting (localStorage) and backend (PHP) modes.
   ═══════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ─── Config ───────────────────────────────────────────────
    const API = {
        generate: 'api/generate.php',
        documents: 'api/documents.php',
    };

    const AIMLAPI_URL = 'https://api.aimlapi.com/v1/chat/completions';
    const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
    const STORAGE_KEY = 'brainforge_documents';
    const SETTINGS_KEY = 'brainforge_settings';

    const CATEGORY_EMOJIS = {
        memory: '🧩',
        mental_math: '🔢',
        logic: '♟️',
        vocabulary: '📖',
        mindfulness: '🧘',
        cognitive: '⚡',
    };

    const CATEGORY_NAMES = {
        memory: 'Memory Techniques',
        mental_math: 'Mental Math',
        logic: 'Logic & Reasoning',
        vocabulary: 'Vocabulary Building',
        mindfulness: 'Mindfulness & Focus',
        cognitive: 'Cognitive Exercises',
    };

    const CATEGORY_KEYS = Object.keys(CATEGORY_NAMES);

    const LOADING_MESSAGES = [
        'Generating your brain training...',
        'Activating neural pathways...',
        'Crafting cognitive exercises...',
        'Building mental models...',
        'Preparing brain workout...',
        'Synthesizing knowledge...',
    ];

    // ─── Prompt Templates (for static mode) ──────────────────
    const SYSTEM_PROMPT = `You are BrainCoach, an expert neuroscience educator and cognitive trainer. You create engaging, well-structured brain training documents that are informative, practical, and immediately actionable.

FORMATTING RULES:
- Use Markdown formatting with clear headers (##, ###)
- Start with a compelling title using # heading
- Include a brief introduction explaining WHY this matters for the brain
- Use bullet points and numbered lists for clarity
- Include concrete examples and practice exercises
- End with a "Practice Challenge" section with 3-5 exercises
- Keep language accessible but intellectually stimulating
- Aim for 600-900 words — substantial but not overwhelming
- Use emoji sparingly for visual interest (1-2 per section max)`;

    const USER_PROMPTS = {
        memory: "Create a brain training document about MEMORY TECHNIQUES. Pick ONE specific technique from this list (vary your choice): Memory Palace method, Spaced Repetition strategy, Chunking technique, Association/Link method, Peg system, Story method, Name-Face association, Number-Shape system. Explain the science behind it, give step-by-step instructions, provide vivid worked examples, and include practice exercises the reader can do right now.",
        mental_math: "Create a brain training document about MENTAL MATH. Pick ONE specific skill from this list (vary your choice): rapid multiplication tricks, estimation techniques, percentage calculations, squaring numbers mentally, divisibility rules, adding large numbers, fraction shortcuts, logarithmic estimation. Explain the mental shortcut clearly, walk through multiple examples of increasing difficulty, and include timed practice problems.",
        logic: "Create a brain training document about LOGIC & REASONING. Pick ONE topic from this list (vary your choice): deductive reasoning puzzles, pattern recognition exercises, syllogism training, lateral thinking problems, analogical reasoning, if-then logic chains, Venn diagram reasoning, probability intuition. Present the core concept, provide worked examples, and include progressively harder challenges.",
        vocabulary: "Create a brain training document about VOCABULARY BUILDING. Pick ONE approach from this list (vary your choice): Greek/Latin root analysis, contextual word learning, synonym/antonym networks, etymological exploration, academic word families, idiomatic expressions, precise word choice exercises, word relationship mapping. Teach 8-12 words using your chosen method with memorable explanations and usage examples.",
        mindfulness: "Create a brain training document about MINDFULNESS & FOCUS. Pick ONE technique from this list (vary your choice): focused attention meditation, body scan practice, mindful breathing patterns (box breathing, 4-7-8, etc.), concentration games, single-tasking strategies, attention restoration techniques, flow state cultivation, sensory awareness exercises. Explain the neuroscience benefits, provide clear step-by-step instructions, and include a guided practice session.",
        cognitive: "Create a brain training document about COGNITIVE EXERCISES. Pick ONE type from this list (vary your choice): pattern completion challenges, spatial reasoning tasks, working memory drills, processing speed exercises, cognitive flexibility tasks (task-switching), abstract reasoning problems, visual-spatial puzzles described in text, creative divergent thinking prompts. Explain which cognitive skill is being trained and why, then provide a series of exercises.",
    };

    // ─── DOM Elements ─────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const docContent = $('#doc-content');
    const docBadge = $('#doc-badge');
    const docDate = $('#doc-date');
    const docNewBadge = $('#doc-new-badge');
    const btnGenerate = $('#btn-generate');
    const btnLibrary = $('#btn-library');
    const btnStats = $('#btn-stats');
    const btnSettings = $('#btn-settings');
    const loadingOverlay = $('#loading-overlay');
    const loadingText = $('#loading-text');
    const libraryModal = $('#library-modal');
    const statsModal = $('#stats-modal');
    const settingsModal = $('#settings-modal');
    const libraryList = $('#library-list');
    const statsContent = $('#stats-content');
    const toastContainer = $('#toast-container');

    // ─── State ────────────────────────────────────────────────
    let activeCategory = 'all';
    let isGenerating = false;
    let useBackend = false; // detected at init

    // ─── Initialize ───────────────────────────────────────────
    async function init() {
        registerServiceWorker();
        await detectMode();
        bindEvents();
        loadInitialDocument();
    }

    // ─── Detect Backend vs Static Mode ────────────────────────
    async function detectMode() {
        try {
            const res = await fetch(API.documents + '?action=stats', {
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                const data = await res.json();
                if (data && typeof data.totalDocuments !== 'undefined') {
                    useBackend = true;
                }
            }
        } catch {
            useBackend = false;
        }
        const modeLabel = $('#settings-mode-label');
        if (modeLabel) {
            modeLabel.textContent = useBackend ? 'Backend (PHP + MySQL)' : 'Static (Browser Storage)';
        }
    }

    // ─── Service Worker ───────────────────────────────────────
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // ─── Events ───────────────────────────────────────────────
    function bindEvents() {
        btnGenerate.addEventListener('click', () => generateNew());
        btnLibrary.addEventListener('click', openLibrary);
        btnStats.addEventListener('click', openStats);
        btnSettings.addEventListener('click', openSettings);
        $('#close-library').addEventListener('click', () => closeModal(libraryModal));
        $('#close-stats').addEventListener('click', () => closeModal(statsModal));
        $('#close-settings').addEventListener('click', () => closeModal(settingsModal));

        // Close modals on backdrop click
        $$('.modal-backdrop').forEach(el =>
            el.addEventListener('click', () => closeModal(el.closest('.modal')))
        );

        // Keyboard: Escape closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal:not([hidden])');
                if (openModal) closeModal(openModal);
            }
        });

        // Category pills
        $$('.cat-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                $$('.cat-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeCategory = pill.dataset.category;
            });
        });

        // Settings UI
        $('#btn-save-settings').addEventListener('click', saveSettings);
        $('#btn-clear-data').addEventListener('click', clearLocalData);
        $('#btn-toggle-key').addEventListener('click', toggleKeyVisibility);

        // Load saved settings
        loadSettings();
    }

    // ─── Settings Management ─────────────────────────────────
    function loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            if (settings.apiKey) $('#settings-api-key').value = settings.apiKey;
            if (settings.model) $('#settings-model').value = settings.model;
        } catch { /* ignore */ }
    }

    function saveSettings() {
        const apiKey = $('#settings-api-key').value.trim();
        const model = $('#settings-model').value.trim();
        const settings = { apiKey, model };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        showToast('Settings saved!', 'success');
    }

    function clearLocalData() {
        if (!confirm('This will clear all locally stored documents and settings. Continue?')) return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SETTINGS_KEY);
        $('#settings-api-key').value = '';
        $('#settings-model').value = '';
        showToast('Local data cleared.', 'success');
    }

    function toggleKeyVisibility() {
        const input = $('#settings-api-key');
        input.type = input.type === 'password' ? 'text' : 'password';
    }

    // ─── Local Storage Helpers ────────────────────────────────
    function getLocalDocs() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveLocalDoc(doc) {
        const docs = getLocalDocs();
        doc.id = doc.id || Date.now();
        doc.created_at = doc.created_at || new Date().toISOString();
        docs.unshift(doc);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
        return doc;
    }

    function getSettings() {
        try {
            return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        } catch {
            return {};
        }
    }

    // ─── Load Initial Document ────────────────────────────────
    async function loadInitialDocument() {
        if (useBackend) {
            try {
                const res = await fetch(API.documents + '?action=random');
                const data = await res.json();
                if (data.generate_new) {
                    await generateNew();
                } else {
                    renderDocument(data);
                }
            } catch {
                // Show welcome screen — user can click Generate
            }
        } else {
            const docs = getLocalDocs();
            if (docs.length > 0) {
                const doc = docs[Math.floor(Math.random() * docs.length)];
                doc.is_new = false;
                renderDocument(doc);
            }
            // else show the default welcome placeholder
        }
    }

    // ─── Generate New Document ────────────────────────────────
    async function generateNew(category = null) {
        if (isGenerating) return;
        isGenerating = true;

        const cat = category || (activeCategory !== 'all' ? activeCategory : null);

        showLoading();
        btnGenerate.classList.add('loading');

        try {
            let doc;
            if (useBackend) {
                doc = await generateViaBackend(cat);
            } else {
                doc = await generateViaAPI(cat);
            }
            hideLoading();
            renderDocument(doc);
            showToast('New document generated!', 'success');
        } catch (err) {
            hideLoading();
            showError(err.message);
            showToast(err.message, 'error');
        } finally {
            isGenerating = false;
            btnGenerate.classList.remove('loading');
        }
    }

    // ─── Backend generation ──────────────────────────────────
    async function generateViaBackend(cat) {
        const res = await fetch(API.generate, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cat ? { category: cat } : {}),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'HTTP ' + res.status);
        }

        return await res.json();
    }

    // ─── Static mode: direct API call ─────────────────────────
    async function generateViaAPI(cat) {
        const settings = getSettings();
        const apiKey = settings.apiKey;
        if (!apiKey) {
            throw new Error('No API key configured. Open Settings (⚙️) to add your AIMLAPI key.');
        }

        const categoryKey = cat || CATEGORY_KEYS[Math.floor(Math.random() * CATEGORY_KEYS.length)];
        const categoryName = CATEGORY_NAMES[categoryKey] || categoryKey;
        const userPrompt = USER_PROMPTS[categoryKey];
        const model = settings.model || DEFAULT_MODEL;

        const payload = {
            model: model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.85,
            max_tokens: 2048,
        };

        const res = await fetch(AIMLAPI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'API error: HTTP ' + res.status);
        }

        const data = await res.json();
        const content = (data.choices?.[0]?.message?.content || '').trim();
        if (!content) throw new Error('Empty response from AI API');

        // Extract title
        let title = categoryName + ' Training';
        const match = content.match(/^#\s+(.+)$/m);
        if (match) title = match[1].trim();

        const doc = {
            id: Date.now(),
            title: title,
            category: categoryKey,
            categoryName: categoryName,
            content: content,
            model_used: model,
            created_at: new Date().toISOString(),
            is_new: true,
        };

        saveLocalDoc(doc);
        return doc;
    }

    // ─── Render Document ──────────────────────────────────────
    function renderDocument(doc) {
        // Category badge
        const emoji = CATEGORY_EMOJIS[doc.category] || '📄';
        const catName = doc.categoryName || CATEGORY_NAMES[doc.category] || doc.category;
        docBadge.textContent = emoji + ' ' + catName;

        // Date
        if (doc.created_at) {
            const d = new Date(doc.created_at);
            docDate.textContent = d.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } else {
            docDate.textContent = '';
        }

        // New badge
        docNewBadge.hidden = !doc.is_new;

        // Render markdown content safely with DOMPurify
        const rawHtml = marked.parse(doc.content || '');
        let cleanHtml;
        if (typeof DOMPurify !== 'undefined') {
            cleanHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
        } else {
            // Fallback: strip all HTML tags if DOMPurify failed to load
            const tmp = document.createElement('div');
            tmp.innerHTML = rawHtml;
            cleanHtml = escapeHtml(tmp.textContent || tmp.innerText || '');
            cleanHtml = '<pre style="white-space:pre-wrap;">' + cleanHtml + '</pre>';
        }
        docContent.innerHTML = cleanHtml;

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Animate card
        const card = $('#document-card');
        card.style.animation = 'none';
        void card.offsetHeight; // trigger reflow
        card.style.animation = 'cardIn 0.5s var(--ease-out)';
    }

    // ─── Error Display ────────────────────────────────────────
    function showError(message) {
        const safeMsg = escapeHtml(message);
        const hint = useBackend
            ? 'Check your AIMLAPI key in config.php and try again.'
            : 'Open Settings (⚙️) to configure your AIMLAPI key.';
        docContent.innerHTML =
            '<div class="welcome-placeholder">' +
                '<div class="pulse-brain">⚠️</div>' +
                '<h2>Generation Failed</h2>' +
                '<p>' + safeMsg + '</p>' +
                '<p style="margin-top: 16px; color: var(--text-muted); font-size: 0.85rem;">' +
                    escapeHtml(hint) +
                '</p>' +
            '</div>';
    }

    // ─── Loading ──────────────────────────────────────────────
    function showLoading() {
        loadingText.textContent = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
        loadingOverlay.hidden = false;
    }

    function hideLoading() {
        loadingOverlay.hidden = true;
    }

    // ─── Toast Notifications ──────────────────────────────────
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        // Trigger animation
        requestAnimationFrame(() => toast.classList.add('toast-visible'));
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            // Fallback removal in case transitionend doesn't fire
            const fallback = setTimeout(() => toast.remove(), 500);
            toast.addEventListener('transitionend', () => {
                clearTimeout(fallback);
                toast.remove();
            });
        }, 3000);
    }

    // ─── Library Modal ────────────────────────────────────────
    async function openLibrary() {
        openModal(libraryModal);
        libraryList.innerHTML = '<p class="muted">Loading documents...</p>';

        try {
            let docs;
            if (useBackend) {
                const res = await fetch(API.documents + '?action=list&page=1');
                const data = await res.json();
                docs = data.documents || [];
            } else {
                docs = getLocalDocs();
            }

            if (docs.length === 0) {
                libraryList.innerHTML = '<p class="muted">No documents yet. Generate your first one!</p>';
                return;
            }

            libraryList.innerHTML = docs.map(doc => {
                const emoji = CATEGORY_EMOJIS[doc.category] || '📄';
                const catName = doc.categoryName || CATEGORY_NAMES[doc.category] || doc.category;
                const d = new Date(doc.created_at);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return '<div class="library-item" data-id="' + escapeHtml(String(doc.id)) + '">' +
                    '<span class="library-item-icon">' + emoji + '</span>' +
                    '<div class="library-item-info">' +
                        '<div class="library-item-title">' + escapeHtml(doc.title) + '</div>' +
                        '<div class="library-item-meta">' + escapeHtml(catName) + ' · ' + escapeHtml(dateStr) + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');

            // Click handlers for each item
            libraryList.querySelectorAll('.library-item').forEach(item => {
                item.addEventListener('click', () => loadDocument(item.dataset.id));
            });

        } catch (err) {
            libraryList.innerHTML = '<p class="muted">Failed to load library: ' + escapeHtml(err.message) + '</p>';
        }
    }

    // ─── Load Specific Document ───────────────────────────────
    async function loadDocument(id) {
        closeModal(libraryModal);
        showLoading();

        try {
            let doc;
            if (useBackend) {
                const numId = parseInt(id, 10);
                if (isNaN(numId) || numId <= 0) throw new Error('Invalid document ID');
                const res = await fetch(API.documents + '?action=get&id=' + encodeURIComponent(numId));
                doc = await res.json();
                if (doc.error) throw new Error(doc.error);
            } else {
                const docs = getLocalDocs();
                doc = docs.find(d => String(d.id) === String(id));
                if (!doc) throw new Error('Document not found');
            }

            hideLoading();
            doc.is_new = false;
            renderDocument(doc);
        } catch (err) {
            hideLoading();
            showError(err.message);
        }
    }

    // ─── Stats Modal ──────────────────────────────────────────
    async function openStats() {
        openModal(statsModal);
        statsContent.innerHTML = '<p class="muted">Loading stats...</p>';

        try {
            let data;
            if (useBackend) {
                const res = await fetch(API.documents + '?action=stats');
                data = await res.json();
            } else {
                const docs = getLocalDocs();
                const byCategory = {};
                docs.forEach(d => {
                    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
                });
                const catArray = Object.entries(byCategory).map(([cat, count]) => ({
                    category: cat,
                    categoryName: CATEGORY_NAMES[cat] || cat,
                    count: count,
                }));
                catArray.sort((a, b) => b.count - a.count);
                data = {
                    totalDocuments: docs.length,
                    totalCategories: catArray.length,
                    byCategory: catArray,
                };
            }

            const maxCount = Math.max(...(data.byCategory || []).map(c => c.count), 1);

            statsContent.innerHTML =
                '<div class="stat-card">' +
                    '<div>' +
                        '<div class="stat-number">' + escapeHtml(String(data.totalDocuments)) + '</div>' +
                        '<div class="stat-label">Documents Generated</div>' +
                    '</div>' +
                '</div>' +
                '<div class="stat-card">' +
                    '<div>' +
                        '<div class="stat-number">' + escapeHtml(String(data.totalCategories)) + '</div>' +
                        '<div class="stat-label">Categories Explored</div>' +
                    '</div>' +
                '</div>' +
                (data.byCategory || []).map(cat => {
                    const name = escapeHtml(cat.categoryName || CATEGORY_NAMES[cat.category] || cat.category);
                    const emoji = CATEGORY_EMOJIS[cat.category] || '📄';
                    const pct = Math.round((cat.count / maxCount) * 100);
                    return '<div class="stat-bar">' +
                        '<span class="stat-bar-label">' + emoji + ' ' + name + '</span>' +
                        '<div class="stat-bar-track">' +
                            '<div class="stat-bar-fill" style="width: ' + pct + '%;"></div>' +
                        '</div>' +
                        '<span class="stat-bar-count">' + escapeHtml(String(cat.count)) + '</span>' +
                    '</div>';
                }).join('');

        } catch (err) {
            statsContent.innerHTML = '<p class="muted">Failed to load stats: ' + escapeHtml(err.message) + '</p>';
        }
    }

    // ─── Settings Modal ──────────────────────────────────────
    function openSettings() {
        loadSettings();
        const modeLabel = $('#settings-mode-label');
        if (modeLabel) {
            modeLabel.textContent = useBackend ? 'Backend (PHP + MySQL)' : 'Static (Browser Storage)';
        }
        openModal(settingsModal);
    }

    // ─── Modal Helpers ────────────────────────────────────────
    function openModal(modal) {
        if (modal) {
            modal.hidden = false;
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal(modal) {
        if (modal) {
            modal.hidden = true;
            // Restore scroll if no other modals open
            if (!document.querySelector('.modal:not([hidden])')) {
                document.body.style.overflow = '';
            }
        }
    }

    // ─── Utilities ────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ─── Kick Off ─────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
