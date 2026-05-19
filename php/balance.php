<?php
/**
 * balance.php — API per leggere/aggiornare il saldo utente dal DB
 * 
 * GET  /php/balance.php          → restituisce il saldo attuale (JSON)
 * POST /php/balance.php          → aggiorna il saldo con un delta (JSON)
 *
 * Richiede sessione PHP attiva (login via PHP) OPPURE username in POST/GET.
 * Risponde sempre con JSON: { ok: true/false, balance: float, error: string }
 */

session_start();
include 'db_config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

/* ── Controllo manutenzione ── */
$maintRes = $conn->query("SELECT Valore FROM impostazioni_sistema WHERE Chiave = 'manutenzione'");
$isMaint = ($maintRes && $maintRes->fetch_row()[0] === '1');
$isAdmin = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

if ($isMaint && !$isAdmin) {
    $msgRes = $conn->query("SELECT Valore FROM impostazioni_sistema WHERE Chiave = 'messaggio_manutenzione'");
    $maintMsg = $msgRes ? $msgRes->fetch_row()[0] : 'Il casino è in manutenzione...';
    echo json_encode([
        'ok' => false,
        'maintenance' => true,
        'maintenance_message' => $maintMsg
    ]);
    exit;
}

/* ── Determina username ── */
$username = null;
if (isset($_SESSION['Username'])) {
    $username = $_SESSION['Username'];
} elseif (isset($_POST['username'])) {
    $username = trim($_POST['username']);
} elseif (isset($_GET['username'])) {
    $username = trim($_GET['username']);
}

if (!$username) {
    echo json_encode(['ok' => false, 'error' => 'Non autenticato']);
    exit;
}

/* ── GET: Leggi saldo ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';

    if ($action === 'getUserData') {
        $stmt = $conn->prepare("SELECT ID_UtenteCasino, Saldo, VipLevel, Status, Email, CreatedAt FROM utente_casino WHERE Username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($row = $res->fetch_assoc()) {
            $userId = (int)$row['ID_UtenteCasino'];
            $currentBalance = (float)$row['Saldo'];
            $vipLevel = $row['VipLevel'];
            $status = $row['Status'];
            $email = $row['Email'] ?? ($username . '@casino.it');
            $createdAt = $row['CreatedAt'];

            // Recupera statistiche
            $sStmt = $conn->prepare("SELECT 
                COUNT(pu.ID_Puntata) as gamesPlayed,
                SUM(CASE WHEN pu.ImportoVincita > pu.ImportoPuntata THEN 1 ELSE 0 END) as gamesWon,
                SUM(CASE WHEN pu.ImportoVincita > pu.ImportoPuntata THEN pu.ImportoVincita - pu.ImportoPuntata ELSE 0 END) as totalWon,
                SUM(CASE WHEN pu.ImportoVincita < pu.ImportoPuntata THEN pu.ImportoPuntata - pu.ImportoVincita ELSE 0 END) as totalLost
              FROM partecipazione pt
              JOIN specifica s ON pt.ID_PartitaFK = s.ID_PartitaFK
              JOIN puntata pu ON s.ID_PuntataFK = pu.ID_Puntata
              WHERE pt.ID_UtenteCasinoFK = ?");
            $sStmt->bind_param("i", $userId);
            $sStmt->execute();
            $sRes = $sStmt->get_result();
            $stats = $sRes->fetch_assoc();

            $statsData = [
                'gamesPlayed' => (int)($stats['gamesPlayed'] ?? 0),
                'gamesWon' => (int)($stats['gamesWon'] ?? 0),
                'totalWon' => (float)($stats['totalWon'] ?? 0.0),
                'totalLost' => (float)($stats['totalLost'] ?? 0.0)
            ];

            // Recupera cronologia partite
            $hStmt = $conn->prepare("SELECT 
                pa.DataOraFine as date,
                pa.Risultato as game,
                pu.ImportoPuntata as bet,
                pu.ImportoVincita as payout,
                (pu.ImportoVincita - pu.ImportoPuntata) as profit
              FROM partita pa
              JOIN partecipazione pt ON pa.ID_Partita = pt.ID_PartitaFK
              JOIN specifica s ON pa.ID_Partita = s.ID_PartitaFK
              JOIN puntata pu ON s.ID_PuntataFK = pu.ID_Puntata
              WHERE pt.ID_UtenteCasinoFK = ?
              ORDER BY pa.DataOraFine DESC
              LIMIT 100");
            $hStmt->bind_param("i", $userId);
            $hStmt->execute();
            $hRes = $hStmt->get_result();

            $historyData = [];
            $runningBalance = $currentBalance;
            while ($hRow = $hRes->fetch_assoc()) {
                $historyData[] = [
                    'date' => $hRow['date'],
                    'game' => $hRow['game'],
                    'bet' => (float)$hRow['bet'],
                    'payout' => (float)$hRow['payout'],
                    'profit' => (float)$hRow['profit'],
                    'balance' => (float)$runningBalance
                ];
                $runningBalance -= (float)$hRow['profit'];
            }

            echo json_encode([
                'ok' => true,
                'username' => $username,
                'email' => $email,
                'balance' => $currentBalance,
                'vipLevel' => $vipLevel,
                'status' => $status,
                'createdAt' => $createdAt,
                'stats' => $statsData,
                'history' => $historyData
            ]);
        } else {
            echo json_encode(['ok' => false, 'error' => 'Utente non trovato']);
        }
        exit;
    }

    // Default: leggi saldo
    $stmt = $conn->prepare("SELECT Saldo FROM utente_casino WHERE Username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        echo json_encode(['ok' => true, 'balance' => (float)$row['Saldo']]);
    } else {
        // Utente non ancora nel DB: crea con saldo 0
        $ins = $conn->prepare("INSERT INTO utente_casino (Username, Saldo) VALUES (?, 0)");
        $ins->bind_param("s", $username);
        $ins->execute();
        echo json_encode(['ok' => true, 'balance' => 0.0]);
    }
    exit;
}

/* ── POST: Aggiorna saldo ── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    // Accetta sia JSON body che POST classico
    $action = $input['action'] ?? ($_POST['action'] ?? 'delta');
    $amount = floatval($input['amount'] ?? $_POST['amount'] ?? 0);

    if ($amount == 0 && $action !== 'set') {
        echo json_encode(['ok' => false, 'error' => 'Importo non valido']);
        exit;
    }

    // Recupera saldo attuale
    $stmt = $conn->prepare("SELECT Saldo FROM utente_casino WHERE Username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($row = $res->fetch_assoc()) {
        $currentBalance = (float)$row['Saldo'];

        if ($action === 'set') {
            // Imposta direttamente
            $newBalance = max(0, $amount);
            $upd = $conn->prepare("UPDATE utente_casino SET Saldo = ? WHERE Username = ?");
            $upd->bind_param("ds", $newBalance, $username);
        } else {
            // Delta: somma/sottrai
            $newBalance = max(0, $currentBalance + $amount);
            if ($amount < 0 && abs($amount) > $currentBalance) {
                echo json_encode(['ok' => false, 'error' => 'Saldo insufficiente', 'balance' => $currentBalance]);
                exit;
            }
            $upd = $conn->prepare("UPDATE utente_casino SET Saldo = ? WHERE Username = ?");
            $upd->bind_param("ds", $newBalance, $username);
        }

        if ($upd->execute()) {
            // Se sono forniti i dettagli del gioco, registriamo la partita nel DB
            $details = $input['details'] ?? null;
            if ($details && isset($details['game']) && isset($details['bet'])) {
                $game = $details['game'];
                $bet = floatval($details['bet']);
                $payout = floatval($details['payout'] ?? 0);
                $esito = $payout > 0 ? 1 : 0;

                // Recupera ID utente
                $uStmt = $conn->prepare("SELECT ID_UtenteCasino FROM utente_casino WHERE Username = ?");
                $uStmt->bind_param("s", $username);
                $uStmt->execute();
                $uRes = $uStmt->get_result();
                if ($uRow = $uRes->fetch_assoc()) {
                    $userId = $uRow['ID_UtenteCasino'];

                    // 1. Inserisci in partita
                    $pStmt = $conn->prepare("INSERT INTO partita (DataOraInizio, DataOraFine, StatoPartita, Risultato) VALUES (NOW(), NOW(), 1, ?)");
                    $pStmt->bind_param("s", $game);
                    if ($pStmt->execute()) {
                        $partitaId = $conn->insert_id;

                        // 2. Inserisci in partecipazione
                        $ptStmt = $conn->prepare("INSERT INTO partecipazione (ID_UtenteCasinoFK, ID_PartitaFK) VALUES (?, ?)");
                        $ptStmt->bind_param("ii", $userId, $partitaId);
                        $ptStmt->execute();

                        // 3. Inserisci in puntata
                        $puStmt = $conn->prepare("INSERT INTO puntata (ImportoPuntata, TipoPuntata, Esito, ImportoVincita) VALUES (?, 1, ?, ?)");
                        $puStmt->bind_param("did", $bet, $esito, $payout);
                        if ($puStmt->execute()) {
                            $puntataId = $conn->insert_id;

                            // 4. Inserisci in specifica
                            $sStmt = $conn->prepare("INSERT INTO specifica (ID_PuntataFK, ID_PartitaFK) VALUES (?, ?)");
                            $sStmt->bind_param("ii", $puntataId, $partitaId);
                            $sStmt->execute();
                        }
                    }
                }
            }

            echo json_encode(['ok' => true, 'balance' => $newBalance]);
        } else {
            echo json_encode(['ok' => false, 'error' => $conn->error]);
        }
    } else {
        // Crea l'utente nel DB se non esiste
        $startBalance = max(0, $amount > 0 ? $amount : 0);
        $ins = $conn->prepare("INSERT INTO utente_casino (Username, Saldo) VALUES (?, ?)");
        $ins->bind_param("sd", $username, $startBalance);
        if ($ins->execute()) {
            echo json_encode(['ok' => true, 'balance' => $startBalance]);
        } else {
            echo json_encode(['ok' => false, 'error' => $conn->error]);
        }
    }
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Metodo non supportato']);
