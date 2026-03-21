// ── Room Selection ──
function getDMDisplayName(roomName) {
    const parts = roomName.split(':dm:');
    return parts[0] === username ? parts[1] : parts[0];
}

async function showRoomSelect() {
    document.getElementById('room-username').textContent = username;
    try {
        const res = await authFetch('/api/v1/rooms');
        const rooms = await res.json();
        const list = document.getElementById('room-list');
        const defaultRooms = [{name:'General',hasPassword:false,creator:'system',isDM:false},{name:'Random',hasPassword:false,creator:'system',isDM:false}];
        const allRooms = [...defaultRooms];
        rooms.forEach(r => { if(!allRooms.find(d => d.name === r.name)) allRooms.push(r); });

        const groupRooms = allRooms.filter(r => !r.isDM && !r.name.includes(':dm:'));
        const dmRooms = allRooms.filter(r => r.isDM || r.name.includes(':dm:'));

        let html = groupRooms.map(r => `
            <li class="room-item${room === r.name ? ' active' : ''}" data-room="${escapeHtml(r.name)}" data-locked="${r.hasPassword}">
                <span class="ri-icon">#</span>
                <span class="ri-name">${escapeHtml(r.name)}</span>
                ${r.hasPassword ? '<span class="ri-lock"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>' : ''}
                ${r.creator !== 'system' ? `<button class="room-delete-btn" data-del="${escapeHtml(r.name)}" title="Delete room"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>` : ''}
            </li>
        `).join('');

        if (dmRooms.length > 0) {
            html += '<li class="room-section-header">Direct Messages</li>';
            html += dmRooms.map(r => {
                const displayName = getDMDisplayName(r.name);
                const color = getColor(displayName);
                return `<li class="room-item dm-item${room === r.name ? ' active' : ''}" data-room="${escapeHtml(r.name)}" data-locked="false">
                    <span class="ri-icon ri-dm" style="background:${color}">@</span>
                    <span class="ri-name">${escapeHtml(displayName)}</span>
                </li>`;
            }).join('');
        }

        list.innerHTML = html;
        list.querySelectorAll('.room-item').forEach(el => el.addEventListener('click', (e) => {
            if (e.target.closest('.room-delete-btn')) return;
            const name = el.dataset.room;
            const locked = el.dataset.locked === 'true';
            if (locked) {
                showPasswordModal(name);
            } else {
                joinRoom(name, null);
            }
        }));
        list.querySelectorAll('.room-delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const name = btn.dataset.del;
            if (confirm(`Delete room "${name}"? All messages will be lost.`)) {
                socket.emit('delete room', { name });
            }
        }));
    } catch(e) {}
}

// ── Password Modal ──
let pendingRoom = null;
const pwModal = document.getElementById('password-modal');
const pwInput = document.getElementById('pw-modal-input');
const pwError = document.getElementById('pw-modal-error');

function showPasswordModal(roomName) {
    pendingRoom = roomName;
    document.getElementById('pw-modal-room').textContent = `Enter password for "${roomName}"`;
    pwInput.value = '';
    pwError.textContent = '';
    pwModal.style.display = 'flex';
    pwInput.focus();
}

document.getElementById('pw-modal-join').addEventListener('click', () => {
    const pass = pwInput.value.trim();
    if (!pass) { pwError.textContent = 'Password is required'; return; }
    pwModal.style.display = 'none';
    joinRoom(pendingRoom, pass);
});

document.getElementById('pw-modal-cancel').addEventListener('click', () => {
    pwModal.style.display = 'none';
    pendingRoom = null;
});

pwInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pw-modal-join').click();
});

document.getElementById('create-room-btn').addEventListener('click', () => {
    const name = document.getElementById('new-room-name').value.trim();
    if (!name) return;
    const pass = document.getElementById('new-room-pass').value.trim();
    socket.emit('create room', { name, password: pass || null });
});

// Join existing room by name + password
document.getElementById('join-room-btn').addEventListener('click', () => {
    const name = document.getElementById('join-room-name').value.trim();
    if (!name) { document.getElementById('room-error').textContent = 'Enter a room name'; return; }
    const pass = document.getElementById('join-room-pass').value.trim();
    document.getElementById('room-error').textContent = '';
    joinRoom(name, pass || null);
});

function joinRoom(name, password) {
    room = name;
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-view').style.display = 'flex';
    const isDM = room.includes(':dm:');
    document.getElementById('current-room').textContent = isDM ? getDMDisplayName(room) : room;
    document.getElementById('current-user').textContent = username;
    // Highlight active room
    document.querySelectorAll('.room-item').forEach(el => {
        el.classList.toggle('active', el.dataset.room === name);
    });
    // On mobile, show chat panel
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        document.getElementById('app-container').classList.add('show-chat');
    }
    messages.innerHTML = `
        <li class="skeleton-msg left"><div class="sk-line" style="width:70%"></div><div class="sk-line"></div></li>
        <li class="skeleton-msg right"><div class="sk-line" style="width:60%"></div><div class="sk-line"></div></li>
        <li class="skeleton-msg left"><div class="sk-line" style="width:80%"></div><div class="sk-line"></div></li>
    `;
    lastDateStr = null; oldestTimestamp = null; hasMore = true; historyLoaded = false;
    socket.emit('join room', { room: name, password });
    input.focus();
}

// Go back to room list on mobile
function goBackToRoomList() {
    room = null;
    document.getElementById('app-container').classList.remove('show-chat');
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('chat-empty').style.display = 'flex';
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
}

// Handle window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        updateAppDisplay();
        // On desktop, always show room panel
        if (window.innerWidth > 768) {
            const app = document.getElementById('app-container');
            app.classList.remove('show-chat');
        }
    }, 50);
});

// Handle orientation change on mobile
window.addEventListener('orientationchange', () => {
    setTimeout(updateAppDisplay, 100);
});

// Add mobile back button functionality
const mobileBackBtn = document.getElementById('mobile-back-btn');
if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', goBackToRoomList);
}

// Also handle Escape key to go back on mobile
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.innerWidth <= 768) {
        const app = document.getElementById('app-container');
        if (app && app.classList.contains('show-chat') && room) {
            goBackToRoomList();
        }
    }
});
