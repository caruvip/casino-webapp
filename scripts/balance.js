/**
 * balance.js — Gestione centralizzata del saldo utente
 *
 * Sincronizzazione DB MySQL via balance.php (XAMPP).
 * localStorage usato come cache locale/fallback.
 *
 * API pubblica:
 *   getBalance()                  → Promise<number>
 *   setBalance(amount)            → Promise<number>
 *   addToBalance(delta)           → Promise<number>
 *   deductBet(amount)             → Promise<{ok, balance, error?}>
 *   addWin(amount)                → Promise<number>
 *   recordGame({game,bet,payout}) → Promise<number>
 *   syncBalanceOnLoad()           → Promise<number>
 */

/* ── Percorso API backend ──────────────────────────────────────────────────── */
const _BALANCE_API = (() => {
    const loc = window.location.href;
    if (loc.startsWith('file://')) return null; // solo localStorage
    const depth = loc.includes('/html/') ? '../' : './';
    return depth + 'php/balance.php';
})();


const SESSION_KEY = 'casino_current_user';
const USERS_KEY   = 'casino_users';

// ─── Storage layer (sostituire con chiamate Supabase in produzione) ───────────

function _readUser() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

function _writeUser(user) {
    if (!user) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    // Aggiorna anche l'array globale utenti
    try {
        const all = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
        const idx = all.findIndex(u => u.username === user.username);
        if (idx !== -1) {
            all[idx] = user;
        } else {
            all.push(user);
        }
        localStorage.setItem(USERS_KEY, JSON.stringify(all));
    } catch (e) {
        console.error('[balance.js] Errore scrittura utenti:', e);
    }
}

// ─── Chiamate backend DB ───────────────────────────────────────────────────────

function _getUsername() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.username || null; }
    catch { return null; }
}

async function _apiGet() {
    if (!_BALANCE_API) return null;
    const u = _getUsername();
    if (!u) return null;
    try {
        const r = await fetch(`${_BALANCE_API}?username=${encodeURIComponent(u)}`);
        if (!r.ok) return null;
        const d = await r.json();
        if (d.maintenance) { _showMaintenanceOverlay(d.maintenance_message); return null; }
        if (d.ok) { _applyBalance(d.balance); return d.balance; }
    } catch {}
    return null;
}

async function _apiPost(action, amount, details = null) {
    if (!_BALANCE_API) return null;
    const u = _getUsername();
    if (!u) return null;
    try {
        const body = { username: u, action, amount };
        if (details) body.details = details;
        const r = await fetch(_BALANCE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!r.ok) return null;
        const d = await r.json();
        if (d.maintenance) { _showMaintenanceOverlay(d.maintenance_message); return null; }
        if (d.ok) { _applyBalance(d.balance); return d.balance; }
        if (d.error === 'Saldo insufficiente') throw new Error('Saldo insufficiente');
    } catch (e) { if (e.message === 'Saldo insufficiente') throw e; }
    return null;
}

/** Scrive il saldo nel localStorage e aggiorna la UI */
function _applyBalance(balance) {
    balance = +Math.max(0, balance).toFixed(2);
    const user = _readUser();
    if (user) {
        user.balance = balance;
        _writeUser(user);
    }
    _updateUI(balance);
    _dispatchBalanceEvent(balance);
}

function _updateUI(balance) {
    const fmt = v => '€' + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // topnav layout.css
    document.querySelectorAll('.nav-balance-amount').forEach(el => el.textContent = fmt(balance));
    // user-bar vecchio stile
    const ub = document.getElementById('userBalance');
    if (ub) ub.textContent = '€ ' + balance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

/** Legge il saldo dal DB (fallback localStorage). @returns {Promise<number>} */
async function getBalance() {
    const db = await _apiGet();
    return db !== null ? db : (_readUser()?.balance ?? 0);
}

/** Saldo locale sincrono (per controlli rapidi senza await). @returns {number} */
function getBalanceLocal() {
    return _readUser()?.balance ?? 0;
}

/** Controlla se ha saldo sufficiente. @returns {boolean} */
function canBet(amount) {
    return getBalanceLocal() >= amount;
}

/**
 * Scala l'importo della puntata dal saldo.
 * @returns {Promise<{ok:boolean, balance:number, error?:string}>}
 */
async function deductBet(amount) {
    amount = +Math.abs(amount).toFixed(2);
    if (amount <= 0) return { ok: false, error: 'Importo non valido', balance: getBalanceLocal() };
    if (!canBet(amount)) return { ok: false, error: 'Saldo insufficiente', balance: getBalanceLocal() };
    try {
        const nb = await _apiPost('delta', -amount);
        if (nb !== null) return { ok: true, balance: nb };
    } catch (e) {
        if (e.message === 'Saldo insufficiente') return { ok: false, error: 'Saldo insufficiente', balance: getBalanceLocal() };
    }
    // Fallback localStorage
    const loc = getBalanceLocal();
    if (loc < amount) return { ok: false, error: 'Saldo insufficiente', balance: loc };
    _applyBalance(loc - amount);
    return { ok: true, balance: loc - amount };
}

/**
 * Aggiunge la vincita al saldo.
 * @returns {Promise<number>}
 */
async function addWin(amount) {
    amount = +Math.abs(amount).toFixed(2);
    if (amount <= 0) return getBalanceLocal();
    const nb = await _apiPost('delta', +amount);
    if (nb !== null) return nb;
    _applyBalance(getBalanceLocal() + amount);
    return getBalanceLocal();
}

/**
 * Imposta il saldo direttamente.
 * @returns {Promise<number>}
 */
async function setBalance(amount) {
    amount = +Math.max(0, amount).toFixed(2);
    const nb = await _apiPost('set', amount);
    if (nb !== null) return nb;
    _applyBalance(amount);
    return amount;
}

/**
 * Aggiunge (o sottrae se negativo) al saldo.
 * @returns {Promise<number>}
 */
async function addToBalance(delta) {
    if (delta < 0) {
        const r = await deductBet(Math.abs(delta));
        return r.balance;
    }
    return addWin(delta);
}

/**
 * Registra partita e aggiorna saldo + statistiche localStorage.
 * @param {{game:string, bet:number, payout:number}}
 * @returns {Promise<number>} nuovo saldo
 */
async function recordGame({ game, bet, payout }) {
    const profit = payout - bet;
    const won    = profit > 0;

    // Aggiorna statistiche in localStorage
    const user = _readUser();
    if (user) {
        if (!user.stats) user.stats = { gamesPlayed: 0, gamesWon: 0, totalWon: 0, totalLost: 0 };
        user.stats.gamesPlayed++;
        if (won) user.stats.gamesWon++;
        if (profit > 0) user.stats.totalWon  = +(user.stats.totalWon  + profit).toFixed(2);
        else            user.stats.totalLost = +(user.stats.totalLost + Math.abs(profit)).toFixed(2);
        if (!Array.isArray(user.history)) user.history = [];
        user.history.unshift({ date: new Date().toISOString(), game, bet, payout, profit });
        if (user.history.length > 100) user.history.length = 100;
        _writeUser(user);
    }

    // Aggiorna saldo nel DB
    const nb = await _apiPost('delta', profit, { game, bet, payout });
    if (nb !== null) return nb;
    _applyBalance(getBalanceLocal() + profit);
    return getBalanceLocal();
}

/** Ritorna le statistiche dell'utente corrente. */
function getStats() {
    const user = _readUser();
    if (!user) return null;
    const s = user.stats || { gamesPlayed: 0, gamesWon: 0, totalWon: 0, totalLost: 0 };
    return { ...s, winRate: s.gamesPlayed ? Math.round(s.gamesWon / s.gamesPlayed * 100) : 0 };
}

/** Ritorna la cronologia partite (max 100). */
function getHistory() { return _readUser()?.history ?? []; }

/** Sincronizza il saldo DB → localStorage all'avvio pagina. */
async function syncBalanceOnLoad() {
    const balance = await getBalance();
    _updateUI(balance);
    return balance;
}

/** Richiede tutti i dati aggiornati del profilo, statistiche e cronologia dal DB */
async function fetchFullUserData() {
    if (!_BALANCE_API) return null;
    const u = _getUsername();
    if (!u) return null;
    try {
        const r = await fetch(`${_BALANCE_API}?username=${encodeURIComponent(u)}&action=getUserData`);
        if (!r.ok) return null;
        const d = await r.json();
        if (d.maintenance) { _showMaintenanceOverlay(d.maintenance_message); return null; }
        if (d.ok) {
            const currentUser = {
                username: d.username,
                email: d.email,
                balance: d.balance,
                vipLevel: d.vipLevel,
                status: d.status,
                createdAt: d.createdAt,
                stats: d.stats,
                history: d.history
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
            
            // Aggiorna anche nell'elenco utenti globale per coerenza locale
            try {
                const all = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
                const idx = all.findIndex(x => x.username === currentUser.username);
                if (idx !== -1) {
                    all[idx] = currentUser;
                } else {
                    all.push(currentUser);
                }
                localStorage.setItem(USERS_KEY, JSON.stringify(all));
            } catch (err) {}

            return currentUser;
        }
    } catch(e) {
        console.error('[balance.js] Errore in fetchFullUserData:', e);
    }
    return null;
}

// ─── Evento custom ────────────────────────────────────────────────────────────
function _dispatchBalanceEvent(balance) {
    document.dispatchEvent(new CustomEvent('balanceUpdate', { detail: { balance } }));
}

// ─── Redirect automatico se non loggato ──────────────────────────────────────
function requireAuth(loginPath = 'login.html') {
    const user = _readUser();
    if (!user) { window.location.href = loginPath; return null; }
    return user;
}

// ─── Auto-sync saldo all'avvio di ogni pagina ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => syncBalanceOnLoad(), 300);
});

/* Mostra un overlay a schermo intero se il sito è in manutenzione */
function _showMaintenanceOverlay(message) {
    if (document.getElementById('maintenanceOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'maintenanceOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(circle at center, rgba(30, 20, 20, 0.98), rgba(10, 10, 10, 0.99));
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #fff;
        font-family: 'Lato', sans-serif;
        text-align: center;
        padding: 30px;
    `;

    overlay.innerHTML = `
        <div style="max-width: 600px; padding: 40px; border-radius: 16px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.2); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 64px; margin-bottom: 20px; animation: pulse 2s infinite; filter: drop-shadow(0 0 10px rgba(212, 175, 55, 0.5));">⚙️</div>
            <h1 style="font-family: 'Cinzel', serif; font-size: 28px; color: #ffd700; margin-bottom: 15px; letter-spacing: 2px; text-transform: uppercase;">Lavori in Corso</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #e0e0e0; margin-bottom: 25px; font-weight: 300;">
                ${message || 'Il casino è temporaneamente in manutenzione per miglioramenti di sistema.'}
            </p>
            <div style="width: 50px; height: 2px; background: linear-gradient(90deg, transparent, #ffd700, transparent); margin-bottom: 20px;"></div>
            <span style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Torneremo online a breve. Grazie per la pazienza.</span>
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.8)); }
                100% { transform: scale(1); opacity: 0.8; }
            }
            body { overflow: hidden !important; }
        </style>
    `;

    document.body.appendChild(overlay);
}

