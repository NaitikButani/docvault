/* ===== auth.js — Shared auth utilities used by all pages ===== */

const API = 'http://localhost:8000';

// ---- Token Management ----
function getToken() { return localStorage.getItem('docvault_token'); }
function setToken(t) { localStorage.setItem('docvault_token', t); }
function getUser() {
  const u = localStorage.getItem('docvault_user');
  return u ? JSON.parse(u) : null;
}
function setUser(u) { localStorage.setItem('docvault_user', JSON.stringify(u)); }
function clearAuth() {
  localStorage.removeItem('docvault_token');
  localStorage.removeItem('docvault_user');
}

// ---- Auth Guard (call on protected pages) ----
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/';
    return false;
  }
  updateNavbar();
  return true;
}

// ---- Update navbar user info ----
function updateNavbar() {
  const user = getUser();
  if (!user) return;
  const nameEl = document.getElementById('nav-username');
  const avatarEl = document.getElementById('nav-avatar');
  if (nameEl) nameEl.textContent = user.username;
  if (avatarEl) avatarEl.textContent = (user.full_name || user.username || '?')[0].toUpperCase();
}

// ---- Logout ----
function logout() {
  clearAuth();
  window.location.href = '/';
}

// ---- API helper ----
async function apiRequest(method, path, body = null, isForm = false) {
  const headers = { 'Authorization': `Bearer ${getToken()}` };
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body) options.body = isForm ? body : JSON.stringify(body);

  const res = await fetch(`${API}${path}`, options);
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  return res;
}

// ---- Auth page functions ----
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');
  if (!loginForm) return;

  if (tab === 'login') {
    loginForm.style.display = 'flex';
    regForm.style.display = 'none';
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'flex';
    tabLogin.classList.remove('active');
    tabReg.classList.add('active');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const res = await fetch(`${API}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');

    setToken(data.access_token);
    setUser(data.user);
    showToast('Welcome back! Redirecting...', 'success');
    setTimeout(() => window.location.href = '/dashboard', 800);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = 'Sign In →';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('reg-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating account...';

  const body = {
    username: document.getElementById('reg-username').value,
    email: document.getElementById('reg-email').value,
    password: document.getElementById('reg-password').value,
    full_name: document.getElementById('reg-name').value,
  };

  try {
    const res = await fetch(`${API}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');

    setToken(data.access_token);
    setUser(data.user);
    showToast('Account created! Welcome to DocVault 🎉', 'success');
    setTimeout(() => window.location.href = '/dashboard', 800);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = 'Create Account →';
  }
}

// ---- Toast notifications ----
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---- Redirect if already logged in (for auth page only) ----
if (window.location.pathname === '/' && getToken()) {
  window.location.href = '/dashboard';
}
