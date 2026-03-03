/* ═══════════════════════════════════════════════════════════════
   BrainForge — App Logic
   ═══════════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    // ─── Config ───────────────────────────────────────────────
    const API = {
        generate: 'api/generate.php',
        documents: 'api/documents.php',
    };

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

    const LOADING_MESSAGES = [
        'Generating your brain training...',
        'Activating neural pathways...',
        'Crafting cognitive exercises...',
        'Building mental models...',
        'Preparing brain workout...',
        'Synthesizing knowledge...',
    ];

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
    const loadingOverlay = $('#loading-overlay');
    const loadingText = $('#loading-text');
    const libraryModal = $('#library-modal');
    const statsModal = $('#stats-modal');
    const libraryList = $('#library-list');
    const statsContent = $('#stats-content');

    // ─── State ────────────────────────────────────────────────
    let activeCategory = 'all';
    let isGenerating = false;

    // ─── Initialize ───────────────────────────────────────────
    function init() {
        registerServiceWorker();
        bindEvents();
        loadInitialDocument();
    }

    // ─── Service Worker ───────────────────────────────────────
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(console.warn);
        }
    }

    // ─── Events ───────────────────────────────────────────────
    function bindEvents() {
        btnGenerate.addEventListener('click', () => generateNew());
        btnLibrary.addEventListener('click', openLibrary);
        btnStats.addEventListener('click', openStats);
        $('#close-library').addEventListener('click', () => closeModal(libraryModal));
        $('#close-stats').addEventListener('click', () => closeModal(statsModal));

        // Close modals on backdrop click
        $$('.modal-backdrop').forEach(el =>
            el.addEventListener('click', () => closeModal(el.closest('.modal')))
        );

        // Category pills
        $$('.cat-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                $$('.cat-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeCategory = pill.dataset.category;
            });
        });
    }

    // ─── Load Initial Document ────────────────────────────────
    async function loadInitialDocument() {
        try {
            const res = await fetch(`${API.documents}?action=random`);
            const data = await res.json();

            if (data.generate_new) {
                // No past docs or dice says generate new
                await generateNew();
            } else {
                renderDocument(data);
            }
        } catch (err) {
            console.error('Failed to load initial document:', err);
            // Show welcome screen — user can click Generate
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
            const res = await fetch(API.generate, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cat ? { category: cat } : {}),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const doc = await res.json();
            hideLoading();
            renderDocument(doc);
        } catch (err) {
            hideLoading();
            showError(err.message);
        } finally {
            isGenerating = false;
            btnGenerate.classList.remove('loading');
        }
    }

    // ─── Render Document ──────────────────────────────────────
    function renderDocument(doc) {
        // Category badge
        const emoji = CATEGORY_EMOJIS[doc.category] || '📄';
        const catName = doc.categoryName || CATEGORY_NAMES[doc.category] || doc.category;
        docBadge.textContent = `${emoji} ${catName}`;

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
        docNewBadge.style.display = doc.is_new ? '' : 'none';

        // Render markdown content
        const html = marked.parse(doc.content || '');
        docContent.innerHTML = html;

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Animate card
        const card = $('#document-card');
        card.style.animation = 'none';
        card.offsetHeight; // trigger reflow
        card.style.animation = 'cardIn 0.5s var(--ease-out)';
    }

    // ─── Error Display ────────────────────────────────────────
    function showError(message) {
        docContent.innerHTML = `
            <div class="welcome-placeholder">
                <div class="pulse-brain">⚠️</div>
                <h2>Generation Failed</h2>
                <p>${escapeHtml(message)}</p>
                <p style="margin-top: 16px; color: var(--text-muted); font-size: 0.85rem;">
                    Check your AIMLAPI key in config.php and try again.
                </p>
            </div>
        `;
    }

    // ─── Loading ──────────────────────────────────────────────
    function showLoading() {
        loadingText.textContent = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
        loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    // ─── Library Modal ────────────────────────────────────────
    async function openLibrary() {
        libraryModal.style.display = 'flex';
        libraryList.innerHTML = '<p class="muted">Loading documents...</p>';

        try {
            const res = await fetch(`${API.documents}?action=list&page=1`);
            const data = await res.json();

            if (!data.documents || data.documents.length === 0) {
                libraryList.innerHTML = '<p class="muted">No documents yet. Generate your first one!</p>';
                return;
            }

            libraryList.innerHTML = data.documents.map(doc => {
                const emoji = CATEGORY_EMOJIS[doc.category] || '📄';
                const catName = doc.categoryName || CATEGORY_NAMES[doc.category] || doc.category;
                const d = new Date(doc.created_at);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return `
                    <div class="library-item" data-id="${doc.id}">
                        <span class="library-item-icon">${emoji}</span>
                        <div class="library-item-info">
                            <div class="library-item-title">${escapeHtml(doc.title)}</div>
                            <div class="library-item-meta">${catName} · ${dateStr}</div>
                        </div>
                    </div>
                `;
            }).join('');

            // Click handlers for each item
            libraryList.querySelectorAll('.library-item').forEach(item => {
                item.addEventListener('click', () => loadDocument(item.dataset.id));
            });

        } catch (err) {
            libraryList.innerHTML = `<p class="muted">Failed to load library: ${escapeHtml(err.message)}</p>`;
        }
    }

    // ─── Load Specific Document ───────────────────────────────
    async function loadDocument(id) {
        closeModal(libraryModal);
        showLoading();

        try {
            const res = await fetch(`${API.documents}?action=get&id=${id}`);
            const doc = await res.json();

            if (doc.error) throw new Error(doc.error);

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
        statsModal.style.display = 'flex';
        statsContent.innerHTML = '<p class="muted">Loading stats...</p>';

        try {
            const res = await fetch(`${API.documents}?action=stats`);
            const data = await res.json();

            const maxCount = Math.max(...(data.byCategory || []).map(c => c.count), 1);

            statsContent.innerHTML = `
                <div class="stat-card">
                    <div>
                        <div class="stat-number">${data.totalDocuments}</div>
                        <div class="stat-label">Documents Generated</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div>
                        <div class="stat-number">${data.totalCategories}</div>
                        <div class="stat-label">Categories Explored</div>
                    </div>
                </div>
                ${(data.byCategory || []).map(cat => {
                const name = cat.categoryName || CATEGORY_NAMES[cat.category] || cat.category;
                const emoji = CATEGORY_EMOJIS[cat.category] || '📄';
                const pct = Math.round((cat.count / maxCount) * 100);
                return `
                        <div class="stat-bar">
                            <span class="stat-bar-label">${emoji} ${name}</span>
                            <div class="stat-bar-track">
                                <div class="stat-bar-fill" style="width: ${pct}%;"></div>
                            </div>
                            <span class="stat-bar-count">${cat.count}</span>
                        </div>
                    `;
            }).join('')}
            `;

        } catch (err) {
            statsContent.innerHTML = `<p class="muted">Failed to load stats: ${escapeHtml(err.message)}</p>`;
        }
    }

    // ─── Modal Helpers ────────────────────────────────────────
    function closeModal(modal) {
        if (modal) modal.style.display = 'none';
    }

    // ─── Utilities ────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Kick Off ─────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();
