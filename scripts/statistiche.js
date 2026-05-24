'use strict';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function formatCurrency(n) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n ?? 0);
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

function sanitize(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

/* ── Popola profilo ──────────────────────────────────────────────────────── */
function populateProfile(user) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('userName',    user.username);
    set('userBalance', formatCurrency(user.balance));
    set('userEmail',   user.email || 'Non impostata');
    set('lastLogin',   formatDate(user.lastLogin));
    set('joinDate',    formatDate(user.createdAt));

    const vipEl = document.getElementById('userVip');
    if (vipEl) {
        const levels = { standard: 'Standard', silver: 'Silver', gold: 'VIP Gold', platinum: 'Platinum' };
        vipEl.textContent = levels[user.vipLevel] || 'Standard';
    }
}

/* ── Statistiche aggregate ───────────────────────────────────────────────── */
function _formatPlayTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function populateStats(user) {
    const s = user.stats || { gamesPlayed: 0, gamesWon: 0, totalWon: 0, totalLost: 0 };
    const winRate = s.gamesPlayed ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('gamesPlayed', s.gamesPlayed.toLocaleString('it-IT'));
    set('gamesWon',    s.gamesWon.toLocaleString('it-IT'));
    set('winRate',     winRate + '%');
    set('totalWon',    formatCurrency(s.totalWon));
    set('totalLost',   formatCurrency(s.totalLost));
    set('netProfit',   formatCurrency((s.totalWon ?? 0) - (s.totalLost ?? 0)));
    set('playTime',    _formatPlayTime(user.playTime ?? 0));

    const netEl = document.getElementById('netProfit');
    if (netEl) {
        const net = (s.totalWon || 0) - (s.totalLost || 0);
        netEl.style.color = net >= 0 ? 'var(--color-text-success, #22c55e)' : 'var(--color-text-danger, #ef4444)';
    }
}

/* ── Grafico torta vittorie/sconfitte ────────────────────────────────────── */
function buildWinLossChart(user) {
    const canvas = document.getElementById('winLossChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const s    = user.stats || { gamesPlayed: 0, gamesWon: 0 };
    const won  = s.gamesWon || 0;
    const lost = Math.max(0, (s.gamesPlayed || 0) - won);

    new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Vinte', 'Perse'],
            datasets: [{
                data: [won, lost],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderColor: 'transparent',
                borderWidth: 0,
            }],
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#e0e0e0', font: { size: 13 }, padding: 16 } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${s.gamesPlayed ? Math.round(ctx.raw / s.gamesPlayed * 100) : 0}%)` } },
            },
        },
    });
}

/* ── Grafico lineare andamento saldo ─────────────────────────────────────── */
function buildBalanceChart(user) {
    const canvas = document.getElementById('balanceChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const history = (user.history || []).slice().reverse();
    if (history.length < 2) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Gioca qualche partita per vedere il grafico!', canvas.width / 2, 80);
        return;
    }

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: history.map((_, i) => `#${i + 1}`),
            datasets: [{
                label: 'Saldo (€)',
                data: history.map(h => h.balance ?? 0),
                borderColor: '#FFD700',
                backgroundColor: 'rgba(255,215,0,0.08)',
                borderWidth: 2,
                pointRadius: history.length < 20 ? 4 : 2,
                pointBackgroundColor: '#FFD700',
                fill: true,
                tension: 0.35,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
            },
            scales: {
                x: { ticks: { color: '#888', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#888', callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    });
}

/* ── Grafico a barre per gioco ───────────────────────────────────────────── */
function buildGameBreakdownChart(user) {
    const canvas = document.getElementById('gameBreakdownChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const history = user.history || [];
    if (!history.length) return;

    const games = {};
    history.forEach(h => {
        const g = h.game || 'altro';
        if (!games[g]) games[g] = { won: 0, lost: 0 };
        if ((h.profit || 0) > 0) games[g].won  += h.profit;
        else                      games[g].lost += Math.abs(h.profit || 0);
    });

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Object.keys(games).map(g => g.charAt(0).toUpperCase() + g.slice(1)),
            datasets: [
                { label: 'Vinto (€)', data: Object.values(games).map(g => +(g.won.toFixed(2))),  backgroundColor: 'rgba(34,197,94,0.7)'  },
                { label: 'Perso (€)', data: Object.values(games).map(g => +(g.lost.toFixed(2))), backgroundColor: 'rgba(239,68,68,0.7)' },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: { callbacks: { label: ctx => ` ${formatCurrency(ctx.raw)}` } },
            },
            scales: {
                x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#888', callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        },
    });
}

/* ── Tabella cronologia ───────────────────────────────────────────────────── */
function buildHistoryTable(user) {
    const tbody = document.querySelector('#historyTable tbody');
    if (!tbody) return;

    const history = (user.history || []).slice(0, 20);
    if (!history.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;">Nessuna partita registrata</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(h => {
        const profit = h.profit ?? 0;
        const color  = profit > 0 ? '#22c55e' : profit < 0 ? '#ef4444' : '#888';
        const sign   = profit > 0 ? '+' : '';
        const game   = sanitize((h.game || 'altro').charAt(0).toUpperCase() + (h.game || 'altro').slice(1));
        return `<tr>
            <td>${formatDate(h.date)}</td>
            <td>${game}</td>
            <td>${formatCurrency(h.bet)}</td>
            <td>${formatCurrency(h.payout)}</td>
            <td style="color:${color};font-weight:500">${sign}${formatCurrency(profit)}</td>
            <td>${formatCurrency(h.balance)}</td>
        </tr>`;
    }).join('');
}

function _buildCharts(user) {
    buildWinLossChart(user);
    buildBalanceChart(user);
    buildGameBreakdownChart(user);
}

/* ── Inizializzazione ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    // Assicura che la sessione PHP sia verificata prima di procedere
    if (typeof checkSession === 'function') await checkSession();

    let user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Carica dati completi (profilo + statistiche + cronologia) dal DB
    if (typeof fetchFullUserData === 'function') {
        const fullData = await fetchFullUserData();
        if (fullData) user = fullData;
    }

    populateProfile(user);
    populateStats(user);
    buildHistoryTable(user);

    if (typeof Chart !== 'undefined') {
        _buildCharts(user);
    } else {
        window.addEventListener('load', () => {
            if (typeof Chart !== 'undefined') _buildCharts(user);
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof authLogout === 'function') authLogout();
        });
    }
});
