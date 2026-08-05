/* ===== search.js ===== */

let currentMode = 'semantic';
let searchResults = [];

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  // Check URL params for auto-search
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    document.getElementById('search-input').value = q;
    performSearch();
  }
});

function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-semantic').classList.toggle('active', mode === 'semantic');
  document.getElementById('mode-keyword').classList.toggle('active', mode === 'keyword');
}

function useSuggestion(text) {
  document.getElementById('search-input').value = text;
  document.getElementById('suggestions').style.display = 'none';
  performSearch();
}

async function performSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) { showToast('Please enter a search query', 'error'); return; }

  const resultsSection = document.getElementById('results-section');
  const initialState = document.getElementById('initial-state');
  const resultsList = document.getElementById('results-list');
  const resultsCount = document.getElementById('results-count');
  const modeBadge = document.getElementById('mode-badge');

  initialState.style.display = 'none';
  resultsSection.style.display = 'block';
  resultsCount.textContent = 'Searching...';
  resultsList.innerHTML = `
    <div style="text-align:center;padding:3rem;">
      <div class="big-spinner"></div>
      <div style="margin-top:1rem;color:var(--text-muted);font-size:0.9rem;">
        ${currentMode === 'semantic' ? '🤖 Running AI semantic search...' : '🔤 Running keyword search...'}
      </div>
    </div>`;

  modeBadge.className = `mode-indicator ${currentMode}`;
  modeBadge.innerHTML = currentMode === 'semantic' ? '🤖 Semantic Mode' : '🔤 Keyword Mode';

  try {
    const res = await apiRequest('GET', `/search/?q=${encodeURIComponent(query)}&mode=${currentMode}&top_k=20`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Search failed');

    searchResults = data.results || [];
    renderResults(searchResults, query);
    resultsCount.textContent = `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${query}"`;
  } catch (err) {
    showToast(err.message, 'error');
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Search failed</div>
        <div class="empty-sub">${err.message}</div>
      </div>`;
    resultsCount.textContent = 'Search failed';
  }
}

function renderResults(results, query) {
  const list = document.getElementById('results-list');

  if (!results.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No results found</div>
        <div class="empty-sub">Try a different query or switch to keyword mode.</div>
        <button class="btn btn-secondary btn-sm" style="margin-top:1rem;" onclick="setMode('keyword');performSearch()">Switch to Keyword Search</button>
      </div>`;
    return;
  }

  list.innerHTML = results.map((result, i) => {
    const scorePct = Math.round(result.score * 100);
    const scoreColor = scorePct > 70 ? 'var(--accent-green)' : scorePct > 40 ? 'var(--accent-blue)' : 'var(--accent-orange)';
    const icon = getDocIcon(result.file_type);
    const tagsHtml = (result.tags || []).slice(0, 5).map(t => `<span class="tag">#${t}</span>`).join('');
    const snippet = highlightQuery(result.summary || '', query);

    return `
    <div class="card search-result" onclick="openDocModal(${result.id})">
      <div class="result-score" style="color:${scoreColor};border:1px solid ${scoreColor}33;background:${scoreColor}11;">
        <span style="font-size:1rem;font-weight:800;">${scorePct}%</span>
        <small>match</small>
      </div>
      <div class="result-content">
        <div class="result-title">${icon} ${escapeHtml(result.title)}</div>
        ${snippet ? `<div class="result-snippet">${snippet}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.4rem;">${tagsHtml}</div>
        <div class="result-meta">
          ${result.file_type.toUpperCase()} · by ${result.owner} · ${formatDate(result.created_at)}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-end;flex-shrink:0;">
        <span class="badge badge-${result.file_type === 'pdf' ? 'pdf' : result.file_type === 'docx' ? 'docx' : 'txt'}">${result.file_type.toUpperCase()}</span>
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();downloadDoc(${result.id},'${escapeHtml(result.filename || result.title)}')">⬇️</button>
      </div>
    </div>`;
  }).join('');
}

// ---- Document Detail Modal (reuse from dashboard) ----
async function openDocModal(docId) {
  const modal = document.getElementById('doc-modal');
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = 'Loading...';
  modal.classList.add('show');
  body.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="big-spinner"></div></div>';

  try {
    const res = await apiRequest('GET', `/documents/${docId}`);
    const doc = await res.json();
    document.getElementById('modal-title').textContent = doc.title;

    const icon = getDocIcon(doc.file_type);
    const tagsHtml = (doc.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');

    body.innerHTML = `
      <div class="doc-detail-header">
        <div style="font-size:2.5rem;">${icon}</div>
        <div class="doc-detail-info">
          <div class="doc-detail-title">${escapeHtml(doc.title)}</div>
          <div class="doc-detail-meta">${doc.file_type.toUpperCase()} · ${doc.page_count} page(s) · ${formatDate(doc.created_at)} · by ${doc.owner}</div>
          <div style="margin-top:0.5rem;display:flex;gap:0.35rem;flex-wrap:wrap;">${tagsHtml}</div>
        </div>
      </div>
      ${doc.summary ? `
        <div style="margin-bottom:1.25rem;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">🤖 AI Summary</div>
          <div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.65;padding:1rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">${escapeHtml(doc.summary)}</div>
        </div>` : ''}
      ${doc.extracted_text ? `
        <div style="margin-bottom:1.25rem;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">📝 Text Preview</div>
          <div class="text-preview">${escapeHtml(doc.extracted_text)}</div>
        </div>` : ''}
      <button class="btn btn-primary btn-sm" onclick="downloadDoc(${doc.id},'${escapeHtml(doc.filename)}')">⬇️ Download</button>`;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load</div></div>`;
  }
}

function closeModal() {
  document.getElementById('doc-modal').classList.remove('show');
}

async function downloadDoc(docId, filename) {
  try {
    const res = await apiRequest('GET', `/documents/${docId}/download`);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('Download failed', 'error');
  }
}

// ---- Helpers ----
function highlightQuery(text, query) {
  if (!text) return '';
  const safe = escapeHtml(text.substring(0, 300));
  const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return safe.replace(re, '<mark style="background:rgba(79,142,247,0.3);color:var(--text-primary);border-radius:3px;padding:0 2px;">$1</mark>') + (text.length > 300 ? '...' : '');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getDocIcon(type) {
  const icons = { pdf:'📕', docx:'📘', doc:'📘', txt:'📃', png:'🖼️', jpg:'🖼️', jpeg:'🖼️', bmp:'🖼️', tiff:'🖼️', webp:'🖼️' };
  return icons[type] || '📄';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}
