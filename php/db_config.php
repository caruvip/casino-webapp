<?php
$host = "localhost";
$user = "root"; 
$password = ""; 
$db_name = "casino_v1"; 

$conn = new mysqli($host, $user, $password, $db_name);

if ($conn->connect_error) {
    die("Connessione fallita: " . $conn->connect_error);
}
?>