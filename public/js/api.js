"use strict";
const API_BASE = '';
const api = {
    async request(method, path, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (store.user?.token) {
            headers['Authorization'] = `Bearer ${store.user.token}`;
        }
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 401) {
                store.logout();
                router.push('/login');
            }
            throw new Error(data.msg || '请求失败');
        }
        return data;
    },
    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    // ========== Auth APIs ==========
    async login(id, username, clientHash) {
        return this.post('/api/auth/login', { id, username, clientHash });
    },
    async register(id, username, clientHash, captcha, invcode) {
        const headers = { 'cf-turnstile-response': captcha || '' };
        if (invcode)
            headers['X-Registration-Code'] = invcode;
        const res = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ id, username, clientHash }),
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(data.msg || '注册失败');
        return data;
    },
    async getStatus() {
        return this.get('/api/status');
    },
    // ========== User APIs ==========
    async getUser(userId) {
        return this.get(`/api/user/${userId}`);
    },
    async getMe() {
        return this.get('/api/me');
    },
    async updateMe(data) {
        return this.patch('/api/me', data);
    },
    async updateSettings(settings) {
        return this.patch('/api/me/settings', settings);
    },
    // ========== Contact APIs ==========
    async addContact(userId) {
        return this.patch(`/api/contact/${userId}`, { action: 'add' }).catch(() => { });
    },
    async removeContact(userId) {
        return this.patch(`/api/contact/${userId}`, { action: 'remove' }).catch(() => { });
    },
    // ========== File Upload (mock) ==========
    async uploadFile(file, channelId) {
        return {
            success: true,
            content: {
                fileId: 'f_' + Date.now(),
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                url: URL.createObjectURL(file),
            },
        };
    },
};
