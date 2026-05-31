"use strict";
const wsManager = {
    _ws: null,
    _reconnectTimer: null,
    _reconnectAttempts: 0,
    _maxRetries: 10,
    connect(channelId) {
        if (this._ws) {
            this._ws.onclose = null;
            this._ws.close();
        }
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${location.host}/ws/${encodeURIComponent(channelId)}`;
        this._ws = new WebSocket(url);
        this._ws.onopen = () => {
            store.wsStatus = 'connected';
            this._reconnectAttempts = 0;
        };
        this._ws.onclose = () => {
            store.wsStatus = 'disconnected';
            this._scheduleReconnect(channelId);
        };
        this._ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                // DO broadcasts: { type: "msg", channelId, id, userId, username, content, timestamp, ... }
                if (data.type === 'msg' && data.channelId) {
                    store.addMessage(data.channelId, {
                        id: data.id,
                        userId: data.userId,
                        username: data.username,
                        content: data.content,
                        time: (data.timestamp || 0) * 1000, // DO uses Unix seconds
                    });
                }
            }
            catch (_) { /* ignore bad frames */ }
        };
    },
    send(channelId, content) {
        if (!store.user)
            return;
        // Optimistic add
        const tempId = 'tmp_' + Date.now();
        store.addMessage(channelId, {
            id: tempId,
            userId: store.user.id,
            username: store.user.username,
            content,
            time: Date.now(),
            pending: true,
        });
        if (this._ws?.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify({
                userId: store.user.id,
                username: store.user.username,
                content,
            }));
        }
    },
    disconnect() {
        this._clearReconnect();
        if (this._ws) {
            this._ws.onclose = null;
            this._ws.close();
            this._ws = null;
        }
        store.wsStatus = 'disconnected';
    },
    _scheduleReconnect(channelId) {
        this._clearReconnect();
        if (this._reconnectAttempts >= this._maxRetries)
            return;
        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
        store.wsStatus = 'reconnecting';
        this._reconnectAttempts++;
        this._reconnectTimer = setTimeout(() => {
            this.connect(channelId);
        }, delay);
    },
    _clearReconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    },
};
