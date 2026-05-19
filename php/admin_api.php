<?php
/**
 * admin_api.php — Backend API per il Pannello Admin
 * 
 * Gestisce l'autenticazione dell'admin, l'overview, la visualizzazione e modifica
 * di utenti, transazioni, bonus, impostazioni e log nel database MySQL.
 */

session_start();
require_once 'db_config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Helper per inviare risposte JSON
function respond($ok, $data = []) {
    $response = array_merge(['ok' => $ok], $data);
    echo json_encode($response);
    exit;
}

// Helper per loggare azioni admin nel database
function logAdminAction($conn, $type, $message) {
    $stmt = $conn->prepare("INSERT INTO log_attivita (Tipo, Messaggio) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
}

// Helper per prendere un'impostazione
function getSetting($conn, $key, $default = '') {
    $stmt = $conn->prepare("SELECT Valore FROM impostazioni_sistema WHERE Chiave = ?");
    $stmt->bind_param("s", $key);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        return $row['Valore'];
    }
    return $default;
}

// Helper per salvare un'impostazione
function setSetting($conn, $key, $val) {
    $stmt = $conn->prepare("INSERT INTO impostazioni_sistema (Chiave, Valore) VALUES (?, ?) ON DUPLICATE KEY UPDATE Valore = ?");
    $stmt->bind_param("sss", $key, $val, $val);
    return $stmt->execute();
}

// Leggi la richiesta JSON o POST
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? ($_POST['action'] ?? ($_GET['action'] ?? ''));

if (empty($action)) {
    respond(false, ['error' => 'Azione non specificata']);
}

// 1. Azione di Login Admin (non richiede sessione già attiva)
if ($action === 'login') {
    $user = $input['username'] ?? ($_POST['username'] ?? '');
    $pass = $input['password'] ?? ($_POST['password'] ?? '');

    if (empty($user) || empty($pass)) {
        respond(false, ['error' => 'Inserisci username e password']);
    }

    $dbUser = getSetting($conn, 'admin_username', 'admin');
    $dbPass = getSetting($conn, 'admin_password', 'admin');

    if ($user === $dbUser && $pass === $dbPass) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $user;
        logAdminAction($conn, 'admin', "Admin '$user' ha effettuato l'accesso");
        respond(true, ['username' => $user]);
    } else {
        logAdminAction($conn, 'error', "Tentativo di accesso fallito per l'admin '$user'");
        respond(false, ['error' => 'Credenziali non valide']);
    }
}

// 2. Azione di verifica sessione
if ($action === 'check_session') {
    if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
        respond(true, ['username' => $_SESSION['admin_username']]);
    } else {
        respond(false, ['error' => 'Sessione scaduta']);
    }
}

// 3. Azione di logout
if ($action === 'logout') {
    if (isset($_SESSION['admin_username'])) {
        logAdminAction($conn, 'admin', "Admin '" . $_SESSION['admin_username'] . "' ha effettuato il logout");
    }
    unset($_SESSION['admin_logged_in']);
    unset($_SESSION['admin_username']);
    respond(true);
}

// Controllo di sicurezza: tutte le azioni successive richiedono che l'admin sia loggato
if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    respond(false, ['error' => 'Non autorizzato', 'unauthorized' => true]);
}

// 4. Caricamento Dashboard
if ($action === 'get_dashboard') {
    // KPI Utenti
    $resUsers = $conn->query("SELECT COUNT(*) FROM utente_casino");
    $kpiUsers = (int)($resUsers->fetch_row()[0] ?? 0);

    // KPI GGR (Vincite vs Perdite)
    $resGgr = $conn->query("SELECT SUM(ImportoPuntata - ImportoVincita) FROM puntata");
    $kpiRevenue = (float)($resGgr->fetch_row()[0] ?? 0.0);

    // KPI Puntate
    $resBets = $conn->query("SELECT COUNT(*) FROM puntata");
    $kpiBets = (int)($resBets->fetch_row()[0] ?? 0);

    // KPI Online (Utenti con StatoAccount = 1)
    $resOnline = $conn->query("SELECT COUNT(*) FROM utente_casino WHERE StatoAccount = 1");
    $kpiOnline = (int)($resOnline->fetch_row()[0] ?? 0);

    // VIP Distribution
    $vipCounts = ['standard' => 0, 'silver' => 0, 'gold' => 0, 'platinum' => 0];
    $resVip = $conn->query("SELECT VipLevel, COUNT(*) FROM utente_casino GROUP BY VipLevel");
    if ($resVip) {
        while ($row = $resVip->fetch_row()) {
            $lvl = strtolower($row[0]);
            if (isset($vipCounts[$lvl])) {
                $vipCounts[$lvl] = (int)$row[1];
            } else {
                $vipCounts['standard'] += (int)$row[1];
            }
        }
    }

    // Recent Activity (Ultime 10 puntate con dettagli gioco/utente)
    $activity = [];
    $sql_act = "SELECT u.Username, pa.Risultato as game, pu.ImportoPuntata as bet, pu.ImportoVincita as payout, pu.TimeStampPuntata as date 
                FROM puntata pu 
                JOIN specifica s ON pu.ID_Puntata = s.ID_PuntataFK 
                JOIN partecipazione pt ON s.ID_PartitaFK = pt.ID_PartitaFK 
                JOIN utente_casino u ON pt.ID_UtenteCasinoFK = u.ID_UtenteCasino 
                ORDER BY pu.TimeStampPuntata DESC LIMIT 10";
    $resAct = $conn->query($sql_act);
    if ($resAct) {
        while ($row = $resAct->fetch_assoc()) {
            $profit = (float)$row['payout'] - (float)$row['bet'];
            $type = $profit > 0 ? 'win' : 'loss';
            $detail = $profit > 0 ? "ha vinto €" . number_format($profit, 2, ',', '.') . " su " . htmlspecialchars($row['game']) : "ha perso €" . number_format(abs($profit), 2, ',', '.') . " su " . htmlspecialchars($row['game']);
            $activity[] = [
                'type' => $type,
                'user' => $row['Username'],
                'detail' => $detail,
                'time' => date('d/m H:i', strtotime($row['date']))
            ];
        }
    }

    // Se non ci sono attività recenti, aggiungi dei placeholder
    if (empty($activity)) {
        $activity[] = ['type' => 'info', 'user' => 'System', 'detail' => 'Database online. Nessuna giocata recente.', 'time' => 'Ora'];
    }

    // Volume di gioco per gioco
    $gamesVolume = [];
    $sql_vol = "SELECT pa.Risultato as game, SUM(pu.ImportoPuntata) as vol 
                FROM partita pa 
                JOIN specifica s ON pa.ID_Partita = s.ID_PartitaFK 
                JOIN puntata pu ON s.ID_PuntataFK = pu.ID_Puntata 
                GROUP BY pa.Risultato";
    $resVol = $conn->query($sql_vol);
    if ($resVol) {
        while ($row = $resVol->fetch_assoc()) {
            $gamesVolume[] = [
                'name' => $row['game'],
                'vol' => (float)$row['vol']
            ];
        }
    }

    respond(true, [
        'kpiUsers' => $kpiUsers,
        'kpiRevenue' => $kpiRevenue,
        'kpiBets' => $kpiBets,
        'kpiOnline' => $kpiOnline,
        'vipCounts' => $vipCounts,
        'activity' => $activity,
        'gamesVolume' => $gamesVolume
    ]);
}

// 5. Elenco Utenti
if ($action === 'get_users') {
    $users = [];
    $sql = "SELECT 
              u.ID_UtenteCasino as id,
              u.Username as username,
              u.Email as email,
              u.Saldo as balance,
              u.VipLevel as vipLevel,
              u.Status as status,
              u.CreatedAt as createdAt,
              COUNT(pu.ID_Puntata) as gamesPlayed,
              SUM(CASE WHEN pu.ImportoVincita > pu.ImportoPuntata THEN 1 ELSE 0 END) as gamesWon,
              SUM(CASE WHEN pu.ImportoVincita > pu.ImportoPuntata THEN pu.ImportoVincita - pu.ImportoPuntata ELSE 0 END) as totalWon,
              SUM(CASE WHEN pu.ImportoVincita < pu.ImportoPuntata THEN pu.ImportoPuntata - pu.ImportoVincita ELSE 0 END) as totalLost
            FROM utente_casino u
            LEFT JOIN partecipazione pt ON u.ID_UtenteCasino = pt.ID_UtenteCasinoFK
            LEFT JOIN specifica s ON pt.ID_PartitaFK = s.ID_PartitaFK
            LEFT JOIN puntata pu ON s.ID_PuntataFK = pu.ID_Puntata
            GROUP BY u.ID_UtenteCasino";
    
    $res = $conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $users[] = [
                'id' => (int)$row['id'],
                'username' => $row['username'],
                'email' => $row['email'] ?? ($row['username'] . '@casino.it'),
                'balance' => (float)$row['balance'],
                'vipLevel' => $row['vipLevel'],
                'status' => $row['status'],
                'createdAt' => $row['createdAt'],
                'stats' => [
                    'gamesPlayed' => (int)$row['gamesPlayed'],
                    'gamesWon' => (int)$row['gamesWon'],
                    'totalWon' => (float)($row['totalWon'] ?? 0.0),
                    'totalLost' => (float)($row['totalLost'] ?? 0.0)
                ]
            ];
        }
    }
    respond(true, ['users' => $users]);
}

// 6. Modifica Utente (Banna/Sbanna, Bonus, VIP, Saldo, Elimina)
if ($action === 'update_user') {
    $username = $input['username'] ?? '';
    $subAction = $input['subAction'] ?? '';

    if (empty($username) || empty($subAction)) {
        respond(false, ['error' => 'Parametri mancanti']);
    }

    // Trova l'utente per sicurezza
    $stmt = $conn->prepare("SELECT ID_UtenteCasino, Saldo FROM utente_casino WHERE Username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $res = $stmt->get_result();
    $userRow = $res->fetch_assoc();
    if (!$userRow) {
        respond(false, ['error' => 'Utente non trovato']);
    }
    $userId = $userRow['ID_UtenteCasino'];
    $currentBalance = (float)$userRow['Saldo'];

    if ($subAction === 'give_bonus') {
        $amount = floatval($input['amount'] ?? 0);
        if ($amount <= 0) respond(false, ['error' => 'Importo non valido']);
        
        $newBal = $currentBalance + $amount;
        $conn->begin_transaction();
        try {
            // Aggiorna saldo
            $upd = $conn->prepare("UPDATE utente_casino SET Saldo = ? WHERE ID_UtenteCasino = ?");
            $upd->bind_param("di", $newBal, $userId);
            $upd->execute();

            // Registra transazione
            $tx = $conn->prepare("INSERT INTO transazione (ID_UtenteCasinoFK, Tipo, Importo, Stato) VALUES (?, 'bonus', ?, 'completed')");
            $tx->bind_param("id", $userId, $amount);
            $tx->execute();

            $conn->commit();
            logAdminAction($conn, 'admin', "Bonus di €" . number_format($amount, 2) . " assegnato a @$username");
            respond(true, ['newBalance' => $newBal]);
        } catch (Exception $e) {
            $conn->rollback();
            respond(false, ['error' => 'Errore nel salvataggio: ' . $e->getMessage()]);
        }
    }

    if ($subAction === 'set_balance') {
        $amount = floatval($input['amount'] ?? 0);
        if ($amount < 0) respond(false, ['error' => 'Importo negativo non valido']);

        $upd = $conn->prepare("UPDATE utente_casino SET Saldo = ? WHERE ID_UtenteCasino = ?");
        $upd->bind_param("di", $amount, $userId);
        if ($upd->execute()) {
            logAdminAction($conn, 'admin', "Saldo di @$username modificato a €" . number_format($amount, 2));
            respond(true, ['newBalance' => $amount]);
        } else {
            respond(false, ['error' => $conn->error]);
        }
    }

    if ($subAction === 'set_vip') {
        $level = $input['level'] ?? 'standard';
        $upd = $conn->prepare("UPDATE utente_casino SET VipLevel = ? WHERE ID_UtenteCasino = ?");
        $upd->bind_param("si", $level, $userId);
        if ($upd->execute()) {
            logAdminAction($conn, 'admin', "VIP di @$username modificato a '$level'");
            respond(true);
        } else {
            respond(false, ['error' => $conn->error]);
        }
    }

    if ($subAction === 'set_status') {
        $status = $input['status'] ?? 'active';
        $upd = $conn->prepare("UPDATE utente_casino SET Status = ? WHERE ID_UtenteCasino = ?");
        $upd->bind_param("si", $status, $userId);
        if ($upd->execute()) {
            logAdminAction($conn, 'admin', "Stato di @$username modificato a '$status'");
            respond(true);
        } else {
            respond(false, ['error' => $conn->error]);
        }
    }

    if ($subAction === 'delete') {
        $conn->begin_transaction();
        try {
            // Elimina pass
            $delPass = $conn->prepare("DELETE FROM password WHERE ID_UtenteFK = ?");
            $delPass->bind_param("i", $userId);
            $delPass->execute();

            // Elimina utente
            $delUser = $conn->prepare("DELETE FROM utente_casino WHERE ID_UtenteCasino = ?");
            $delUser->bind_param("i", $userId);
            $delUser->execute();

            $conn->commit();
            logAdminAction($conn, 'admin', "Utente @$username eliminato dal database");
            respond(true);
        } catch (Exception $e) {
            $conn->rollback();
            respond(false, ['error' => $e->getMessage()]);
        }
    }
}

// 7. Crea Utente
if ($action === 'create_user') {
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? 'demo123';
    $balance = floatval($input['balance'] ?? 1000);
    $email = trim($input['email'] ?? ($username . '@casino.it'));

    if (empty($username)) respond(false, ['error' => 'Username obbligatorio']);

    // Check esistente
    $stmt = $conn->prepare("SELECT ID_UtenteCasino FROM utente_casino WHERE Username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        respond(false, ['error' => 'Username già esistente']);
    }

    $conn->begin_transaction();
    try {
        // Inserisci utente
        $ins = $conn->prepare("INSERT INTO utente_casino (Username, DataNascita, Saldo, VipLevel, Status, Email) VALUES (?, '2000-01-01', ?, 'standard', 'active', ?)");
        $ins->bind_param("sds", $username, $balance, $email);
        $ins->execute();
        $userId = $conn->insert_id;

        // Inserisci password hashata
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $insPass = $conn->prepare("INSERT INTO password (ID_UtenteFK, PasswordHash) VALUES (?, ?)");
        $insPass->bind_param("is", $userId, $hash);
        $insPass->execute();

        $conn->commit();
        logAdminAction($conn, 'admin', "Creato nuovo utente @$username con saldo iniziale €" . number_format($balance, 2));
        respond(true);
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, ['error' => $e->getMessage()]);
    }
}

// 8. Transazioni
if ($action === 'get_transactions') {
    $txs = [];
    $sql = "SELECT t.ID_Transazione as id, u.Username as username, t.Tipo as type, t.Importo as amount, t.Stato as status, t.DataOra as date 
            FROM transazione t 
            JOIN utente_casino u ON t.ID_UtenteCasinoFK = u.ID_UtenteCasino 
            ORDER BY t.DataOra DESC";
    $res = $conn->query($sql);
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $txs[] = [
                'id' => (int)$row['id'],
                'username' => $row['username'],
                'type' => $row['type'],
                'amount' => (float)$row['amount'],
                'status' => $row['status'],
                'date' => $row['date']
            ];
        }
    }
    respond(true, ['transactions' => $txs]);
}

// 9. Gestione Transazione (Approva/Rifiuta)
if ($action === 'update_transaction') {
    $id = (int)($input['id'] ?? 0);
    $status = $input['status'] ?? ''; // completed, failed

    if ($id <= 0 || empty($status)) respond(false, ['error' => 'Parametri non validi']);

    // Recupera transazione
    $stmt = $conn->prepare("SELECT Tipo, Importo, ID_UtenteCasinoFK, Stato FROM transazione WHERE ID_Transazione = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $txRow = $stmt->get_result()->fetch_assoc();
    if (!$txRow) respond(false, ['error' => 'Transazione non trovata']);

    if ($txRow['Stato'] !== 'pending') {
        respond(false, ['error' => 'La transazione è già stata elaborata']);
    }

    $userId = $txRow['ID_UtenteCasinoFK'];
    $amount = (float)$txRow['Importo'];
    $type = $txRow['Tipo'];

    $conn->begin_transaction();
    try {
        // Se approvata ed è ricarica/deposito, aggiungi saldo. Se prelievo, deduci saldo (normalmente già dedotto in fase di richiesta, ma gestiamo qui per coerenza)
        if ($status === 'completed') {
            if ($type === 'deposit') {
                $conn->query("UPDATE utente_casino SET Saldo = Saldo + $amount WHERE ID_UtenteCasino = $userId");
            }
        } else if ($status === 'failed') {
            // Se rifiutata ed era prelievo, restituisci i soldi
            if ($type === 'withdrawal') {
                $conn->query("UPDATE utente_casino SET Saldo = Saldo + $amount WHERE ID_UtenteCasino = $userId");
            }
        }

        // Aggiorna stato transazione
        $upd = $conn->prepare("UPDATE transazione SET Stato = ? WHERE ID_Transazione = ?");
        $upd->bind_param("si", $status, $id);
        $upd->execute();

        $conn->commit();
        logAdminAction($conn, 'admin', "Transazione #$id ($type di €$amount) aggiornata a '$status'");
        respond(true);
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, ['error' => $e->getMessage()]);
    }
}

// 10. Gestione Bonus
if ($action === 'get_bonuses') {
    $bonuses = [];
    $res = $conn->query("SELECT * FROM bonus ORDER BY ID_Bonus DESC");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $bonuses[] = [
                'id' => (int)$row['ID_Bonus'],
                'name' => $row['Nome'],
                'type' => $row['Tipo'],
                'amount' => (float)$row['Importo'],
                'expiry' => $row['Scadenza'],
                'active' => (bool)$row['Attivo'],
                'uses' => (int)$row['Utilizzi']
            ];
        }
    }
    respond(true, ['bonuses' => $bonuses]);
}

if ($action === 'create_bonus') {
    $name = trim($input['name'] ?? '');
    $type = $input['type'] ?? 'welcome';
    $amount = floatval($input['amount'] ?? 0);
    $expiry = $input['expiry'] ?? null;

    if (empty($name) || $amount <= 0) respond(false, ['error' => 'Nome e importo validi richiesti']);

    $stmt = $conn->prepare("INSERT INTO bonus (Nome, Tipo, Importo, Scadenza, Attivo, Utilizzi) VALUES (?, ?, ?, ?, 1, 0)");
    $stmt->bind_param("ssds", $name, $type, $amount, $expiry);
    if ($stmt->execute()) {
        logAdminAction($conn, 'admin', "Bonus '$name' da €" . number_format($amount, 2) . " creato");
        respond(true);
    } else {
        respond(false, ['error' => $conn->error]);
    }
}

if ($action === 'delete_bonus') {
    $id = (int)($input['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM bonus WHERE ID_Bonus = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        logAdminAction($conn, 'admin', "Bonus ID #$id eliminato");
        respond(true);
    } else {
        respond(false, ['error' => $conn->error]);
    }
}

if ($action === 'send_bonus') {
    $id = (int)($input['id'] ?? 0);
    $stmt = $conn->prepare("SELECT Nome, Importo FROM bonus WHERE ID_Bonus = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $bRow = $stmt->get_result()->fetch_assoc();
    if (!$bRow) respond(false, ['error' => 'Bonus non trovato']);

    $amount = (float)$bRow['Importo'];
    $name = $bRow['Nome'];

    $conn->begin_transaction();
    try {
        // Incrementa utilizzi
        $conn->query("UPDATE bonus SET Utilizzi = Utilizzi + 1 WHERE ID_Bonus = $id");

        // Aggiorna tutti gli utenti
        $resUsers = $conn->query("SELECT ID_UtenteCasino FROM utente_casino");
        while ($u = $resUsers->fetch_assoc()) {
            $uId = $u['ID_UtenteCasino'];
            $conn->query("UPDATE utente_casino SET Saldo = Saldo + $amount WHERE ID_UtenteCasino = $uId");
            $conn->query("INSERT INTO transazione (ID_UtenteCasinoFK, Tipo, Importo, Stato) VALUES ($uId, 'bonus', $amount, 'completed')");
        }

        $conn->commit();
        logAdminAction($conn, 'admin', "Inviato bonus '$name' (€$amount) a tutti gli utenti");
        respond(true);
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, ['error' => $e->getMessage()]);
    }
}

if ($action === 'send_mass_bonus') {
    $amount = floatval($input['amount'] ?? 0);
    if ($amount <= 0) respond(false, ['error' => 'Importo non valido']);

    $conn->begin_transaction();
    try {
        $resUsers = $conn->query("SELECT ID_UtenteCasino FROM utente_casino");
        while ($u = $resUsers->fetch_assoc()) {
            $uId = $u['ID_UtenteCasino'];
            $conn->query("UPDATE utente_casino SET Saldo = Saldo + $amount WHERE ID_UtenteCasino = $uId");
            $conn->query("INSERT INTO transazione (ID_UtenteCasinoFK, Tipo, Importo, Stato) VALUES ($uId, 'bonus', $amount, 'completed')");
        }
        $conn->commit();
        logAdminAction($conn, 'admin', "Inviato bonus di massa da €$amount a tutti gli utenti");
        respond(true);
    } catch (Exception $e) {
        $conn->rollback();
        respond(false, ['error' => $e->getMessage()]);
    }
}

// 11. Manutenzione
if ($action === 'get_maintenance') {
    respond(true, [
        'manutenzione' => getSetting($conn, 'manutenzione', '0') === '1',
        'blocco_registrazioni' => getSetting($conn, 'blocco_registrazioni', '0') === '1',
        'blocco_prelievi' => getSetting($conn, 'blocco_prelievi', '0') === '1',
        'solo_vip' => getSetting($conn, 'solo_vip', '0') === '1',
        'messaggio_manutenzione' => getSetting($conn, 'messaggio_manutenzione', 'Il casino è in manutenzione...'),
        'db_users_count' => (int)($conn->query("SELECT COUNT(*) FROM utente_casino")->fetch_row()[0] ?? 0),
        'uptime' => '99.9%'
    ]);
}

if ($action === 'save_maintenance') {
    $maint = ($input['manutenzione'] ?? false) ? '1' : '0';
    $blockReg = ($input['blocco_registrazioni'] ?? false) ? '1' : '0';
    $blockWithd = ($input['blocco_prelievi'] ?? false) ? '1' : '0';
    $vip = ($input['solo_vip'] ?? false) ? '1' : '0';
    $msg = trim($input['messaggio_manutenzione'] ?? 'Sito in manutenzione');

    setSetting($conn, 'manutenzione', $maint);
    setSetting($conn, 'blocco_registrazioni', $blockReg);
    setSetting($conn, 'blocco_prelievi', $blockWithd);
    setSetting($conn, 'solo_vip', $vip);
    setSetting($conn, 'messaggio_manutenzione', $msg);

    logAdminAction($conn, 'admin', "Aggiornate impostazioni di manutenzione (Stato: " . ($maint === '1' ? 'ATTIVA' : 'OFFLINE') . ")");
    respond(true);
}

// 12. Impostazioni Generali
if ($action === 'get_settings') {
    $settings = [
        'casino_name' => getSetting($conn, 'casino_name', '777Casino'),
        'welcome_bonus' => (float)getSetting($conn, 'welcome_bonus', '1000'),
        'min_bet' => (float)getSetting($conn, 'min_bet', '1'),
        'max_bet' => (float)getSetting($conn, 'max_bet', '5000'),
        'dep_limit' => (float)getSetting($conn, 'dep_limit', '10000'),
    ];
    // Recupera anche tutti i settaggi RTP salvati
    $res = $conn->query("SELECT Chiave, Valore FROM impostazioni_sistema WHERE Chiave LIKE 'rtp_%'");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $settings[$row['Chiave']] = (float)$row['Valore'];
        }
    }
    respond(true, $settings);
}

if ($action === 'save_settings') {
    $name = trim($input['casino_name'] ?? '777Casino');
    $welcome = floatval($input['welcome_bonus'] ?? 1000);
    $min = floatval($input['min_bet'] ?? 1);
    $max = floatval($input['max_bet'] ?? 5000);
    $dep = floatval($input['dep_limit'] ?? 10000);

    setSetting($conn, 'casino_name', $name);
    setSetting($conn, 'welcome_bonus', $welcome);
    setSetting($conn, 'min_bet', $min);
    setSetting($conn, 'max_bet', $max);
    setSetting($conn, 'dep_limit', $dep);

    // Salva dinamicamente anche tutti i parametri RTP passati
    foreach ($input as $k => $v) {
        if (strpos($k, 'rtp_') === 0) {
            setSetting($conn, $k, strval($v));
        }
    }

    logAdminAction($conn, 'admin', "Impostazioni generali e RTP aggiornati");
    respond(true);
}

if ($action === 'change_admin_password') {
    $old = $input['oldPassword'] ?? '';
    $new = $input['newPassword'] ?? '';

    $dbPass = getSetting($conn, 'admin_password', 'admin');

    if ($old !== $dbPass) {
        respond(false, ['error' => 'Password attuale errata']);
    }

    if (strlen($new) < 4) {
        respond(false, ['error' => 'Password troppo corta (min 4 caratteri)']);
    }

    setSetting($conn, 'admin_password', $new);
    logAdminAction($conn, 'admin', "Password dell'admin aggiornata");
    respond(true);
}

// 13. Log Sistema
if ($action === 'get_logs') {
    $logs = [];
    $res = $conn->query("SELECT * FROM log_attivita ORDER BY DataOra DESC LIMIT 100");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $logs[] = [
                'type' => $row['Tipo'],
                'message' => $row['Messaggio'],
                'time' => $row['DataOra']
            ];
        }
    }
    respond(true, ['logs' => $logs]);
}

if ($action === 'clear_logs') {
    $conn->query("TRUNCATE TABLE log_attivita");
    logAdminAction($conn, 'admin', "Log di attività del sistema svuotati");
    respond(true);
}

// 14. Azioni Rapide Manutenzione
if ($action === 'reset_all_balances') {
    $conn->query("UPDATE utente_casino SET Saldo = 1000.00");
    logAdminAction($conn, 'admin', "Reset di tutti i saldi utente a €1.000,00");
    respond(true);
}

if ($action === 'nuke_users') {
    $conn->query("DELETE FROM password");
    $conn->query("DELETE FROM utente_casino");
    logAdminAction($conn, 'admin', "Eliminati TUTTI gli utenti dal database");
    respond(true);
}

respond(false, ['error' => 'Azione non riconosciuta']);
?>
