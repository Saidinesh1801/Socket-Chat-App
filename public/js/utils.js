// ── Service Worker ──
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Notification permission ──
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

let socket, username, room, authToken;

// ── Helpers ──
function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
const avatarColors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6'];
function getColor(name) { let h=0; for(let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h); return avatarColors[Math.abs(h)%avatarColors.length]; }
function formatSize(b) { if(!b)return '0 B'; const k=1024,s=['B','KB','MB','GB'],i=Math.floor(Math.log(b)/Math.log(k)); return parseFloat((b/Math.pow(k,i)).toFixed(1))+' '+s[i]; }

// ── Markdown-lite ──
function renderMarkdown(text) {
    let t = escapeHtml(text);
    t = t.replace(/```([^`]+)```/g, '<code style="display:block;background:rgba(0,0,0,.08);padding:6px 8px;border-radius:6px;font-size:.8rem;white-space:pre-wrap;margin:4px 0">$1</code>');
    t = t.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,.08);padding:1px 4px;border-radius:3px;font-size:.82rem">$1</code>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;opacity:.9">$1</a>');
    return t;
}

// ── Sound ──
let audioCtx;
function playSound() {
    if (localStorage.getItem('chat_sound') === 'false') return;
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.value = 800; o.type = 'sine';
        g.gain.setValueAtTime(0.06, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        o.start(); o.stop(audioCtx.currentTime + 0.12);
    } catch(e){}
}

// ── Unread ──
let unreadCount = 0;
function incrementUnread() { if(document.hidden){unreadCount++;document.title=`(${unreadCount}) Chat`;} }
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { unreadCount=0; document.title='Chat'; if(room) socket.emit('mark seen',{room}); }
});

// ── Theme ──
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.theme === t);
    });
}
setTheme(localStorage.getItem('theme') || 'light');
document.querySelectorAll('.theme-option').forEach(el => el.addEventListener('click', () => setTheme(el.dataset.theme)));

// ── Sidebar Navigation ──
function showMiddlePanel(panelId) {
    ['room-list', 'room-create-panel', 'theme-panel', 'users-sidebar-panel', 'settings-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelector('.room-user-info').style.display = 'none';
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

    if (panelId === 'chat') {
        document.getElementById('room-list').style.display = '';
        document.querySelector('.room-user-info').style.display = '';
        document.getElementById('nav-chat').classList.add('active');
        const crp = document.getElementById('room-create-panel');
        if (crp.dataset.open === '1') crp.style.display = '';
    } else if (panelId === 'theme') {
        document.getElementById('theme-panel').style.display = '';
        document.getElementById('nav-theme').classList.add('active');
    } else if (panelId === 'users') {
        document.getElementById('users-sidebar-panel').style.display = '';
        document.getElementById('nav-users').classList.add('active');
    } else if (panelId === 'settings') {
        document.getElementById('settings-panel').style.display = '';
        document.getElementById('nav-settings').classList.add('active');
        // populate profile
        const nameEl = document.getElementById('settings-profile-name');
        const avatarEl = document.getElementById('settings-avatar');
        if (nameEl && username) nameEl.textContent = username;
        if (avatarEl && username) {
            avatarEl.textContent = username.charAt(0).toUpperCase();
            avatarEl.style.background = getColor(username);
        }
    }

    // Toggle right-panel view: settings detail vs chat empty
    const settingsDetail = document.getElementById('settings-detail');
    const chatEmpty = document.getElementById('chat-empty');
    const chatView = document.getElementById('chat-view');
    if (panelId === 'settings') {
        if (settingsDetail) settingsDetail.style.display = '';
        if (chatEmpty) chatEmpty.style.display = 'none';
        if (chatView) chatView.style.display = 'none';
        // Reset to default section
        document.querySelectorAll('#settings-detail .settings-section').forEach(s => s.style.display = 'none');
        const def = document.getElementById('settings-default');
        if (def) def.style.display = '';
        document.querySelectorAll('.settings-item').forEach(i => i.classList.remove('active'));
    } else {
        if (settingsDetail) settingsDetail.style.display = 'none';
        if (room && chatView) chatView.style.display = '';
        if (!room && chatEmpty) chatEmpty.style.display = '';
    }
}

document.getElementById('nav-chat').addEventListener('click', () => showMiddlePanel('chat'));
document.getElementById('nav-users').addEventListener('click', () => showMiddlePanel('users'));
document.getElementById('nav-theme').addEventListener('click', () => showMiddlePanel('theme'));
document.getElementById('nav-settings').addEventListener('click', () => showMiddlePanel('settings'));

// ── Settings item click → show detail section ──
function showSettingsSection(sectionId) {
    document.querySelectorAll('#settings-detail .settings-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById('settings-' + sectionId);
    if (target) target.style.display = '';
    document.querySelectorAll('.settings-item').forEach(i => i.classList.remove('active'));
    const item = document.querySelector(`.settings-item[data-section="${sectionId}"]`);
    if (item) item.classList.add('active');

    // Populate account profile
    if (sectionId === 'account' && username) {
        const av = document.getElementById('sd-account-avatar');
        const nm = document.getElementById('sd-account-name');
        if (av) { av.textContent = username.charAt(0).toUpperCase(); av.style.background = getColor(username); }
        if (nm) nm.textContent = username;
    }

    // Sync theme & wallpaper cards active state
    if (sectionId === 'chats') {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        document.querySelectorAll('.sd-theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === current));
        const curWp = document.documentElement.getAttribute('data-wallpaper') || 'none';
        document.querySelectorAll('.sd-wp-card').forEach(c => c.classList.toggle('active', c.dataset.wallpaper === curWp));
    }
}

document.querySelectorAll('.settings-item').forEach(item => {
    item.addEventListener('click', () => showSettingsSection(item.dataset.section));
});

// ── Settings search filter ──
const settingsSearchInput = document.getElementById('settings-search-input');
if (settingsSearchInput) {
    settingsSearchInput.addEventListener('input', () => {
        const q = settingsSearchInput.value.toLowerCase();
        document.querySelectorAll('.settings-item').forEach(item => {
            const title = item.querySelector('.settings-item-title').textContent.toLowerCase();
            const desc = item.querySelector('.settings-item-desc').textContent.toLowerCase();
            item.style.display = (title.includes(q) || desc.includes(q)) ? '' : 'none';
        });
    });
}

// ── Settings detail: Theme cards ──
document.querySelectorAll('.sd-theme-card').forEach(card => {
    card.addEventListener('click', () => {
        setTheme(card.dataset.theme);
        document.querySelectorAll('.sd-theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === card.dataset.theme));
    });
});

// ── Settings detail: Wallpaper ──
const wpPalettes = {
    // Gradients
    'gradient-sunset':   { p:'#f5576c', pr:'245,87,108',  ph:'#e0455a', s:'#fda085', sr:'253,160,133' },
    'gradient-ocean':    { p:'#667eea', pr:'102,126,234', ph:'#5568d4', s:'#764ba2', sr:'118,75,162' },
    'gradient-forest':   { p:'#11998e', pr:'17,153,142',  ph:'#0e8278', s:'#38ef7d', sr:'56,239,125' },
    'gradient-midnight': { p:'#302b63', pr:'48,43,99',    ph:'#252050', s:'#24243e', sr:'36,36,62' },
    'gradient-candy':    { p:'#a18cd1', pr:'161,140,209', ph:'#9079c0', s:'#fbc2eb', sr:'251,194,235' },
    'gradient-fire':     { p:'#f12711', pr:'241,39,17',   ph:'#d92210', s:'#f5af19', sr:'245,175,25' },
    'gradient-aurora':   { p:'#43e97b', pr:'67,233,123',  ph:'#35d46c', s:'#667eea', sr:'102,126,234' },
    'gradient-rose':     { p:'#e91e63', pr:'233,30,99',   ph:'#d11557', s:'#f48fb1', sr:'244,143,177' },
    'gradient-arctic':   { p:'#74ebd5', pr:'116,235,213', ph:'#5dd4be', s:'#acb6e5', sr:'172,182,229' },
    'gradient-dusk':     { p:'#fd746c', pr:'253,116,108', ph:'#e5635b', s:'#2c3e50', sr:'44,62,80' },
    'gradient-neon':     { p:'#00f260', pr:'0,242,96',    ph:'#00d654', s:'#0575e6', sr:'5,117,230' },
    'gradient-peach':    { p:'#f57c5e', pr:'245,124,94',  ph:'#e06a4d', s:'#ff8a65', sr:'255,138,101' },
    // Anime
    'anime-naruto':      { p:'#ff6b00', pr:'255,107,0',   ph:'#e55f00', s:'#ff9a44', sr:'255,154,68' },
    'anime-dbz':         { p:'#ff8c00', pr:'255,140,0',   ph:'#e57e00', s:'#4169e1', sr:'65,105,225' },
    'anime-aot':         { p:'#6c5ce7', pr:'108,92,231',  ph:'#5a4bd1', s:'#636e72', sr:'99,110,114' },
    'anime-onepiece':    { p:'#0077b6', pr:'0,119,182',   ph:'#00669e', s:'#d62828', sr:'214,40,40' },
    'anime-demonslayer': { p:'#00cec9', pr:'0,206,201',   ph:'#00b5b0', s:'#fd79a8', sr:'253,121,168' },
    'anime-mha':         { p:'#00b894', pr:'0,184,148',   ph:'#009e80', s:'#fdcb6e', sr:'253,203,110' },
    'anime-jjk':         { p:'#6c5ce7', pr:'108,92,231',  ph:'#5a4bd1', s:'#e84393', sr:'232,67,147' },
    'anime-spy':         { p:'#d63031', pr:'214,48,49',   ph:'#bf2a2b', s:'#fdcb6e', sr:'253,203,110' },
    'anime-eva':         { p:'#6c3082', pr:'108,48,130',  ph:'#5a2870', s:'#00ff41', sr:'0,255,65' },
    'anime-ghibli':      { p:'#55a3e8', pr:'85,163,232',  ph:'#4590d1', s:'#90ee90', sr:'144,238,144' },
    'anime-death':       { p:'#e94560', pr:'233,69,96',   ph:'#d13b54', s:'#16213e', sr:'22,33,62' },
    'anime-chainsaw':    { p:'#ff5722', pr:'255,87,34',   ph:'#e54d1e', s:'#ffab00', sr:'255,171,0' },
    // Movies
    'movie-starwars':    { p:'#00b4d8', pr:'0,180,216',   ph:'#009dbe', s:'#004e92', sr:'0,78,146' },
    'movie-matrix':      { p:'#00ff41', pr:'0,255,65',    ph:'#00e039', s:'#003300', sr:'0,51,0' },
    'movie-avengers':    { p:'#7b1fa2', pr:'123,31,162',  ph:'#6a1a8c', s:'#ffd54f', sr:'255,213,79' },
    'movie-batman':      { p:'#f1c40f', pr:'241,196,15',  ph:'#d9b00e', s:'#1a1a2e', sr:'26,26,46' },
    'movie-interstellar':{ p:'#0984e3', pr:'9,132,227',   ph:'#0874c9', s:'#3a3a6e', sr:'58,58,110' },
    'movie-spiderman':   { p:'#d32f2f', pr:'211,47,47',   ph:'#bd2929', s:'#1565c0', sr:'21,101,192' },
    'movie-frozen':      { p:'#4fc3f7', pr:'79,195,247',  ph:'#3ab5e8', s:'#0288d1', sr:'2,136,209' },
    'movie-lotr':        { p:'#ffd54f', pr:'255,213,79',  ph:'#f0c83e', s:'#558b2f', sr:'85,139,47' },
    'movie-joker':       { p:'#7e57c2', pr:'126,87,194',  ph:'#6d4aaf', s:'#f9a825', sr:'249,168,37' },
    'movie-inception':   { p:'#ff6f00', pr:'255,111,0',   ph:'#e56300', s:'#283593', sr:'40,53,147' },
    'movie-ironman':     { p:'#ff5722', pr:'255,87,34',   ph:'#e54d1e', s:'#ffc107', sr:'255,193,7' },
    'movie-harrypotter': { p:'#d4a017', pr:'212,160,23',  ph:'#be8f14', s:'#7b1fa2', sr:'123,31,162' },
    // Series
    'series-stranger':   { p:'#d32f2f', pr:'211,47,47',   ph:'#bd2929', s:'#1a0000', sr:'26,0,0' },
    'series-breaking':   { p:'#558b2f', pr:'85,139,47',   ph:'#4a7a28', s:'#f9a825', sr:'249,168,37' },
    'series-got':        { p:'#ff6f00', pr:'255,111,0',   ph:'#e56300', s:'#37474f', sr:'55,71,79' },
    'series-squid':      { p:'#e91e63', pr:'233,30,99',   ph:'#d11557', s:'#00bcd4', sr:'0,188,212' },
    'series-witcher':    { p:'#c0ca33', pr:'192,202,51',  ph:'#adb62d', s:'#424242', sr:'66,66,66' },
    'series-money':      { p:'#d32f2f', pr:'211,47,47',   ph:'#bd2929', s:'#b71c1c', sr:'183,28,28' },
    'series-peaky':      { p:'#c49000', pr:'196,144,0',   ph:'#ab7e00', s:'#546e7a', sr:'84,110,122' },
    'series-wednesday':  { p:'#7e57c2', pr:'126,87,194',  ph:'#6d4aaf', s:'#37474f', sr:'55,71,79' },
    'series-mandalorian':{ p:'#4fc3f7', pr:'79,195,247',  ph:'#3ab5e8', s:'#546e7a', sr:'84,110,122' },
    'series-arcane':     { p:'#e91e63', pr:'233,30,99',   ph:'#d11557', s:'#ff6f00', sr:'255,111,0' },
    'series-dark':       { p:'#f1c40f', pr:'241,196,15',  ph:'#d9b00e', s:'#1b2631', sr:'27,38,49' },
    'series-loki':       { p:'#4caf50', pr:'76,175,80',   ph:'#43a047', s:'#ffd54f', sr:'255,213,79' },
};

function applyWpPalette(wp) {
    const el = document.documentElement;
    const pal = wpPalettes[wp];
    if (!pal || wp === 'none') {
        // Remove overrides — revert to base theme
        ['--primary','--primary-rgb','--primary-hover','--secondary','--secondary-rgb',
         '--own-bubble','--gradient-primary','--border','--glass-border',
         '--skeleton-base','--skeleton-shine','--reply-bg','--reply-border',
         '--search-highlight','--glow','--glow-strong','--ctx-shadow',
         '--shadow','--shadow-lg','--shadow-xl','--link-preview-bg','--gradient-subtle'
        ].forEach(v => el.style.removeProperty(v));
        return;
    }
    el.style.setProperty('--primary', pal.p);
    el.style.setProperty('--primary-rgb', pal.pr);
    el.style.setProperty('--primary-hover', pal.ph);
    el.style.setProperty('--secondary', pal.s);
    el.style.setProperty('--secondary-rgb', pal.sr);
    el.style.setProperty('--own-bubble', `linear-gradient(135deg,${pal.p} 0%,${pal.s} 100%)`);
    el.style.setProperty('--gradient-primary', `linear-gradient(135deg,${pal.p},${pal.s})`);
    el.style.setProperty('--border', `rgba(${pal.pr},.12)`);
    el.style.setProperty('--glass-border', `1px solid rgba(${pal.pr},.1)`);
    el.style.setProperty('--skeleton-base', `rgba(${pal.pr},.06)`);
    el.style.setProperty('--skeleton-shine', `rgba(${pal.pr},.12)`);
    el.style.setProperty('--reply-bg', `rgba(${pal.pr},.05)`);
    el.style.setProperty('--reply-border', `rgba(${pal.pr},.2)`);
    el.style.setProperty('--search-highlight', `rgba(${pal.pr},.2)`);
    el.style.setProperty('--glow', `0 0 20px rgba(${pal.pr},.08)`);
    el.style.setProperty('--glow-strong', `0 0 40px rgba(${pal.pr},.16)`);
    el.style.setProperty('--ctx-shadow', `0 8px 32px rgba(${pal.pr},.12)`);
    el.style.setProperty('--shadow', `0 1px 3px rgba(0,0,0,.06),0 2px 8px rgba(${pal.pr},.06)`);
    el.style.setProperty('--shadow-lg', `0 8px 32px rgba(${pal.pr},.1),0 2px 8px rgba(0,0,0,.04)`);
    el.style.setProperty('--shadow-xl', `0 20px 60px rgba(${pal.pr},.15),0 4px 16px rgba(0,0,0,.06)`);
    el.style.setProperty('--link-preview-bg', `rgba(${pal.pr},.04)`);
    el.style.setProperty('--gradient-subtle', `linear-gradient(135deg,rgba(${pal.pr},.06),rgba(${pal.sr},.06))`);
}

function hexToRgb(hex) {
    const h = hex.replace('#','');
    return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
}
function darkenHex(hex, amt) {
    const [r,g,b] = hexToRgb(hex);
    const d = v => Math.max(0, Math.round(v * (1 - amt)));
    return `#${d(r).toString(16).padStart(2,'0')}${d(g).toString(16).padStart(2,'0')}${d(b).toString(16).padStart(2,'0')}`;
}
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }
    return [h * 360, s, l];
}
function saturateHex(hex, targetSat) {
    const [r,g,b] = hexToRgb(hex);
    let [h, s, l] = rgbToHsl(r, g, b);
    s = Math.max(s, targetSat);
    l = Math.max(0.35, Math.min(0.6, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1, g1, b1;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}
function pickBestColors(colors) {
    if (!colors || colors.length === 0) return null;
    const scored = colors.map(c => {
        const [r,g,b] = hexToRgb(c);
        const [h, s, l] = rgbToHsl(r, g, b);
        // Penalize browns (hue 20-50), very dark, very light, and desaturated
        const isBrown = (h >= 20 && h <= 50 && s < 0.6);
        const isMuddy = s < 0.3;
        const tooExtreme = l < 0.15 || l > 0.85;
        let score = s * 120 + (1 - Math.abs(l - 0.5)) * 60;
        if (isBrown) score -= 80;
        if (isMuddy) score -= 60;
        if (tooExtreme) score -= 100;
        return { c, score, h, s, l };
    }).sort((a,b) => b.score - a.score);
    let primary = scored[0]?.c || colors[0];
    // Boost saturation if the picked color is dull
    const [,ps] = rgbToHsl(...hexToRgb(primary));
    if (ps < 0.5) primary = saturateHex(primary, 0.6);
    // Pick a secondary with a different hue
    const pH = scored[0]?.h || 0;
    const secondary = scored.find((s, i) => i > 0 && Math.abs(s.h - pH) > 30)?.c
        || scored[1]?.c || colors[1] || primary;
    return { primary, secondary };
}

function setWallpaper(wp, customUrl, colors) {
    document.documentElement.setAttribute('data-wallpaper', wp);
    localStorage.setItem('chat_wallpaper', wp);
    document.querySelectorAll('.sd-wp-card').forEach(c => c.classList.toggle('active', c.dataset.wallpaper === wp));
    if (wp === 'custom' && customUrl) {
        document.documentElement.style.setProperty('--custom-wp-url', `url("${customUrl}")`);
        localStorage.setItem('chat_wallpaper_url', customUrl);
    }
    if (wp !== 'custom') {
        document.documentElement.style.removeProperty('--custom-wp-url');
    }
    // For custom wallpapers, build dynamic palette from image colors
    if (wp === 'custom' && colors && colors.length > 0) {
        const best = pickBestColors(colors);
        if (best) {
            const [pr,pg,pb] = hexToRgb(best.primary);
            const [sr,sg,sb] = hexToRgb(best.secondary);
            wpPalettes['custom'] = {
                p: best.primary, pr: `${pr},${pg},${pb}`, ph: darkenHex(best.primary, 0.12),
                s: best.secondary, sr: `${sr},${sg},${sb}`
            };
            localStorage.setItem('chat_wallpaper_colors', JSON.stringify(colors));
        }
    }
    if (wp !== 'custom') {
        delete wpPalettes['custom'];
        localStorage.removeItem('chat_wallpaper_colors');
    }
    applyWpPalette(wp);
}
// Restore saved wallpaper
const savedWp = localStorage.getItem('chat_wallpaper');
const savedWpUrl = localStorage.getItem('chat_wallpaper_url');
const savedWpColors = (() => { try { return JSON.parse(localStorage.getItem('chat_wallpaper_colors')); } catch { return null; } })();
if (savedWp) setWallpaper(savedWp, savedWpUrl, savedWpColors);
// Restore custom preview
if (savedWp === 'custom' && savedWpUrl) {
    const prev = document.getElementById('custom-wp-preview');
    const img = document.getElementById('custom-wp-img');
    if (prev && img) { img.src = savedWpUrl; prev.style.display = ''; }
    const inp = document.getElementById('custom-wp-url');
    if (inp) inp.value = savedWpUrl;
}

document.querySelectorAll('.sd-wp-card').forEach(card => {
    card.addEventListener('click', () => setWallpaper(card.dataset.wallpaper));
});

// ── Wallpaper tab switching ──
document.querySelectorAll('.sd-wp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.sd-wp-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.sd-wp-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('wp-tab-' + tab.dataset.wpTab);
        if (panel) panel.style.display = '';
    });
});

// ── Custom wallpaper URL ──
const customWpApply = document.getElementById('custom-wp-apply');
const customWpRemove = document.getElementById('custom-wp-remove');
if (customWpApply) {
    customWpApply.addEventListener('click', () => {
        const url = document.getElementById('custom-wp-url').value.trim();
        if (!url) return;
        setWallpaper('custom', url);
        const prev = document.getElementById('custom-wp-preview');
        const img = document.getElementById('custom-wp-img');
        if (prev && img) { img.src = url; prev.style.display = ''; }
    });
}
if (customWpRemove) {
    customWpRemove.addEventListener('click', () => {
        setWallpaper('none');
        localStorage.removeItem('chat_wallpaper_url');
        document.getElementById('custom-wp-url').value = '';
        document.getElementById('custom-wp-preview').style.display = 'none';
    });
}

// ── Wallpaper Browser ──
(function() {
    const grid = document.getElementById('wp-browse-grid');
    const input = document.getElementById('wp-browse-input');
    const searchBtn = document.getElementById('wp-browse-search-btn');
    const loadMoreBtn = document.getElementById('wp-load-more');
    const loading = document.getElementById('wp-browse-loading');
    const empty = document.getElementById('wp-browse-empty');
    if (!grid || !input) return;

    let wpPage = 1, wpQuery = '', wpTotalPages = 1;

    async function searchWallpapers(query, page, append) {
        wpQuery = query; wpPage = page;
        loading.style.display = '';
        empty.style.display = 'none';
        if (!append) grid.innerHTML = '';
        loadMoreBtn.style.display = 'none';

        try {
            const res = await authFetch(`/api/v1/wallpapers?q=${encodeURIComponent(query)}&page=${page}`);
            const data = await res.json();
            loading.style.display = 'none';

            if (!data.results || data.results.length === 0) {
                if (!append) empty.style.display = '';
                return;
            }
            wpTotalPages = data.pages;

            data.results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'wp-browse-item';
                div.innerHTML = `<img src="${item.thumb}" loading="lazy" alt="wallpaper" /><div class="wp-overlay"><span>Apply</span></div>`;
                div.addEventListener('click', () => {
                    setWallpaper('custom', item.url, item.colors || []);
                    grid.querySelectorAll('.wp-browse-item').forEach(i => i.classList.remove('applied'));
                    div.classList.add('applied');
                    const prev = document.getElementById('custom-wp-preview');
                    const img = document.getElementById('custom-wp-img');
                    const urlInput = document.getElementById('custom-wp-url');
                    if (prev && img) { img.src = item.url; prev.style.display = ''; }
                    if (urlInput) urlInput.value = item.url;
                });
                grid.appendChild(div);
            });

            if (wpPage < wpTotalPages) loadMoreBtn.style.display = '';
        } catch (e) {
            loading.style.display = 'none';
            empty.style.display = '';
            empty.querySelector('p').textContent = 'Failed to load wallpapers. Try restarting the server.';
        }
    }

    function doSearch() {
        const q = input.value.trim();
        if (!q) return;
        document.querySelectorAll('.wp-tag').forEach(t => t.classList.toggle('active', t.dataset.q.toLowerCase() === q.toLowerCase()));
        searchWallpapers(q, 1, false);
    }

    searchBtn.addEventListener('click', doSearch);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

    document.querySelectorAll('.wp-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.wp-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            input.value = tag.dataset.q;
            searchWallpapers(tag.dataset.q, 1, false);
        });
    });

    loadMoreBtn.addEventListener('click', () => {
        searchWallpapers(wpQuery, wpPage + 1, true);
    });
})();

// ── Settings detail: Font size ──
const fontSelect = document.getElementById('set-font-size');
if (fontSelect) {
    const saved = localStorage.getItem('chat_font_size');
    if (saved) { fontSelect.value = saved; document.documentElement.setAttribute('data-font', saved); }
    fontSelect.addEventListener('change', () => {
        const v = fontSelect.value;
        localStorage.setItem('chat_font_size', v);
        document.documentElement.setAttribute('data-font', v);
    });
}

// ── Settings detail: Toggle persistence ──
const settingsToggles = {
    'set-msg-sound': { key: 'chat_sound', default: true },
    'set-notif-sound': { key: 'chat_notif_sound', default: true },
    'set-msg-notif': { key: 'chat_msg_notif', default: true },
    'set-notif-preview': { key: 'chat_notif_preview', default: true },
    'set-enter-send': { key: 'chat_enter_send', default: true },
    'set-auto-download': { key: 'chat_auto_download', default: true },
    'set-read-receipts': { key: 'chat_read_receipts', default: true },
    'set-last-seen': { key: 'chat_last_seen', default: true },
    'set-online-status': { key: 'chat_online_status', default: true },
    'set-disappearing': { key: 'chat_disappearing', default: false },
    'set-2fa': { key: 'chat_2fa', default: false },
    'set-login-notif': { key: 'chat_login_notif', default: true },
    'set-launch-startup': { key: 'chat_launch_startup', default: false },
    'set-start-minimised': { key: 'chat_start_minimised', default: false },
    'set-close-tray': { key: 'chat_close_tray', default: false },
};
Object.entries(settingsToggles).forEach(([id, cfg]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = localStorage.getItem(cfg.key);
    el.checked = saved !== null ? saved === 'true' : cfg.default;
    el.addEventListener('change', () => localStorage.setItem(cfg.key, el.checked));
});

// ── New Room Toggle ──
document.getElementById('new-room-toggle').addEventListener('click', () => {
    const panel = document.getElementById('room-create-panel');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : '';
    panel.dataset.open = isOpen ? '0' : '1';
});

// ── Sidebar Logout ──
document.getElementById('sidebar-logout').addEventListener('click', () => {
    if (!confirm('Are you sure you want to logout?')) return;
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    if (socket) socket.disconnect();
    location.reload();
});

// ── Back Button ──
document.getElementById('mobile-back-btn').addEventListener('click', () => {
    document.getElementById('app-container').classList.remove('show-chat');
    document.getElementById('chat-view').style.display = 'none';
    document.getElementById('chat-empty').style.display = '';
    room = null;
    document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
});

// ── Toast ──
function showToast(id, msg) {
    const t = document.getElementById(id);
    if (msg) t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 2500);
}

// ── Date helpers ──
function getDateLabel(ts) {
    const d = new Date(ts), today = new Date(), yest = new Date();
    yest.setDate(today.getDate()-1);
    if (d.toDateString()===today.toDateString()) return 'Today';
    if (d.toDateString()===yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

// ── Auth Fetch Helper ──
function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) options.headers['Authorization'] = 'Bearer ' + authToken;
    return fetch(url, options);
}

// ── Resize Handle (drag to resize room / chat columns) ──
(function() {
    const handle = document.getElementById('resize-handle');
    const container = document.getElementById('app-container');
    if (!handle || !container) return;

    let dragging = false, startX = 0, startWidth = 0;
    const MIN_ROOM = 220, MAX_ROOM = 600;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        const roomPanel = document.getElementById('room-panel');
        startWidth = roomPanel.getBoundingClientRect().width;
        document.body.classList.add('resizing');
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = e.clientX - startX;
        const newWidth = Math.min(MAX_ROOM, Math.max(MIN_ROOM, startWidth + delta));
        const sidebar = document.getElementById('sidebar');
        const sidebarW = sidebar ? sidebar.getBoundingClientRect().width : 72;
        container.style.gridTemplateColumns = `${sidebarW}px ${newWidth}px 4px 1fr`;
    });

    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        document.body.classList.remove('resizing');
    });
})();

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+F — Search messages
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const searchToggle = document.getElementById('search-toggle');
        const chatView = document.getElementById('chat-view');
        if (chatView && chatView.style.display !== 'none') {
            e.preventDefault();
            searchToggle.click();
        }
    }

    // Ctrl+E — Emoji picker
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        const chatView = document.getElementById('chat-view');
        if (chatView && chatView.style.display !== 'none') {
            e.preventDefault();
            document.getElementById('emoji-btn').click();
        }
    }

    // Ctrl+U — Attach file
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        const chatView = document.getElementById('chat-view');
        if (chatView && chatView.style.display !== 'none') {
            e.preventDefault();
            document.getElementById('file-input').click();
        }
    }

    // Ctrl+, — Open Settings
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        showMiddlePanel('settings');
    }

    // Alt+↓ / Alt+↑ — Next / Previous room
    if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isInput) {
        e.preventDefault();
        const items = Array.from(document.querySelectorAll('#room-list .room-item'));
        if (items.length === 0) return;
        const activeIdx = items.findIndex(el => el.classList.contains('active'));
        let next;
        if (e.key === 'ArrowDown') next = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
        else next = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
        items[next].click();
    }
});
