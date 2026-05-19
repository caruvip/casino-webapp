<?php
session_start();
include 'db_config.php';

// Determina username: da sessione PHP o lascia vuoto (JS lo gestirà)
$username = isset($_SESSION['Username']) ? $_SESSION['Username'] : null;
$saldo_reale = null;

// Se c'è sessione PHP, recupera il saldo reale dal DB
if ($username) {
    $sql = "SELECT Saldo FROM utente_casino WHERE Username = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $saldo_reale = $row['Saldo'];
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profilo Utente | VIP Lounge</title>
    <link rel="stylesheet" href="styles/main.css">
    <link rel="stylesheet" href="styles/user.css">
</head>
<body>

<div class="user-bar" id="userBar"></div>

<header>
    <h1>PROFILO UTENTE</h1>
    <nav>
        <ul>
            <li><a href="index.html">Home</a></li>
            <li><a href="giochi.html">Giochi</a></li>
            <li><a href="promozioni.html">Promozioni</a></li>
            <li><a href="#" onclick="logout()">Esci</a></li>
        </ul>
    </nav>
</header>

<main class="dashboard">

    <section class="chart-box">
        <div class="profile-info">
            <img src="images/casinotipa.png" class="avatar" alt="Avatar">
            <div class="user-details">
                <h2>Bentornato, <span id="userNameDisplay"><?php echo $username ? htmlspecialchars($username) : ''; ?></span></h2>
                <p>Status: <strong class="vip">💎 VIP GOLD</strong></p>
            </div>
        </div>
        <div class="balance-card">
            <span id="userBalance"><?php echo $saldo_reale !== null ? '€ ' . number_format($saldo_reale, 2, ',', '.') : '---'; ?></span>
            <p><a href="ricarica.html" class="btn">Ricarica</a></p>
        </div>
    </section>

    <section class="chart-box">
        <h3 class="section-title">Le Tue Statistiche</h3>
            <div class="stats-grid">
            <div class="stat-card">
                <h4>Partite Giocate</h4>
                <p id="gamesPlayed">0</p>
            </div>
            <div class="stat-card">
                <h4>Partite Vinte</h4>
                <p id="gamesWon">0</p>
            </div>
            <div class="stat-card">
                <h4>Win Rate</h4>
                <p id="winRate">0%</p>
            </div>
            <div class="stat-card">
                <h4>Totale Vinto</h4>
                <p id="totalWon">€ 0</p>
            </div>
        </div>
    </section>

    <section class="transaction-history">
        <h3 class="section-title">Cronologia Partite</h3>
        <table>
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Gioco</th>
                    <th>Importo</th>
                    <th>Risultato</th>
                </tr>
            </thead>
            <tbody id="historyTable">
                <tr><td colspan="4" style="text-align:center; color:#aaa;">Nessuna partita ancora giocata.</td></tr>
            </tbody>
        </table>
    </section>

</main>

<script src="scripts/auth.js?v=2"></script>
</body>
</html>