// =======================================================
// Водить.РФ - ГИБРИДНЫЙ JavaScript
// Работает как с PHP/БД, так и без (localStorage)
// =======================================================

// =======================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// =======================================================
let currentUser = null;
let sliderInterval = null;
let currentSlide = 0;
let allRequests = [];
let currentFilter = 'all';
let currentTransportFilter = 'all';
let currentSearch = '';
let currentSort = { field: 'id', direction: 'asc' };
let currentPage = 1;
const itemsPerPage = 10;

// Режим работы: 'api' или 'local'
let workingMode = 'api'; // сначала пробуем API
let apiAvailable = true;

// Ключи для localStorage
const STORAGE_KEYS = {
    USERS: 'vodit_users',
    REQUESTS: 'vodit_requests',
    CURRENT_USER: 'vodit_current_user'
};

// =======================================================
// ИНИЦИАЛИЗАЦИЯ LOCALSTORAGE (резервный режим)
// =======================================================
function initLocalStorage() {
    // Инициализация пользователей
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        const defaultUsers = [
            {
                id: 1,
                login: 'Admin26',
                password: 'Demo20',
                full_name: 'Администратор Системы',
                birth_date: '1990-01-01',
                phone: '+70000000000',
                email: 'admin@vodit-rf.ru',
                role: 'admin'
            },
            {
                id: 2,
                login: 'user123',
                password: 'password123',
                full_name: 'Иванов Иван Иванович',
                birth_date: '1995-05-15',
                phone: '+79001234567',
                email: 'ivanov@example.com',
                role: 'user'
            }
        ];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
    }
    
    // Инициализация заявок
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
        const defaultRequests = [
            {
                id: 1,
                user_id: 2,
                user_name: 'Иванов Иван Иванович',
                user_login: 'user123',
                transport_type: 'Катер',
                start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                payment_method: 'Банковская карта',
                comment: 'Хотелось бы заниматься по вечерам',
                status: 'Новая',
                review: null,
                review_date: null,
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                user_id: 2,
                user_name: 'Иванов Иван Иванович',
                user_login: 'user123',
                transport_type: 'Яхта',
                start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                payment_method: 'Рассрочка',
                comment: 'Интересует интенсивный курс',
                status: 'Идет обучение',
                review: null,
                review_date: null,
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                user_id: 2,
                user_name: 'Иванов Иван Иванович',
                user_login: 'user123',
                transport_type: 'Круизный лайнер',
                start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                payment_method: 'Наличные',
                comment: null,
                status: 'Обучение завершено',
                review: 'Отличное обучение! Инструкторы профессионалы. Всё понравилось!',
                review_date: new Date().toISOString(),
                created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(defaultRequests));
    }
}

// Получить пользователей из localStorage
function getLocalUsers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
}

// Сохранить пользователей в localStorage
function saveLocalUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// Получить заявки из localStorage
function getLocalRequests() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS) || '[]');
}

// Сохранить заявки в localStorage
function saveLocalRequests(requests) {
    localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
}

// =======================================================
// API ЗАПРОСЫ С АВТОМАТИЧЕСКИМ ПЕРЕКЛЮЧЕНИЕМ НА LOCALSTORAGE
// =======================================================
async function apiRequest(action, method = 'GET', data = null) {
    // Если API уже признан недоступным, сразу работаем через localStorage
    if (!apiAvailable) {
        return localApiRequest(action, method, data);
    }
    
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        // Определяем правильный путь к API
        let apiUrl = '../php/api.php';
        
        // Если на странице регистрации или входа, путь может быть другим
        if (window.location.pathname.includes('/pages/')) {
            apiUrl = '../php/api.php';
        } else {
            apiUrl = 'php/api.php';
        }
        
        const url = `${apiUrl}?action=${action}`;
        const response = await fetch(url, { ...options, mode: 'cors' });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        return result;
        
    } catch (error) {
        console.warn(`API недоступно (${error.message}), переключаемся на локальный режим`);
        
        // При первой ошибке переключаемся на localStorage
        if (apiAvailable) {
            apiAvailable = false;
            workingMode = 'local';
            initLocalStorage();
            showToast('Работаем в автономном режиме (сервер не обнаружен)', false);
        }
        
        // Выполняем запрос через localStorage
        return localApiRequest(action, method, data);
    }
}

// =======================================================
// LOCALSTORAGE API (резервный режим)
// =======================================================
async function localApiRequest(action, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                let result;
                
                switch (action) {
                    case 'register':
                        result = localHandleRegister(data);
                        break;
                    case 'login':
                        result = localHandleLogin(data);
                        break;
                    case 'check_auth':
                        result = localHandleCheckAuth();
                        break;
                    case 'logout':
                        result = localHandleLogout();
                        break;
                    case 'get_user_requests':
                        result = localHandleGetUserRequests();
                        break;
                    case 'create_request':
                        result = localHandleCreateRequest(data);
                        break;
                    case 'add_review':
                        result = localHandleAddReview(data);
                        break;
                    case 'get_all_requests':
                        result = localHandleGetAllRequests();
                        break;
                    case 'update_request_status':
                        result = localHandleUpdateRequestStatus(data);
                        break;
                    case 'get_statistics':
                        result = localHandleGetStatistics();
                        break;
                    default:
                        reject(new Error('Неизвестное действие'));
                        return;
                }
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, 50);
    });
}

// Регистрация (localStorage)
function localHandleRegister(data) {
    const users = getLocalUsers();
    
    if (users.find(u => u.login === data.login)) {
        throw new Error('Пользователь с таким логином уже существует');
    }
    
    if (users.find(u => u.email === data.email)) {
        throw new Error('Пользователь с таким email уже существует');
    }
    
    const newUser = {
        id: users.length + 1,
        login: data.login,
        password: data.password,
        full_name: data.full_name,
        birth_date: data.birth_date,
        phone: data.phone,
        email: data.email,
        role: 'user'
    };
    
    users.push(newUser);
    saveLocalUsers(users);
    
    return {
        success: true,
        message: 'Регистрация успешна',
        data: { user_id: newUser.id }
    };
}

// Вход (localStorage)
function localHandleLogin(data) {
    const users = getLocalUsers();
    const user = users.find(u => u.login === data.login && u.password === data.password);
    
    if (!user) {
        throw new Error('Неверный логин или пароль');
    }
    
    currentUser = {
        user_id: user.id,
        login: user.login,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        birth_date: user.birth_date
    };
    
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    
    return {
        success: true,
        message: 'Вход выполнен',
        data: currentUser
    };
}

// Проверка авторизации (localStorage)
function localHandleCheckAuth() {
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        return {
            success: true,
            message: 'Авторизован',
            data: currentUser
        };
    }
    throw new Error('Не авторизован');
}

// Выход (localStorage)
function localHandleLogout() {
    currentUser = null;
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    return {
        success: true,
        message: 'Выход выполнен'
    };
}

// Получение заявок пользователя (localStorage)
function localHandleGetUserRequests() {
    if (!currentUser) throw new Error('Необходима авторизация');
    
    const requests = getLocalRequests();
    const userRequests = requests.filter(r => r.user_id === currentUser.user_id);
    
    return {
        success: true,
        message: 'Заявки получены',
        data: userRequests
    };
}

// Создание заявки (localStorage)
function localHandleCreateRequest(data) {
    if (!currentUser) throw new Error('Необходима авторизация');
    
    const requests = getLocalRequests();
    const newRequest = {
        id: requests.length + 1,
        user_id: currentUser.user_id,
        user_name: currentUser.full_name,
        user_login: currentUser.login,
        transport_type: data.transport_type,
        start_date: data.start_date,
        payment_method: data.payment_method,
        comment: data.comment || null,
        status: 'Новая',
        review: null,
        review_date: null,
        created_at: new Date().toISOString()
    };
    
    requests.push(newRequest);
    saveLocalRequests(requests);
    
    return {
        success: true,
        message: 'Заявка успешно создана',
        data: { request_id: newRequest.id }
    };
}

// Добавление отзыва (localStorage)
function localHandleAddReview(data) {
    if (!currentUser) throw new Error('Необходима авторизация');
    
    const requests = getLocalRequests();
    const requestIndex = requests.findIndex(r => r.id === data.request_id && r.user_id === currentUser.user_id);
    
    if (requestIndex === -1) {
        throw new Error('Заявка не найдена');
    }
    
    if (requests[requestIndex].status !== 'Обучение завершено') {
        throw new Error('Отзыв можно оставить только для завершенного обучения');
    }
    
    requests[requestIndex].review = data.review;
    requests[requestIndex].review_date = new Date().toISOString();
    saveLocalRequests(requests);
    
    return {
        success: true,
        message: 'Отзыв успешно добавлен'
    };
}

// Получение всех заявок для админа (localStorage)
function localHandleGetAllRequests() {
    if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Доступ запрещен');
    }
    
    const requests = getLocalRequests();
    const users = getLocalUsers();
    
    // Обогащаем заявки данными пользователей
    const enrichedRequests = requests.map(req => {
        const user = users.find(u => u.id === req.user_id);
        return {
            ...req,
            user_name: user?.full_name || req.user_name,
            user_login: user?.login || req.user_login,
            phone: user?.phone,
            email: user?.email
        };
    });
    
    return {
        success: true,
        message: 'Заявки получены',
        data: enrichedRequests
    };
}

// Обновление статуса заявки (localStorage)
function localHandleUpdateRequestStatus(data) {
    if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Доступ запрещен');
    }
    
    const requests = getLocalRequests();
    const requestIndex = requests.findIndex(r => r.id == data.request_id);
    
    if (requestIndex === -1) {
        throw new Error('Заявка не найдена');
    }
    
    requests[requestIndex].status = data.status;
    saveLocalRequests(requests);
    
    return {
        success: true,
        message: 'Статус заявки обновлен'
    };
}

// Получение статистики (localStorage)
function localHandleGetStatistics() {
    if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Доступ запрещен');
    }
    
    const requests = getLocalRequests();
    
    const stats = {
        new_count: requests.filter(r => r.status === 'Новая').length,
        learning_count: requests.filter(r => r.status === 'Идет обучение').length,
        completed_count: requests.filter(r => r.status === 'Обучение завершено').length,
        total_count: requests.length
    };
    
    return {
        success: true,
        message: 'Статистика получена',
        data: stats
    };
}

// =======================================================
// ПРОВЕРКА АВТОРИЗАЦИИ (общая)
// =======================================================
async function checkAuth() {
    try {
        const result = await apiRequest('check_auth');
        if (result.success && result.data) {
            currentUser = result.data;
            return true;
        }
    } catch (error) {
        console.log('Не авторизован');
    }
    return false;
}

// =======================================================
// ВЫХОД ИЗ СИСТЕМЫ
// =======================================================
async function logout() {
    try {
        await apiRequest('logout');
        currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        window.location.href = '../index.html';
    } catch (error) {
        showToast('Ошибка выхода: ' + error.message, true);
    }
}

// =======================================================
// СТРАНИЦА ВХОДА (login.html) - С ПРОВЕРКОЙ КАЖДОГО ПОЛЯ
// =======================================================
function initLoginPage() {
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const loginForm = document.getElementById('login-form');
    
    // Функция проверки отдельного поля
    function validateField(field, value, fieldName) {
        const errorDiv = document.getElementById(`${field}-error-field`);
        const successDiv = document.getElementById(`${field}-success-field`);
        const inputElement = document.getElementById(`login-${field}`);
        
        if (!value || value.trim() === '') {
            if (errorDiv) {
                errorDiv.textContent = `Поле "${fieldName}" не может быть пустым`;
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (inputElement) {
                inputElement.classList.remove('success');
                inputElement.classList.add('error');
            }
            return false;
        } else {
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'block';
            if (inputElement) {
                inputElement.classList.remove('error');
                inputElement.classList.add('success');
            }
            return true;
        }
    }
    
    // Проверка поля Логин
    function validateUsername() {
        return validateField('username', usernameInput?.value || '', 'Логин');
    }
    
    // Проверка поля Пароль
    function validatePassword() {
        return validateField('password', passwordInput?.value || '', 'Пароль');
    }
    
    // Событие потери фокуса для поля Логин
    if (usernameInput) {
        usernameInput.addEventListener('blur', validateUsername);
        usernameInput.addEventListener('input', validateUsername);
    }
    
    // Событие потери фокуса для поля Пароль
    if (passwordInput) {
        passwordInput.addEventListener('blur', validatePassword);
        passwordInput.addEventListener('input', validatePassword);
    }
    
    // Обработка отправки формы
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Проверяем каждое поле по отдельности
            const isUsernameValid = validateUsername();
            const isPasswordValid = validatePassword();
            
            if (!isUsernameValid || !isPasswordValid) {
                const errorDiv = document.getElementById('login-error');
                if (errorDiv) {
                    errorDiv.textContent = 'Пожалуйста, заполните все поля корректно';
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);
                }
                return;
            }
            
            const login = usernameInput.value.trim();
            const password = passwordInput.value;
            
            try {
                loginBtn.disabled = true;
                loginBtn.textContent = 'Вход...';
                
                const result = await apiRequest('login', 'POST', { login, password });
                if (result.success) {
                    currentUser = result.data;
                    showToast('Добро пожаловать, ' + currentUser.full_name + '!');
                    
                    if (currentUser.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }
            } catch (error) {
                const errorDiv = document.getElementById('login-error');
                if (errorDiv) {
                    errorDiv.textContent = error.message;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);
                }
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Войти';
            }
        });
    }
    
    // Вход по Enter
    const handleEnter = (e) => {
        if (e.key === 'Enter' && loginForm) {
            const event = new Event('submit');
            loginForm.dispatchEvent(event);
        }
    };
    
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnter);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnter);
}

// =======================================================
// СТРАНИЦА РЕГИСТРАЦИИ (register.html)
// =======================================================
function initRegisterPage() {
    const registerBtn = document.getElementById('register-btn');
    const registerForm = document.getElementById('register-form');
    
    const loginInput = document.getElementById('reg-login');
    const passwordInput = document.getElementById('reg-password');
    const passwordConfirmInput = document.getElementById('reg-password-confirm');
    const fioInput = document.getElementById('reg-fio');
    const birthdateInput = document.getElementById('reg-birthdate');
    const phoneInput = document.getElementById('reg-phone');
    const emailInput = document.getElementById('reg-email');
    
    // Проверка логина
    function validateLogin() {
        const value = loginInput?.value || '';
        const errorDiv = document.getElementById('login-error-field');
        const successDiv = document.getElementById('login-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'Логин не может быть пустым';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (loginInput) {
                loginInput.classList.remove('success');
                loginInput.classList.add('error');
            }
            return false;
        }
        
        const loginRegex = /^[a-zA-Z0-9]{6,}$/;
        if (!loginRegex.test(value)) {
            if (errorDiv) {
                errorDiv.textContent = 'Логин должен содержать только латинские буквы и цифры, минимум 6 символов';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (loginInput) {
                loginInput.classList.remove('success');
                loginInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (loginInput) {
            loginInput.classList.remove('error');
            loginInput.classList.add('success');
        }
        return true;
    }
    
    // Проверка пароля
    function validatePassword() {
        const value = passwordInput?.value || '';
        const errorDiv = document.getElementById('password-error-field');
        const successDiv = document.getElementById('password-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'Пароль не может быть пустым';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (passwordInput) {
                passwordInput.classList.remove('success');
                passwordInput.classList.add('error');
            }
            return false;
        }
        
        if (value.length < 8) {
            if (errorDiv) {
                errorDiv.textContent = 'Пароль должен содержать не менее 8 символов';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (passwordInput) {
                passwordInput.classList.remove('success');
                passwordInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (passwordInput) {
            passwordInput.classList.remove('error');
            passwordInput.classList.add('success');
        }
        
        validatePasswordConfirm();
        return true;
    }
    
    // Проверка подтверждения пароля
    function validatePasswordConfirm() {
        const password = passwordInput?.value || '';
        const confirmValue = passwordConfirmInput?.value || '';
        const errorDiv = document.getElementById('password-confirm-error-field');
        const successDiv = document.getElementById('password-confirm-success-field');
        
        if (!confirmValue) {
            if (errorDiv) {
                errorDiv.textContent = 'Подтвердите пароль';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (passwordConfirmInput) {
                passwordConfirmInput.classList.remove('success');
                passwordConfirmInput.classList.add('error');
            }
            return false;
        }
        
        if (password !== confirmValue) {
            if (errorDiv) {
                errorDiv.textContent = 'Пароли не совпадают';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (passwordConfirmInput) {
                passwordConfirmInput.classList.remove('success');
                passwordConfirmInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (passwordConfirmInput) {
            passwordConfirmInput.classList.remove('error');
            passwordConfirmInput.classList.add('success');
        }
        return true;
    }
    
    // Проверка ФИО
    function validateFio() {
        const value = fioInput?.value?.trim() || '';
        const errorDiv = document.getElementById('fio-error-field');
        const successDiv = document.getElementById('fio-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'ФИО не может быть пустым';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (fioInput) {
                fioInput.classList.remove('success');
                fioInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (fioInput) {
            fioInput.classList.remove('error');
            fioInput.classList.add('success');
        }
        return true;
    }
    
    // Проверка даты рождения
    function validateBirthdate() {
        const value = birthdateInput?.value || '';
        const errorDiv = document.getElementById('birthdate-error-field');
        const successDiv = document.getElementById('birthdate-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'Дата рождения не может быть пустой';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (birthdateInput) {
                birthdateInput.classList.remove('success');
                birthdateInput.classList.add('error');
            }
            return false;
        }
        
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 18) {
            if (errorDiv) {
                errorDiv.textContent = 'Вам должно быть не менее 18 лет';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (birthdateInput) {
                birthdateInput.classList.remove('success');
                birthdateInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (birthdateInput) {
            birthdateInput.classList.remove('error');
            birthdateInput.classList.add('success');
        }
        return true;
    }
    
    // Проверка телефона
    function validatePhone() {
        const value = phoneInput?.value?.trim() || '';
        const errorDiv = document.getElementById('phone-error-field');
        const successDiv = document.getElementById('phone-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'Телефон не может быть пустым';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (phoneInput) {
                phoneInput.classList.remove('success');
                phoneInput.classList.add('error');
            }
            return false;
        }
        
        const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
        const phoneRegex = /^\+?\d{10,12}$/;
        if (!phoneRegex.test(cleanPhone)) {
            if (errorDiv) {
                errorDiv.textContent = 'Введите корректный номер телефона (например, +79001234567)';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (phoneInput) {
                phoneInput.classList.remove('success');
                phoneInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (phoneInput) {
            phoneInput.classList.remove('error');
            phoneInput.classList.add('success');
        }
        return true;
    }
    
    // Проверка email
    function validateEmail() {
        const value = emailInput?.value?.trim() || '';
        const errorDiv = document.getElementById('email-error-field');
        const successDiv = document.getElementById('email-success-field');
        
        if (!value) {
            if (errorDiv) {
                errorDiv.textContent = 'E-mail не может быть пустым';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (emailInput) {
                emailInput.classList.remove('success');
                emailInput.classList.add('error');
            }
            return false;
        }
        
        const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
        if (!emailRegex.test(value)) {
            if (errorDiv) {
                errorDiv.textContent = 'Введите корректный E-mail';
                errorDiv.style.display = 'block';
            }
            if (successDiv) successDiv.style.display = 'none';
            if (emailInput) {
                emailInput.classList.remove('success');
                emailInput.classList.add('error');
            }
            return false;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'block';
        if (emailInput) {
            emailInput.classList.remove('error');
            emailInput.classList.add('success');
        }
        return true;
    }
    
    // Навешиваем события
    if (loginInput) {
        loginInput.addEventListener('blur', validateLogin);
        loginInput.addEventListener('input', validateLogin);
    }
    if (passwordInput) {
        passwordInput.addEventListener('blur', validatePassword);
        passwordInput.addEventListener('input', validatePassword);
    }
    if (passwordConfirmInput) {
        passwordConfirmInput.addEventListener('blur', validatePasswordConfirm);
        passwordConfirmInput.addEventListener('input', validatePasswordConfirm);
    }
    if (fioInput) {
        fioInput.addEventListener('blur', validateFio);
        fioInput.addEventListener('input', validateFio);
    }
    if (birthdateInput) {
        birthdateInput.addEventListener('blur', validateBirthdate);
        birthdateInput.addEventListener('change', validateBirthdate);
    }
    if (phoneInput) {
        phoneInput.addEventListener('blur', validatePhone);
        phoneInput.addEventListener('input', validatePhone);
    }
    if (emailInput) {
        emailInput.addEventListener('blur', validateEmail);
        emailInput.addEventListener('input', validateEmail);
    }
    
    // Обработка отправки формы
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const isLoginValid = validateLogin();
            const isPasswordValid = validatePassword();
            const isPasswordConfirmValid = validatePasswordConfirm();
            const isFioValid = validateFio();
            const isBirthdateValid = validateBirthdate();
            const isPhoneValid = validatePhone();
            const isEmailValid = validateEmail();
            
            if (!isLoginValid || !isPasswordValid || !isPasswordConfirmValid || 
                !isFioValid || !isBirthdateValid || !isPhoneValid || !isEmailValid) {
                const errorDiv = document.getElementById('register-error');
                if (errorDiv) {
                    errorDiv.textContent = 'Пожалуйста, исправьте ошибки в форме';
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);
                }
                return;
            }
            
            try {
                registerBtn.disabled = true;
                registerBtn.textContent = 'Регистрация...';
                
                const result = await apiRequest('register', 'POST', {
                    login: loginInput.value.trim(),
                    password: passwordInput.value,
                    full_name: fioInput.value.trim(),
                    birth_date: birthdateInput.value,
                    phone: phoneInput.value.trim(),
                    email: emailInput.value.trim()
                });
                
                if (result.success) {
                    const successDiv = document.getElementById('register-success');
                    if (successDiv) {
                        successDiv.textContent = 'Регистрация успешна! Перенаправление на страницу входа...';
                        successDiv.style.display = 'block';
                    }
                    showToast('Регистрация успешна!');
                    
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }
            } catch (error) {
                const errorDiv = document.getElementById('register-error');
                if (errorDiv) {
                    errorDiv.textContent = error.message;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 3000);
                }
            } finally {
                registerBtn.disabled = false;
                registerBtn.textContent = 'Зарегистрироваться';
            }
        });
    }
}

// =======================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =======================================================
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    
    if (menuBtn && navMenu) {
        menuBtn.addEventListener('click', () => {
            menuBtn.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
}

// Остальные функции (для dashboard, admin, new-request, слайдер)
// добавляются аналогично, но для краткости оставляем существующие
// ... (остальные функции из предыдущей версии)
// =======================================================
// ВЫХОД ИЗ СИСТЕМЫ (работает в любом режиме)
// =======================================================
async function logout() {
    try {
        // Пытаемся выйти через API если он доступен
        if (apiAvailable) {
            try {
                await apiRequest('logout');
            } catch(e) {
                console.log('API logout error, using local');
            }
        }
        
        // Очищаем локальные данные
        currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        
        // Показываем сообщение
        showToast('До свидания!');
        
        // Перенаправляем на главную страницу
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 500);
        
    } catch (error) {
        console.error('Logout error:', error);
        // Принудительный выход даже при ошибке
        currentUser = null;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        window.location.href = '../index.html';
    }
}
// =======================================================
// СЛАЙДЕР (работает на главной и в личном кабинете)
// =======================================================
let sliderInterval = null;
let currentSlide = 0;

function initSlider() {
    const track = document.getElementById('slider-track');
    const prevBtn = document.getElementById('prev-slide');
    const nextBtn = document.getElementById('next-slide');
    const dotsContainer = document.getElementById('slider-dots');
    
    // Если слайдера нет на странице - выходим
    if (!track) {
        console.log('Слайдер не найден на этой странице');
        return;
    }
    
    const slides = track.querySelectorAll('.slide');
    const totalSlides = slides.length;
    
    if (totalSlides === 0) {
        console.log('Нет слайдов для отображения');
        return;
    }
    
    console.log('Слайдер инициализирован, найдено слайдов:', totalSlides);
    
    // Создание точек (dots)
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        }
    }
    
    // Функция перехода к слайду
    function goToSlide(index) {
        if (index < 0) index = totalSlides - 1;
        if (index >= totalSlides) index = 0;
        currentSlide = index;
        track.style.transform = `translateX(-${currentSlide * 100}%)`;
        
        // Обновление активной точки
        if (dotsContainer) {
            const dots = dotsContainer.querySelectorAll('.dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentSlide);
            });
        }
    }
    
    // Функции для кнопок
    function nextSlide() {
        goToSlide(currentSlide + 1);
    }
    
    function prevSlide() {
        goToSlide(currentSlide - 1);
    }
    
    // Навешиваем обработчики на кнопки
    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);
    
    // Автоматическое переключение каждые 3 секунды
    if (sliderInterval) clearInterval(sliderInterval);
    sliderInterval = setInterval(nextSlide, 3000);
    
    // Остановка автопереключения при наведении
    const sliderContainer = document.querySelector('.slider-container');
    if (sliderContainer) {
        sliderContainer.addEventListener('mouseenter', () => {
            if (sliderInterval) clearInterval(sliderInterval);
        });
        sliderContainer.addEventListener('mouseleave', () => {
            if (sliderInterval) clearInterval(sliderInterval);
            sliderInterval = setInterval(nextSlide, 3000);
        });
    }
    
    // Показываем первый слайд
    goToSlide(0);
}