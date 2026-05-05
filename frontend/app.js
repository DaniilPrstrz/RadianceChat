// Конфигурация
const API_URL = window.location.origin + '/api'; 
const tokenKey = 'radiance_token';
const userIdKey = 'radiance_user_id';

let currentRoom = null;
let currentUser = null;

const getToken = () => localStorage.getItem(tokenKey);
const setToken = (token) => localStorage.setItem(tokenKey, token);
const setUserId = (id) => localStorage.setItem(userIdKey, id);

const getEl = (id) => document.getElementById(id);

const elements = {
    authScreen: getEl('authScreen'),
    appScreen: getEl('appScreen'),
    loginForm: getEl('loginForm'),
    registerForm: getEl('registerForm'),
    loginEmail: getEl('loginEmail'),
    loginPassword: getEl('loginPassword'),
    regEmail: getEl('regEmail'),
    regPassword: getEl('regPassword'),
    loginBtn: getEl('loginBtn'),
    registerBtn: getEl('registerBtn'),
    roomNameInput: getEl('roomNameInput'),
    createRoomBtn: getEl('createRoomBtn'),
    roomsList: getEl('roomsList'),
    messagesList: getEl('messagesList'),
    messageInput: getEl('messageInput'),
    sendMessageBtn: getEl('sendMessageBtn'),
    logoutBtn: getEl('logoutBtn'),
    authError: getEl('authError'),
    notification: getEl('notifications') // В HTML id="notifications"
};

// --- УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ---

// ИСПРАВЛЕНО: Теперь используем класс 'active' согласно вашему CSS
function showScreen(screenName) {
    if (screenName === 'app') {
        elements.authScreen?.classList.remove('active');
        elements.appScreen?.classList.add('active');
    } else {
        elements.appScreen?.classList.remove('active');
        elements.authScreen?.classList.add('active');
    }
}

function showNotification(message, type = 'success') {
    if (elements.notification) {
        const note = document.createElement('div');
        note.className = `notification ${type}`;
        note.textContent = message;
        elements.notification.appendChild(note);
        setTimeout(() => note.remove(), 3000);
    } else {
        alert(message);
    }
}

function showAuthError(msg) {
    if (elements.authError) {
        elements.authError.textContent = msg;
        elements.authError.classList.remove('hidden');
    }
}

// --- АВТОРИЗАЦИЯ ---

async function login() {
    const email = elements.loginEmail?.value;
    const password = elements.loginPassword?.value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        if (response.ok) {
            setToken(data.token);
            setUserId(data.user.id);
            currentUser = data.user;
            showScreen('app'); // Переключаем на приложение
            await loadRooms();
        } else {
            showAuthError(data.error || 'Ошибка входа');
        }
    } catch (err) {
        showAuthError('Сервер недоступен');
    }
}

// --- КОМНАТЫ ---

async function loadRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (!response.ok) return;
        const rooms = await response.json();
        
        if (elements.roomsList) {
            if (!rooms || rooms.length === 0) {
                elements.roomsList.innerHTML = '<li class="p-2 text-gray-500">Нет комнат</li>';
                return;
            }

            elements.roomsList.innerHTML = rooms.map(room => `
                <li class="room-item" data-id="${room.id}">
                    <div class="room-item-title">${room.name}</div>
                </li>
            `).join('');

            elements.roomsList.querySelectorAll('.room-item').forEach(item => {
                item.onclick = () => joinRoom(item.getAttribute('data-id'));
            });
        }
    } catch (err) {
        console.error("Ошибка загрузки комнат", err);
    }
}

async function createRoom() {
    const name = elements.roomNameInput?.value.trim();
    if (!name) return;

    try {
        const response = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ name, type: 'public' })
        });

        if (response.ok) {
            elements.roomNameInput.value = '';
            await loadRooms();
            showNotification('Комната создана');
        }
    } catch (error) {
        showNotification('Ошибка сети', 'error');
    }
}

function logout() {
    localStorage.clear();
    location.reload();
}

// --- ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ ---

// Переключение между Входом и Регистрацией
getEl('switchToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    elements.loginForm?.classList.add('hidden');
    elements.registerForm?.classList.remove('hidden');
});

getEl('switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    elements.registerForm?.classList.add('hidden');
    elements.loginForm?.classList.remove('hidden');
});

if (elements.loginBtn) elements.loginBtn.onclick = login;
if (elements.createRoomBtn) elements.createRoomBtn.onclick = createRoom;
if (elements.logoutBtn) elements.logoutBtn.onclick = logout;

async function init() {
    const token = getToken();
    if (!token) {
        showScreen('auth');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentUser = await response.json();
            showScreen('app');
            await loadRooms();
        } else {
            logout();
        }
    } catch (e) {
        showScreen('auth');
    }
}

window.onload = init;