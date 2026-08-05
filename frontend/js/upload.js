/* ===== upload.js ===== */

let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
});

// ---- Drag & Drop ----
function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}

function onDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) setFile(files[0]);
}

function onFileSelect(input) {
  if (input.files.length > 0) setFile(input.files[0]);
}

function setFile(file) {
  selectedFile = file;
  const ext = file.name.split('.').pop().toLowerCase();
  const allowedExts = ['pdf','docx','doc','txt','png','jpg','jpeg','bmp','tiff','tif','webp'];

  if (!allowedExts.includes(ext)) {
    showToast(`File type .${ext} is not supported`, 'error');
    selectedFile = null;
    return;
  }

  // Show preview
  document.getElementById('file-preview').style.display = 'block';
  document.getElementById('file-preview-name').textContent = file.name;
  document.getElementById('file-preview-size').textContent = formatSize(file.size);
  document.getElementById('file-preview-icon').textContent = getFileIcon(ext);

  // Enable upload button
  document.getElementById('upload-btn').disabled = false;

  // Auto-fill title
  const titleInput = document.getElementById('doc-title');
  if (!titleInput.value) {
    titleInput.value = file.name.replace(/\.[^.]+$/, '');
  }
}

function clearFile() {
  selectedFile = null;
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('upload-btn').disabled = true;
  document.getElementById('file-input').value = '';
}

// ---- Upload ----
async function uploadDocument() {
  if (!selectedFile) { showToast('Please select a file first', 'error'); return; }

  const btn = document.getElementById('upload-btn');
  const progressDiv = document.getElementById('upload-progress');
  const resultDiv = document.getElementById('upload-result');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Processing...';
  progressDiv.classList.add('show');
  resultDiv.style.display = 'none';

  // Show steps animation
  setStep('upload', 'active');
  setProgress(10, 'Uploading file...');

  const formData = new FormData();
  formData.append('file', selectedFile);
  const title = document.getElementById('doc-title').value.trim();
  if (title) formData.append('title', title);

  try {
    // Simulate step progression
    setTimeout(() => { setStep('upload', 'done'); setStep('extract', 'active'); setProgress(30, 'Extracting text...'); }, 800);
    setTimeout(() => { setStep('extract', 'done'); setStep('embed', 'active'); setProgress(55, 'Generating AI embeddings...'); }, 2000);
    setTimeout(() => { setStep('embed', 'done'); setStep('tag', 'active'); setProgress(75, 'Auto-tagging...'); }, 3500);

    const res = await apiRequest('POST', '/documents/upload', formData, true);
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'Upload failed');

    setStep('tag', 'done');
    setStep('done', 'done');
    setProgress(100, 'Complete!');

    setTimeout(() => showResult(data), 300);
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
    btn.disabled = false;
    btn.innerHTML = '⬆️ Upload & Process Document';
    progressDiv.classList.remove('show');
    resetSteps();
  }
}

function showResult(doc) {
  const resultDiv = document.getElementById('upload-result');
  const details = document.getElementById('result-details');

  const tagsHtml = (doc.tags || []).map(t => `<span class="tag">#${t}</span>`).join(' ');

  details.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.75rem;margin-bottom:1rem;">
      <div style="padding:0.75rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">
        <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Type</div>
        <div style="font-size:1rem;font-weight:700;margin-top:0.2rem;">${doc.file_type.toUpperCase()}</div>
      </div>
      <div style="padding:0.75rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">
        <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Pages</div>
        <div style="font-size:1rem;font-weight:700;margin-top:0.2rem;">${doc.page_count}</div>
      </div>
      <div style="padding:0.75rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">
        <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Size</div>
        <div style="font-size:1rem;font-weight:700;margin-top:0.2rem;">${formatSize(doc.file_size)}</div>
      </div>
      <div style="padding:0.75rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">
        <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Tags</div>
        <div style="font-size:1rem;font-weight:700;margin-top:0.2rem;">${doc.tags?.length || 0}</div>
      </div>
    </div>
    ${doc.summary ? `
      <div style="margin-bottom:1rem;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">🤖 AI Summary</div>
        <div style="font-size:0.88rem;color:var(--text-secondary);line-height:1.65;padding:1rem;background:var(--glass);border-radius:var(--border-radius-sm);border:1px solid var(--glass-border);">${doc.summary}</div>
      </div>` : ''}
    ${tagsHtml ? `
      <div>
        <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.5rem;">🏷️ Auto Tags</div>
        <div style="display:flex;flex-wrap:wrap;gap:0.35rem;">${tagsHtml}</div>
      </div>` : ''}`;

  resultDiv.style.display = 'block';
  showToast('Document processed successfully! 🎉', 'success');
}

function uploadAnother() {
  clearFile();
  document.getElementById('upload-progress').classList.remove('show');
  document.getElementById('upload-result').style.display = 'none';
  document.getElementById('doc-title').value = '';
  document.getElementById('upload-btn').innerHTML = '⬆️ Upload & Process Document';
  resetSteps();
}

// ---- Step helpers ----
function setStep(id, state) {
  const el = document.getElementById(`step-${id}`);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
}

function resetSteps() {
  ['upload','extract','embed','tag','done'].forEach(id => setStep(id, ''));
}

function setProgress(pct, label) {
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-label').textContent = label;
}

// ---- Helpers ----
function getFileIcon(ext) {
  if (ext === 'pdf') return '📕';
  if (['docx','doc'].includes(ext)) return '📘';
  if (ext === 'txt') return '📃';
  return '🖼️';
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}
