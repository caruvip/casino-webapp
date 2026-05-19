<?php
// Include database configuration
require_once 'db_config.php';

// Admin account details
$username = 'admin';
$password = password_hash('admin', PASSWORD_BCRYPT); // Securely hash the password
$email = 'admin@localhost';

try {
    // Create a new PDO instance
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check if the admin account already exists
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
    $stmt->execute(['username' => $username]);

    if ($stmt->rowCount() > 0) {
        echo "Admin account already exists.";
    } else {
        // Insert the admin account into the database
        $stmt = $pdo->prepare("INSERT INTO users (username, password, email, role) VALUES (:username, :password, :email, 'admin')");
        $stmt->execute([
            'username' => $username,
            'password' => $password,
            'email' => $email
        ]);

        echo "Admin account created successfully.";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}

?>