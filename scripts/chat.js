'use strict';

/**
 * chat.js — Live Chat Widget
 * Dipende da: supabase-client.js (_sb), auth.js (getCurrentUser)
 * Auto-inizializza dopo authReady.
 */

const _CHAT_CONV_KEY  = 'casino_chat_conv';
const _CHAT_OPEN_KEY  = 'casino_chat_open';

const _BOT_GREETING = 'Ciao! 👋 Sono il supporto automatico di 777Casino. Come posso aiutarti oggi?';

const _BOT_RESPONSES = [
    { keys: ['bonus','promo'],   reply: 'Per informazioni sui bonus visita la pagina Promozioni. Per attivare un bonus contatta il supporto.' },
    { keys: ['deposito','ricarica','versare'], reply: 'Per effettuare un deposito vai su "Deposita" nel menu in alto. Accettiamo carte di credito/debito e bonifico. Limite max €10.000 per transazione.' },
    { keys: ['prelievo','ritirare','prelevare'], reply: 'I prelievi vengono elaborati entro 24–72 ore lavorative. Assicurati di aver completato la verifica identità (KYC).' },
    { keys: ['saldo','soldi','crediti'], reply: 'Puoi visualizzare il tuo saldo in qualsiasi momento nella barra in alto a destra, o nella tua area profilo.' },
    { keys: ['password','accesso','login','entrare'], reply: 'Per problemi di accesso puoi usare la funzione "Hai dimenticato la password?" nella pagina di login, oppure contattaci.' },
    { keys: ['vip','livello','punti'], reply: 'Il programma VIP di 777Casino ha 4 livelli: Standard, Silver, Gold e Platinum. Sali di livello giocando e ottieni cashback e bonus esclusivi!' },
    { keys: ['gioco','blackjack','roulette','poker','slot','rocket'], reply: 'Trovi tutti i nostri giochi nella sezione Giochi. Ogni gioco ha le regole accessibili direttamente dall\'interfaccia.' },
    { keys: ['problema','errore','bug','aiuto','supporto'], reply: 'Ci dispiace per il problema! Un operatore ti risponderà il prima possibile. Puoi anche scriverci a supporto@777casino.it.' },
];

const _BOT_DEFAULT = 'Grazie per il messaggio! Un nostro operatore ti risponderà il prima possibile. Siamo disponibili 7 giorni su 7.';

let _chatConvId  = null;
let _chatChannel = null;
let _unreadCount = 0;
let _isPanelOpen = false;
let _botTimer    = null;
let _lastAdminTs = 0;

/* ════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════ */

document.addEventListener('authReady', () => {
    _buildWidget();
    const user = getCurrentUser();
    if (user) {
        _chatConvId = localStorage.getItem(_CHAT_CONV_KEY + '_' + user.id) || null;
        _initChat();
    } else {
        _renderLoginPrompt();
    }
});

function _buildWidget() {
    if (document.getElementById('chatBtn')) return;

    // CSS
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    const isHtml = location.pathname.includes('/html/');
    link.href = (isHtml ? '..' : '.') + '/styles/chat.css';
    document.head.appendChild(link);

    // Button
    const btn = document.createElement('button');
    btn.id = 'chatBtn';
    btn.setAttribute('aria-label', 'Chat live');
    btn.innerHTML = `💬<span id="chatUnreadBadge"></span>`;
    btn.onclick = toggleChat;
    document.body.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'chatPanel';
    panel.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-avatar">
                🎰
                <div class="chat-online-dot"></div>
            </div>
            <div class="chat-header-info">
                <div class="chat-header-name">Supporto 777Casino</div>
                <div class="chat-header-status">● Online ora</div>
            </div>
            <div class="chat-header-actions">
                <button class="chat-icon-btn" onclick="minimizeChat()" title="Minimizza">—</button>
            </div>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-typing" id="chatTyping">
            <span>Operatore sta scrivendo</span>
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
        <div class="chat-input-bar" id="chatInputBar">
            <textarea class="chat-input" id="chatInput" placeholder="Scrivi un messaggio…" rows="1"
                onkeydown="chatInputKeydown(event)"></textarea>
            <button class="chat-send-btn" id="chatSendBtn" onclick="sendChatMessage()" title="Invia">➤</button>
        </div>`;
    document.body.appendChild(panel);

    // Restore open state
    if (localStorage.getItem(_CHAT_OPEN_KEY) === '1') {
        panel.classList.add('open');
        _isPanelOpen = true;
    }
}

/* ════════════════════════════════════════════════════
   STATE RENDERING
   ════════════════════════════════════════════════════ */

function _renderLoginPrompt() {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    const isHtml = location.pathname.includes('/html/');
    const base   = isHtml ? '' : 'html/';
    msgs.innerHTML = `
        <div class="chat-login-prompt">
            <div class="lock-icon">🔒</div>
            <div>Accedi al tuo account per chattare con il nostro supporto.</div>
            <a href="${base}login.html">Accedi ora</a>
        </div>`;
    _disableInput(true);
}

function _renderWelcome() {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    msgs.innerHTML = `
        <div class="chat-welcome">
            <div class="chat-welcome-icon">🎰</div>
            <div class="chat-welcome-title">Come possiamo aiutarti?</div>
            <div class="chat-welcome-text">Il nostro team di supporto è online e pronto ad assisterti in italiano, 7 giorni su 7.</div>
            <button class="chat-start-btn" onclick="startNewChat()">💬 Inizia la chat</button>
        </div>`;
    _disableInput(true);
}

function _renderClosedNote() {
    const bar = document.getElementById('chatInputBar');
    if (bar) {
        bar.style.display = 'none';
    }
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    const note = document.createElement('div');
    note.className = 'chat-closed-note';
    note.textContent = 'Questa chat è stata chiusa. Inizia una nuova conversazione.';
    msgs.after(note);
}

function _disableInput(disabled) {
    const inp  = document.getElementById('chatInput');
    const btn  = document.getElementById('chatSendBtn');
    const bar  = document.getElementById('chatInputBar');
    if (inp)  inp.disabled  = disabled;
    if (btn)  btn.disabled  = disabled;
    if (bar)  bar.style.display = disabled ? 'none' : 'flex';
}

/* ════════════════════════════════════════════════════
   INIT CHAT (load existing or show welcome)
   ════════════════════════════════════════════════════ */

async function _initChat() {
    if (!_chatConvId) {
        _renderWelcome();
        return;
    }

    // Verify the conversation still exists and is owned by this user
    const { data, error } = await _sb
        .from('chat_conversations')
        .select('id, status')
        .eq('id', _chatConvId)
        .single();

    if (error || !data) {
        _chatConvId = null;
        const user = getCurrentUser();
        if (user) localStorage.removeItem(_CHAT_CONV_KEY + '_' + user.id);
        _renderWelcome();
        return;
    }

    await _loadMessages();

    if (data.status === 'closed') {
        _disableInput(true);
        _renderClosedNote();
    } else {
        _disableInput(false);
        _subscribeRealtime();
    }
}

/* ════════════════════════════════════════════════════
   START NEW CONVERSATION
   ════════════════════════════════════════════════════ */

async function startNewChat() {
    const user = getCurrentUser();
    if (!user) return;

    const { data, error } = await _sb
        .from('chat_conversations')
        .insert({ user_id: user.id })
        .select('id')
        .single();

    if (error || !data) return;

    _chatConvId = data.id;
    localStorage.setItem(_CHAT_CONV_KEY + '_' + user.id, _chatConvId);

    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = '';

    _disableInput(false);
    _subscribeRealtime();

    // Bot greeting after a short delay
    setTimeout(() => {
        _insertBotMessage(_BOT_GREETING);
    }, 600);
}

/* ════════════════════════════════════════════════════
   LOAD MESSAGES
   ════════════════════════════════════════════════════ */

async function _loadMessages() {
    if (!_chatConvId) return;

    const { data, error } = await _sb
        .from('chat_messages')
        .select('id, sender_type, sender_name, message, created_at')
        .eq('conversation_id', _chatConvId)
        .order('created_at', { ascending: true });

    if (error) return;

    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    msgs.innerHTML = '';

    (data || []).forEach(m => _appendMessage(m.sender_type, m.sender_name, m.message, m.created_at, false));
    _scrollToBottom();
}

/* ════════════════════════════════════════════════════
   SEND MESSAGE
   ════════════════════════════════════════════════════ */

async function sendChatMessage() {
    const inp  = document.getElementById('chatInput');
    const user = getCurrentUser();
    if (!inp || !user || !_chatConvId) return;

    const text = inp.value.trim();
    if (!text) return;

    inp.value   = '';
    inp.style.height = '';

    const { error } = await _sb.from('chat_messages').insert({
        conversation_id: _chatConvId,
        sender_type: 'user',
        sender_name: user.username,
        message:     text,
    });

    if (error) {
        inp.value = text;
        return;
    }

    await _sb.from('chat_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', _chatConvId);

    _scheduleBotReply(text);
}

function chatInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
}

/* ════════════════════════════════════════════════════
   BOT AUTO-REPLY
   ════════════════════════════════════════════════════ */

function _scheduleBotReply(userText) {
    clearTimeout(_botTimer);
    _botTimer = setTimeout(async () => {
        // If admin replied recently (within last 60s), skip bot
        const now = Date.now();
        if (now - _lastAdminTs < 60_000) return;

        const lower = userText.toLowerCase();
        let reply = _BOT_DEFAULT;
        for (const r of _BOT_RESPONSES) {
            if (r.keys.some(k => lower.includes(k))) { reply = r.reply; break; }
        }

        _showTyping(true);
        await _sleep(1600);
        _showTyping(false);
        _insertBotMessage(reply);
    }, 2200);
}

async function _insertBotMessage(text) {
    if (!_chatConvId) return;
    await _sb.from('chat_messages').insert({
        conversation_id: _chatConvId,
        sender_type: 'bot',
        sender_name: 'Assistente',
        message:     text,
    });
}

/* ════════════════════════════════════════════════════
   REALTIME
   ════════════════════════════════════════════════════ */

function _subscribeRealtime() {
    if (_chatChannel) _sb.removeChannel(_chatChannel);
    if (!_chatConvId) return;

    _chatChannel = _sb.channel('chat_' + _chatConvId)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'chat_messages',
            filter: `conversation_id=eq.${_chatConvId}`,
        }, (payload) => {
            const m = payload.new;
            _appendMessage(m.sender_type, m.sender_name, m.message, m.created_at, true);
            _scrollToBottom();

            if (m.sender_type === 'admin') {
                _lastAdminTs = Date.now();
                clearTimeout(_botTimer);
                _showTyping(false);
            }

            if (!_isPanelOpen) {
                _unreadCount++;
                _updateBadge();
            }
        })
        .on('postgres_changes', {
            event:  'UPDATE',
            schema: 'public',
            table:  'chat_conversations',
            filter: `id=eq.${_chatConvId}`,
        }, (payload) => {
            if (payload.new?.status === 'closed') {
                _disableInput(true);
                _renderClosedNote();
            }
        })
        .subscribe();
}

/* ════════════════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════════════════ */

function _appendMessage(senderType, senderName, message, createdAt, animate) {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;

    // Remove welcome div if present
    const welcome = msgs.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const time = createdAt
        ? new Date(createdAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const wrap = document.createElement('div');
    wrap.className = `chat-msg from-${senderType}`;

    const name = senderType === 'user' ? '' :
        `<div class="chat-msg-name">${_esc(senderName || (senderType === 'admin' ? 'Supporto' : 'Assistente'))}</div>`;

    wrap.innerHTML = `
        ${name}
        <div class="chat-msg-bubble">${_esc(message).replace(/\n/g, '<br>')}</div>
        <div class="chat-msg-time">${time}</div>`;

    msgs.appendChild(wrap);
}

function _scrollToBottom() {
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function _showTyping(visible) {
    const el = document.getElementById('chatTyping');
    if (el) el.classList.toggle('visible', visible);
}

function _updateBadge() {
    const badge = document.getElementById('chatUnreadBadge');
    const btn   = document.getElementById('chatBtn');
    if (!badge) return;
    if (_unreadCount > 0) {
        badge.textContent = _unreadCount > 9 ? '9+' : _unreadCount;
        badge.classList.add('visible');
        btn?.classList.add('pulse');
    } else {
        badge.classList.remove('visible');
        btn?.classList.remove('pulse');
    }
}

function _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ════════════════════════════════════════════════════
   PANEL TOGGLE
   ════════════════════════════════════════════════════ */

function toggleChat() {
    const panel = document.getElementById('chatPanel');
    if (!panel) return;
    _isPanelOpen = !_isPanelOpen;
    panel.classList.toggle('open', _isPanelOpen);
    localStorage.setItem(_CHAT_OPEN_KEY, _isPanelOpen ? '1' : '0');

    if (_isPanelOpen) {
        _unreadCount = 0;
        _updateBadge();
        _scrollToBottom();
        setTimeout(() => document.getElementById('chatInput')?.focus(), 250);
    }
}

function minimizeChat() {
    const panel = document.getElementById('chatPanel');
    if (!panel) return;
    _isPanelOpen = false;
    panel.classList.remove('open');
    localStorage.setItem(_CHAT_OPEN_KEY, '0');
}

// Expose globals needed by inline onclick handlers
window.toggleChat    = toggleChat;
window.minimizeChat  = minimizeChat;
window.startNewChat  = startNewChat;
window.sendChatMessage = sendChatMessage;
window.chatInputKeydown = chatInputKeydown;
