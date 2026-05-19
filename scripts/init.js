/* ================================================
   FILE init.js - INITIALIZATION & UI UPDATES
   Handles: jackpot ticker, VIP status, user bar
================================================ */

// ═══════════════════════════════════════════════════════════
// JACKPOT TICKER
// ═══════════════════════════════════════════════════════════

function initJackpot(initialAmount = 4290123.82) {
    let jackpot = initialAmount;
    const jackpotEl = document.getElementById('jackpotAmt');
    
    if (!jackpotEl) return;
    
    setInterval(() => {
        jackpot += Math.random() * 9.5 + 0.5;
        jackpotEl.textContent = '€' + jackpot.toLocaleString('it-IT', {
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2
        });
    }, 2200);
}

// ═══════════════════════════════════════════════════════════
// VIP STATUS INITIALIZATION
// ═══════════════════════════════════════════════════════════

function initVipStatus() {
    try {
        const user = JSON.parse(localStorage.getItem('casino_current_user'));
        if (!user) return;
        
        const levels = {
            standard: { name: 'Standard', pct: 15, next: 'Silver' },
            silver: { name: '🥈 Silver', pct: 45, next: 'Gold' },
            gold: { name: '💎 Gold', pct: 75, next: 'Platinum' },
            platinum: { name: '💎 Platinum', pct: 95, next: 'Diamond' }
        };
        
        const l = levels[user.vipLevel] || levels.standard;
        
        const vipLevelEl = document.getElementById('vipLevelName');
        const vipPctEl = document.getElementById('vipPct');
        const vipInfoEl = document.getElementById('vipInfo');
        const vipFillEl = document.getElementById('vipFill');
        
        if (vipLevelEl) vipLevelEl.textContent = l.name;
        if (vipPctEl) vipPctEl.textContent = l.pct + '%';
        if (vipInfoEl) vipInfoEl.innerHTML = `Mancano punti per il livello <strong>${l.next}</strong>`;
        
        if (vipFillEl) {
            setTimeout(() => { 
                vipFillEl.style.width = l.pct + '%'; 
            }, 400);
        }
    } catch(e) {
        console.error('VIP Status initialization error:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// USER BAR INITIALIZATION
// ═══════════════════════════════════════════════════════════

function initUserBar() {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const user = JSON.parse(localStorage.getItem('casino_current_user'));
            const bar = document.getElementById('userBar');
            
            if (!bar) return;
            
            if (user) {
                bar.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:flex-end;line-height:1.2;">
                        <span style="font-family:'Cinzel',serif;font-size:15px;font-weight:900;color:var(--gold);">
                            €${(user.balance || 0).toLocaleString('it-IT',{minimumFractionDigits:2})}
                        </span>
                        <span style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">
                            Saldo Reale
                        </span>
                    </div>
                    <a href="ricarica.html" class="nav-btn nav-btn-outline">+ Deposita</a>
                    <div style="display:flex;align-items:center;gap:7px;padding:5px 12px 5px 5px;border-radius:50px;background:var(--bg-elevated);border:1px solid var(--border-gold);cursor:pointer;" onclick="window.location.href='user.html'">
                        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#800000,#cc0000);border:1px solid var(--gold-dim);display:flex;align-items:center;justify-content:center;font-size:13px;">👤</div>
                        <span style="font-family:'Cinzel',serif;font-size:12px;font-weight:700;color:var(--gold-dim);">${user.username}</span>
                        <span style="font-size:10px;color:var(--text-muted);">▾</span>
                    </div>
                    <button class="nav-btn nav-btn-outline" onclick="localStorage.removeItem('casino_current_user');location.reload()">Esci</button>
                `;
            } else {
                bar.innerHTML = `
                    <a href="login.html" class="nav-btn nav-btn-outline">Accedi</a>
                    <a href="registrati.html" class="nav-btn nav-btn-solid">Registrati</a>
                `;
            }
        } catch(e) {
            console.error('User bar initialization error:', e);
        }
    });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initJackpot();
    initVipStatus();
});

// Also call user bar init immediately
initUserBar();
