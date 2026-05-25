<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Metodo non consentito']);
    exit;
}

$nome    = trim($_POST['nome']    ?? '');
$email   = trim($_POST['email']   ?? '');
$oggetto = trim($_POST['oggetto'] ?? '');
$messaggio = trim($_POST['messaggio'] ?? '');

$errors = [];

if (empty($nome) || strlen($nome) < 2) {
    $errors[] = 'Il nome deve avere almeno 2 caratteri.';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Inserisci un indirizzo email valido.';
}
if (empty($oggetto) || strlen($oggetto) < 3) {
    $errors[] = 'L\'oggetto deve avere almeno 3 caratteri.';
}
if (empty($messaggio) || strlen($messaggio) < 10) {
    $errors[] = 'Il messaggio deve avere almeno 10 caratteri.';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'errors' => $errors]);
    exit;
}

$record = [
    'data'      => date('Y-m-d H:i:s'),
    'nome'      => htmlspecialchars($nome),
    'email'     => htmlspecialchars($email),
    'oggetto'   => htmlspecialchars($oggetto),
    'messaggio' => htmlspecialchars($messaggio),
];

$file = __DIR__ . '/messaggi.json';
$lista = [];

if (file_exists($file)) {
    $contenuto = file_get_contents($file);
    $lista = json_decode($contenuto, true) ?? [];
}

$lista[] = $record;

if (file_put_contents($file, json_encode($lista, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Errore nel salvataggio del messaggio.']);
    exit;
}

echo json_encode(['ok' => true, 'message' => 'Messaggio ricevuto! Ti risponderemo entro 5 minuti.']);
