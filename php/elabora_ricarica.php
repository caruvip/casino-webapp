<?php
session_start();
include 'db_config.php';

// Se non sei loggato, vai al login
if (!isset($_SESSION['Username'])) {
    header("Location: ../html/login.html");
    exit();
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $importo = floatval($_POST['importo']);
    $username = $_SESSION['Username'];

    if ($importo > 0 && $importo <= 10000) {
        // Se non esiste ancora nel DB, inseriamolo
        $check = $conn->prepare("SELECT Saldo FROM utente_casino WHERE Username = ?");
        $check->bind_param("s", $username);
        $check->execute();
        $res = $check->get_result();

        if ($res->num_rows > 0) {
            $sql = "UPDATE utente_casino SET Saldo = Saldo + ? WHERE Username = ?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("ds", $importo, $username);
            $success = $stmt->execute();
        } else {
            // Supponiamo che il DB avesse perso i dati, lo creiamo col solo importo (il JS correggerà il saldo totale)
            $sql = "INSERT INTO utente_casino (Username, Saldo) VALUES (?, ?)";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("sd", $username, $importo);
            $success = $stmt->execute();
        }

        if ($success) {
            echo "<!DOCTYPE html>";
            echo "<html lang='it'><head><meta charset='UTF-8'><title>Pagamento Completato</title>";
            echo "<link rel='stylesheet' href='../styles/main.css'>";
            echo "</head><body style='display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#050505; color:white; font-family:sans-serif;'>";
            echo "<h1 style='color:#FFD700; font-size:3rem; margin-bottom:10px;'>&#9989; Pagamento Accettato!</h1>";
            echo "<p style='font-size:1.5rem; margin-bottom:30px;'>Hai ricaricato <b>&euro;" . number_format($importo, 2, ',', '.') . "</b> sul tuo conto.</p>";
            echo "<a href='../html/user.html' style='padding:15px 30px; background:#FFD700; color:black; text-decoration:none; border-radius:8px; font-weight:bold; font-size:1.2rem;'>TORNA AL PROFILO</a>";
            
            // Sincronizziamo il localStorage
            echo "<script>";
            echo "let users = JSON.parse(localStorage.getItem('casino_users')) || [];";
            echo "let current = JSON.parse(localStorage.getItem('casino_current_user'));";
            echo "if (current && current.username === '" . addslashes($username) . "') {";
            echo "  current.balance += $importo;";
            echo "  localStorage.setItem('casino_current_user', JSON.stringify(current));";
            echo "  let idx = users.findIndex(u => u.username === current.username);";
            echo "  if (idx !== -1) { users[idx].balance += $importo; localStorage.setItem('casino_users', JSON.stringify(users)); }";
            echo "}";
            echo "</script>";

            echo "</body></html>";
        } else {
            echo "<h1 style='color:red;'>Errore del database: " . $conn->error . "</h1>";
        }
    } else {
        echo "<h1 style='color:red;'>Inserisci un importo valido (tra 1 e 10.000 euro).</h1>";
    }
} else {
    header("Location: ../html/ricarica.html");
    exit();
}
?>