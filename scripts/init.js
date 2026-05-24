'use strict';

/* ── Jackpot ticker ─────────────────────────────────────────────────────── */
function initJackpot(initialAmount = 4290123.82) {
    let jackpot = initialAmount;
    const jackpotEl = document.getElementById('jackpotAmt');
    if (!jackpotEl) return;
    setInterval(() => {
        jackpot += Math.random() * 9.5 + 0.5;
        jackpotEl.textContent = '€' + jackpot.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }, 2200);
}

/* ── VIP status bar ─────────────────────────────────────────────────────── */
function initVipStatus() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;

    const levels = {
        standard: { name: 'Standard',      pct: 15, next: 'Silver'   },
        silver:   { name: 'Silver',         pct: 45, next: 'Gold'     },
        gold:     { name: 'Gold',           pct: 75, next: 'Platinum' },
        platinum: { name: 'Platinum',       pct: 95, next: 'Diamond'  },
    };

    const l = levels[user.vipLevel] || levels.standard;

    const vipLevelEl = document.getElementById('vipLevelName');
    const vipPctEl   = document.getElementById('vipPct');
    const vipInfoEl  = document.getElementById('vipInfo');
    const vipFillEl  = document.getElementById('vipFill');

    if (vipLevelEl) vipLevelEl.textContent = l.name;
    if (vipPctEl)   vipPctEl.textContent   = l.pct + '%';
    if (vipInfoEl)  vipInfoEl.innerHTML    = `Mancano punti per il livello <strong>${l.next}</strong>`;
    if (vipFillEl)  setTimeout(() => { vipFillEl.style.width = l.pct + '%'; }, 400);
}

/* ── Chat widget loader ──────────────────────────────────────────────────── */
function _loadChatWidget() {
    if (document.getElementById('_chatScript')) return;
    const base = location.pathname.includes('/html/') ? '..' : '.';
    const s = document.createElement('script');
    s.id  = '_chatScript';
    s.src = base + '/scripts/chat.js';
    document.body.appendChild(s);
}

/* ── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initJackpot();
    _loadChatWidget();
});

// VIP status viene popolato dopo che auth.js ha verificato la sessione
document.addEventListener('authReady', () => {
    initVipStatus();
});
