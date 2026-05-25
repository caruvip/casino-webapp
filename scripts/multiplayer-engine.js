'use strict';

class MultiplayerEngine {
    constructor() {
        this.room         = null;
        this.channel      = null;
        this._presence    = {};
        this._evHandlers  = {};
        this._presHandlers = [];
        this.localPlayer  = null;
    }

    /* ── Crea stanza ── */
    async createRoom(gameType, maxPlayers = 4) {
        const user = getCurrentUser();
        if (!user) return { error: 'Non autenticato' };

        const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();

        const { data, error } = await _sb.from('game_rooms').insert({
            game_type:   gameType,
            room_code:   roomCode,
            host_id:     user.id,
            max_players: maxPlayers,
            status:      'waiting',
        }).select().single();

        if (error) return { error: error.message };

        this.room        = data;
        this.localPlayer = { id: user.id, username: user.username, isHost: true };
        await this._subscribe();
        return { data };
    }

    /* ── Entra in stanza ── */
    async joinRoom(roomCode) {
        const user = getCurrentUser();
        if (!user) return { error: 'Non autenticato' };

        const { data, error } = await _sb.from('game_rooms')
            .select()
            .eq('room_code', roomCode.toUpperCase())
            .eq('status', 'waiting')
            .single();

        if (error || !data) return { error: 'Stanza non trovata o già iniziata' };

        this.room        = data;
        this.localPlayer = { id: user.id, username: user.username, isHost: data.host_id === user.id };
        await this._subscribe();
        return { data };
    }

    /* ── Subscription Realtime ── */
    async _subscribe() {
        if (this.channel) _sb.removeChannel(this.channel);
        const user = getCurrentUser();

        this.channel = _sb.channel('game_' + this.room.room_code, {
            config: { presence: { key: user.id } }
        })
        .on('presence', { event: 'sync' }, () => {
            this._presence = this.channel.presenceState();
            this._presHandlers.forEach(h => h(this.getPlayers()));
        })
        .on('broadcast', { event: '*' }, ({ event, payload }) => {
            (this._evHandlers[event] || []).forEach(h => h(payload));
            (this._evHandlers['*']   || []).forEach(h => h(event, payload));
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({
                    id:        user.id,
                    username:  user.username,
                    joined_at: Date.now(),
                });
            }
        });
    }

    /* ── API pubblica ── */
    async broadcast(event, payload = {}) {
        if (!this.channel) return;
        await this.channel.send({ type: 'broadcast', event, payload });
    }

    on(event, handler) {
        if (!this._evHandlers[event]) this._evHandlers[event] = [];
        this._evHandlers[event].push(handler);
        return this;
    }

    onPresenceChange(handler) {
        this._presHandlers.push(handler);
        return this;
    }

    getPlayers() {
        return Object.values(this._presence).flat();
    }

    isHost() { return !!this.localPlayer?.isHost; }

    getRoom() { return this.room; }

    async setStatus(status) {
        if (!this.room || !this.isHost()) return;
        await _sb.from('game_rooms').update({ status }).eq('id', this.room.id);
    }

    async leave() {
        if (this.channel) {
            await this.channel.untrack();
            _sb.removeChannel(this.channel);
            this.channel = null;
        }
        if (this.isHost() && this.room) {
            await _sb.from('game_rooms').delete().eq('id', this.room.id);
        }
        this.room = null;
        this.localPlayer = null;
    }
}

window.MultiplayerEngine = MultiplayerEngine;
