'use strict';

/**
 * balance.js — Gestione saldo via Supabase
 * Dipende da: supabase-client.js (_sb), auth.js (getCurrentUser)
 *
 * API pubblica:
 *   getBalanceLocal()             → number  (cache in-memoria)
 *   canBet(amount)                → boolean
 *   syncBalanceOnLoad()           → Promise<number>
 *   deductBet(amount)             → Promise<{ok, balance, error?}>
 *   addWin(amount)                → Promise<number>
 *   setBalance(amount)            → Promise<number>
 *   addToBalance(delta)           → Promise<number>
 *   recordGame({game,bet,payout}) → Promise<number>
 *   fetchFullUserData()           → Promise<object|null>
 */

/* ── Cache in-memoria ────────────────────────────────────────────────────── */
let _cachedBalance = 0;

/* ── Helpers interni ─────────────────────────────────────────────────────── */
function _getUserId() {
    return (typeof getCurrentUser === 'function' ? getCurrentUser() : null)?.id ?? null;
}

function _applyBalance(balance) {
    _cachedBalance = +Math.max(0, balance).toFixed(2);
    _updateUI(_cachedBalance);
    _dispatchBalanceEvent(_cachedBalance);
}

function _updateUI(balance) {
    const fmt = v => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
    document.querySelectorAll('.nav-balance-amount').forEach(el => el.textContent = fmt(balance));
    const ub = document.getElementById('userBalance');
    if (ub) ub.textContent = fmt(balance);
}

function _dispatchBalanceEvent(balance) {
    document.dispatchEvent(new CustomEvent('balanceUpdate', { detail: { balance } }));
}

async function _checkMaintenance() {
    const { data } = await _sb
        .from('impostazioni_sistema')
        .select('valore')
        .eq('chiave', 'manutenzione')
        .single();
    if (data?.valore === '1') {
        const { data: msg } = await _sb
            .from('impostazioni_sistema')
            .select('valore')
            .eq('chiave', 'messaggio_manutenzione')
            .single();
        _showMaintenanceOverlay(msg?.valore);
        return true;
    }
    return false;
}

/* ── API pubblica ─────────────────────────────────────────────────────────── */

function getBalanceLocal() { return _cachedBalance; }

function canBet(amount) { return _cachedBalance >= amount; }

/** Sincronizza il saldo dal DB all'avvio pagina. */
async function syncBalanceOnLoad() {
    const uid = _getUserId();
    if (!uid) return _cachedBalance;

    if (await _checkMaintenance()) return _cachedBalance;

    const { data, error } = await _sb
        .from('profiles')
        .select('balance')
        .eq('id', uid)
        .single();

    if (!error && data) _applyBalance(data.balance);
    return _cachedBalance;
}

/**
 * Scala la puntata dal saldo.
 */
async function deductBet(amount) {
    amount = +Math.abs(amount).toFixed(2);
    if (amount <= 0) return { ok: false, error: 'Importo non valido', balance: _cachedBalance };
    if (!canBet(amount)) return { ok: false, error: 'Saldo insufficiente', balance: _cachedBalance };

    const { data, error } = await _sb.rpc('update_balance', { delta: -amount });
    if (error) {
        if (error.message?.includes('Saldo insufficiente'))
            return { ok: false, error: 'Saldo insufficiente', balance: _cachedBalance };
        return { ok: false, error: 'Errore di connessione', balance: _cachedBalance };
    }
    _applyBalance(data);
    return { ok: true, balance: _cachedBalance };
}

/**
 * Aggiunge la vincita al saldo.
 */
async function addWin(amount) {
    amount = +Math.abs(amount).toFixed(2);
    if (amount <= 0) return _cachedBalance;
    const { data, error } = await _sb.rpc('update_balance', { delta: +amount });
    if (!error && data !== null) _applyBalance(data);
    return _cachedBalance;
}

/**
 * Imposta il saldo direttamente (usato da poker).
 */
async function setBalance(amount) {
    amount = +Math.max(0, amount).toFixed(2);
    const { data, error } = await _sb.rpc('set_balance', { new_balance: amount });
    if (!error && data !== null) _applyBalance(data);
    return _cachedBalance;
}

/**
 * Delta generico (positivo o negativo).
 */
async function addToBalance(delta) {
    if (delta < 0) { const r = await deductBet(Math.abs(delta)); return r.balance; }
    return addWin(delta);
}

/**
 * Registra una partita nel DB e aggiorna il saldo.
 * duration: durata sessione in secondi (opzionale, per TempoDiGioco)
 */
async function recordGame({ game, bet, payout, duration = 0 }) {
    const { data, error } = await _sb.rpc('record_game', {
        p_game:     game,
        p_bet:      +bet.toFixed(2),
        p_payout:   +payout.toFixed(2),
        p_duration: Math.round(duration),
    });
    if (!error && data !== null) _applyBalance(data);
    return _cachedBalance;
}

/**
 * Recupera profilo completo con statistiche e cronologia dal DB.
 */
async function fetchFullUserData() {
    const { data, error } = await _sb.rpc('get_user_data');
    if (error || !data) return null;

    if (data.balance !== undefined) _applyBalance(data.balance);

    return {
        username:     data.username,
        email:        data.email,
        balance:      data.balance,
        vipLevel:     data.vip_level,
        status:       data.status,
        createdAt:    data.created_at,
        playTime:     data.play_time ?? 0,
        statoAccount: data.stato_account ?? false,
        stats:        data.stats,
        history:      data.history,
    };
}

/* ── Auto-sync quando la sessione è pronta ────────────────────────────────── */
document.addEventListener('authReady', () => {
    if (getCurrentUser()) syncBalanceOnLoad();
});

/* ── Overlay manutenzione ─────────────────────────────────────────────────── */
function _showMaintenanceOverlay(message) {
    if (document.getElementById('maintenanceOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'maintenanceOverlay';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100vw;height:100vh;
        background:radial-gradient(circle at center,rgba(30,20,20,0.98),rgba(10,10,10,0.99));
        backdrop-filter:blur(12px);z-index:9999999;
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:#fff;font-family:'Lato',sans-serif;text-align:center;padding:30px;
    `;
    overlay.innerHTML = `
        <div style="max-width:600px;padding:40px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(212,175,55,0.2);">
            <div style="font-size:64px;margin-bottom:20px;">&#9881;&#65039;</div>
            <h1 style="font-family:'Cinzel',serif;font-size:28px;color:#ffd700;margin-bottom:15px;letter-spacing:2px;text-transform:uppercase;">Lavori in Corso</h1>
            <p style="font-size:16px;line-height:1.6;color:#e0e0e0;margin-bottom:25px;">${message || 'Il casino è temporaneamente in manutenzione.'}</p>
            <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Torneremo online a breve.</span>
        </div>
        <style>body{overflow:hidden!important}</style>
    `;
    document.body.appendChild(overlay);
}
