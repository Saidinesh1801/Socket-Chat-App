// ── Auth ──
let isSignup = true;
const authOverlay = document.getElementById('auth-overlay');
const roomOverlay = document.getElementById('room-overlay');
const authBtn = document.getElementById('auth-btn');
const authError = document.getElementById('auth-error');

const emailInput = document.getElementById('auth-email');
const forgotWrap = document.getElementById('forgot-link-wrap');

function toggleAuthMode() {
    isSignup = !isSignup;
    document.getElementById('auth-title').textContent = isSignup ? 'Sign Up' : 'Log In';
    document.getElementById('auth-subtitle').textContent = isSignup ? 'Create an account to start chatting' : 'Welcome back';
    authBtn.textContent = isSignup ? 'Sign Up' : 'Log In';
    document.getElementById('auth-toggle-text').textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
    document.getElementById('auth-toggle-link').textContent = isSignup ? 'Log In' : 'Sign Up';
    emailInput.style.display = isSignup ? '' : 'none';
    forgotWrap.style.display = isSignup ? 'none' : '';
    authError.textContent = '';
}
document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);

// Show all cards helper
function showAuthCard(id) {
    ['auth-card','forgot-card','otp-card'].forEach(c => document.getElementById(c).style.display = 'none');
    document.getElementById(id).style.display = '';
}

// Forgot Password — Step 1
let resetEmail = '';
document.getElementById('forgot-link').addEventListener('click', () => showAuthCard('forgot-card'));
document.getElementById('forgot-back').addEventListener('click', () => showAuthCard('auth-card'));

document.getElementById('forgot-send-btn').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim();
    const err = document.getElementById('forgot-error');
    err.textContent = '';
    if (!email) { err.textContent = 'Enter your email'; return; }
    const btn = document.getElementById('forgot-send-btn');
    btn.textContent = 'Sending…'; btn.disabled = true;
    try {
        const res = await fetch('/api/v1/forgot-password', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email })
        });
        const data = await res.json();
        btn.textContent = 'Send Code'; btn.disabled = false;
        if (!res.ok) { err.textContent = data.error; return; }
        resetEmail = email;
        document.getElementById('otp-subtitle').textContent = `Code sent to ${email}`;
        showAuthCard('otp-card');
    } catch(e) { btn.textContent = 'Send Code'; btn.disabled = false; err.textContent = 'Network error'; }
});

// Forgot Password — Step 2
document.getElementById('otp-back').addEventListener('click', () => showAuthCard('forgot-card'));

document.getElementById('otp-verify-btn').addEventListener('click', async () => {
    const otp = document.getElementById('otp-code').value.trim();
    const np = document.getElementById('otp-newpass').value.trim();
    const err = document.getElementById('otp-error');
    err.textContent = '';
    if (!otp || !np) { err.textContent = 'Fill in all fields'; return; }
    try {
        const res = await fetch('/api/v1/verify-otp', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email: resetEmail, otp, newPassword: np })
        });
        const data = await res.json();
        if (!res.ok) { err.textContent = data.error; return; }
        err.style.color = 'var(--accent-green)';
        err.textContent = '✅ ' + data.message;
        setTimeout(() => {
            err.style.color = '';
            showAuthCard('auth-card');
            if (isSignup) toggleAuthMode();
        }, 2000);
    } catch(e) { err.textContent = 'Network error'; }
});

authBtn.addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value.trim();
    const em = document.getElementById('auth-email').value.trim();
    authError.textContent = '';
    if (!u || !p) { authError.textContent = 'Fill in all fields'; return; }
    if (isSignup && !em) { authError.textContent = 'Email is required'; return; }
    const body = isSignup ? { username: u, email: em, password: p } : { username: u, password: p };
    try {
        const res = await fetch(`/api/v1/${isSignup?'signup':'login'}`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) { authError.textContent = data.error; return; }
        authToken = data.token; username = data.username;
        localStorage.setItem('chat_token', authToken);
        localStorage.setItem('chat_user', username);
        authOverlay.style.display = 'none';
        document.getElementById('app-container').style.display = 'grid';
        document.getElementById('sidebar-username').textContent = username;
        document.getElementById('sidebar-avatar').textContent = username[0].toUpperCase();
        document.getElementById('sidebar-avatar').style.background = getColor(username);
        connectSocket();
        showRoomSelect();
    } catch(e) { authError.textContent = 'Network error'; }
});
document.querySelectorAll('#auth-username,#auth-password').forEach(el => el.addEventListener('keydown', e => { if(e.key==='Enter') authBtn.click(); }));

function connectSocket() {
    socket = io({ auth: { token: authToken } });
    socket.on('connect_error', (err) => {
        if (err.message === 'Authentication required' || err.message === 'Invalid token') {
            localStorage.removeItem('chat_token'); localStorage.removeItem('chat_user');
            location.reload();
        }
    });
    setupSocketEvents();
}
