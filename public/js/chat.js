// ── Elements ──
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typing-indicator');
const fileInput = document.getElementById('file-input');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const scrollBottomBtn = document.getElementById('scroll-bottom');

let typingTimer, selectedFile = null, replyTarget = null;
let lastDateStr = null, oldestTimestamp = null, hasMore = true, loadingMore = false, historyLoaded = false;
let contextMsgId = null, contextMsgUser = null, contextMsgText = null;

// ── Link preview cache ──
const linkPreviews = new Map();
async function fetchLinkPreview(url, container) {
    if (linkPreviews.has(url)) { renderPreview(linkPreviews.get(url), container); return; }
    try {
        const res = await authFetch(`/api/v1/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.title) { linkPreviews.set(url, data); renderPreview(data, container); }
    } catch(e){}
}
function renderPreview(data, container) {
    const el = document.createElement('a');
    el.className = 'link-preview'; el.href = data.url; el.target = '_blank'; el.rel = 'noopener';
    el.innerHTML = (data.image ? `<img class="lp-img" src="${escapeHtml(data.image)}" loading="lazy">` : '')
        + `<div class="lp-title">${escapeHtml(data.title)}</div>`
        + (data.description ? `<div class="lp-desc">${escapeHtml(data.description)}</div>` : '');
    container.appendChild(el);
}

function setupSocketEvents() {
    socket.on('load messages', (docs) => {
        document.querySelectorAll('.skeleton-msg').forEach(s => s.remove());
        historyLoaded = true; lastDateStr = null;
        if (docs.length < 50) hasMore = false;
        docs.forEach(msg => displayMessage(msg));
        socket.emit('mark seen', { room });
    });

    socket.on('chat message', (msg) => {
        displayMessage(msg);
        if (msg.user !== username) {
            if (document.hidden) playSound();
            incrementUnread();
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                const isDM = room && room.includes(':dm:');
                const title = isDM ? msg.user : `${msg.user} in ${room}`;
                const color = getColor(msg.user);
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = color;
                ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 32px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(msg.user[0].toUpperCase(), 32, 32);
                const n = new Notification(title, {
                    body: msg.text || 'File attachment',
                    icon: canvas.toDataURL()
                });
                n.onclick = () => { window.focus(); n.close(); };
            }
            socket.emit('deliver message', { _id: msg._id, room });
        }
    });

    socket.on('more messages', (docs) => {
        loadingMore = false;
        const spinner = document.getElementById('load-more-spinner');
        if (spinner) spinner.style.display = 'none';
        if (docs.length < 30) hasMore = false;
        if (!docs.length) return;
        const sh = messages.scrollHeight;
        const first = messages.firstElementChild;
        let prevDate = null;
        docs.forEach(msg => {
            const label = getDateLabel(msg.timestamp);
            if (label !== prevDate) {
                const sep = document.createElement('li'); sep.className='date-separator'; sep.textContent=label;
                messages.insertBefore(sep, first); prevDate = label;
            }
            displayMessage(msg, true, first);
        });
        messages.scrollTop = messages.scrollHeight - sh;
    });

    socket.on('message status', (d) => {
        const el = document.querySelector(`[data-status-id="${d._id}"]`);
        if (el) el.textContent = d.status === 'delivered' ? '✓✓' : '✓';
    });

    socket.on('message edited', (d) => {
        const el = document.querySelector(`[data-msg-id="${d._id}"]`);
        if (!el) return;
        const textDiv = el.querySelector('.msg-text');
        if (textDiv) textDiv.innerHTML = renderMarkdown(d.text);
        if (!el.querySelector('.edited-tag')) {
            const info = el.querySelector('.message-info');
            if (info) { const tag = document.createElement('span'); tag.className='edited-tag'; tag.textContent='(edited)'; info.appendChild(tag); }
        }
    });

    socket.on('message deleted', (d) => {
        const el = document.querySelector(`[data-msg-id="${d._id}"]`);
        if (!el) return;
        el.classList.add('deleted-msg');
        el.innerHTML = '<div class="message-info" style="opacity:.5">Message deleted</div>';
    });

    socket.on('message reactions', (d) => {
        const el = document.querySelector(`[data-msg-id="${d._id}"]`);
        if (!el) return;
        let bar = el.querySelector('.reactions-bar');
        if (!bar) { bar = document.createElement('div'); bar.className='reactions-bar'; el.appendChild(bar); }
        bar.innerHTML = d.reactions.filter(r => r.users.length > 0).map(r =>
            `<span class="reaction-chip ${r.users.includes(username)?'own-reaction':''}" data-emoji="${r.emoji}" data-mid="${d._id}">${r.emoji}<span class="rc-count">${r.users.length}</span></span>`
        ).join('');
        bar.querySelectorAll('.reaction-chip').forEach(c => c.addEventListener('click', () => {
            socket.emit('add reaction', { _id: c.dataset.mid, emoji: c.dataset.emoji });
        }));
    });

    socket.on('messages seen', (d) => {
        document.querySelectorAll('.seen-info').forEach(el => el.remove());
        const msgs = document.querySelectorAll('.msg-wrapper.own .message');
        const last = msgs[msgs.length - 1];
        if (last) {
            const s = document.createElement('div'); s.className='seen-info'; s.textContent=`Seen by ${d.user}`;
            last.appendChild(s);
        }
    });

    socket.on('typing', (d) => {
        if (d.user !== username) {
            typingIndicator.innerHTML = `<span>${escapeHtml(d.user)}</span><span class="typing-dots"><span></span><span></span><span></span></span>`;
        }
    });
    socket.on('stop typing', (d) => { if(d.user!==username) typingIndicator.innerHTML=''; });

    socket.on('rate limited', () => { showToast('rate-toast'); });

    socket.on('users list', (users) => {
        document.getElementById('users-count').textContent = users.length;
        const uch = document.getElementById('users-count-header');
        if (uch) uch.textContent = users.length;
        const userHtml = users.map(u => {
            const c = getColor(u);
            return `<li class="user-chip" data-user="${escapeHtml(u)}"><span class="avatar-sm" style="background:${c}">${escapeHtml(u[0].toUpperCase())}</span>${escapeHtml(u)}</li>`;
        }).join('');
        document.getElementById('users-list').innerHTML = userHtml;
        const ulh = document.getElementById('users-list-header');
        if (ulh) ulh.innerHTML = userHtml;
        // Click user for DM (bind on both lists)
        document.querySelectorAll('.user-chip').forEach(el => el.addEventListener('click', () => {
            const target = el.dataset.user;
            if (target === username) return;
            const dmRoom = [username, target].sort().join(':dm:');
            joinRoom(dmRoom, null);
        }));
    });

    socket.on('room created', (d) => { showRoomSelect(); });
    socket.on('room deleted', (d) => { if(d.name===room){room=null; document.getElementById('chat-view').style.display='none'; document.getElementById('chat-empty').style.display=''; } showRoomSelect(); });
    socket.on('room error', (d) => {
        document.getElementById('chat-view').style.display = 'none';
        document.getElementById('chat-empty').style.display = '';
        room = null;
        showRoomSelect();
        showToast('room-toast', d.message);
    });

    socket.on('search results', (docs) => {
        document.getElementById('search-count').textContent = `${docs.length} result${docs.length!==1?'s':''}`;
        // Highlight matches in chat
        document.querySelectorAll('.message.search-hit').forEach(el => el.classList.remove('search-hit'));
        docs.forEach(d => {
            const el = document.querySelector(`[data-msg-id="${d._id}"]`);
            if (el) { el.classList.add('search-hit'); el.style.outline = `2px solid var(--primary)`; }
        });
    });

    // ── Reconnection ──
    const banner = document.getElementById('reconnect-banner');
    socket.on('disconnect', () => { banner.textContent='Connection lost. Reconnecting…'; banner.className='warn'; });
    socket.on('connect', () => {
        if (banner.classList.contains('warn')) {
            banner.textContent='Reconnected!'; banner.className='ok';
            if (room) socket.emit('join room', { room });
            setTimeout(() => { banner.className=''; banner.style.display='none'; }, 2000);
        }
    });
}

// ── Display Message ──
let prevMsgUser = null;
function displayMessage(msg, prepend = false, refNode = null) {
    if (!prepend) {
        const label = getDateLabel(msg.timestamp);
        if (label !== lastDateStr) {
            const sep = document.createElement('li'); sep.className='date-separator'; sep.textContent=label;
            messages.appendChild(sep); lastDateStr = label;
        }
    }

    const isOwn = msg.user === username;
    const isGrouped = !prepend && prevMsgUser === msg.user;
    if (!prepend) prevMsgUser = msg.user;

    const wrapper = document.createElement('li');
    wrapper.className = `msg-wrapper ${isOwn?'own':'other'} ${isGrouped?'grouped':''}`;

    let avatarHtml = '';
    if (!isOwn) {
        const c = getColor(msg.user);
        avatarHtml = `<div class="avatar-msg" style="background:${c}">${escapeHtml(msg.user[0].toUpperCase())}</div>`;
    }

    const statusHtml = isOwn ? `<span class="msg-status" data-status-id="${msg._id}">${msg.status==='delivered'?'✓✓':'✓'}</span>` : '';
    const editedHtml = msg.edited ? '<span class="edited-tag">(edited)</span>' : '';

    let content = '';
    if (msg.deleted) {
        content = '<div class="message-info" style="opacity:.5">Message deleted</div>';
    } else {
        content = `<div class="message-info"><strong>${escapeHtml(msg.user)}</strong> · ${escapeHtml(msg.time)} ${statusHtml} ${editedHtml}</div>`;
        if (msg.replyTo && msg.replyTo.user) {
            content += `<div class="reply-quote"><div class="rq-user">${escapeHtml(msg.replyTo.user)}</div><div class="rq-text">${escapeHtml(msg.replyTo.text)}</div></div>`;
        }
        if (msg.text) {
            if (isEncrypted(msg.text)) {
                content += `<div class="msg-text e2e-encrypted" data-ct="${escapeHtml(msg.text)}"><span style="opacity:.5">🔒 Decrypting...</span></div>`;
            } else {
                content += `<div class="msg-text">${renderMarkdown(msg.text)}</div>`;
            }
        }
        if (msg.file) {
            if (msg.file.mimetype && msg.file.mimetype.startsWith('image/')) {
                content += `<img class="chat-img" src="${escapeHtml(msg.file.url)}" alt="${escapeHtml(msg.file.originalname)}" loading="lazy">`;
            } else if (msg.file.mimetype && msg.file.mimetype.startsWith('audio/')) {
                content += `<audio controls src="${escapeHtml(msg.file.url)}" style="max-width:200px;margin-top:4px"></audio>`;
            } else {
                content += `<a class="file-link" href="${escapeHtml(msg.file.url)}" download="${escapeHtml(msg.file.originalname)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>${escapeHtml(msg.file.originalname)} (${formatSize(msg.file.size)})</a>`;
            }
        }
        if (msg.reactions && msg.reactions.length) {
            content += '<div class="reactions-bar">' + msg.reactions.filter(r=>r.users.length).map(r =>
                `<span class="reaction-chip ${r.users.includes(username)?'own-reaction':''}" data-emoji="${r.emoji}" data-mid="${msg._id}">${r.emoji}<span class="rc-count">${r.users.length}</span></span>`
            ).join('') + '</div>';
        }
    }

    const bubble = document.createElement('div');
    bubble.className = `message ${isOwn?'own':'other'} ${msg.deleted?'deleted-msg':''} ${isGrouped?'grouped-msg':''}`;
    bubble.setAttribute('data-msg-id', msg._id);
    bubble.innerHTML = content;

    // Context menu on right-click
    if (!msg.deleted) {
        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMsgId = msg._id; contextMsgUser = msg.user; contextMsgText = msg.text;
            const ctx = document.getElementById('context-menu');
            ctx.style.display = 'block';
            ctx.style.left = Math.min(e.clientX, window.innerWidth - 170) + 'px';
            ctx.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
            // Show/hide edit/delete based on ownership
            ctx.querySelector('[data-action="edit"]').style.display = isOwn ? '' : 'none';
            ctx.querySelector('[data-action="delete"]').style.display = isOwn ? '' : 'none';
        });

        bubble.addEventListener('dblclick', (e) => {
            const rp = document.getElementById('reaction-picker');
            rp.classList.add('open');
            rp.style.left = Math.min(e.clientX - 60, window.innerWidth - 220) + 'px';
            rp.style.top = (e.clientY - 40) + 'px';
            rp.dataset.mid = msg._id;
        });
    }

    // Reaction chip clicks
    bubble.querySelectorAll('.reaction-chip').forEach(c => c.addEventListener('click', () => {
        socket.emit('add reaction', { _id: c.dataset.mid, emoji: c.dataset.emoji });
    }));

    wrapper.innerHTML = avatarHtml;
    wrapper.appendChild(bubble);

    if (prepend && refNode) {
        messages.insertBefore(wrapper, refNode);
    } else {
        messages.appendChild(wrapper);
        // Auto-scroll if near bottom
        if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120) {
            messages.scrollTop = messages.scrollHeight;
        }
    }

    if (!oldestTimestamp || new Date(msg.timestamp) < new Date(oldestTimestamp)) {
        oldestTimestamp = msg.timestamp;
    }

    // Decrypt E2EE messages
    if (msg.text && isEncrypted(msg.text) && !msg.deleted) {
        const passphrase = getE2EKey() || room;
        decryptMessage(msg.text, passphrase).then(plain => {
            const el = bubble.querySelector('.e2e-encrypted');
            if (el) el.innerHTML = plain ? '🔒 ' + renderMarkdown(plain) : '<span style="opacity:.5">🔒 Encrypted message</span>';
        });
    }

    // Fetch link previews
    if (msg.text && !msg.deleted && !isEncrypted(msg.text)) {
        const urls = msg.text.match(/https?:\/\/[^\s]+/g);
        if (urls) urls.slice(0,1).forEach(url => fetchLinkPreview(url, bubble));
    }
}

// ── Context Menu Actions ──
document.addEventListener('click', () => { document.getElementById('context-menu').style.display='none'; document.getElementById('reaction-picker').classList.remove('open'); });
document.querySelectorAll('.ctx-item').forEach(el => el.addEventListener('click', () => {
    const action = el.dataset.action;
    if (action === 'reply') {
        replyTarget = { _id: contextMsgId, user: contextMsgUser, text: contextMsgText || 'File attachment' };
        document.getElementById('reply-label').textContent = `Replying to ${contextMsgUser}`;
        document.getElementById('reply-snippet').textContent = replyTarget.text;
        document.getElementById('reply-preview').style.display = 'flex';
        input.focus();
    } else if (action === 'edit') {
        const newText = prompt('Edit message:', contextMsgText);
        if (newText !== null && newText.trim()) socket.emit('edit message', { _id: contextMsgId, text: newText.trim() });
    } else if (action === 'delete') {
        if (confirm('Delete this message?')) socket.emit('delete message', { _id: contextMsgId });
    }
}));

// Reaction picker
document.querySelectorAll('.react-emoji').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    const rp = document.getElementById('reaction-picker');
    socket.emit('add reaction', { _id: rp.dataset.mid, emoji: el.dataset.emoji });
    rp.classList.remove('open');
}));

// ── Typing ──
input.addEventListener('input', () => {
    if (!socket || !room) return;
    socket.emit('typing', { user: username, room });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('stop typing', { user: username, room }), 1000);
});

// ── File ──
document.getElementById('file-button').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) { document.getElementById('file-name').textContent=selectedFile.name; document.getElementById('file-preview').style.display='flex'; }
});
document.getElementById('remove-file').addEventListener('click', () => { selectedFile=null; fileInput.value=''; document.getElementById('file-preview').style.display='none'; });

// ── Drag & Drop ──
const dropZone = document.getElementById('drop-zone');
messages.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
messages.addEventListener('dragleave', () => dropZone.classList.remove('active'));
messages.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('active');
    if (e.dataTransfer.files.length) {
        selectedFile = e.dataTransfer.files[0];
        document.getElementById('file-name').textContent = selectedFile.name;
        document.getElementById('file-preview').style.display = 'flex';
    }
});

// ── Voice Recording ──
let mediaRecorder, audioChunks = [], voiceTimer, voiceSeconds = 0;
const voiceBtn = document.getElementById('voice-btn');
const voiceIndicator = document.getElementById('voice-indicator');

voiceBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = []; voiceSeconds = 0;
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            clearInterval(voiceTimer);
            voiceIndicator.style.display = 'none';
            voiceBtn.classList.remove('recording');
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
            selectedFile = file;
            document.getElementById('file-name').textContent = 'Voice message';
            document.getElementById('file-preview').style.display = 'flex';
        };
        mediaRecorder.start();
        voiceBtn.classList.add('recording');
        voiceIndicator.style.display = 'flex';
        voiceTimer = setInterval(() => { voiceSeconds++; document.getElementById('voice-time').textContent=voiceSeconds+'s'; }, 1000);
    } catch(e) { alert('Microphone access denied'); }
});
document.getElementById('cancel-voice').addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); }
    voiceIndicator.style.display = 'none'; voiceBtn.classList.remove('recording');
    clearInterval(voiceTimer); selectedFile = null;
});

// ── Reply ──
document.getElementById('cancel-reply').addEventListener('click', () => { replyTarget=null; document.getElementById('reply-preview').style.display='none'; });

// ── Emoji ──
const emojis = ['😀','😂','😍','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','🎉','✨','💯','🙏','👏','🤝','💪','🙌','😱','🤯','😴','🤮','🤡','👀','💀','☠️','🫡','🫠','😈','🥳','😇','🤩','🥺','😤','🫶','✅','❌','⭐','🌈','🎶','🍕','☕','🏆','💎','🚀','💡','📌','🔔'];
const emojiGrid = document.getElementById('emoji-grid');
emojis.forEach(e => {
    const btn = document.createElement('button'); btn.type='button'; btn.className='emoji-item'; btn.textContent=e;
    btn.addEventListener('click', () => {
        const pos = input.selectionStart;
        input.value = input.value.slice(0,pos)+e+input.value.slice(pos);
        input.focus(); input.selectionStart=input.selectionEnd=pos+e.length;
        document.getElementById('emoji-picker').classList.remove('open');
    });
    emojiGrid.appendChild(btn);
});
document.getElementById('emoji-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('emoji-picker').classList.toggle('open'); });
document.addEventListener('click', (e) => {
    const p = document.getElementById('emoji-picker');
    if (!p.contains(e.target) && e.target.id !== 'emoji-btn') p.classList.remove('open');
});

// ── Lightbox ──
lightbox.addEventListener('click', () => lightbox.classList.remove('active'));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        lightbox.classList.remove('active');
        document.getElementById('context-menu').style.display = 'none';
        document.getElementById('reaction-picker').classList.remove('open');
        document.getElementById('emoji-picker').classList.remove('open');
        const searchBar = document.getElementById('search-bar');
        if (searchBar.classList.contains('open')) {
            document.getElementById('search-toggle').click();
        }
    }
    // Keyboard navigation for context menu
    const ctx = document.getElementById('context-menu');
    if (ctx.style.display === 'block' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const items = Array.from(ctx.querySelectorAll('[role="menuitem"]')).filter(el => el.style.display !== 'none');
        const current = document.activeElement;
        let idx = items.indexOf(current);
        if (e.key === 'ArrowDown') idx = idx < items.length - 1 ? idx + 1 : 0;
        else idx = idx > 0 ? idx - 1 : items.length - 1;
        items[idx].focus();
    }
    if (ctx.style.display === 'block' && e.key === 'Enter' && document.activeElement.hasAttribute('role')) {
        document.activeElement.click();
    }
});
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('chat-img')) { lightboxImg.src=e.target.src; lightbox.classList.add('active'); }
});

// ── Search ──
const searchToggle = document.getElementById('search-toggle');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
searchToggle.addEventListener('click', () => {
    searchBar.classList.toggle('open');
    searchToggle.classList.toggle('active');
    if (searchBar.classList.contains('open')) searchInput.focus();
    else {
        searchInput.value = '';
        document.getElementById('search-count').textContent = '';
        document.querySelectorAll('.message.search-hit').forEach(el => { el.classList.remove('search-hit'); el.style.outline=''; });
    }
});
document.getElementById('search-close').addEventListener('click', () => searchToggle.click());
let searchTimer;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        const q = searchInput.value.trim();
        if (q && socket) socket.emit('search messages', { room, query: q });
        else { document.getElementById('search-count').textContent=''; document.querySelectorAll('.message.search-hit').forEach(el => {el.classList.remove('search-hit');el.style.outline='';}); }
    }, 400);
});

// ── Users panel ──
document.getElementById('users-toggle').addEventListener('click', () => document.getElementById('users-panel').classList.toggle('open'));

// ── Scroll to bottom ──
messages.addEventListener('scroll', () => {
    const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
    scrollBottomBtn.classList.toggle('visible', !atBottom);
    // Pagination
    if (messages.scrollTop < 50 && hasMore && !loadingMore && historyLoaded) {
        loadingMore = true;
        let spinner = document.getElementById('load-more-spinner');
        if (!spinner) { spinner = document.createElement('li'); spinner.id='load-more-spinner'; spinner.textContent='Loading…'; messages.insertBefore(spinner, messages.firstChild); }
        spinner.style.display = 'block';
        socket.emit('load more messages', { room, before: oldestTimestamp });
    }
});
scrollBottomBtn.addEventListener('click', () => { messages.scrollTop = messages.scrollHeight; });

// ── Send ──
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!socket || !room) return;
    const text = input.value.trim();
    if (!text && !selectedFile) return;

    let fileData = null;
    if (selectedFile) {
        const fd = new FormData(); fd.append('file', selectedFile);
        try {
            const res = await authFetch('/api/v1/upload', { method:'POST', body:fd });
            if (!res.ok) { const err = await res.json(); alert(err.error||'Upload failed'); return; }
            fileData = await res.json();
        } catch(err) { console.error(err); return; }
    }

    let sendText = text;
    if (text && isE2EEnabled()) {
        const passphrase = getE2EKey() || room;
        sendText = await encryptMessage(text, passphrase);
    }
    const payload = { text: sendText, user: username, room, file: fileData };
    if (replyTarget) payload.replyTo = replyTarget;
    socket.emit('chat message', payload);
    socket.emit('stop typing', { user: username, room });

    input.value = '';
    selectedFile = null; fileInput.value = '';
    document.getElementById('file-preview').style.display = 'none';
    replyTarget = null; document.getElementById('reply-preview').style.display = 'none';
});

// ── Auto Login ──
const savedToken = localStorage.getItem('chat_token');
const savedUser = localStorage.getItem('chat_user');
if (savedToken && savedUser) {
    authToken = savedToken; username = savedUser;
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'grid';
    document.getElementById('sidebar-username').textContent = username;
    document.getElementById('sidebar-avatar').textContent = username[0].toUpperCase();
    document.getElementById('sidebar-avatar').style.background = getColor(username);
    connectSocket();
    showRoomSelect();
}
