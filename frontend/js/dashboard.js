/* ===== dashboard.js ===== */

let allDocuments = [];
let currentFilter = 'all';
let currentTypeFilter = '';
let currentShareDocId = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  await loadDocuments();
});

async function loadDocuments() {
  try {
    const res = await apiRequest('GET', '/documents/');
    if (!res.ok) throw new Error('Failed to load documents');
    allDocuments = await res.json();
    renderAll();
  } catch (err) {
    showToast('Failed to load documents', 'error');
    document.getElementById('doc-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Failed to load</div>
        <div class="empty-sub">${err.message}</div>
      </div>`;
  }
}

function renderAll() {
  updateStats();
  updateSidebarCounts();
  renderFilterChips();
  renderDocs(getFilteredDocs());
}

function getFilteredDocs() {
  const user = getUser();
  let docs = [...allDocuments];

  // Ownership filter
  if (currentFilter === 'mine') docs = docs.filter(d => d.is_owner);
  else if (currentFilter === 'shared') docs = docs.filter(d => !d.is_owner);
  else if (currentFilter === 'public') docs = docs.filter(d => d.is_public);

  // Type filter
  if (currentTypeFilter) {
    if (currentTypeFilter === 'image') {
      docs = docs.filter(d => ['png','jpg','jpeg','bmp','tiff','webp'].includes(d.file_type));
    } else {
      docs = docs.filter(d => d.file_type === currentTypeFilter);
    }
  }

  // Quick search
  const q = document.getElementById('quick-search')?.value?.toLowerCase() || '';
  if (q) {
    docs = docs.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  return docs;
}

function updateStats() {
  const user = getUser();
  const mine = allDocuments.filter(d => d.is_owner);
  const shared = allDocuments.filter(d => !d.is_owner);
  const pdfs = allDocuments.filter(d => d.file_type === 'pdf');
  const tagged = allDocuments.filter(d => d.tags && d.tags.length > 0);

  document.getElementById('stat-total').textContent = allDocuments.length;
  document.getElementById('stat-pdf').textContent = pdfs.length;
  document.getElementById('stat-shared').textContent = shared.length;
  document.getElementById('stat-tagged').textContent = tagged.length;
}

function updateSidebarCounts() {
  document.getElementById('count-all').textContent = allDocuments.length;
  document.getElementById('count-mine').textContent = allDocuments.filter(d => d.is_owner).length;
  document.getElementById('count-shared').textContent = allDocuments.filter(d => !d.is_owner).length;
  document.getElementById('count-public').textContent = allDocuments.filter(d => d.is_public).length;
}

function renderFilterChips() {
  const allTags = [...new Set(allDocuments.flatMap(d => d.tags || []))].slice(0, 12);
  const filterRow = document.getElementById('filter-row');
  filterRow.innerHTML = allTags.map(tag =>
    `<span class="filter-chip" onclick="toggleTagFilter('${tag}')" data-tag="${tag}">#${tag}</span>`
  ).join('');
}

let activeTagFilters = new Set();
function toggleTagFilter(tag) {
  const chip = document.querySelector(`[data-tag="${tag}"]`);
  if (activeTagFilters.has(tag)) {
    activeTagFilters.delete(tag);
    chip?.classList.remove('active');
  } else {
    activeTagFilters.add(tag);
    chip?.classList.add('active');
  }
  renderDocs(getFilteredDocsWithTags());
}

function getFilteredDocsWithTags() {
  let docs = getFilteredDocs();
  if (activeTagFilters.size > 0) {
    docs = docs.filter(d => [...activeTagFilters].some(tag => (d.tags || []).includes(tag)));
  }
  return docs;
}

function renderDocs(docs) {
  const grid = document.getElementById('doc-grid');
  if (!docs.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No documents found</div>
        <div class="empty-sub">Try uploading a document or adjusting your filters.</div>
      </div>`;
    return;
  }

  grid.innerHTML = docs.map(doc => {
    const icon = getDocIcon(doc.file_type);
    const iconClass = getDocIconClass(doc.file_type);
    const badge = getFileTypeBadge(doc.file_type);
    const tagsHtml = (doc.tags || []).slice(0, 4).map(t => `<span class="tag">#${t}</span>`).join('');
    const ownerBadge = !doc.is_owner ? `<span class="badge badge-shared">Shared</span>` : '';
    const publicBadge = doc.is_public ? `<span class="badge badge-public">Public</span>` : '';
    const size = formatSize(doc.file_size || 0);
    const date = formatDate(doc.created_at);

    return `
    <div class="card doc-card" onclick="openDocModal(${doc.id})">
      <div class="doc-card-header">
        <div class="doc-icon ${iconClass}">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div class="doc-card-title">${escapeHtml(doc.title)}</div>
          <div class="doc-card-meta">${size} · ${date} · by ${doc.owner}</div>
        </div>
        <div style="display:flex;gap:0.35rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
          ${badge}${ownerBadge}${publicBadge}
        </div>
      </div>
      ${doc.summary ? `<div class="doc-summary">${escapeHtml(doc.summary)}</div>` : ''}
      ${tagsHtml ? `<div class="doc-tags">${tagsHtml}</div>` : ''}
      <div class="doc-card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm" onclick="downloadDoc(${doc.id}, '${escapeHtml(doc.filename)}')">⬇️ Download</button>
        ${doc.is_owner ? `<button class="btn btn-secondary btn-sm" onclick="openShareModal(${doc.id})">🔗 Share</button>` : ''}
        ${doc.is_owner ? `<button class="btn btn-danger btn-sm" onclick="deleteDoc(${doc.id})">🗑️</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ---- Sidebar / Filter functions ----
function filterDocs(type) {
  currentFilter = type;
  currentTypeFilter = '';
  activeTagFilters.clear();
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`filter-${type}`)?.classList.add('active');
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  renderDocs(getFilteredDocs());
}

function filterType(type) {
  currentTypeFilter = currentTypeFilter === type ? '' : type;
  renderDocs(getFilteredDocs());
}

function quickFilter(val) {
  renderDocs(getFilteredDocsWithTags());
}

// ---- Document Detail Modal ----
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
    const iconClass = getDocIconClass(doc.file_type);
    const tagsHtml = (doc.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
    const sharesHtml = (doc.shares || []).map(s =>
      `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid var(--glass-border);">
        <span>👤</span>
        <span style="flex:1;font-size:0.88rem;">${s.username}</span>
        <span class="badge badge-${s.permission === 'edit' ? 'docx' : 'shared'}">${s.permission}</span>
        ${doc.is_owner ? `<button class="btn btn-danger btn-sm" onclick="revokeShare(${doc.id},'${s.username}')">✕</button>` : ''}
      </div>`
    ).join('');

    body.innerHTML = `
      <div class="doc-detail-header">
        <div class="doc-detail-icon ${iconClass}">${icon}</div>
        <div class="doc-detail-info">
          <div class="doc-detail-title">${escapeHtml(doc.title)}</div>
          <div class="doc-detail-meta">
            ${formatSize(doc.file_size)} · ${doc.page_count} page(s) · ${doc.file_type.toUpperCase()} · ${formatDate(doc.created_at)}
          </div>
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
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">📝 Extracted Text (preview)</div>
          <div class="text-preview">${escapeHtml(doc.extracted_text)}</div>
        </div>` : ''}

      ${sharesHtml ? `
        <div style="margin-bottom:1.25rem;">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">🔗 Shared With</div>
          ${sharesHtml}
        </div>` : ''}

      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="downloadDoc(${doc.id},'${escapeHtml(doc.filename)}')">⬇️ Download</button>
        ${doc.is_owner ? `<button class="btn btn-secondary btn-sm" onclick="closeModal();openShareModal(${doc.id})">🔗 Share</button>` : ''}
        ${doc.is_owner ? `<button class="btn btn-secondary btn-sm" onclick="togglePublic(${doc.id})">${doc.is_public ? '🔒 Make Private' : '🌐 Make Public'}</button>` : ''}
        ${doc.is_owner ? `<button class="btn btn-danger btn-sm" onclick="closeModal();deleteDoc(${doc.id})">🗑️ Delete</button>` : ''}
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load</div></div>`;
  }
}

function closeModal() {
  document.getElementById('doc-modal').classList.remove('show');
}

// ---- Share Modal ----
function openShareModal(docId) {
  currentShareDocId = docId;
  document.getElementById('share-username').value = '';
  document.getElementById('share-permission').value = 'view';
  const doc = allDocuments.find(d => d.id === docId);
  document.getElementById('current-shares').innerHTML = doc?.shares?.length
    ? doc.shares.map(s => `<div style="font-size:0.85rem;padding:0.35rem 0;">${s.username} — ${s.permission}</div>`).join('')
    : '<div style="color:var(--text-muted);font-size:0.85rem;">Not shared with anyone yet.</div>';
  document.getElementById('share-modal').classList.add('show');
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('show');
  currentShareDocId = null;
}

async function confirmShare() {
  if (!currentShareDocId) return;
  const username = document.getElementById('share-username').value.trim();
  const permission = document.getElementById('share-permission').value;
  if (!username) { showToast('Enter a username to share with', 'error'); return; }

  try {
    const res = await apiRequest('POST', `/documents/${currentShareDocId}/share`, { username, permission });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    showToast(data.message, 'success');
    closeShareModal();
    await loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function revokeShare(docId, username) {
  try {
    const res = await apiRequest('DELETE', `/documents/${docId}/share/${username}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    showToast('Access revoked', 'success');
    closeModal();
    await loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Delete ----
async function deleteDoc(docId) {
  if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return;
  try {
    const res = await apiRequest('DELETE', `/documents/${docId}`);
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail); }
    showToast('Document deleted', 'success');
    allDocuments = allDocuments.filter(d => d.id !== docId);
    renderAll();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Download ----
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

// ---- Toggle Public ----
async function togglePublic(docId) {
  try {
    const res = await apiRequest('PATCH', `/documents/${docId}/toggle-public`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    showToast(`Document is now ${data.is_public ? 'public' : 'private'}`, 'success');
    closeModal();
    await loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---- Helpers ----
function getDocIcon(type) {
  const icons = { pdf: '📕', docx: '📘', doc: '📘', txt: '📃', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', bmp: '🖼️', tiff: '🖼️', webp: '🖼️' };
  return icons[type] || '📄';
}

function getDocIconClass(type) {
  if (type === 'pdf') return 'doc-icon-pdf';
  if (['docx','doc'].includes(type)) return 'doc-icon-docx';
  if (type === 'txt') return 'doc-icon-txt';
  return 'doc-icon-img';
}

function getFileTypeBadge(type) {
  if (type === 'pdf') return `<span class="badge badge-pdf">PDF</span>`;
  if (['docx','doc'].includes(type)) return `<span class="badge badge-docx">DOCX</span>`;
  if (type === 'txt') return `<span class="badge badge-txt">TXT</span>`;
  return `<span class="badge badge-image">${type.toUpperCase()}</span>`;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

function formatDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
