'use strict';

/**
 * auth.js — Autenticazione via Supabase Auth
 * Dipende da: supabase-client.js (_sb globale)
 */

const LOGIN_ATTEMPTS_KEY = 'casino_login_attempts';
const MAX_ATTEMPTS       = 5;
const LOCKOUT_MS         = 5 * 60 * 1000;

/* ── Cache in-memoria sessione corrente ───────────────────────────────────── */
let _sessionUser = null; // { id, username, email, balance, vipLevel, status }

/* ── Rate limiting login ──────────────────────────────────────────────────── */
function _getAttempts() {
    try { return JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY)) || { count: 0, last: 0 }; }
    catch { return { count: 0, last: 0 }; }
}
function _recordAttempt(success) {
    if (success) { localStorage.removeItem(LOGIN_ATTEMPTS_KEY); return; }
    const data = _getAttempts();
    const now  = Date.now();
    if (now - data.last > LOCKOUT_MS) data.count = 0;
    data.count++;
    data.last = now;
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
}
function _isLockedOut() {
    const data = _getAttempts();
    if (data.count < MAX_ATTEMPTS) return false;
    const remaining = LOCKOUT_MS - (Date.now() - data.last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : false;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function _sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function _formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}
function _calcAge(birthdateStr) {
    const birth = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

/* ── Carica profilo da Supabase ───────────────────────────────────────────── */
async function _loadProfile(userId) {
    const { data, error } = await _sb
        .from('profiles')
        .select('username, email, balance, vip_level, status')
        .eq('id', userId)
        .single();

    if (error || !data) { _sessionUser = null; return null; }

    _sessionUser = {
        id:       userId,
        username: data.username,
        email:    data.email    ?? '',
        balance:  data.balance  ?? 0,
        vipLevel: data.vip_level ?? 'standard',
        status:   data.status   ?? 'active',
    };
    return _sessionUser;
}

/* ── API pubblica ─────────────────────────────────────────────────────────── */

function getCurrentUser() { return _sessionUser; }

/**
 * Verifica la sessione Supabase e popola _sessionUser.
 * Chiamata all'avvio di ogni pagina.
 */
async function checkSession() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) { _sessionUser = null; return null; }
    return _loadProfile(session.user.id);
}

/**
 * Login via Supabase Auth (email + password).
 */
async function login({ email, password }) {
    const lockout = _isLockedOut();
    if (lockout) return { ok: false, error: `Troppi tentativi. Riprova tra ${lockout} secondi.` };
    if (!email?.trim() || !password) return { ok: false, error: 'Inserisci email e password.' };

    const { data, error } = await _sb.auth.signInWithPassword({
        email: email.trim(),
        password,
    });

    if (error) {
        _recordAttempt(false);
        return { ok: false, error: 'Credenziali non valide.' };
    }

    _recordAttempt(true);
    await _loadProfile(data.user.id);
    return { ok: true, user: _sessionUser };
}

/**
 * Registrazione via Supabase Auth.
 */
async function register({ username, password, email, birthdate }) {
    if (!username?.trim() || !password || !email?.trim() || !birthdate)
        return { ok: false, error: 'Compila tutti i campi obbligatori.' };
    if (username.trim().length < 3)
        return { ok: false, error: 'Il nome utente deve avere almeno 3 caratteri.' };
    if (password.length < 6)
        return { ok: false, error: 'La password deve avere almeno 6 caratteri.' };
    if (_calcAge(birthdate) < 18)
        return { ok: false, error: 'Devi avere almeno 18 anni per registrarti.' };

    // Controlla blocco registrazioni
    const { data: blk } = await _sb
        .from('impostazioni_sistema')
        .select('valore')
        .eq('chiave', 'blocco_registrazioni')
        .single();
    if (blk?.valore === '1')
        return { ok: false, error: 'Le registrazioni sono temporaneamente sospese.' };

    // Controlla username già in uso
    const { data: existing } = await _sb
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .maybeSingle();
    if (existing) return { ok: false, error: 'Nome utente già in uso.' };

    const { data, error } = await _sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: { username: username.trim(), birthdate },
        },
    });

    if (error) return { ok: false, error: error.message };

    // Supabase può richiedere conferma email
    if (data.user && !data.session) {
        return { ok: true, message: 'Controlla la tua email per confermare la registrazione.' };
    }

    return { ok: true, message: 'Registrazione completata! Bonus di €1.000 accreditato.' };
}

/**
 * Logout: termina la sessione Supabase.
 */
async function logout(redirectTo = null) {
    await _sb.auth.signOut();
    _sessionUser = null;
    const path = redirectTo || (location.pathname.includes('/html/') ? 'index.html' : 'html/index.html');
    window.location.href = path;
}

/**
 * Reindirizza al login se non autenticato.
 */
async function requireAuth(loginPath) {
    const user = await checkSession();
    if (!user) {
        window.location.href = loginPath || (location.pathname.includes('/html/') ? 'login.html' : 'html/login.html');
        return null;
    }
    return user;
}

/* ── userBar UI ───────────────────────────────────────────────────────────── */
function updateAuthUI() {
    const bar = document.getElementById('userBar');
    if (!bar) return;

    const isHtml = location.pathname.includes('/html/');
    const user = _sessionUser;

    if (user) {
        const profilePath  = isHtml ? 'user.html'     : 'html/user.html';
        const rechargePath = isHtml ? 'ricarica.html' : 'html/ricarica.html';
        bar.innerHTML = `
            <div class="nav-balance">
                <span class="nav-balance-label">Saldo</span>
                <span class="nav-balance-amount">${_formatCurrency(user.balance)}</span>
            </div>
            <a href="${rechargePath}" class="nav-btn nav-btn-outline">+ Deposita</a>
            <a href="${profilePath}"  class="nav-btn nav-btn-outline">${_sanitize(user.username)}</a>
            <button class="nav-btn nav-btn-outline" onclick="authLogout()">Esci</button>`;
    } else {
        const base = isHtml ? '' : 'html/';
        bar.innerHTML = `
            <a href="${base}login.html"      class="nav-btn nav-btn-outline">Accedi</a>
            <a href="${base}registrati.html" class="nav-btn nav-btn-solid">Registrati</a>`;
    }
}

/* ── Compatibilità globale ────────────────────────────────────────────────── */
window.authLogout = () => logout();

/* ── Init automatico ad ogni pagina ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    await checkSession();
    updateAuthUI();
    document.dispatchEvent(new CustomEvent('authReady', { detail: { user: _sessionUser } }));

    document.addEventListener('balanceUpdate', (e) => {
        if (_sessionUser && e.detail?.balance !== undefined) {
            _sessionUser.balance = e.detail.balance;
        }
        updateAuthUI();
    });

    // Form login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn   = loginForm.querySelector('button[type="submit"]');
            const errEl = document.getElementById('loginError');
            const email = document.getElementById('loginUser')?.value;
            const pass  = document.getElementById('loginPass')?.value;

            if (btn) btn.disabled = true;
            if (errEl) errEl.textContent = '';

            const result = await login({ email, password: pass });
            if (btn) btn.disabled = false;

            if (result.ok) {
                window.location.href = 'index.html';
            } else {
                if (errEl) errEl.textContent = result.error;
                else alert(result.error);
            }
        });
    }

    // Form registrazione
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn   = regForm.querySelector('button[type="submit"]');
            const errEl = document.getElementById('regError');
            const uname = document.getElementById('reguser')?.value;
            const pass  = document.getElementById('regpass')?.value;
            const email = document.getElementById('regemail')?.value;
            const birth = document.getElementById('regbirth')?.value;

            if (btn) btn.disabled = true;
            if (errEl) errEl.textContent = '';

            const result = await register({ username: uname, password: pass, email, birthdate: birth });
            if (btn) btn.disabled = false;

            if (result.ok) {
                alert(result.message || 'Registrazione completata!');
                window.location.href = 'login.html';
            } else {
                if (errEl) errEl.textContent = result.error;
                else alert(result.error);
            }
        });
    }

    // Pulsante logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    }
});
