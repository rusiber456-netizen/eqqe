<?php
// =======================================================
// Водить.РФ - API для работы с базой данных
// =======================================================

// Настройка заголовков для CORS и JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Настройки подключения к БД
define('DB_HOST', 'localhost');
define('DB_NAME', 'vodit_rf');
define('DB_USER', 'root');
define('DB_PASS', '');

// Подключение к БД
function getDBConnection() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        // Возвращаем ошибку подключения (для отладки)
        sendResponse(false, 'Ошибка подключения к БД: ' . $e->getMessage(), null, 500);
        exit;
    }
}

// Функция отправки ответа
function sendResponse($success, $message, $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

// Получение action из запроса
$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Сессия для авторизации
session_start();

// =======================================================
// ОБРАБОТЧИКИ ЗАПРОСОВ
// =======================================================

switch ($action) {
    // -------------------------------------------------------
    // РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
    // -------------------------------------------------------
    case 'register':
        if ($method !== 'POST') sendResponse(false, 'Метод не поддерживается', null, 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Валидация полей
        $errors = [];
        
        // Проверка логина
        if (empty($data['login'])) {
            $errors[] = 'Логин обязателен';
        } elseif (!preg_match('/^[a-zA-Z0-9]{6,}$/', $data['login'])) {
            $errors[] = 'Логин должен содержать только латинские буквы и цифры, минимум 6 символов';
        }
        
        // Проверка пароля
        if (empty($data['password'])) {
            $errors[] = 'Пароль обязателен';
        } elseif (strlen($data['password']) < 8) {
            $errors[] = 'Пароль должен быть не менее 8 символов';
        }
        
        // Проверка ФИО
        if (empty($data['full_name'])) {
            $errors[] = 'ФИО обязательно';
        }
        
        // Проверка даты рождения
        if (empty($data['birth_date'])) {
            $errors[] = 'Дата рождения обязательна';
        }
        
        // Проверка телефона
        if (empty($data['phone'])) {
            $errors[] = 'Телефон обязателен';
        }
        
        // Проверка email
        if (empty($data['email'])) {
            $errors[] = 'E-mail обязателен';
        } elseif (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'Некорректный E-mail';
        }
        
        if (!empty($errors)) {
            sendResponse(false, implode(', ', $errors), null, 400);
        }
        
        try {
            $pdo = getDBConnection();
            
            // Проверка уникальности логина
            $stmt = $pdo->prepare("SELECT id FROM users WHERE login = ?");
            $stmt->execute([$data['login']]);
            if ($stmt->fetch()) {
                sendResponse(false, 'Пользователь с таким логином уже существует', null, 400);
            }
            
            // Проверка уникальности email
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$data['email']]);
            if ($stmt->fetch()) {
                sendResponse(false, 'Пользователь с таким email уже существует', null, 400);
            }
            
            // Хеширование пароля
            $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
            
            // Вставка пользователя
            $stmt = $pdo->prepare("
                INSERT INTO users (login, password, full_name, birth_date, phone, email, role)
                VALUES (?, ?, ?, ?, ?, ?, 'user')
            ");
            $stmt->execute([
                $data['login'],
                $hashedPassword,
                $data['full_name'],
                $data['birth_date'],
                $data['phone'],
                $data['email']
            ]);
            
            $userId = $pdo->lastInsertId();
            
            sendResponse(true, 'Регистрация успешна', ['user_id' => $userId]);
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
    // -------------------------------------------------------
    case 'login':
        if ($method !== 'POST') sendResponse(false, 'Метод не поддерживается', null, 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['login']) || empty($data['password'])) {
            sendResponse(false, 'Логин и пароль обязательны', null, 400);
        }
        
        try {
            $pdo = getDBConnection();
            
            $stmt = $pdo->prepare("SELECT * FROM users WHERE login = ?");
            $stmt->execute([$data['login']]);
            $user = $stmt->fetch();
            
            if ($user && password_verify($data['password'], $user['password'])) {
                // Сохраняем данные в сессию
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['user_login'] = $user['login'];
                $_SESSION['user_name'] = $user['full_name'];
                $_SESSION['user_role'] = $user['role'];
                
                sendResponse(true, 'Вход выполнен', [
                    'user_id' => $user['id'],
                    'login' => $user['login'],
                    'full_name' => $user['full_name'],
                    'role' => $user['role']
                ]);
            } else {
                sendResponse(false, 'Неверный логин или пароль', null, 401);
            }
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // ПРОВЕРКА АВТОРИЗАЦИИ
    // -------------------------------------------------------
    case 'check_auth':
        if (isset($_SESSION['user_id'])) {
            sendResponse(true, 'Авторизован', [
                'user_id' => $_SESSION['user_id'],
                'login' => $_SESSION['user_login'],
                'full_name' => $_SESSION['user_name'],
                'role' => $_SESSION['user_role']
            ]);
        } else {
            sendResponse(false, 'Не авторизован', null, 401);
        }
        break;
    
    // -------------------------------------------------------
    // ВЫХОД ИЗ СИСТЕМЫ
    // -------------------------------------------------------
    case 'logout':
        session_destroy();
        sendResponse(true, 'Выход выполнен');
        break;
    
    // -------------------------------------------------------
    // ПОЛУЧЕНИЕ ЗАЯВОК ПОЛЬЗОВАТЕЛЯ
    // -------------------------------------------------------
    case 'get_user_requests':
        if (!isset($_SESSION['user_id'])) {
            sendResponse(false, 'Необходима авторизация', null, 401);
        }
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("
                SELECT * FROM requests 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            ");
            $stmt->execute([$_SESSION['user_id']]);
            $requests = $stmt->fetchAll();
            
            sendResponse(true, 'Заявки получены', $requests);
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // СОЗДАНИЕ НОВОЙ ЗАЯВКИ
    // -------------------------------------------------------
    case 'create_request':
        if (!isset($_SESSION['user_id'])) {
            sendResponse(false, 'Необходима авторизация', null, 401);
        }
        
        if ($method !== 'POST') sendResponse(false, 'Метод не поддерживается', null, 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Валидация
        $errors = [];
        if (empty($data['transport_type'])) $errors[] = 'Вид транспорта обязателен';
        if (empty($data['start_date'])) $errors[] = 'Дата начала обязательна';
        if (empty($data['payment_method'])) $errors[] = 'Способ оплаты обязателен';
        
        if (!empty($errors)) {
            sendResponse(false, implode(', ', $errors), null, 400);
        }
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("
                INSERT INTO requests (user_id, transport_type, start_date, payment_method, comment, status)
                VALUES (?, ?, ?, ?, ?, 'Новая')
            ");
            $stmt->execute([
                $_SESSION['user_id'],
                $data['transport_type'],
                $data['start_date'],
                $data['payment_method'],
                $data['comment'] ?? null
            ]);
            
            sendResponse(true, 'Заявка успешно создана', ['request_id' => $pdo->lastInsertId()]);
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // ДОБАВЛЕНИЕ ОТЗЫВА К ЗАЯВКЕ
    // -------------------------------------------------------
    case 'add_review':
        if (!isset($_SESSION['user_id'])) {
            sendResponse(false, 'Необходима авторизация', null, 401);
        }
        
        if ($method !== 'POST') sendResponse(false, 'Метод не поддерживается', null, 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['request_id']) || empty($data['review'])) {
            sendResponse(false, 'ID заявки и отзыв обязательны', null, 400);
        }
        
        try {
            $pdo = getDBConnection();
            
            // Проверяем, что заявка принадлежит пользователю и имеет статус "Обучение завершено"
            $stmt = $pdo->prepare("
                UPDATE requests 
                SET review = ?, review_date = NOW() 
                WHERE id = ? AND user_id = ? AND status = 'Обучение завершено'
            ");
            $stmt->execute([$data['review'], $data['request_id'], $_SESSION['user_id']]);
            
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Отзыв успешно добавлен');
            } else {
                sendResponse(false, 'Отзыв можно оставить только для завершенного обучения', null, 400);
            }
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // ПОЛУЧЕНИЕ ВСЕХ ЗАЯВОК (ДЛЯ АДМИНИСТРАТОРА)
    // -------------------------------------------------------
    case 'get_all_requests':
        // Проверка прав администратора
        if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
            sendResponse(false, 'Доступ запрещен', null, 403);
        }
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->query("
                SELECT r.*, u.full_name as user_name, u.login as user_login, u.phone, u.email
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.created_at DESC
            ");
            $requests = $stmt->fetchAll();
            
            sendResponse(true, 'Заявки получены', $requests);
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // ИЗМЕНЕНИЕ СТАТУСА ЗАЯВКИ (ДЛЯ АДМИНИСТРАТОРА)
    // -------------------------------------------------------
    case 'update_request_status':
        // Проверка прав администратора
        if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
            sendResponse(false, 'Доступ запрещен', null, 403);
        }
        
        if ($method !== 'PUT') sendResponse(false, 'Метод не поддерживается', null, 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['request_id']) || empty($data['status'])) {
            sendResponse(false, 'ID заявки и статус обязательны', null, 400);
        }
        
        // Валидация статуса
        $allowedStatuses = ['Новая', 'Идет обучение', 'Обучение завершено'];
        if (!in_array($data['status'], $allowedStatuses)) {
            sendResponse(false, 'Недопустимый статус', null, 400);
        }
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("
                UPDATE requests SET status = ? WHERE id = ?
            ");
            $stmt->execute([$data['status'], $data['request_id']]);
            
            if ($stmt->rowCount() > 0) {
                sendResponse(true, 'Статус заявки обновлен');
            } else {
                sendResponse(false, 'Заявка не найдена', null, 404);
            }
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // ПОЛУЧЕНИЕ СТАТИСТИКИ (ДЛЯ АДМИНИСТРАТОРА)
    // -------------------------------------------------------
    case 'get_statistics':
        if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
            sendResponse(false, 'Доступ запрещен', null, 403);
        }
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->query("
                SELECT 
                    SUM(CASE WHEN status = 'Новая' THEN 1 ELSE 0 END) as new_count,
                    SUM(CASE WHEN status = 'Идет обучение' THEN 1 ELSE 0 END) as learning_count,
                    SUM(CASE WHEN status = 'Обучение завершено' THEN 1 ELSE 0 END) as completed_count,
                    COUNT(*) as total_count
                FROM requests
            ");
            $stats = $stmt->fetch();
            
            sendResponse(true, 'Статистика получена', $stats);
            
        } catch (PDOException $e) {
            sendResponse(false, 'Ошибка БД: ' . $e->getMessage(), null, 500);
        }
        break;
    
    // -------------------------------------------------------
    // НЕИЗВЕСТНОЕ ДЕЙСТВИЕ
    // -------------------------------------------------------
    default:
        sendResponse(false, 'Неизвестное действие', null, 400);
        break;
}
?>