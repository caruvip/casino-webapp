/**
 * auth.js — Sistema di autenticazione centralizzato
 * 
 * Modalità: localStorage (demo) → sostituire _authBackend con Supabase in produzione.
 * 
 * Funzionalità:
 *  - Registrazione con verifica età 18+
 *  - Login / Logout
 *  - Aggiornamento UI automatico (userBar)
 *  - Rate limiting login lato client (anti-brute force base)
 *  - Redirect automatico per pagine protette
 */

'use strict';

// ─── Costanti ─────────────────────────────────────────────────────────────────
const SESSION_KEY   = 'casino_current_user';
const USERS_KEY     = 'casino_users';
const LOGIN_ATTEMPTS_KEY = 'casino_login_attempts';
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 5 * 60 * 1000; // 5 minuti

// ─── Rate limiting (anti-brute force lato client) ─────────────────────────────
function _getAttempts() {
    try { return JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY)) || { count: 0, last: 0 }; }
    catch { return { count: 0, last: 0 }; }
}

function _recordAttempt(success) {
    const data = _getAttempts();
    if (success) {
        localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
        return;
    }
    const now = Date.now();
    // Reset se passato il lockout
    if (now - data.last > LOCKOUT_MS) data.count = 0;
    data.count += 1;
    data.last = now;
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
}

function _isLockedOut() {
    const data = _getAttempts();
    if (data.count < MAX_ATTEMPTS) return false;
    const remaining = LOCKOUT_MS - (Date.now() - data.last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : false;
}

// ─── Storage backend (localStorage — sostituire con Supabase per produzione) ──
function _getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
}

function _saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function _getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
}

function _saveSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function _clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Calcola l'età in anni dalla data di nascita (formato YYYY-MM-DD) */
function _calcAge(birthdateStr) {
    const birth = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

/** Hash semplice (solo per demo localStorage — in produzione usare bcrypt lato server) */
async function _hashPassword(password) {
    const enc = new TextEncoder().encode(password + 'casino_salt_2025');
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Sanitizza una stringa per prevenire XSS */
function _sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/** Formatta il saldo come valuta italiana */
function _formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ─── API pubblica ──────────────────────────────────────────────────────────────

/**
 * Restituisce l'utente loggato, o null.
 */
function getCurrentUser() {
    return _getSession();
}

/**
 * Registra un nuovo utente.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
async function register({ username, password, email, birthdate }) {
    // Validazione input
    if (!username?.trim() || !password || !birthdate) {
        return { ok: false, error: 'Compila tutti i campi obbligatori.' };
    }
    if (username.trim().length < 3) {
        return { ok: false, error: 'Il nome utente deve avere almeno 3 caratteri.' };
    }
    if (password.length < 6) {
        return { ok: false, error: 'La password deve avere almeno 6 caratteri.' };
    }
    if (_calcAge(birthdate) < 18) {
        return { ok: false, error: 'Devi avere almeno 18 anni per registrarti.' };
    }

    const users = _getUsers();
    const uname = username.trim().toLowerCase();

    if (users.find(u => u.username.toLowerCase() === uname)) {
        return { ok: false, error: 'Nome utente già in uso.' };
    }
    if (email && users.find(u => u.email?.toLowerCase() === email.toLowerCase())) {
        return { ok: false, error: 'Email già registrata.' };
    }

    const hash = await _hashPassword(password);
    const newUser = {
        id:               crypto.randomUUID?.() || Date.now().toString(36),
        username:         username.trim(),
        email:            email?.trim() || null,
        passwordHash:     hash,
        balance:          1000,    // Bonus benvenuto
        createdAt:        new Date().toISOString(),
        lastLogin:        null,
        vipLevel:         'standard',
        stats: { gamesPlayed: 0, gamesWon: 0, totalWon: 0, totalLost: 0 },
        history:          [],
    };

    users.push(newUser);
    _saveUsers(users);
    return { ok: true };
}

/**
 * Effettua il login.
 * @returns {Promise<{ok:boolean, user?:object, error?:string}>}
 */
async function login({ username, password }) {
    // Rate limiting
    const lockout = _isLockedOut();
    if (lockout) {
        return { ok: false, error: `Troppi tentativi. Riprova tra ${lockout} secondi.` };
    }

    if (!username?.trim() || !password) {
        return { ok: false, error: 'Inserisci nome utente e password.' };
    }

    const users = _getUsers();
    const uname = username.trim().toLowerCase();
    const user  = users.find(u => u.username.toLowerCase() === uname);

    if (!user) {
        _recordAttempt(false);
        return { ok: false, error: 'Credenziali non valide.' };
    }

    const hash = await _hashPassword(password);
    if (user.passwordHash !== hash) {
        // Supporto legacy: confronto password in chiaro per account vecchi
        if (user.password && user.password !== password) {
            _recordAttempt(false);
            return { ok: false, error: 'Credenziali non valide.' };
        } else if (!user.password) {
            _recordAttempt(false);
            return { ok: false, error: 'Credenziali non valide.' };
        }
        // Migra la password al formato hash
        user.passwordHash = hash;
        delete user.password;
    }

    // Aggiorna lastLogin
    user.lastLogin = new Date().toISOString();
    const idx = users.findIndex(u => u.username.toLowerCase() === uname);
    users[idx] = user;
    _saveUsers(users);
    _saveSession(user);
    _recordAttempt(true);

    return { ok: true, user };
}

/**
 * Effettua il logout e reindirizza.
 * @param {string} redirectTo  URL di destinazione (default: '../index.html')
 */
function logout(redirectTo = null) {
    _clearSession();
    const path = redirectTo || (location.pathname.includes('/giochi') ? '../index.html' : 'index.html');
    window.location.href = path;
}

/**
 * Aggiorna la userBar nella pagina corrente.
 * Cerca un elemento con id="userBar" e lo popola.
 */
function updateAuthUI() {
    const bar = document.getElementById('userBar');
    if (!bar) return;

    const user = _getSession();
    if (user) {
        bar.innerHTML = `
            <div class="user-bar-inner">
                <span class="user-bar-name">
                    <i class="ti ti-user-circle"></i>
                    ${_sanitize(user.username)}
                </span>
                <span class="user-bar-balance">
                    ${_formatCurrency(user.balance)}
                </span>
                <a href="${_resolveProfilePath()}" class="user-bar-link">Profilo</a>
                <button class="user-bar-btn" onclick="authLogout()">Esci</button>
            </div>
        `;
    } else {
        bar.innerHTML = `
            <div class="user-bar-inner">
                <a href="${_resolveLoginPath()}" class="user-bar-link">Accedi</a>
                <a href="${_resolveRegisterPath()}" class="user-bar-btn">Registrati</a>
            </div>
        `;
    }
}

/** Risolve i percorsi in base alla profondità della pagina corrente */
function _resolveDepth() {
    return location.pathname.includes('/giochi') ? '../' : './';
}
function _resolveLoginPath()    { return _resolveDepth() + 'login.html'; }
function _resolveRegisterPath() { return _resolveDepth() + 'registrati.html'; }
function _resolveProfilePath()  { return _resolveDepth() + 'user.html'; }

/**
 * Reindirizza al login se l'utente non è loggato.
 * Da chiamare all'inizio delle pagine di gioco.
 */
function requireAuth(loginPath) {
    if (!_getSession()) {
        window.location.href = loginPath || _resolveLoginPath();
        return null;
    }
    return _getSession();
}

// ─── Compatibilità globale (window) per script inline ─────────────────────────
// Permette di chiamare authLogout() da onclick inline
window.authLogout = () => logout();

// ─── Init automatico ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();

    // Aggiorna la UI quando il saldo cambia (evento da balance.js)
    document.addEventListener('balanceUpdate', () => updateAuthUI());

    // Gestione form login (se presente)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn    = loginForm.querySelector('button[type="submit"]');
            const errEl  = document.getElementById('loginError');
            const uname  = document.getElementById('loginUser')?.value;
            const pass   = document.getElementById('loginPass')?.value;

            if (btn) btn.disabled = true;
            const result = await login({ username: uname, password: pass });
            if (btn) btn.disabled = false;

            if (result.ok) {
                window.location.href = 'index.html';
            } else {
                if (errEl) errEl.textContent = result.error;
                else alert(result.error);
            }
        });
    }

    // Gestione form registrazione (se presente)
    const regForm = document.getElementById('regForm');
    if (regForm) {
        regForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn    = regForm.querySelector('button[type="submit"]');
            const errEl  = document.getElementById('regError');
            const uname  = document.getElementById('reguser')?.value;
            const pass   = document.getElementById('regpass')?.value;
            const email  = document.getElementById('regemail')?.value;
            const birth  = document.getElementById('regbirth')?.value;

            if (btn) btn.disabled = true;
            const result = await register({ username: uname, password: pass, email, birthdate: birth });
            if (btn) btn.disabled = false;

            if (result.ok) {
                alert('Registrazione completata! Bonus di €1.000 accreditato. Ora puoi accedere.');
                window.location.href = 'login.html';
            } else {
                if (errEl) errEl.textContent = result.error;
                else alert(result.error);
            }
        });
    }

    // Pulsante logout (id="logoutBtn")
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});
