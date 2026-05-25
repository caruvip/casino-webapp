'use strict';

/* ════════════════════════════════════════════════════
   LOBBY — Mode picker + stanza multiplayer
   Dipende da: supabase-client.js, multiplayer-engine.js, auth.js
════════════════════════════════════════════════════ */

let _lobbyEngine   = null;
let _lobbyGameType = null;
let _lobbyOnStart  = null;
let _lobbyChannel  = null;

const GAME_LABELS    = { poker: "Texas Hold'em", blackjack: 'Blackjack', roulette: 'Roulette', rocket: 'Rocket Cash' };
const GAME_MAX_SEATS = { poker: 4, blackjack: 4, roulette: 6, rocket: 8 };

/* ─────────────────────────────────────────────────
   Entry point: chiamato da ogni gioco su authReady
───────────────────────────────────────────────── */
function showModePicker(gameType, { onSolo, onMulti }) {
    _lobbyGameType = gameType;
    _injectCSS();

    const ov = _makeOverlay();
    ov.innerHTML = `
      <div class="lby-box lby-mode">
        <div class="lby-logo">777CASINO</div>
        <div class="lby-subtitle">${GAME_LABELS[gameType] || gameType}</div>
        <div class="lby-modes">
          <button class="lby-mode-btn" id="lbyBtnSolo">
            <span class="lby-icon">🤖</span>
            <span class="lby-label">Solo</span>
            <span class="lby-desc">Gioca contro i bot</span>
          </button>
          <button class="lby-mode-btn" id="lbyBtnMulti">
            <span class="lby-icon">👥</span>
            <span class="lby-label">Multiplayer</span>
            <span class="lby-desc">Gioca con altri utenti</span>
          </button>
        </div>
      </div>`;

    document.body.appendChild(ov);

    document.getElementById('lbyBtnSolo').onclick = () => {
        ov.remove();
        onSolo();
    };
    document.getElementById('lbyBtnMulti').onclick = () => {
        _lobbyOnStart = onMulti;
        _showLobbyPanel(ov);
    };
}

/* ─────────────────────────────────────────────────
   Pannello lobby (lista stanze)
───────────────────────────────────────────────── */
function _showLobbyPanel(ov) {
    ov.innerHTML = `
      <div class="lby-box">
        <div class="lby-head">
          <span class="lby-title">Lobby — ${GAME_LABELS[_lobbyGameType]}</span>
          <button class="lby-back" id="lbyBack">← Indietro</button>
        </div>
        <div class="lby-actions">
          <button class="lby-btn-primary" id="lbyCreate">+ Crea Stanza</button>
          <div class="lby-join-row">
            <input class="lby-code-in" id="lbyCodeIn" placeholder="Codice stanza…" maxlength="6">
            <button class="lby-btn-sec" id="lbyJoin">Entra</button>
          </div>
        </div>
        <div class="lby-rooms-label">Stanze aperte</div>
        <div class="lby-rooms" id="lbyRooms"><div class="lby-empty">Caricamento…</div></div>
      </div>`;

    document.getElementById('lbyBack').onclick   = () => location.reload();
    document.getElementById('lbyCreate').onclick = () => _createRoom(ov);
    document.getElementById('lbyJoin').onclick   = () => _joinByCode(ov);

    _refreshRooms();

    // Realtime: aggiorna lista quando cambiano le stanze
    if (_lobbyChannel) _sb.removeChannel(_lobbyChannel);
    _lobbyChannel = _sb.channel('lobby_list_' + _lobbyGameType)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'game_rooms',
            filter: `game_type=eq.${_lobbyGameType}`
        }, _refreshRooms)
        .subscribe();
}

async function _refreshRooms() {
    const list = document.getElementById('lbyRooms');
    if (!list) return;

    const { data } = await _sb.from('game_rooms')
        .select('*, profiles!host_id(username)')
        .eq('game_type', _lobbyGameType)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(8);

    if (!data || data.length === 0) {
        list.innerHTML = '<div class="lby-empty">Nessuna stanza aperta. Creane una!</div>';
        return;
    }

    list.innerHTML = data.map(r => `
      <div class="lby-room" data-code="${r.room_code}">
        <span class="lby-room-code">${r.room_code}</span>
        <span class="lby-room-host">Host: @${r.profiles?.username || '?'}</span>
        <span class="lby-room-seats">Max ${r.max_players}p</span>
        <span class="lby-room-join">Entra →</span>
      </div>`).join('');

    list.querySelectorAll('.lby-room').forEach(el => {
        el.onclick = () => _joinByCodeStr(el.dataset.code, document.getElementById('lbyRooms').closest('.lby-box').parentElement);
    });
}

/* ─────────────────────────────────────────────────
   Crea / Entra stanza
───────────────────────────────────────────────── */
async function _createRoom(ov) {
    const engine = new MultiplayerEngine();
    const result = await engine.createRoom(_lobbyGameType, GAME_MAX_SEATS[_lobbyGameType] || 4);
    if (result.error) { alert('Errore: ' + result.error); return; }
    _lobbyEngine = engine;
    _showWaitingRoom(ov, engine);
}

function _joinByCode(ov) {
    const code = document.getElementById('lbyCodeIn')?.value?.trim();
    if (!code) return;
    _joinByCodeStr(code, ov);
}

async function _joinByCodeStr(code, ov) {
    const engine = new MultiplayerEngine();
    const result = await engine.joinRoom(code);
    if (result.error) { alert('Errore: ' + result.error); return; }
    _lobbyEngine = engine;
    _showWaitingRoom(ov, engine);
}

/* ─────────────────────────────────────────────────
   Sala d'attesa
───────────────────────────────────────────────── */
function _showWaitingRoom(ov, engine) {
    if (_lobbyChannel) { _sb.removeChannel(_lobbyChannel); _lobbyChannel = null; }

    const room = engine.getRoom();
    const isHost = engine.isHost();

    ov.innerHTML = `
      <div class="lby-box lby-wait">
        <div class="lby-head">
          <div>
            <span class="lby-title">Stanza</span>
            <span class="lby-room-code-big">${room.room_code}</span>
          </div>
          <button class="lby-back" id="lbyLeave">Esci</button>
        </div>
        <div class="lby-wait-hint">Condividi il codice con gli amici</div>
        <div class="lby-players" id="lbyPlayers"><div class="lby-empty">In attesa…</div></div>
        ${isHost
          ? '<button class="lby-btn-primary lby-start-btn" id="lbyStart">▶ Inizia Partita</button>'
          : '<div class="lby-waiting-msg">In attesa che l\'host avvii la partita…</div>'}
      </div>`;

    document.getElementById('lbyLeave').onclick = () => { engine.leave(); location.reload(); };
    if (isHost) {
        document.getElementById('lbyStart').onclick = () => _startGame(ov, engine);
    }

    engine.onPresenceChange(players => {
        const el = document.getElementById('lbyPlayers');
        if (!el) return;
        el.innerHTML = players.length
            ? players.map(p => `<div class="lby-player-row">👤 @${p.username}${p.id === room.host_id ? ' <span class="lby-host-badge">HOST</span>' : ''}</div>`).join('')
            : '<div class="lby-empty">Nessun giocatore</div>';
    });

    // Non-host: ascolta game_start
    engine.on('game_start', () => {
        ov.remove();
        if (_lobbyOnStart) _lobbyOnStart(engine);
    });
}

function _startGame(ov, engine) {
    engine.broadcast('game_start', { ts: Date.now() });
    ov.remove();
    if (_lobbyOnStart) _lobbyOnStart(engine);
}

/* ─────────────────────────────────────────────────
   HUD in-game (mostra giocatori connessi)
───────────────────────────────────────────────── */
function showMultiHUD(engine, extraHTML = '') {
    let hud = document.getElementById('multiHUD');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'multiHUD';
        hud.className = 'lby-hud';
        document.body.appendChild(hud);
    }
    hud.innerHTML = `
      <div class="lby-hud-title">🟢 ONLINE</div>
      <div id="multiHUDPlayers"></div>
      ${extraHTML}`;

    _updateHUD(engine.getPlayers(), engine.localPlayer?.id);
    engine.onPresenceChange(players => _updateHUD(players, engine.localPlayer?.id));
}

function _updateHUD(players, myId) {
    const el = document.getElementById('multiHUDPlayers');
    if (!el) return;
    el.innerHTML = players.map(p =>
        `<div class="lby-hud-player${p.id === myId ? ' lby-you' : ''}">👤 @${p.username}</div>`
    ).join('');
}

/* ─────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────── */
function _makeOverlay() {
    const ov = document.createElement('div');
    ov.id = 'lbyOverlay';
    ov.className = 'lby-overlay';
    return ov;
}

function _injectCSS() {
    if (document.getElementById('lbyStyles')) return;
    const isHtml = location.pathname.includes('/html/');
    const base   = isHtml ? '..' : '.';
    const link   = document.createElement('link');
    link.id   = 'lbyStyles';
    link.rel  = 'stylesheet';
    link.href = base + '/styles/lobby.css';
    document.head.appendChild(link);
}

window.showModePicker = showModePicker;
window.showMultiHUD   = showMultiHUD;
