<div class=""></div><?php
session_start();
include 'db_config.php';

if (isset($_POST['username'])) {
    $user = $_POST['username'];
    $_SESSION['Username'] = $user;

    if (isset($_POST['balance']) && isset($conn)) {
        $bal = floatval($_POST['balance']);
        $check = $conn->prepare("SELECT Saldo FROM utente_casino WHERE Username = ?");
        $check->bind_param("s", $user);
        $check->execute();
        $res = $check->get_result();
        
        if ($res->num_rows > 0) {
            // Se esiste, aggiorniamo il DB per riflettere il localStorage
            $upd = $conn->prepare("UPDATE utente_casino SET Saldo = ? WHERE Username = ?");
            $upd->bind_param("ds", $bal, $user);
            $upd->execute();
        } else {
            // Altrimenti lo creiamo
            $ins = $conn->prepare("INSERT INTO utente_casino (Username, Saldo) VALUES (?, ?)");
            $ins->bind_param("sd", $user, $bal);
            $ins->execute();
        }
    }
    
    echo "OK";
} else {
    echo "ERROR";
}
?>
