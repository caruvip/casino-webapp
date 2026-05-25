/**
 * admin.js — 777Casino Admin Panel
 * Dipende da: supabase-client.js (_sb globale)
 * Auth: Supabase Auth + admin_users table
 */

'use strict';

const GAMES = [
    { name: 'Blackjack',    rtp: 99.5, icon: '🃏' },
    { name: 'Roulette',     rtp: 97.3, icon: '🎡' },
    { name: 'Slot 777',     rtp: 96.0, icon: '🎰' },
    { name: 'Poker',        rtp: 98.5, icon: '🤠' },
    { name: 'Rocket Cash',  rtp: 97.0, icon: '🚀' },
];

let globalUsers        = [];
let globalTransactions = [];
let globalBonuses      = [];
let globalSettings     = {};

/* ════════════════════════════════════════════════════
   AUTH
   ════════════════════════════════════════════════════ */
async function adminLogin() {
    const email = document.getElementById('adminUser').value.trim();
    const pass  = document.getElementById('adminPass').value;
    const errEl = document.getElementById('loginError');
    if (!email || !pass) { errEl.textContent = '⚠ Inserisci email e password'; return; }

    const { data, error } = await _sb.auth.signInWithPassword({ email, password: pass });
    if (error || !data.session) {
        errEl.textContent = '✗ Credenziali non valide';
        return;
    }

    const { data: isAdmin } = await _sb.rpc('check_admin');
    if (!isAdmin) {
        await _sb.auth.signOut();
        errEl.textContent = '✗ Account non autorizzato come admin';
        return;
    }

    const username = data.user.user_metadata?.username || email.split('@')[0];
    _showAdminPanel(username);
    toast('Login effettuato con successo', 'success');
    initPanel();
}

async function adminLogout() {
    await _sb.auth.signOut();
    _hideAdminPanel();
}

function _showAdminPanel(username) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminShell').classList.remove('hidden');
    document.getElementById('sidebarAdminName').textContent = username;
}

function _hideAdminPanel() {
    document.getElementById('adminShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminUser').value  = '';
    document.getElementById('adminPass').value  = '';
    document.getElementById('loginError').textContent = '';
}

/* ════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════ */
async function initPanel() {
    startClock();
    showSection('dashboard');
    await refreshAllData();
    startLiveActivity();
    _startAdminChatGlobalSubscription();
}

async function refreshAllData() {
    await Promise.all([
        populateDashboard(),
        populateUsers(),
        populateTransactions(),
        populateBonuses(),
        populateAdminChat(),
        populateTavoli(),
        populateMaintenance(),
        populateLogs(),
        populateSettings(),
    ]);
}

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
        const { data: isAdmin } = await _sb.rpc('check_admin');
        if (isAdmin) {
            const username = session.user.user_metadata?.username || session.user.email.split('@')[0];
            _showAdminPanel(username);
            initPanel();
        } else {
            await _sb.auth.signOut();
            _hideAdminPanel();
        }
    } else {
        _hideAdminPanel();
    }

    document.getElementById('adminPass').addEventListener('keydown', e => {
        if (e.key === 'Enter') adminLogin();
    });
    document.getElementById('adminUser').addEventListener('keydown', e => {
        if (e.key === 'Enter') adminLogin();
    });
});

/* ════════════════════════════════════════════════════
   CLOCK
   ════════════════════════════════════════════════════ */
function startClock() {
    const el = document.getElementById('topbarTime');
    if (!el) return;
    const tick = () => { el.textContent = new Date().toLocaleTimeString('it-IT'); };
    tick();
    setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════════════ */
const SECTION_TITLES = {
    dashboard:    ['Overview',              'Dashboard / Overview'],
    live:         ['🔴 Live Feed',          'Dashboard / Live Feed'],
    users:        ['Utenti',               'Dashboard / Utenti'],
    transactions: ['Transazioni',          'Dashboard / Transazioni'],
    bonuses:      ['Bonus',               'Dashboard / Bonus'],
    chat:         ['💬 Chat Live',          'Dashboard / Chat Live'],
    analytics:    ['Analisi Giochi',      'Dashboard / Analytics'],
    revenue:      ['Revenue',             'Dashboard / Revenue'],
    tavoli:       ['Tavoli',              'Dashboard / Tavoli'],
    maintenance:  ['Manutenzione',        'Dashboard / Manutenzione'],
    logs:         ['Activity Log',        'Dashboard / Logs'],
    settings:     ['Impostazioni',        'Dashboard / Impostazioni'],
};

function showSection(id) {
    document.querySelectorAll('.adm-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));

    const sec = document.getElementById('sec-' + id);
    if (sec) sec.classList.add('active');

    const titles = SECTION_TITLES[id] || [id, id];
    const titleEl      = document.getElementById('pageTitle');
    const breadcrumbEl = document.getElementById('pageBreadcrumb');
    if (titleEl)      titleEl.textContent      = titles[0];
    if (breadcrumbEl) breadcrumbEl.textContent = titles[1];

    document.querySelectorAll('.adm-nav-item').forEach(n => {
        if (n.getAttribute('onclick')?.includes(`'${id}'`)) n.classList.add('active');
    });

    if (id === 'analytics') drawCharts();
    if (id === 'revenue')   drawRevenueChart();
    if (id === 'logs')      populateLogs();
    if (id === 'tavoli')    populateTavoli();

    if (id === 'live') startLivePolling();
    else stopLivePolling();

    if (id === 'chat') populateAdminChat();
}

function fmt(n) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}
function fmtDate(iso) {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

/* ════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════ */
async function populateDashboard() {
    const { data, error } = await _sb.rpc('get_admin_dashboard');
    if (error || !data) return;

    document.getElementById('kpiUsers').textContent        = data.kpiUsers;
    document.getElementById('kpiUsersDelta').textContent   = `+0 oggi`;
    document.getElementById('kpiRevenue').textContent      = fmt(data.kpiRevenue);
    document.getElementById('kpiRevenueDelta').textContent = 'GGR Totale';
    document.getElementById('kpiBets').textContent         = (data.kpiBets || 0).toLocaleString();
    document.getElementById('kpiOnline').textContent       = data.kpiOnline;

    const badgeUsers = document.getElementById('badgeUsers');
    if (badgeUsers) badgeUsers.textContent = data.kpiUsers;

    const list = document.getElementById('activityList');
    if (list && data.activity) {
        list.innerHTML = data.activity.map(e => `
            <div class="activity-item type-${e.type}">
                <span class="activity-user">@${e.user}</span>
                <span class="activity-detail">${e.detail}</span>
                <span class="activity-time">${e.time}</span>
            </div>`).join('');
    }

    const gamesVolume = data.gamesVolume || [];
    const max = Math.max(...gamesVolume.map(g => g.vol), 1);
    const el = document.getElementById('topGamesList');
    if (el) {
        el.innerHTML = gamesVolume.sort((a, b) => b.vol - a.vol).map(g => {
            const icon = GAMES.find(x => x.name.toLowerCase() === g.name.toLowerCase())?.icon || '🎮';
            const pct  = Math.round(g.vol / max * 100);
            return `
            <div class="tg-item">
                <span class="tg-name">${icon} ${g.name}</span>
                <div class="tg-bar-wrap"><div class="tg-bar" style="width:${pct}%"></div></div>
                <span class="tg-pct">${fmt(g.vol)}</span>
            </div>`;
        }).join('');
    }

    const vipCounts = data.vipCounts || {};
    const total = data.kpiUsers || 1;
    const vipEl = document.getElementById('vipBars');
    if (vipEl) {
        vipEl.innerHTML = Object.entries(vipCounts).map(([k, v]) => `
            <div class="vip-bar-item">
                <span class="vip-bar-label">${k.charAt(0).toUpperCase() + k.slice(1)}</span>
                <div class="vip-bar-wrap">
                    <div class="vip-bar-fill vip-bar-${k}" style="width:${Math.round(v / total * 100)}%"></div>
                </div>
                <span class="vip-bar-count">${v}</span>
            </div>`).join('');
    }

    const alertsList = document.getElementById('alertsList');
    if (alertsList) {
        alertsList.innerHTML = `
            <div class="alert-item info">
                <span class="alert-icon">ℹ️</span>
                <div class="alert-text"><strong>Database Supabase</strong> — Connesso e operativo.</div>
            </div>
            <div class="alert-item info">
                <span class="alert-icon">ℹ️</span>
                <div class="alert-text"><strong>Auth System</strong> — Sessioni JWT attive.</div>
            </div>`;
    }
}

function startLiveActivity() {
    setInterval(async () => {
        const activeSec = document.querySelector('.adm-section.active');
        if (activeSec?.id === 'sec-dashboard') await populateDashboard();
    }, 10000);
}

/* ════════════════════════════════════════════════════
   UTENTI
   ════════════════════════════════════════════════════ */
async function populateUsers(filter = 'all', search = '') {
    const { data, error } = await _sb.rpc('get_admin_users');
    if (error || !data) return;
    globalUsers = data;

    let filtered = [...globalUsers];
    if (filter === 'active') filtered = filtered.filter(u => u.status !== 'banned');
    if (filter === 'banned') filtered = filtered.filter(u => u.status === 'banned');
    if (filter === 'vip')    filtered = filtered.filter(u => ['gold', 'platinum'].includes(u.vipLevel));
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }

    const tbody = document.getElementById('usersTableBody');
    if (tbody) {
        tbody.innerHTML = filtered.map((u, i) => `
            <tr>
                <td><span style="font-family:var(--font-mono);color:var(--text-secondary);">#${i + 1}</span></td>
                <td>
                    <div style="font-weight:600;">${u.username}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${u.email || '—'}</div>
                </td>
                <td style="color:var(--text-secondary);">${u.email || '—'}</td>
                <td><span style="font-family:var(--font-mono);font-weight:700;color:var(--accent);">${fmt(u.balance)}</span></td>
                <td><span class="badge badge-${u.vipLevel || 'standard'}">${(u.vipLevel || 'standard').toUpperCase()}</span></td>
                <td><span style="font-family:var(--font-mono);">${u.stats?.gamesPlayed || 0}</span></td>
                <td><span class="badge badge-${u.status === 'banned' ? 'banned' : 'active'}">${u.status === 'banned' ? 'Bannato' : 'Attivo'}</span></td>
                <td style="color:var(--text-secondary);font-size:12px;">${fmtDate(u.createdAt)}</td>
                <td>
                    <div class="tbl-actions">
                        <button class="tbl-btn" onclick="openUserModal('${u.username}')">Dettagli</button>
                        <button class="tbl-btn gold" onclick="giveBonus('${u.username}')">Bonus</button>
                        ${u.status === 'banned'
                            ? `<button class="tbl-btn green" onclick="toggleBan('${u.username}', 'active')">Sbanna</button>`
                            : `<button class="tbl-btn red"   onclick="toggleBan('${u.username}', 'banned')">Banna</button>`}
                    </div>
                </td>
            </tr>`).join('');
    }
}

function filterUsers() {
    populateUsers(
        document.getElementById('userFilter').value,
        document.getElementById('userSearch').value
    );
}

async function toggleBan(username, newStatus) {
    const { data, error } = await _sb.rpc('admin_update_user', {
        p_username: username, p_action: 'set_status', p_value: newStatus
    });
    if (!error && data?.ok) {
        toast(`Utente ${username} ${newStatus === 'banned' ? 'bannato' : 'sbannato'}`, newStatus === 'banned' ? 'error' : 'success');
        await populateUsers();
        await populateDashboard();
    } else {
        toast('Errore: impossibile modificare lo stato utente', 'error');
    }
}

async function giveBonus(username) {
    const amount = parseFloat(prompt(`Importo bonus per @${username} (€):`));
    if (!amount || isNaN(amount) || amount <= 0) return;
    const { data, error } = await _sb.rpc('admin_update_user', {
        p_username: username, p_action: 'give_bonus', p_value: String(amount)
    });
    if (!error && data?.ok) {
        toast(`Bonus di ${fmt(amount)} assegnato a @${username}`, 'success');
        await populateUsers();
        await populateDashboard();
    } else {
        toast('Errore: impossibile assegnare il bonus — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

function openUserModal(username) {
    const u = globalUsers.find(x => x.username === username);
    if (!u) return;
    document.getElementById('userModalTitle').textContent = `Utente: @${u.username}`;
    const winRate = u.stats?.gamesPlayed ? Math.round(u.stats.gamesWon / u.stats.gamesPlayed * 100) : 0;

    document.getElementById('userModalBody').innerHTML = `
        <div class="user-detail-grid">
            <div class="user-detail-item"><div class="udl">Username</div><div class="udv">@${u.username}</div></div>
            <div class="user-detail-item"><div class="udl">Email</div><div class="udv">${u.email || '—'}</div></div>
            <div class="user-detail-item"><div class="udl">Saldo</div><div class="udv" style="color:var(--accent)">${fmt(u.balance)}</div></div>
            <div class="user-detail-item"><div class="udl">VIP Level</div><div class="udv">${u.vipLevel || 'standard'}</div></div>
            <div class="user-detail-item"><div class="udl">Stato</div><div class="udv">${u.status === 'banned' ? '🔴 Bannato' : '🟢 Attivo'}</div></div>
            <div class="user-detail-item"><div class="udl">Registrato</div><div class="udv" style="font-size:13px;">${fmtDate(u.createdAt)}</div></div>
            <div class="user-detail-item"><div class="udl">Win Rate</div><div class="udv" style="color:var(--green)">${winRate}%</div></div>
            <div class="user-detail-item"><div class="udl">Partite Giocate</div><div class="udv">${u.stats?.gamesPlayed || 0}</div></div>
            <div class="user-detail-item"><div class="udl">Totale Vinto</div><div class="udv" style="color:var(--green)">${fmt(u.stats?.totalWon)}</div></div>
            <div class="user-detail-item"><div class="udl">Totale Scommesso</div><div class="udv" style="color:var(--red)">${fmt(u.stats?.totalLost)}</div></div>
            <div class="user-detail-item"><div class="udl">Profitto Casino</div><div class="udv" style="color:var(--accent)">${fmt((u.stats?.totalLost || 0) - (u.stats?.totalWon || 0))}</div></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">
            <button class="adm-btn adm-btn-primary" onclick="giveBonus('${u.username}');closeModal('userModal')">💰 Assegna Bonus</button>
            <button class="adm-btn ${u.status === 'banned' ? 'adm-btn-primary' : 'adm-btn-danger'}" onclick="toggleBan('${u.username}','${u.status === 'banned' ? 'active' : 'banned'}');closeModal('userModal')">
                ${u.status === 'banned' ? '✅ Sbanna' : '🚫 Banna'}
            </button>
            <button class="adm-btn" onclick="setUserBalance('${u.username}')">✏️ Modifica Saldo</button>
            <button class="adm-btn" onclick="setUserVip('${u.username}')">⭐ Cambia VIP</button>
            <button class="adm-btn adm-btn-danger" onclick="deleteUser('${u.username}')">🗑️ Elimina Account</button>
        </div>`;
    document.getElementById('userModal').classList.remove('hidden');
}

async function setUserBalance(username) {
    const amount = parseFloat(prompt(`Nuovo saldo per @${username} (€):`));
    if (isNaN(amount) || amount < 0) return;
    const { data, error } = await _sb.rpc('admin_update_user', {
        p_username: username, p_action: 'set_balance', p_value: String(amount)
    });
    if (!error && data?.ok) {
        toast(`Saldo di @${username} aggiornato a ${fmt(amount)}`, 'success');
        closeModal('userModal');
        await populateUsers();
        await populateDashboard();
    } else {
        toast('Errore: impossibile modificare il saldo — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function setUserVip(username) {
    const level = prompt(`Livello VIP per @${username} (standard/silver/gold/platinum):`);
    if (!['standard', 'silver', 'gold', 'platinum'].includes(level)) return;
    const { data, error } = await _sb.rpc('admin_update_user', {
        p_username: username, p_action: 'set_vip', p_value: level
    });
    if (!error && data?.ok) {
        toast(`VIP di @${username} aggiornato a ${level}`, 'success');
        closeModal('userModal');
        await populateUsers();
    } else {
        toast('Errore: impossibile modificare il livello VIP — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function deleteUser(username) {
    if (!confirm(`Eliminare definitivamente l'utente @${username}?`)) return;
    const { data, error } = await _sb.rpc('admin_update_user', {
        p_username: username, p_action: 'delete'
    });
    if (!error && data?.ok) {
        toast(`Account @${username} eliminato`, 'error');
        closeModal('userModal');
        await populateUsers();
        await populateDashboard();
    } else {
        toast('Errore: impossibile eliminare l\'utente — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function openCreateUser() {
    toast('Per creare un utente usa la pagina Registrati del sito.', 'info');
}

function exportUsers() {
    const csv = ['ID,Username,Email,Saldo,VIP,Stato,Registrato',
        ...globalUsers.map(u => `${u.id},${u.username},${u.email},${u.balance},${u.vipLevel},${u.status},${u.createdAt}`)
    ].join('\n');
    downloadFile('utenti_casino.csv', csv, 'text/csv');
    toast('Esportazione CSV completata', 'success');
}

/* ════════════════════════════════════════════════════
   TRANSAZIONI
   ════════════════════════════════════════════════════ */
async function populateTransactions(filter = 'all', search = '') {
    const { data, error } = await _sb.rpc('admin_get_transactions');
    if (error || !data) return;
    globalTransactions = data;

    let filtered = [...globalTransactions];
    if (filter !== 'all') filtered = filtered.filter(t => t.type === filter);
    if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(t =>
            t.username.toLowerCase().includes(q) || String(t.amount).includes(q)
        );
    }

    const tbody = document.getElementById('txTableBody');
    if (tbody) {
        tbody.innerHTML = filtered.map(t => `
            <tr>
                <td><span style="font-family:var(--font-mono);color:var(--text-secondary);">#${t.id}</span></td>
                <td style="font-weight:600;">@${t.username}</td>
                <td><span class="badge badge-${t.type}">${t.type}</span></td>
                <td><span style="font-family:var(--font-mono);font-weight:700;color:${t.type === 'prelievo' ? 'var(--red)' : 'var(--green)'};">
                    ${t.type === 'prelievo' ? '-' : '+'} ${fmt(t.amount)}</span></td>
                <td><span class="badge badge-${t.status}">${t.status}</span></td>
                <td style="color:var(--text-secondary);font-size:12px;">${fmtDate(t.date)}</td>
                <td>
                    <div class="tbl-actions">
                        ${t.status === 'pending'
                            ? `<button class="tbl-btn green" onclick="approveTx(${t.id})">Approva</button>
                               <button class="tbl-btn red"   onclick="rejectTx(${t.id})">Rifiuta</button>`
                            : '<span style="color:var(--text-muted);font-size:11px;">—</span>'}
                    </div>
                </td>
            </tr>`).join('');
    }
}

function filterTransactions() {
    populateTransactions(
        document.getElementById('txFilter').value,
        document.getElementById('txSearch').value
    );
}

async function approveTx(id) {
    const { data, error } = await _sb.rpc('admin_update_transaction', { p_id: id, p_status: 'completed' });
    if (!error && data?.ok) {
        toast('Transazione approvata', 'success');
        await populateTransactions();
        await populateDashboard();
    } else {
        toast('Errore: impossibile approvare la transazione — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function rejectTx(id) {
    const { data, error } = await _sb.rpc('admin_update_transaction', { p_id: id, p_status: 'failed' });
    if (!error && data?.ok) {
        toast('Transazione rifiutata', 'error');
        await populateTransactions();
        await populateDashboard();
    } else {
        toast('Errore: impossibile rifiutare la transazione — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

function exportTransactions() {
    const csv = ['ID,Utente,Tipo,Importo,Stato,Data',
        ...globalTransactions.map(t => `${t.id},${t.username},${t.type},${t.amount},${t.status},${t.date}`)
    ].join('\n');
    downloadFile('transazioni_casino.csv', csv, 'text/csv');
    toast('Esportazione transazioni completata', 'success');
}

/* ════════════════════════════════════════════════════
   BONUS
   ════════════════════════════════════════════════════ */
async function populateBonuses() {
    const { data, error } = await _sb
        .from('bonuses')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return;
    globalBonuses = data || [];

    const grid = document.getElementById('bonusGrid');
    if (grid) {
        grid.innerHTML = globalBonuses.map(b => `
            <div class="bonus-card">
                <div class="bonus-card-header">
                    <span class="bonus-card-name">${b.name}</span>
                    <span class="badge badge-${b.type}">${b.type}</span>
                </div>
                <div class="bonus-card-amount">${fmt(b.amount)}</div>
                <div class="bonus-card-meta">
                    Scadenza: ${b.expiry || 'Nessuna'}<br>
                    Utilizzi: ${b.uses}<br>
                    Stato: <strong style="color:${b.active ? 'var(--green)' : 'var(--red)'}">${b.active ? 'Attivo' : 'Disattivo'}</strong>
                </div>
                <div class="bonus-card-actions">
                    <button class="adm-btn" onclick="sendBonusToAll(${b.amount})">📤 Invia a tutti</button>
                    <button class="adm-btn adm-btn-danger" onclick="deleteBonus(${b.id})">🗑️</button>
                </div>
            </div>`).join('');
    }
}

function openAddBonus() { document.getElementById('bonusModal').classList.remove('hidden'); }

async function createBonus() {
    const name   = document.getElementById('bName').value;
    const amount = parseFloat(document.getElementById('bAmount').value);
    const type   = document.getElementById('bType').value;
    const expiry = document.getElementById('bExpiry').value || null;
    if (!name || !amount) { toast('Compila tutti i campi', 'error'); return; }

    const { error } = await _sb.from('bonuses').insert({ name, type, amount, expiry });
    if (!error) {
        closeModal('bonusModal');
        await populateBonuses();
        toast(`Bonus "${name}" creato`, 'success');
    } else {
        toast('Errore: impossibile creare il bonus — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function deleteBonus(id) {
    if (!confirm('Eliminare questo bonus?')) return;
    const { error } = await _sb.from('bonuses').delete().eq('id', id);
    if (!error) {
        await populateBonuses();
        toast('Bonus eliminato', 'success');
    } else {
        toast('Errore: impossibile eliminare il bonus — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function sendBonusToAll(amount) {
    const { data, error } = await _sb.rpc('admin_send_mass_bonus', { p_amount: amount });
    if (!error && data?.ok) {
        await populateUsers();
        await populateDashboard();
        toast(`Bonus ${fmt(amount)} inviato a tutti gli utenti`, 'success');
    } else {
        toast('Errore: impossibile inviare il bonus di massa — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function sendMassBonus() {
    const amount = parseFloat(prompt('Importo bonus di massa (€):'));
    if (!amount || amount <= 0) return;
    await sendBonusToAll(amount);
}

/* ════════════════════════════════════════════════════
   ANALYTICS & CHARTS
   ════════════════════════════════════════════════════ */
function drawCharts() {
    drawGamesBarChart();
    drawWinLossDonut();
    renderGameStats();
    renderRtpList();
}

function drawGamesBarChart() {
    const canvas = document.getElementById('gamesChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 600;
    const H = 260;
    canvas.width = W; canvas.height = H;

    const data = GAMES.map(g => {
        const uCount = globalUsers.reduce((acc, u) => acc + (u.stats?.gamesPlayed || 0), 0);
        return {
            name: g.icon + ' ' + g.name.split(' ')[0],
            value: Math.max(Math.floor(uCount * 0.2) + Math.floor(Math.random() * 50), 10)
        };
    });
    const max    = Math.max(...data.map(d => d.value), 1);
    const barW   = (W - 80) / data.length - 12;
    const colors = ['#e8b84b', '#4be8a0', '#4b9fe8', '#a04be8', '#e84b4b'];

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = 20 + (H - 60) * (i / 4);
        ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 10, y); ctx.stroke();
        ctx.fillStyle = 'rgba(107,114,128,0.8)'; ctx.font = '10px JetBrains Mono,monospace';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max * (1 - i / 4)), 54, y + 4);
    }

    data.forEach((d, i) => {
        const x  = 68 + i * (barW + 12);
        const bH = (d.value / max) * (H - 70);
        const y  = H - 40 - bH;
        const grad = ctx.createLinearGradient(0, y, 0, H - 40);
        grad.addColorStop(0, colors[i % colors.length]);
        grad.addColorStop(1, colors[i % colors.length] + '44');
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, bH, 4);
        else ctx.rect(x, y, barW, bH);
        ctx.fill();
        ctx.fillStyle = colors[i % colors.length]; ctx.font = 'bold 11px JetBrains Mono,monospace'; ctx.textAlign = 'center';
        ctx.fillText(d.value, x + barW / 2, y - 6);
        ctx.fillStyle = 'rgba(107,114,128,0.9)'; ctx.font = '10px Space Grotesk,sans-serif';
        ctx.fillText(d.name, x + barW / 2, H - 20);
    });
}

function drawWinLossDonut() {
    const canvas = document.getElementById('winLossChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 220; canvas.height = 220;
    const cx = 110, cy = 110, R = 80, r = 52;

    const won    = globalUsers.reduce((s, u) => s + (u.stats?.gamesWon || 0), 0);
    const played = globalUsers.reduce((s, u) => s + (u.stats?.gamesPlayed || 0), 0);
    const total  = played || 1;
    const slices = [
        { val: won, color: '#4be8a0', label: `Vinte (${Math.round(won / total * 100)}%)` },
        { val: Math.max(0, played - won), color: '#e84b4b', label: `Perse (${Math.round(Math.max(0, played - won) / total * 100)}%)` },
    ];

    ctx.clearRect(0, 0, 220, 220);
    let startAngle = -Math.PI / 2;
    slices.forEach(s => {
        const angle = (s.val / total) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, startAngle, startAngle + angle);
        ctx.closePath(); ctx.fillStyle = s.color; ctx.fill();
        startAngle += angle;
    });
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#0d1117'; ctx.fill();
    ctx.fillStyle = '#d4d8e0'; ctx.font = 'bold 18px Syne,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(played.toLocaleString(), cx, cy - 8);
    ctx.fillStyle = '#6b7280'; ctx.font = '10px Space Grotesk,sans-serif';
    ctx.fillText('partite', cx, cy + 10);

    const legend = document.getElementById('winLossLegend');
    if (legend) {
        legend.innerHTML = slices.map(s => `
            <div class="legend-item">
                <div class="legend-dot" style="background:${s.color}"></div>
                <span style="color:var(--text-secondary)">${s.label}</span>
            </div>`).join('');
    }
}

function renderGameStats() {
    const el = document.getElementById('gameStatsList');
    if (!el) return;
    el.innerHTML = GAMES.map(g => {
        const plays  = globalUsers.reduce((s, u) => s + Math.floor((u.stats?.gamesPlayed || 0) * 0.2), 0) + 12;
        const profit = globalUsers.reduce((s, u) => s + ((u.stats?.totalLost || 0) - (u.stats?.totalWon || 0)) * 0.2, 0) + 5;
        return `<div class="game-stat-item">
            <span class="game-stat-name">${g.icon} ${g.name}</span>
            <span class="game-stat-plays">${plays}</span>
            <span class="game-stat-rev">${fmt(profit)}</span>
        </div>`;
    }).join('');
}

function renderRtpList() {
    const el = document.getElementById('rtpList');
    if (!el) return;
    el.innerHTML = GAMES.map(g => {
        const settingRtp = globalSettings['rtp_' + g.name] || g.rtp;
        const actual = Math.round((settingRtp - Math.random() * 2 + 0.5) * 10) / 10;
        return `<div class="rtp-item">
            <span class="rtp-game">${g.icon} ${g.name}</span>
            <div class="rtp-bar-wrap">
                <div class="rtp-track" title="Teorico: ${settingRtp}%">
                    <div class="rtp-fill" style="width:${settingRtp}%"></div>
                </div>
                <div class="rtp-track" style="margin-top:3px;" title="Effettivo: ${actual}%">
                    <div class="rtp-fill rtp-fill-actual" style="width:${actual}%"></div>
                </div>
            </div>
            <span class="rtp-val">${actual}%</span>
        </div>`;
    }).join('');
}

/* ════════════════════════════════════════════════════
   REVENUE
   ════════════════════════════════════════════════════ */
function populateRevenue() {
    const totalBal = globalUsers.reduce((s, u) => s + (u.balance || 0), 0);
    const avgBal   = globalUsers.length ? totalBal / globalUsers.length : 0;
    const ggr      = globalUsers.reduce((s, u) => s + ((u.stats?.totalLost || 0) - (u.stats?.totalWon || 0)), 0);

    document.getElementById('revToday').textContent  = fmt(ggr * 0.05);
    document.getElementById('revWeek').textContent   = fmt(ggr * 0.35);
    document.getElementById('revMonth').textContent  = fmt(ggr);
    document.getElementById('revAvgBal').textContent = fmt(avgBal);

    const sorted = [...globalUsers].sort((a, b) => (b.stats?.totalLost || 0) - (a.stats?.totalLost || 0)).slice(0, 10);
    const tbody = document.getElementById('topSpendersBody');
    if (tbody) {
        tbody.innerHTML = sorted.map((u, i) => `
            <tr>
                <td><strong style="color:var(--accent)">#${i + 1}</strong></td>
                <td style="font-weight:600;">@${u.username}</td>
                <td style="font-family:var(--font-mono);">${fmt(u.stats?.totalLost || 0)}</td>
                <td style="font-family:var(--font-mono);color:var(--green);">${fmt(u.stats?.totalWon || 0)}</td>
                <td style="font-family:var(--font-mono);color:var(--accent);">${fmt((u.stats?.totalLost || 0) - (u.stats?.totalWon || 0))}</td>
                <td><span class="badge badge-${u.vipLevel || 'standard'}">${u.vipLevel || 'standard'}</span></td>
            </tr>`).join('');
    }
}

function drawRevenueChart() {
    populateRevenue();
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 800;
    const H = 280;
    canvas.width = W; canvas.height = H;

    const ggr  = globalUsers.reduce((s, u) => s + ((u.stats?.totalLost || 0) - (u.stats?.totalWon || 0)), 0);
    const days = Array.from({ length: 30 }, (_, i) => ({
        label: `${i + 1}`,
        val: Math.max(50, Math.round((ggr / 30 * (0.5 + Math.random())) * 100) / 100)
    }));
    const max  = Math.max(...days.map(d => d.val), 100) * 1.2;
    const padL = 60, padR = 20, padT = 20, padB = 40;
    const gW = W - padL - padR, gH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i <= 5; i++) {
        const y = padT + gH * (i / 5);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillStyle = '#6b7280'; ctx.font = '10px JetBrains Mono,monospace'; ctx.textAlign = 'right';
        ctx.fillText(fmt(max * (1 - i / 5)).replace('€', '€ '), padL - 6, y + 4);
    }

    const pts = days.map((d, i) => ({
        x: padL + (i / (days.length - 1)) * gW,
        y: padT + gH * (1 - d.val / max)
    }));
    const grad = ctx.createLinearGradient(0, padT, 0, padT + gH);
    grad.addColorStop(0, 'rgba(232,184,75,0.25)');
    grad.addColorStop(1, 'rgba(232,184,75,0.0)');
    ctx.beginPath(); ctx.moveTo(pts[0].x, padT + gH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padT + gH);
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#e8b84b'; ctx.lineWidth = 2; ctx.stroke();

    pts.forEach((p, i) => {
        if (i % 5 === 0) {
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#e8b84b'; ctx.fill();
        }
    });
    days.forEach((d, i) => {
        if (i % 5 === 0) {
            ctx.fillStyle = '#6b7280'; ctx.font = '10px Space Grotesk,sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(d.label + 'gg', pts[i].x, H - 10);
        }
    });
}

/* ════════════════════════════════════════════════════
   TAVOLI (da casino_v1)
   ════════════════════════════════════════════════════ */
async function populateTavoli() {
    const { data, error } = await _sb.rpc('admin_get_tavolo');
    if (error || !data) return;

    const tbody = document.getElementById('tavoliTableBody');
    if (!tbody) return;

    tbody.innerHTML = data.map(t => `
        <tr>
            <td><span style="font-family:var(--font-mono);color:var(--text-secondary);">#${t.id}</span></td>
            <td style="font-weight:600;">${t.nome_tavolo}</td>
            <td>${t.nome_gioco}</td>
            <td>
                <input type="number" id="tmin_${t.id}" value="${t.limite_min}" min="1" max="10000"
                    style="width:70px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 6px;border-radius:4px;">
            </td>
            <td>
                <input type="number" id="tmax_${t.id}" value="${t.limite_max}" min="1" max="100000"
                    style="width:80px;background:var(--bg-tertiary);border:1px solid var(--border);color:var(--text-primary);padding:4px 6px;border-radius:4px;">
            </td>
            <td>${t.max_giocatori}</td>
            <td>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="tattivo_${t.id}" ${t.attivo ? 'checked' : ''}>
                    <span class="badge badge-${t.attivo ? 'active' : 'banned'}">${t.attivo ? 'Aperto' : 'Chiuso'}</span>
                </label>
            </td>
            <td>
                <button class="tbl-btn green" onclick="updateTavolo(${t.id})">Salva</button>
            </td>
        </tr>`).join('');
}

async function refreshTavoli() {
    await populateTavoli();
    toast('Tavoli aggiornati', 'success');
}

async function updateTavolo(id) {
    const min    = parseInt(document.getElementById(`tmin_${id}`)?.value) || 5;
    const max    = parseInt(document.getElementById(`tmax_${id}`)?.value) || 1000;
    const attivo = document.getElementById(`tattivo_${id}`)?.checked ?? true;

    if (min >= max) { toast('Il minimo deve essere inferiore al massimo', 'error'); return; }

    const { data, error } = await _sb.rpc('admin_update_tavolo', {
        p_id: id, p_min: min, p_max: max, p_attivo: attivo
    });
    if (!error && data?.ok) {
        toast(`Tavolo #${id} aggiornato`, 'success');
        await populateTavoli();
    } else {
        toast('Errore aggiornamento tavolo', 'error');
    }
}

/* ════════════════════════════════════════════════════
   MANUTENZIONE
   ════════════════════════════════════════════════════ */
async function populateMaintenance() {
    const { data, error } = await _sb
        .from('impostazioni_sistema')
        .select('chiave, valore');
    if (error) return;

    const settings = {};
    (data || []).forEach(r => { settings[r.chiave] = r.valore; });

    const get = k => settings[k];
    const maintMode = document.getElementById('maintMode');
    if (maintMode) maintMode.checked = get('manutenzione') === '1';
    const blockReg = document.getElementById('blockRegister');
    if (blockReg) blockReg.checked = get('blocco_registrazioni') === '1';
    const blockWith = document.getElementById('blockWithdrawal');
    if (blockWith) blockWith.checked = get('blocco_prelievi') === '1';
    const onlyVip = document.getElementById('onlyVip');
    if (onlyVip) onlyVip.checked = get('solo_vip') === '1';
    const maintMsg = document.getElementById('maintMsg');
    if (maintMsg) maintMsg.value = get('messaggio_manutenzione') || '';

    const services = [
        { name: 'Database (Supabase)', status: 'online', label: 'Operativo' },
        { name: 'Auth System (JWT)',   status: 'online', label: 'Operativo' },
        { name: 'Game Engine',         status: 'online', label: 'Operativo' },
        { name: 'Payment Gateway',     status: 'online', label: 'Operativo' },
        { name: 'CDN / Assets',        status: 'online', label: 'Operativo' },
        { name: 'Admin Panel',         status: 'online', label: 'Operativo' },
    ];
    document.getElementById('servicesList').innerHTML = services.map(s => `
        <div class="service-item">
            <div class="svc-status svc-${s.status}"></div>
            <span class="svc-name">${s.name}</span>
            <span class="svc-label">${s.label}</span>
        </div>`).join('');

    document.getElementById('sysInfoList').innerHTML = [
        ['Versione',   '2.1.0'],
        ['Ambiente',   'Produzione (Supabase)'],
        ['Utenti nel DB', globalUsers.length || '—'],
        ['Browser', navigator.userAgent.split(' ').pop()],
    ].map(([k, v]) => `<div class="sys-info-item"><span>${k}</span><span>${v}</span></div>`).join('');
}

async function toggleMaint() { await saveMaintSettings(); }

async function saveMaintSettings() {
    const settings = {
        manutenzione:          document.getElementById('maintMode').checked    ? '1' : '0',
        blocco_registrazioni:  document.getElementById('blockRegister').checked ? '1' : '0',
        blocco_prelievi:       document.getElementById('blockWithdrawal').checked ? '1' : '0',
        solo_vip:              document.getElementById('onlyVip').checked      ? '1' : '0',
        messaggio_manutenzione: document.getElementById('maintMsg').value,
    };
    const { data, error } = await _sb.rpc('admin_save_settings', { p_settings: settings });
    if (!error && data?.ok) {
        toast('Impostazioni manutenzione salvate', 'success');
        await populateMaintenance();
    } else {
        toast('Errore: impossibile salvare le impostazioni — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

function clearCache() { toast('Cache sistema svuotata con successo', 'success'); }

async function resetAllBalances() {
    if (!confirm('Ripristinare il saldo di tutti gli utenti a €1.000?')) return;
    const { data, error } = await _sb.rpc('admin_reset_balances');
    if (!error && data?.ok) {
        toast('Tutti i saldi utente resettati a €1.000', 'success');
        await refreshAllData();
    } else {
        toast('Errore: impossibile resettare i saldi — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function exportFullBackup() {
    const backup = {
        exportedAt:   new Date().toISOString(),
        users:        globalUsers,
        transactions: globalTransactions,
        bonuses:      globalBonuses,
        settings:     globalSettings
    };
    downloadFile(`backup_casino_${Date.now()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    toast('Backup completo esportato con successo', 'success');
}

function confirmNukeUsers() {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmText').textContent =
        'Questa azione eliminerà TUTTI gli utenti dal database in modo IRREVERSIBILE. Sei sicuro?';
    document.getElementById('confirmOkBtn').onclick = async () => {
        const { data, error } = await _sb.rpc('admin_nuke_users');
        if (!error && data?.ok) {
            closeModal('confirmModal');
            await refreshAllData();
            toast('Tutti gli utenti eliminati dal database', 'error');
        } else {
            toast('Errore: impossibile eliminare gli utenti — ' + (error?.message || 'operazione fallita'), 'error');
        }
    };
    modal.classList.remove('hidden');
}

/* ════════════════════════════════════════════════════
   LOGS
   ════════════════════════════════════════════════════ */
async function populateLogs(filter = 'all') {
    const { data, error } = await _sb.rpc('admin_get_logs');
    if (error || !data) return;

    let logs = data;
    if (filter !== 'all') logs = logs.filter(l => l.type === filter);

    const el = document.getElementById('logLines');
    if (el) {
        el.innerHTML = logs.map(l => {
            const time = new Date(l.time).toLocaleTimeString('it-IT');
            const date = new Date(l.time).toLocaleDateString('it-IT');
            return `<div class="log-line ${l.type}"><span class="log-timestamp">[${date} ${time}]</span> <span>[${l.type.toUpperCase()}]</span> ${l.message}</div>`;
        }).join('');
        const term = document.getElementById('logTerminal');
        if (term) term.scrollTop = term.scrollHeight;
    }
}

function filterLogs() {
    populateLogs(document.getElementById('logFilter').value);
}

async function clearLogs() {
    if (!confirm('Svuotare tutti i log?')) return;
    const { data, error } = await _sb.rpc('admin_clear_logs');
    if (!error && data?.ok) {
        await populateLogs();
        toast('Log svuotati', 'success');
    } else {
        toast('Errore: impossibile svuotare i log — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function exportLogs() {
    const { data, error } = await _sb.rpc('admin_get_logs');
    if (error || !data) return;
    const txt = data.map(l => `[${l.time}] [${l.type}] ${l.message}`).join('\n');
    downloadFile(`log_casino_${Date.now()}.txt`, txt, 'text/plain');
    toast('Log esportati con successo', 'success');
}

/* ════════════════════════════════════════════════════
   IMPOSTAZIONI
   ════════════════════════════════════════════════════ */
async function populateSettings() {
    const { data, error } = await _sb
        .from('impostazioni_sistema')
        .select('chiave, valore');
    if (error) return;

    const s = {};
    (data || []).forEach(r => { s[r.chiave] = r.valore; });
    globalSettings = s;

    const byId = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.value = s[key] || '';
    };
    byId('setCasinoName',  'casino_name');
    byId('setWelcomeBonus', 'welcome_bonus');
    byId('setMinBet',      'min_bet');
    byId('setMaxBet',      'max_bet');
    byId('setDepLimit',    'dep_limit');

    const rtpSettingsEl = document.getElementById('rtpSettings');
    if (rtpSettingsEl) {
        rtpSettingsEl.innerHTML = GAMES.map(g => {
            const currentRtp = s['rtp_' + g.name] || g.rtp;
            return `
            <div class="form-row">
                <label>${g.icon} ${g.name}</label>
                <input type="number" id="rtp_${g.name.replace(/\s/g, '_')}" value="${currentRtp}" min="80" max="99.9" step="0.1">
            </div>`;
        }).join('') + `<button class="adm-btn adm-btn-primary" onclick="saveRtpSettings()">Salva RTP</button>`;
    }
}

async function saveSettings() {
    const payload = {
        casino_name:   document.getElementById('setCasinoName').value,
        welcome_bonus: document.getElementById('setWelcomeBonus').value,
        min_bet:       document.getElementById('setMinBet').value,
        max_bet:       document.getElementById('setMaxBet').value,
        dep_limit:     document.getElementById('setDepLimit').value,
    };
    const { data, error } = await _sb.rpc('admin_save_settings', { p_settings: payload });
    if (!error && data?.ok) {
        toast('Impostazioni generali salvate', 'success');
        await populateSettings();
    } else {
        toast('Errore: impossibile salvare le impostazioni — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function saveRtpSettings() {
    const payload = {};
    GAMES.forEach(g => {
        const el = document.getElementById('rtp_' + g.name.replace(/\s/g, '_'));
        if (el) payload['rtp_' + g.name] = el.value;
    });
    const { data, error } = await _sb.rpc('admin_save_settings', { p_settings: payload });
    if (!error && data?.ok) {
        toast('RTP dei giochi salvati correttamente', 'success');
        await populateSettings();
    } else {
        toast('Errore: impossibile salvare i valori RTP — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

async function changeAdminPass() {
    const nw   = document.getElementById('newPass').value;
    const conf = document.getElementById('confPass').value;
    if (nw !== conf) { toast('Le password non coincidono', 'error'); return; }
    if (nw.length < 6) { toast('Password troppo corta (min 6 caratteri)', 'error'); return; }
    const { error } = await _sb.auth.updateUser({ password: nw });
    if (!error) {
        toast('Password aggiornata con successo', 'success');
        ['newPass', 'confPass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } else {
        toast('Errore aggiornamento password: ' + error.message, 'error');
    }
}

/* ════════════════════════════════════════════════════
   LIVE FEED — Real-time partite e transazioni
   ════════════════════════════════════════════════════ */
let _liveInterval  = null;
let _liveChannel   = null;
let _liveLastGameId = 0;
let _liveLastTxId   = 0;

async function refreshLiveSection() {
    await Promise.all([refreshLiveStats(), refreshLiveGames(), refreshLiveTx()]);
}

async function refreshLiveStats() {
    const { data, error } = await _sb.rpc('admin_get_live_stats');
    if (error || !data) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('liveGames5min',     data.games_5min ?? 0);
    set('liveRevenue5min',   fmt(data.revenue_5min ?? 0));
    set('liveGamesToday',    data.games_today ?? 0);
    set('liveRevenueToday',  fmt(data.revenue_today ?? 0));
    set('liveActivePlayers', data.active_players ?? 0);

    const barsEl = document.getElementById('liveGamesBars');
    if (barsEl && data.games_by_type) {
        const entries = Object.entries(data.games_by_type).sort((a, b) => b[1] - a[1]);
        const max = entries[0]?.[1] || 1;
        const icons = { 'Slot Machine': '🎰', 'Blackjack': '🃏', 'Roulette': '🎡', 'Poker': '🤠', 'Rocket Cash': '🚀' };
        barsEl.innerHTML = entries.map(([game, cnt]) => `
            <div class="tg-item">
                <span class="tg-name">${icons[game] || '🎮'} ${game}</span>
                <div class="tg-bar-wrap"><div class="tg-bar" style="width:${Math.round(cnt / max * 100)}%"></div></div>
                <span class="tg-pct">${cnt}</span>
            </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px;padding:10px 0">Nessuna partita oggi</div>';
    }
}

async function refreshLiveGames() {
    const { data, error } = await _sb.rpc('admin_get_live_games', { p_limit: 40 });
    if (error || !data) return;

    const tbody = document.getElementById('liveGamesBody');
    if (!tbody) return;

    const newMaxId = data[0]?.id ?? 0;
    const hasNew   = newMaxId > _liveLastGameId && _liveLastGameId !== 0;
    _liveLastGameId = newMaxId;

    tbody.innerHTML = data.map((r, i) => {
        const profit = r.profit ?? 0;
        const profitCls = profit > 0 ? 'profit-pos' : profit < 0 ? 'profit-neg' : 'profit-zero';
        const profitTxt = profit > 0 ? `+${fmt(profit)}` : fmt(profit);
        const isNew = hasNew && i === 0;
        const time  = new Date(r.played_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<tr class="${isNew ? 'live-new-row' : ''}">
            <td style="font-weight:600">@${r.username}</td>
            <td>${r.game}</td>
            <td style="font-family:var(--font-mono)">${fmt(r.bet)}</td>
            <td class="${profitCls}">${profitTxt}</td>
            <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">${time}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Nessuna partita registrata</td></tr>';
}

async function refreshLiveTx() {
    const { data, error } = await _sb.rpc('admin_get_live_transactions', { p_limit: 30 });
    if (error || !data) return;

    const tbody = document.getElementById('liveTxBody');
    if (!tbody) return;

    const newMaxId = data[0]?.id ?? 0;
    const hasNew   = newMaxId > _liveLastTxId && _liveLastTxId !== 0;
    _liveLastTxId  = newMaxId;

    tbody.innerHTML = data.map((t, i) => {
        const isNew  = hasNew && i === 0;
        const color  = t.tipo === 'prelievo' ? 'var(--red)' : 'var(--green)';
        const sign   = t.tipo === 'prelievo' ? '-' : '+';
        const time   = new Date(t.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<tr class="${isNew ? 'live-new-row' : ''}">
            <td style="font-weight:600">@${t.username}</td>
            <td><span class="badge badge-${t.tipo}">${t.tipo}</span></td>
            <td style="font-family:var(--font-mono);color:${color}">${sign}${fmt(t.importo)}</td>
            <td><span class="badge badge-${t.stato}">${t.stato}</span></td>
            <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">${time}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">Nessuna transazione</td></tr>';
}

function startLivePolling() {
    stopLivePolling();
    _liveLastGameId = 0;
    _liveLastTxId   = 0;
    refreshLiveSection();
    _liveInterval = setInterval(refreshLiveSection, 3000);

    // Supabase Realtime per aggiornamento istantaneo
    _liveChannel = _sb.channel('admin-live-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_history' }, () => refreshLiveSection())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transazione' },  () => refreshLiveSection())
        .subscribe();
}

function stopLivePolling() {
    if (_liveInterval) { clearInterval(_liveInterval); _liveInterval = null; }
    if (_liveChannel)  { _sb.removeChannel(_liveChannel); _liveChannel = null; }
}

/* ════════════════════════════════════════════════════
   CHAT LIVE — Admin side
   ════════════════════════════════════════════════════ */
let _chatAdminConvId      = null;
let _chatAdminChannel     = null;
let _chatAdminGlobalChannel = null;

function _startAdminChatGlobalSubscription() {
    if (_chatAdminGlobalChannel) _sb.removeChannel(_chatAdminGlobalChannel);

    _chatAdminGlobalChannel = _sb.channel('admin_chat_global')
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_conversations',
        }, async () => {
            await populateAdminChat();
        })
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_messages',
        }, async () => {
            await populateAdminChat();
        })
        .on('postgres_changes', {
            event:  'UPDATE',
            schema: 'public',
            table:  'chat_conversations',
        }, async () => {
            await populateAdminChat();
        })
        .subscribe();
}

async function populateAdminChat() {
    const { data, error } = await _sb.rpc('admin_get_chat_conversations');
    if (error || !data) {
        const chatSection = document.getElementById('sec-chat');
        if (chatSection && !chatSection.classList.contains('hidden')) {
            toast('Errore caricamento chat: ' + (error?.message || 'risposta vuota'), 'error');
        }
        console.error('[admin chat]', error);
        return;
    }

    const list = document.getElementById('adminChatConvList');
    const countEl = document.getElementById('chatConvCount');
    if (countEl) countEl.textContent = `${data.length} tot.`;

    const openCount = data.filter(c => c.status === 'open').length;
    const badge = document.getElementById('badgeChat');
    if (badge) {
        badge.textContent = openCount;
        badge.style.display = openCount > 0 ? '' : 'none';
    }

    if (!list) return;
    if (!data.length) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Nessuna conversazione</div>';
        return;
    }

    list.innerHTML = data.map(c => {
        const time    = c.last_message_at ? fmtDate(c.last_message_at) : '—';
        const preview = c.last_message ? c.last_message.slice(0, 60) + (c.last_message.length > 60 ? '…' : '') : 'Nessun messaggio';
        const active  = c.id === _chatAdminConvId ? 'active' : '';
        const closed  = c.status === 'closed' ? 'closed' : '';
        return `
            <div class="chat-conv-item ${active} ${closed}" onclick="openAdminChat('${c.id}', '${c.status}')">
                <div class="chat-conv-user">
                    @${c.username || 'Utente'}
                    <span class="chat-conv-status-badge ${c.status}">${c.status === 'open' ? 'Aperta' : 'Chiusa'}</span>
                </div>
                <div class="chat-conv-preview">${_escAdmin(preview)}</div>
                <div class="chat-conv-time">${time}</div>
            </div>`;
    }).join('');
}

async function openAdminChat(convId, convStatus = 'open') {
    _chatAdminConvId = convId;

    // Re-render list to update active state
    await populateAdminChat();

    // Load messages via SECURITY DEFINER RPC (bypasses RLS)
    const { data, error } = await _sb.rpc('admin_get_chat_messages', { p_conversation_id: convId });

    const msgsEl   = document.getElementById('adminChatMessages');
    const inputBar = document.getElementById('adminChatInputBar');
    const header   = document.getElementById('adminChatThreadHeader');

    if (!msgsEl) return;

    const isOpen = convStatus === 'open';

    // Header — username letto dal DOM dopo il re-render della lista
    const convUserEl = document.querySelector('.chat-conv-item.active .chat-conv-user');
    if (header) {
        header.innerHTML = `
            <span style="font-family:var(--font-brand);font-size:13px;font-weight:700;color:var(--text-primary);">
                ${convUserEl ? _escAdmin(convUserEl.firstChild.textContent.trim()) : '@Utente'}
            </span>
            <span class="chat-conv-status-badge ${convStatus}" style="margin-left:8px;">
                ${isOpen ? 'Aperta' : 'Chiusa'}
            </span>`;
    }

    if (inputBar) inputBar.style.display = isOpen ? 'flex' : 'none';

    if (error || !data) { msgsEl.innerHTML = '<div style="padding:16px;color:var(--text-muted);">Errore caricamento</div>'; return; }

    msgsEl.innerHTML = '';
    (data || []).forEach(m => _appendAdminChatMsg(m.sender_type, m.sender_name, m.message, m.created_at));

    msgsEl.scrollTop = msgsEl.scrollHeight;

    // Realtime — ora funziona grazie alle policy RLS admin aggiunte al DB
    _subscribeAdminChat(convId);
}

function _subscribeAdminChat(convId) {
    if (_chatAdminChannel) _sb.removeChannel(_chatAdminChannel);
    _chatAdminChannel = _sb.channel('admin_chat_' + convId)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_messages',
            filter: `conversation_id=eq.${convId}`,
        }, async (payload) => {
            const m = payload.new;
            _appendAdminChatMsg(m.sender_type, m.sender_name, m.message, m.created_at);
            const msgsEl = document.getElementById('adminChatMessages');
            if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
            await populateAdminChat();
        })
        .subscribe();
}

function _appendAdminChatMsg(senderType, senderName, message, createdAt) {
    const msgsEl = document.getElementById('adminChatMessages');
    if (!msgsEl) return;

    const empty = msgsEl.querySelector('.chat-admin-empty');
    if (empty) empty.remove();

    const time = createdAt
        ? new Date(createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const name = senderType === 'user'
        ? senderName || 'Utente'
        : senderType === 'admin' ? (senderName || 'Admin') : 'Assistente';

    const wrap = document.createElement('div');
    wrap.className = `adm-chat-msg from-${senderType}`;
    wrap.innerHTML = `
        <div class="adm-chat-msg-name">${_escAdmin(name)}</div>
        <div class="adm-chat-bubble">${_escAdmin(message).replace(/\n/g,'<br>')}</div>
        <div class="adm-chat-msg-time">${time}</div>`;
    msgsEl.appendChild(wrap);
}

async function adminSendMessage() {
    if (!_chatAdminConvId) return;
    const inp = document.getElementById('adminChatInput');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;

    inp.value = '';
    const { data, error } = await _sb.rpc('admin_send_chat_message', {
        p_conversation_id: _chatAdminConvId,
        p_message: text,
    });

    if (error || !data?.ok) {
        toast('Errore invio messaggio — ' + (error?.message || 'operazione fallita'), 'error');
        inp.value = text;
    }
}

async function adminCloseChat() {
    if (!_chatAdminConvId) return;
    if (!confirm('Chiudere questa conversazione?')) return;
    const { data, error } = await _sb.rpc('admin_close_chat', { p_conversation_id: _chatAdminConvId });
    if (!error && data?.ok) {
        toast('Chat chiusa', 'success');
        const inputBar = document.getElementById('adminChatInputBar');
        if (inputBar) inputBar.style.display = 'none';
        await populateAdminChat();
    } else {
        toast('Errore: impossibile chiudere la chat — ' + (error?.message || 'operazione fallita'), 'error');
    }
}

function adminChatInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        adminSendMessage();
    }
}

function _escAdmin(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

/* ════════════════════════════════════════════════════
   NOTIFICHE
   ════════════════════════════════════════════════════ */
const notifications = [
    { text: '✅ Supabase connesso e operativo' },
    { text: '✅ Tutti i nodi di gioco sono operativi' },
];

function toggleNotifs() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        document.getElementById('notifList').innerHTML =
            notifications.map(n => `<div class="notif-item">${n.text}</div>`).join('');
    }
}

function clearNotifs() {
    notifications.length = 0;
    const countEl = document.getElementById('notifCount');
    if (countEl) countEl.textContent = '0';
    document.getElementById('notifList').innerHTML =
        '<div class="notif-item" style="color:var(--text-muted)">Nessuna notifica</div>';
}

/* ════════════════════════════════════════════════════
   MODALS & TOAST
   ════════════════════════════════════════════════════ */
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${message}`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        el.style.transition = 'all 0.25s';
        setTimeout(() => el.remove(), 280);
    }, 3200);
}

/* ════════════════════════════════════════════════════
   UTILS
   ════════════════════════════════════════════════════ */
function downloadFile(filename, content, mime) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

document.addEventListener('click', e => {
    const panel = document.getElementById('notifPanel');
    const btn   = document.querySelector('.adm-notif-btn');
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
        panel.classList.add('hidden');
    }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
});
