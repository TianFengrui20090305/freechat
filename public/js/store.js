"use strict";
const store = Vue.reactive({
    // ========== Auth ==========
    user: null, // { id, username, token } — null means not logged in
    loginError: '',
    // ========== Channels ==========
    channels: [],
    currentChannelId: null,
    // ========== Messages ==========
    messages: {}, // { [channelId]: [msg, ...] }
    pendingMessages: {}, // { [channelId]: [tempId, ...] }
    // ========== Connection ==========
    wsStatus: 'disconnected', // 'connected' | 'disconnected' | 'reconnecting'
    // ========== UI ==========
    sidebarOpen: false,
    activeNav: 'channels', // 'channels' | 'settings' | 'admin'
    notificationEnabled: true,
    soundEnabled: false,
    // ========== Getters (computed-like) ==========
    get currentChannel() {
        return this.channels.find(c => c.id === this.currentChannelId) || null;
    },
    get currentMessages() {
        const cid = this.currentChannelId;
        if (!cid)
            return [];
        return this.messages[cid] || [];
    },
    get channelsWithUnread() {
        return this.channels.filter(c => c.unread > 0).length;
    },
    // ========== Actions ==========
    login(userData) {
        this.user = userData;
        this.loginError = '';
        // Channels and messages will be loaded via API / WebSocket
    },
    logout() {
        this.user = null;
        this.channels = [];
        this.messages = {};
        this.currentChannelId = null;
        this.wsStatus = 'disconnected';
    },
    selectChannel(channelId) {
        this.currentChannelId = channelId;
        const ch = this.channels.find(c => c.id === channelId);
        if (ch)
            ch.unread = 0;
        if (window.innerWidth <= 540)
            this.sidebarOpen = false;
    },
    addMessage(channelId, msg) {
        if (!this.messages[channelId]) {
            this.messages[channelId] = [];
        }
        this.messages[channelId].push(msg);
    },
    // ========== User Profiles (lazy-loaded from API) ==========
    userProfiles: {},
    async getProfile(userId) {
        // Return cached profile if available
        if (this.userProfiles[userId]) {
            return this.userProfiles[userId];
        }
        // Fetch from API
        try {
            const res = await api.getUser(userId);
            if (res.success && res.content) {
                const profile = {
                    id: res.content.id,
                    username: res.content.username,
                    bio: res.content.bio || '这个用户很懒，什么都没写',
                    avatar: res.content.avatar_id || null,
                    status: 'offline',
                    lastSeen: res.content.createdAt ? res.content.createdAt * 1000 : null,
                };
                this.userProfiles[userId] = profile;
                return profile;
            }
        }
        catch (_) { /* fall through to default */ }
        // Fallback
        return { id: userId, username: userId, bio: '这个用户很懒，什么都没写', avatar: null, status: 'offline', lastSeen: null };
    },
    /** 共同群聊：对方也在的群组 */
    getSharedGroups(userId) {
        return this.channels.filter(c => c.type === 'group' &&
            (c.memberIds || []).includes(userId));
    },
    // ========== Contacts (persisted in localStorage) ==========
    contacts: JSON.parse(localStorage.getItem('fc_contacts') || '[]'),
    // Contact metadata: tags, notes, starred
    contactMeta: JSON.parse(localStorage.getItem('fc_contact_meta') || '{}'),
    // Friend requests
    friendRequests: JSON.parse(localStorage.getItem('fc_friend_requests') || '[]'),
    addContact(profile) {
        if (this.contacts.find(c => c.id === profile.id))
            return false;
        this.contacts.push({ id: profile.id, username: profile.username, addedAt: Date.now() });
        localStorage.setItem('fc_contacts', JSON.stringify(this.contacts));
        if (!this.contactMeta[profile.id]) {
            this.contactMeta[profile.id] = { tags: [], notes: '', starred: false };
            localStorage.setItem('fc_contact_meta', JSON.stringify(this.contactMeta));
        }
        return true;
    },
    removeContact(userId) {
        const idx = this.contacts.findIndex(c => c.id === userId);
        if (idx === -1)
            return false;
        this.contacts.splice(idx, 1);
        localStorage.setItem('fc_contacts', JSON.stringify(this.contacts));
        return true;
    },
    isContact(userId) {
        return this.contacts.some(c => c.id === userId);
    },
    toggleStar(userId) {
        if (!this.contactMeta[userId]) {
            this.contactMeta[userId] = { tags: [], notes: '', starred: false };
        }
        this.contactMeta[userId].starred = !this.contactMeta[userId].starred;
        localStorage.setItem('fc_contact_meta', JSON.stringify(this.contactMeta));
        return this.contactMeta[userId].starred;
    },
    getContactMeta(userId) {
        if (!this.contactMeta[userId]) {
            this.contactMeta[userId] = { tags: [], notes: '', starred: false };
        }
        return this.contactMeta[userId];
    },
    setContactTags(userId, tags) {
        if (!this.contactMeta[userId]) {
            this.contactMeta[userId] = { tags: [], notes: '', starred: false };
        }
        this.contactMeta[userId].tags = tags;
        localStorage.setItem('fc_contact_meta', JSON.stringify(this.contactMeta));
    },
    // Friend requests
    addFriendRequest(req) {
        if (this.friendRequests.find(r => r.id === req.id))
            return false;
        this.friendRequests.push({ ...req, time: Date.now(), status: 'pending' });
        localStorage.setItem('fc_friend_requests', JSON.stringify(this.friendRequests));
        return true;
    },
    acceptFriendRequest(id) {
        const req = this.friendRequests.find(r => r.id === id);
        if (!req)
            return false;
        req.status = 'accepted';
        this.addContact({ id: req.id, username: req.username });
        localStorage.setItem('fc_friend_requests', JSON.stringify(this.friendRequests));
        return true;
    },
    rejectFriendRequest(id) {
        const req = this.friendRequests.find(r => r.id === id);
        if (!req)
            return false;
        req.status = 'rejected';
        localStorage.setItem('fc_friend_requests', JSON.stringify(this.friendRequests));
        return true;
    },
    // All unique tags across contacts
    getAllTags() {
        const tagSet = new Set();
        for (const userId of Object.keys(this.contactMeta)) {
            for (const tag of this.contactMeta[userId].tags) {
                tagSet.add(tag);
            }
        }
        return [...tagSet].sort();
    },
    // Contacts grouped by tag
    getContactsByTag(tag) {
        return this.contacts.filter(c => {
            const meta = this.contactMeta[c.id];
            return meta && meta.tags.includes(tag);
        });
    },
    // Seed demo data for display
    _seedDemoData() {
        if (this.contacts.length > 0)
            return;
        const demoContacts = [
            { id: 'alice_w', username: 'Alice Wang' },
            { id: 'bob_c', username: 'Bob Chen' },
            { id: 'charlie_l', username: 'Charlie Li' },
            { id: 'diana_z', username: 'Diana Zhang' },
            { id: 'ella_w', username: 'Ella Wu' },
            { id: 'frank_l', username: 'Frank Liu' },
            { id: 'grace_y', username: 'Grace Yang' },
            { id: 'henry_h', username: 'Henry Huang' },
            { id: 'iris_x', username: 'Iris Xu' },
            { id: 'jack_z', username: 'Jack Zhou' },
            { id: '凯文', username: '凯文' },
            { id: '李华', username: '李华' },
            { id: '王芳', username: '王芳' },
            { id: '张三', username: '张三' },
            { id: '赵六', username: '赵六' },
            { id: '007', username: '007特工' },
            { id: '9527', username: '9527服务' },
        ];
        for (const c of demoContacts) {
            this.contacts.push({ ...c, addedAt: Date.now() - Math.random() * 86400000 * 30 });
        }
        localStorage.setItem('fc_contacts', JSON.stringify(this.contacts));
        this.contactMeta = {
            'alice_w': { tags: ['同事', '项目A'], notes: '前端开发', starred: true },
            'bob_c': { tags: ['同事'], notes: '', starred: false },
            'charlie_l': { tags: ['家人'], notes: '', starred: true },
            'diana_z': { tags: ['同事', '项目A'], notes: '', starred: false },
            'ella_w': { tags: ['朋友'], notes: '大学同学', starred: true },
            'frank_l': { tags: ['朋友'], notes: '', starred: false },
            'grace_y': { tags: ['家人'], notes: '', starred: false },
            'henry_h': { tags: ['同事'], notes: '', starred: false },
            'iris_x': { tags: ['朋友', '项目A'], notes: '', starred: false },
            'jack_z': { tags: ['客户'], notes: '重要客户', starred: true },
            '凯文': { tags: ['朋友'], notes: '', starred: false },
            '李华': { tags: ['同事'], notes: '', starred: false },
            '王芳': { tags: ['家人'], notes: '姐姐', starred: true },
            '张三': { tags: [], notes: '', starred: false },
            '赵六': { tags: ['客户'], notes: '', starred: false },
            '007': { tags: [], notes: '', starred: false },
            '9527': { tags: ['服务'], notes: '客服', starred: false },
        };
        localStorage.setItem('fc_contact_meta', JSON.stringify(this.contactMeta));
        this.friendRequests = [
            { id: 'new_user_1', username: '小明', msg: '你好，我是小明', time: Date.now() - 3600000, status: 'pending' },
            { id: 'new_user_2', username: '小红', msg: '加个好友？', time: Date.now() - 7200000, status: 'pending' },
            { id: 'old_user_1', username: '大刚', msg: '', time: Date.now() - 86400000 * 3, status: 'accepted' },
        ];
        localStorage.setItem('fc_friend_requests', JSON.stringify(this.friendRequests));
    },
});
store._seedDemoData();
