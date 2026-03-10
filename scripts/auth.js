// --- GESTIONE UTENTI E AUTENTICAZIONE ---

const DB_KEY = "casino_users";
const SESSION_KEY = "casino_current_user";

// Funzione di utilità per leggere/scrivere dal LocalStorage
function getUsers() {
    return JSON.parse(localStorage.getItem(DB_KEY)) || [];
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
}

function saveUser(user) {
    const users = getUsers();
    const index = users.findIndex(u => u.username === user.username);
    if (index !== -1) {
        users[index] = user; // Aggiorna esistente
    } else {
        users.push(user); // Nuovo utente
    }
    localStorage.setItem(DB_KEY, JSON.stringify(users));
    
    // Se è l'utente loggato, aggiorna anche la sessione
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.username === user.username) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
}

// 1. REGISTRAZIONE (Con verifica 18+)
function register(event) {
    event.preventDefault();
    
    const username = document.getElementById("reguser").value.trim();
    const password = document.getElementById("regpass").value.trim();
    const birthdate = document.getElementById("regbirth").value;

    if (!username || !password || !birthdate) {
        alert("Compila tutti i campi!");
        return;
    }

    // Verifica Età
    const today = new Date();
    const birthDateObj = new Date(birthdate);
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
    }

    if (age < 18) {
        alert("Ci dispiace, devi avere almeno 18 anni per registrarti.");
        return;
    }

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        alert("Nome utente già esistente!");
        return;
    }

    // Crea oggetto utente con statistiche iniziali
    const newUser = {
        username: username,
        password: password, // In un'app reale, questa andrebbe criptata!
        balance: 1000, // Bonus di benvenuto
        stats: {
            gamesPlayed: 0,
            gamesWon: 0,
            totalWon: 0,
            totalLost: 0
        },
        history: [] // Cronologia partite
    };

    saveUser(newUser);
    alert("Registrazione avvenuta con successo! Ora puoi accedere.");
    window.location.href = "/login.html";
}

// 2. LOGIN
function login(event) {
    event.preventDefault();
    const userIn = document.getElementById("user").value.trim();
    const passIn = document.getElementById("pass").value.trim();

    if (userIn === "admin" && passIn === "admin") {
        const adminUser = {
            username: "admin",
            balance: 999999999, // Infinite money for admin
            stats: { gamesPlayed: 0, gamesWon: 0, totalWon: 0, totalLost: 0 },
            history: []
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(adminUser));
        alert("Benvenuto, admin!");
        window.location.href = "/user.html";
        return;
    }

    const users = getUsers();
    const validUser = users.find(u => u.username === userIn && u.password === passIn);

    if (validUser) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(validUser));
        alert("Benvenuto, " + validUser.username + "!");
        window.location.href = "/user.html"; // Reindirizza al profilo
    } else {
        alert("Nome utente o password errati.");
    }
}

// 3. LOGOUT
function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "/index.html";
}

// 4. CONTROLLO SESSIONE (Da inserire in tutte le pagine)
document.addEventListener("DOMContentLoaded", () => {
    const user = getCurrentUser();
    const userBar = document.getElementById("userBar");

    // Aggiorna la barra utente se presente
    if (userBar) {
        if (user) {
            let balance = user.username === "admin" ? "Illimitato" : `€${user.balance}`;
            userBar.innerHTML = `
                <span>Ciao, <b>${user.username}</b> | Saldo: ${balance}</span>
                <button onclick="window.location.href='/user.html'" class="btn-small">Profilo</button>
                <button onclick="logout()" class="btn-small" style="background:#cc0000;">Esci</button>
            `;
        } else {
            // Mantiene i bottoni di default (Login/Registrati)
        }
    }

    // Protezione pagine gioco (impedisce di giocare se non loggati)
    const playButtons = document.querySelectorAll(".play-btn");
    playButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            if (!user) {
                e.preventDefault();
                alert("Devi accedere per giocare!");
                window.location.href = "/login.html";
            }
        });
    });

    // Popola dati pagina User.html
    if (window.location.pathname.endsWith("/user.html")) {
        if (!user) {
            window.location.href = "/login.html"; // Protezione pagina profilo
            return;
        }
        document.getElementById("userNameDisplay").innerText = user.username;
        let balanceText = user.username === "admin" ? "Illimitato" : "€ " + user.balance;
        document.getElementById("userBalance").innerText = balanceText;
        
        // Statistiche
        document.getElementById("gamesPlayed").innerText = user.stats.gamesPlayed;
        document.getElementById("gamesWon").innerText = user.stats.gamesWon;
        
        let winRate = 0;
        if (user.stats.gamesPlayed > 0) {
            winRate = ((user.stats.gamesWon / user.stats.gamesPlayed) * 100).toFixed(1);
        }
        document.getElementById("winRate").innerText = winRate + "%";

        // Tabella Cronologia
        const historyTable = document.getElementById("historyTable");
        historyTable.innerHTML = "";
        // Prendi le ultime 5 partite
        if (user.history) {
            user.history.slice().reverse().slice(0, 5).forEach(match => {
                const row = `<tr>
                    <td>${match.date}</td>
                    <td>${match.game}</td>
                    <td>${match.result}</td>
                    <td style="color:${match.amount >= 0 ? '#4CAF50' : '#F44336'}">
                        ${match.amount >= 0 ? '+' : ''}${match.amount}
                    </td>
                </tr>`;
                historyTable.innerHTML += row;
            });
        }
    }
});

// 5. FUNZIONE PER AGGIORNARE STATISTICHE (Da chiamare nei giochi)
function updateGameStats(gameName, amountWon) {
    const user = getCurrentUser();
    if (!user) return;

    if (user.username !== "admin") {
        user.balance += amountWon;
    }
    user.stats.gamesPlayed++;
    
    if (amountWon > 0) {
        user.stats.gamesWon++;
        user.stats.totalWon += amountWon;
    } else {
        user.stats.totalLost += Math.abs(amountWon);
    }

    // Aggiungi a cronologia
    const matchData = {
        date: new Date().toLocaleDateString(),
        game: gameName,
        result: amountWon > 0 ? "Vinto" : amountWon < 0 ? "Perso" : "Pari",
        amount: amountWon
    };
    if (!user.history) {
        user.history = [];
    }
    user.history.push(matchData);

    saveUser(user); // Salva su localStorage
    
    // Aggiorna UI saldo se presente
    const balEl = document.getElementById("player-balance-el");
    if(balEl) {
        if (user.username === "admin") {
            balEl.textContent = "Illimitato";
        } else {
            balEl.textContent = user.balance;
        }
    }
}
