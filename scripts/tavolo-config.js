'use strict';

/**
 * tavolo-config.js — Carica la configurazione del tavolo da Supabase
 * Dipende da: supabase-client.js (_sb)
 *
 * API pubblica:
 *   getTavoloConfig(nomeGioco)  → Promise<{id, nome_tavolo, nome_gioco, limite_min, limite_max, attivo}>
 *   applyTavoloUI(config)       → void  (aggiorna elementi UI del banner tavolo)
 *   isGameAttivo(nomeGioco)     → Promise<boolean>
 */

/* Defaults se DB non raggiungibile */
const TAVOLO_DEFAULTS = {
    'Poker':       { nome_tavolo: 'Vip_1',     limite_min: 5,  limite_max: 1000, attivo: true },
    'BlackJack':   { nome_tavolo: 'classic_1', limite_min: 5,  limite_max: 1000, attivo: true },
    'Roulette':    { nome_tavolo: 'classic_1', limite_min: 5,  limite_max: 1000, attivo: true },
    'Slot':        { nome_tavolo: 'slot_1',    limite_min: 5,  limite_max: 1000, attivo: true },
    'Rocket Cash': { nome_tavolo: 'rocket_1',  limite_min: 1,  limite_max: 1000, attivo: true },
};

const _tavoloCache = {};

async function getTavoloConfig(nomeGioco) {
    if (_tavoloCache[nomeGioco]) return _tavoloCache[nomeGioco];

    try {
        const { data, error } = await _sb.rpc('get_tavolo', { p_gioco: nomeGioco });
        if (!error && data) {
            _tavoloCache[nomeGioco] = data;
            return data;
        }
    } catch (_) { /* fallback */ }

    const fallback = TAVOLO_DEFAULTS[nomeGioco] || { limite_min: 1, limite_max: 10000, attivo: true };
    _tavoloCache[nomeGioco] = { ...fallback, nome_gioco: nomeGioco };
    return _tavoloCache[nomeGioco];
}

async function isGameAttivo(nomeGioco) {
    const config = await getTavoloConfig(nomeGioco);
    return config?.attivo !== false;
}

function applyTavoloUI(config) {
    const minEl   = document.getElementById('tavolo-min-bet');
    const maxEl   = document.getElementById('tavolo-max-bet');
    const nameEl  = document.getElementById('tavolo-name');
    const statEl  = document.getElementById('tavolo-status');

    if (minEl)  minEl.textContent  = '€' + (config.limite_min  ?? 5);
    if (maxEl)  maxEl.textContent  = '€' + (config.limite_max  ?? 1000);
    if (nameEl) nameEl.textContent = config.nome_tavolo ?? config.nome_gioco;
    if (statEl) {
        statEl.textContent = config.attivo ? 'Aperto' : 'Chiuso';
        statEl.className   = 'tavolo-status-badge ' + (config.attivo ? 'open' : 'closed');
    }
}
