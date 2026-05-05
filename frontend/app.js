const API_URL = '/api';
const tokenKey = 'radiance_token';
const userIdKey = 'radiance_user_id';
let currentRoom = null;
let currentUser = null;
let autoRefreshInterval = null;


let localStream = null;
let signalingWS = null;
let peerConnections = new Map();
let incomingCall = null;
let isAudioEnabled = true;

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

const authScreen = document.getElementById('authScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regPasswordConfirm = document.getElementById('regPasswordConfirm');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const switchToRegister = document.getElementById('switchToRegister');
const switchToLogin = document.getElementById('switchToLogin');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const roomNameInput = document.getElementById('roomNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const inviteCodeInput = document.getElementById('inviteCodeInput');
const joinByInviteBtn = document.getElementById('joinByInviteBtn');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
const roomsList = document.getElementById('roomsList');
const userInfo = document.getElementById('userInfo');
const noChatSelected = document.getElementById('noChatSelected');
const chatContainer = document.getElementById('chatContainer');
const chatRoomName = document.getElementById('chatRoomName');
const chatRoomInfo = document.getElementById('chatRoomInfo');
const messagesList = document.getElementById('messagesList');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const deleteRoomBtn = document.getElementById('deleteRoomBtn');
const copyInviteBtn = document.getElementById('copyInviteBtn');
const roomOwnerControls = document.getElementById('roomOwnerControls');
const notifications = document.getElementById('notifications');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const callBtn = document.getElementById('callBtn');
const incomingCallModal = document.getElementById('incomingCallModal');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const incomingCallInfo = document.getElementById('incomingCallInfo');
const activeCallUI = document.getElementById('activeCallUI');
const endCallBtn = document.getElementById('endCallBtn');
const participantsGrid = document.getElementById('participantsGrid');


loginBtn.addEventListener('click', () => login());
registerBtn.addEventListener('click', () => register());
switchToRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  authError.classList.add('hidden');
});
switchToLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authError.classList.add('hidden');
});


logoutBtn.addEventListener('click', logout);
createRoomBtn.addEventListener('click', createRoom);
refreshRoomsBtn.addEventListener('click', refreshRooms);
joinByInviteBtn.addEventListener('click', joinByInvite);
sendMessageBtn.addEventListener('click', sendMessage);
leaveRoomBtn.addEventListener('click', leaveRoom);
deleteRoomBtn.addEventListener('click', deleteRoom);
copyInviteBtn.addEventListener('click', copyInviteToClipboard);
toggleAudioBtn.addEventListener('click', toggleAudio);
callBtn.addEventListener('click', initiateCall);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
endCallBtn.addEventListener('click', endCall);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});


async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    const userID = localStorage.getItem(userIdKey);

    if (token) headers.Authorization = `Bearer ${token}`;
    if (userID) headers['X-User-ID'] = userID;

    try {
        const res = await fetch(`${API_URL}${path}`, { ...options, headers });
        const text = await res.text();
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            data = { error: text || 'Invalid response' };
        }

        if (!res.ok) {
            const error = data.error || `HTTP ${res.status}`;
            throw new Error(error);
        }
        return data;
    } catch (error) {
        throw error;
    }
}


function getToken() { return localStorage.getItem(tokenKey); }
function setToken(token) { localStorage.setItem(tokenKey, token); }

function setUserSession(token, userId) {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userIdKey, userId);
}

function clearToken() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userIdKey);
}
async function login() {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showAuthError('Введите email и пароль');
        return;
    }

    try {
        const data = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        setUserSession(data.token, data.id || data.userID); 
        currentUser = { email, id: data.id };
        
        loginEmail.value = '';
        loginPassword.value = '';
        showScreen('app');
        await loadRooms();
    } catch (error) {
        showAuthError(error.message);
    }
}

async function register() {
    const email = regEmail.value.trim();
    const password = regPassword.value;
    const confirmPassword = regPasswordConfirm.value;

    if (!email || !password || !confirmPassword) {
        showAuthError('Заполните все поля');
        return;
    }
    if (password !== confirmPassword) {
        showAuthError('Пароли не совпадают');
        return;
    }

    try {
        const data = await request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        setUserSession(data.token, data.id || data.userID);
        currentUser = { email, id: data.id };

        regEmail.value = '';
        regPassword.value = '';
        regPasswordConfirm.value = '';
        showScreen('app');
        await loadRooms();
    } catch (error) {
        showAuthError(error.message);
    }
}

function logout() {
  clearToken();
  currentRoom = null;
  currentUser = null;
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  closeSignalingConnection();
  endCall();
  showScreen('auth');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  messagesList.innerHTML = '';
  roomsList.innerHTML = '';
}

async function loadRooms() {
  try {
    const rooms = await request('/rooms');
    roomsList.innerHTML = '';

    if (rooms.length === 0) {
      roomsList.innerHTML = '<li style="padding: 12px; color: var(--text-muted); text-align: center;">Нет доступных комнат</li>';
      return;
    }

    rooms.forEach(room => {
      const li = document.createElement('li');
      li.className = 'room-item';
      if (currentRoom && currentRoom.id === room.id) {
        li.classList.add('active');
      }

      li.innerHTML = `
        <div class="room-item-title">${escapeHtml(room.name)}</div>
        <div class="room-item-meta">${room.type === 'public' ? '🌍 Публичная' : '🔒 Приватная'}</div>
      `;

      li.addEventListener('click', () => joinRoom(room.id));
      roomsList.appendChild(li);
    });
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function refreshRooms() {
  refreshRoomsBtn.disabled = true;
  try {
    await loadRooms();
  } finally {
    refreshRoomsBtn.disabled = false;
  }
}

async function createRoom() {
    const roomName = document.getElementById('roomName').value;
    const roomType = document.getElementById('roomType').value;
    
    const userID = localStorage.getItem('user_id'); 
    const token = localStorage.getItem('auth_token');

    if (!userID || !token) {
        alert("Вы не авторизованы!");
        return;
    }

    const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-ID': userID        },
        body: JSON.stringify({ name: roomName, type: roomType })
    });

    if (response.ok) {
        // Обновить список комнат
    } else {
        const errorData = await response.text();
        console.error("Ошибка сервера:", errorData);
    }
}

async function joinRoom(roomID) {
  try {
    await request(`/rooms/${roomID}/join`, { method: 'POST', body: '{}' });
    currentRoom = await request(`/rooms/${roomID}`);
    updateChatUI();
    await loadMessages();
    await loadRooms();
    await initializeSignaling();
    startAutoRefresh();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function joinByInvite() {
  const invite = inviteCodeInput.value.trim();

  if (!invite) {
    showNotification('Введите код приглашения', 'error');
    return;
  }

  try {
    joinByInviteBtn.disabled = true;
    await request(`/invites/${invite}`, { method: 'POST', body: '{}' });
    inviteCodeInput.value = '';
    await loadRooms();
    showNotification('Вы присоединились к комнате');
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    joinByInviteBtn.disabled = false;
  }
}

async function leaveRoom() {
  if (!currentRoom) return;

  try {
    endCall();
    closeSignalingConnection();
    await request(`/rooms/${currentRoom.id}/leave`, { method: 'POST', body: '{}' });
    currentRoom = null;
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    updateChatUI();
    messagesList.innerHTML = '';
    await loadRooms();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function deleteRoom() {
  if (!currentRoom) return;

  if (!confirm('Вы уверены, что хотите удалить эту комнату?')) return;

  try {
    deleteRoomBtn.disabled = true;
    endCall();
    await request(`/rooms/${currentRoom.id}`, { method: 'DELETE' });
    await leaveRoom();
    await loadRooms();
    showNotification('Комната удалена');
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    deleteRoomBtn.disabled = false;
  }
}

function copyInviteToClipboard() {
  if (!currentRoom || !currentRoom.invite_link) return;

  navigator.clipboard.writeText(currentRoom.invite_link).then(() => {
    showNotification('Приглашение скопировано в буфер обмена');
  }).catch(() => {
    showNotification('Не удалось скопировать', 'error');
  });
}

async function loadMessages() {
  if (!currentRoom) return;

  try {
    const messages = await request(`/rooms/${currentRoom.id}/messages`);
    messagesList.innerHTML = '';

    if (messages.length === 0) {
      messagesList.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Сообщений нет</li>';
      return;
    }

    messages.forEach(msg => {
      const li = document.createElement('li');
      li.className = 'message-item';

      const initials = msg.username.substring(0, 2).toUpperCase();
      const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      li.innerHTML = `
        <div class="message-avatar">${escapeHtml(initials)}</div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-username">${escapeHtml(msg.username)}</span>
            <span class="message-time">${time}</span>
          </div>
          <div class="message-text">${escapeHtml(msg.content)}</div>
        </div>
      `;

      messagesList.appendChild(li);
    });

    messagesList.scrollTop = messagesList.scrollHeight;
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function sendMessage() {
  if (!currentRoom) {
    showNotification('Сначала войдите в комнату', 'error');
    return;
  }

  const content = messageInput.value.trim();
  if (!content) return;

  try {
    sendMessageBtn.disabled = true;
    await request(`/rooms/${currentRoom.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });

    messageInput.value = '';
    await loadMessages();
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    sendMessageBtn.disabled = false;
  }
}

async function initializeSignaling() {
  if (!currentRoom || !currentUser) return;

  try {
    await initializeAudio();
    connectSignaling();
  } catch (error) {
    showNotification('Не удалось инициализировать микрофон: ' + error.message, 'error');
  }
}

async function initializeAudio() {
  if (localStream) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    toggleAudioBtn.classList.add('active');
    showNotification('Микрофон включен');
  } catch (error) {
    showNotification('Нет доступа к микрофону', 'error');
    throw error;
  }
}

function connectSignaling() {
  if (!currentRoom) return;

  const token = getToken();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsURL = `${protocol}//${window.location.host}/api/signaling?room=${currentRoom.id}`;

  signalingWS = new WebSocket(wsURL);
  signalingWS.onopen = () => {
    console.log('Signaling connected');
  };

  signalingWS.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    handleSignalingMessage(msg);
  };

  signalingWS.onerror = (error) => {
    console.error('Signaling error:', error);
    showNotification('Ошибка соединения', 'error');
  };

  signalingWS.onclose = () => {
    console.log('Signaling disconnected');
  };
}

function closeSignalingConnection() {
  if (signalingWS) {
    signalingWS.close();
    signalingWS = null;
  }
}

async function handleSignalingMessage(msg) {
  try {
    switch (msg.type) {
      case 'join':
        handlePeerJoin(msg);
        break;
      case 'call-offer':
        handleCallOffer(msg);
        break;
      case 'call-answer':
        handleCallAnswer(msg);
        break;
      case 'ice-candidate':
        handleIceCandidate(msg);
        break;
      case 'call-end':
        handleCallEnd(msg);
        break;
      case 'leave':
        handlePeerLeave(msg);
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

function handlePeerJoin(msg) {
  const peerId = msg.from;
  if (peerId === msg.From) return; // Don't handle own join
  console.log('Peer joined:', peerId);
}

async function handleCallOffer(msg) {
  const peerId = msg.from;
  if (incomingCall) {
    sendSignalingMessage({
      type: 'call-end',
      to: peerId
    });
    return;
  }

  incomingCall = { peerId, offer: msg.data };
  incomingCallInfo.textContent = `Входящий вызов...`;
  incomingCallModal.classList.remove('hidden');
}

async function handleCallAnswer(msg) {
  const peerId = msg.from;
  const peerConn = peerConnections.get(peerId);
  if (!peerConn) return;

  await peerConn.setRemoteDescription(new RTCSessionDescription(msg.data));
  updateCallUI();
}

async function handleIceCandidate(msg) {
  const peerId = msg.from;
  const peerConn = peerConnections.get(peerId);
  if (!peerConn) return;

  if (msg.data) {
    try {
      await peerConn.addIceCandidate(new RTCIceCandidate(msg.data));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
}

function handleCallEnd(msg) {
  const peerId = msg.from;
  closePeerConnection(peerId);
  if (peerConnections.size === 0) {
    endCall();
  }
}

function handlePeerLeave(msg) {
  const peerId = msg.from;
  closePeerConnection(peerId);
  if (peerConnections.size === 0) {
    endCall();
  }
}

function sendSignalingMessage(msg) {
  if (!signalingWS || signalingWS.readyState !== WebSocket.OPEN) {
    console.error('Signaling not connected');
    return;
  }

  signalingWS.send(JSON.stringify(msg));
}

async function initiateCall() {
  if (!currentRoom || !localStream) {
    showNotification('Включите микрофон и войдите в комнату', 'error');
    return;
  }

  if (peerConnections.size > 0) {
    showNotification('Звонок уже активен', 'error');
    return;
  }

  try {
    // Announce call to all peers
    sendSignalingMessage({
      type: 'call-announce'
    });

    activeCallUI.classList.remove('hidden');
    updateCallUI();
  } catch (error) {
    showNotification('Не удалось инициировать звонок', 'error');
  }
}

async function acceptCall() {
  if (!incomingCall) return;

  incomingCallModal.classList.add('hidden');

  try {
    const peerConn = createPeerConnection(incomingCall.peerId);
    await peerConn.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

    const answer = await peerConn.createAnswer();
    await peerConn.setLocalDescription(answer);

    sendSignalingMessage({
      type: 'call-answer',
      to: incomingCall.peerId,
      data: answer
    });

    incomingCall = null;
    activeCallUI.classList.remove('hidden');
    updateCallUI();
  } catch (error) {
    console.error('Error accepting call:', error);
    showNotification('Не удалось принять вызов', 'error');
    incomingCall = null;
  }
}

function rejectCall() {
  if (!incomingCall) return;

  sendSignalingMessage({
    type: 'call-end',
    to: incomingCall.peerId
  });

  incomingCall = null;
  incomingCallModal.classList.add('hidden');
}

function createPeerConnection(peerId) {
  if (peerConnections.has(peerId)) {
    return peerConnections.get(peerId);
  }

  const peerConn = new RTCPeerConnection({ iceServers });

  // Add local stream
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConn.addTrack(track, localStream);
    });
  }

  peerConn.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        type: 'ice-candidate',
        to: peerId,
        data: event.candidate
      });
    }
  };

  peerConn.onconnectionstatechange = () => {
    console.log('Connection state:', peerConn.connectionState);
    if (peerConn.connectionState === 'failed' || peerConn.connectionState === 'disconnected') {
      closePeerConnection(peerId);
      if (peerConnections.size === 0) {
        endCall();
      }
    }
  };

  peerConnections.set(peerId, peerConn);
  return peerConn;
}

function closePeerConnection(peerId) {
  const peerConn = peerConnections.get(peerId);
  if (peerConn) {
    peerConn.close();
    peerConnections.delete(peerId);
  }

  const card = document.getElementById(`peer-${peerId}`);
  if (card) card.remove();
}

function updateCallUI() {
  participantsGrid.innerHTML = '';

  peerConnections.forEach((peerConn, peerId) => {
    const card = document.createElement('div');
    card.id = `peer-${peerId}`;
    card.className = 'participant-card';
    card.innerHTML = `
      <div class="participant-video">
        <span>🎧</span>
      </div>
      <div class="participant-info">
        <span class="participant-name">Участник</span>
        <span class="participant-audio-state">${peerConn.connectionState}</span>
      </div>
    `;
    participantsGrid.appendChild(card);
  });
}

function toggleAudio() {
  if (!localStream) {
    showNotification('Включите микрофон', 'error');
    return;
  }

  isAudioEnabled = !isAudioEnabled;
  localStream.getAudioTracks().forEach(track => {
    track.enabled = isAudioEnabled;
  });

  toggleAudioBtn.style.opacity = isAudioEnabled ? '1' : '0.5';
  showNotification(isAudioEnabled ? 'Микрофон включен' : 'Микрофон отключен');
}

function endCall() {
  peerConnections.forEach((peerConn, peerId) => {
    sendSignalingMessage({
      type: 'call-end',
      to: peerId
    });
    closePeerConnection(peerId);
  });

  activeCallUI.classList.add('hidden');
  incomingCallModal.classList.add('hidden');
  incomingCall = null;
  participantsGrid.innerHTML = '';
}


function showScreen(screen) {
  authScreen.classList.toggle('active', screen === 'auth');
  appScreen.classList.toggle('active', screen === 'app');
}

function updateChatUI() {
  if (currentRoom) {
    noChatSelected.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    chatRoomName.textContent = currentRoom.name;
    chatRoomInfo.textContent = `Приглашение: ${currentRoom.invite_link}`;

    const isOwner = currentRoom.is_owner;
    roomOwnerControls.classList.toggle('hidden', !isOwner);
  } else {
    noChatSelected.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    messagesList.innerHTML = '';
  }

  userInfo.textContent = currentUser ? `👤 ${currentUser.email}` : '';
}

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type === 'error' ? 'error' : ''}`;
  notification.textContent = message;

  notifications.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function startAutoRefresh() {
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);

  autoRefreshInterval = setInterval(async () => {
    if (currentRoom) {
      try {
        await loadMessages();
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    }
  }, 3000);
}


async function init() {
    const token = getToken();
    const userID = localStorage.getItem(userIdKey);
    if (token && userID) {
        try {
            showScreen('app');
            currentUser = { email: 'User', id: userID };
            updateChatUI();
            await loadRooms();
        } catch (error) {
            clearToken();
            showScreen('auth');
        }
    } else {
        showScreen('auth');
    }
}

init();
