// Shared utilities for all frontend JS files

// Global state
let authToken = localStorage.getItem('chat_token') || '';
let username = localStorage.getItem('chat_user') || '';

// Helper: authFetch with automatic token - put on window to avoid conflicts
window.authFetch = function(url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};
    if (authToken) options.headers['Authorization'] = 'Bearer ' + authToken;
    return fetch(url, options);
};

// Helper: Get color for username (avatar background)
const avatarColors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#6366f1','#14b8a6'];
function getColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return avatarColors[Math.abs(h) % avatarColors.length];
}

// Helper: Update sidebar avatar from profile data
function updateSidebarAvatar(avatarUrl) {
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    if (!sidebarAvatar) return;
    
    if (avatarUrl) {
        sidebarAvatar.src = avatarUrl;
        sidebarAvatar.dataset.avatarUrl = avatarUrl;
    } else {
        sidebarAvatar.src = '';
        sidebarAvatar.style.background = getColor(username);
        delete sidebarAvatar.dataset.avatarUrl;
    }
}

// Helper: Load profile and update avatar
async function loadProfileAndUpdateAvatar() {
    try {
        const res = await authFetch('/api/v1/profile');
        const p = await res.json();
        updateSidebarAvatar(p.avatar);
        return p;
    } catch (e) {
        updateSidebarAvatar('');
        return null;
    }
}

// Helper: Display mode (mobile vs desktop)
function updateAppDisplay() {
    const isMobile = window.innerWidth <= 768;
    const app = document.getElementById('app-container');
    if (app) {
        if (isMobile) {
            app.style.display = 'flex';
            app.style.flexDirection = 'column';
        } else {
            app.style.display = 'grid';
        }
    }
}

// Helper: Generic search/browse function
async function searchBrowseItems(endpoint, query, page, append, grid, { loading, empty, loadMore, onItem, onComplete }) {
    let totalPages = 1;
    
    loading.style.display = '';
    empty.style.display = 'none';
    if (!append) grid.innerHTML = '';
    if (loadMore) loadMore.style.display = 'none';

    try {
        const res = await authFetch(`${endpoint}?q=${encodeURIComponent(query)}&page=${page}`);
        const data = await res.json();
        loading.style.display = 'none';

        if (!data.results || data.results.length === 0) {
            if (!append) empty.style.display = '';
            return;
        }
        totalPages = data.pages;

        data.results.forEach(item => onItem(item, grid));
        if (page < totalPages && loadMore) loadMore.style.display = '';
        if (onComplete) onComplete();
    } catch (e) {
        loading.style.display = 'none';
        empty.style.display = '';
        empty.querySelector('p').textContent = 'Failed to load. Try again.';
    }
    
    return totalPages;
}

// Helper: Show toast notification
function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        padding: 12px 24px; border-radius: 8px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// Helper: Set avatar from any URL
async function setAvatar(url) {
    try {
        const res = await authFetch('/api/v1/profile/avatar-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: url })
        });
        const data = await res.json();
        if (!data.error) {
            updateSidebarAvatar(data.avatar);
            const img = document.getElementById('sd-avatar-img');
            if (img) { img.src = data.avatar; img.style.display = 'block'; }
            return true;
        }
        showToast(data.error, 'error');
        return false;
    } catch (e) {
        showToast('Failed to set avatar', 'error');
        return false;
    }
}

// Export for use in other files
window.sharedUtils = {
    authToken, username, setAuth: (t, u) => { authToken = t; username = u; },
    authFetch, getColor, updateSidebarAvatar, loadProfileAndUpdateAvatar,
    updateAppDisplay, searchBrowseItems, showNotification, setAvatar
};
