"use strict";
const ChatPage = {
    template: `
    <div class="app-layout" @dragover.prevent="onDragOver" @drop.prevent="onDrop">
      <!-- Nav Bar -->
      <nav class="nav-bar">
        <div class="nav-logo" @click="goHome" title="FreeChat">F</div>
        <button class="nav-btn" :class="{ active: true }" title="频道" @click="toggleSidebar">
          💬
          <span v-if="store.channelsWithUnread > 0" class="badge"></span>
        </button>
        <button class="nav-btn" title="联系人" @click="goContacts">👥</button>
        <div class="nav-spacer"></div>
        <button class="nav-btn" title="设置" @click="goSettings">⚙️</button>
        <img v-if="store.user" class="nav-avatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect fill='%234f7cff' width='30' height='30' rx='15'/%3E%3Ctext x='15' y='20' text-anchor='middle' fill='%23fff' font-size='14' font-weight='bold'%3E{{store.user.username[0]}}%3C/text%3E%3C/svg%3E" :alt="store.user.username" @click="goSettings" />
      </nav>

      <!-- Mobile backdrop -->
      <div class="sidebar-backdrop" :class="{ open: store.sidebarOpen }" @click="store.sidebarOpen = false"></div>

      <!-- Sidebar -->
      <aside class="sidebar" :class="{ open: store.sidebarOpen }">
        <div class="sidebar-header">
          <h3>聊天</h3>
          <button @click="showChannelModal" title="加入">+</button>
        </div>
        <div class="sidebar-search">
          <input v-model="searchQuery" placeholder="搜索..." />
        </div>
        <div style="flex:1;overflow-y:auto">
          <template v-for="group in channelGroups" :key="group.label">
            <div class="channel-group">
              <div class="channel-group-label">{{ group.label }}</div>
              <div v-if="group.items.length === 0" class="channel-group-empty">{{ group.emptyText }}</div>
              <div v-for="ch in group.items" :key="ch.id"
                class="channel-item"
                :class="{ active: ch.id === store.currentChannelId }"
                @click="handleChannelClick(ch)">
                <span class="channel-icon">{{ ch.icon }}</span>
                <span>{{ ch.name }}</span>
                <span v-if="ch.unread > 0" class="badge">{{ ch.unread }}</span>
              </div>
            </div>
          </template>
        </div>
      </aside>

      <!-- Main -->
      <main class="main-content" v-if="store.currentChannel">
        <div class="chat-header">
          <h2>{{ channelTitle }}</h2>
          <span class="conn-badge" :class="connClass">{{ connLabel }}</span>
          <div class="chat-header-spacer"></div>
          <button class="chat-header-more" title="详细信息" @click="goDetails">···</button>
        </div>
        <div class="message-area" ref="msgArea" @click="closeProfilePopup">
          <div v-if="dragOver" class="drop-indicator" :class="{ highlight: dragZone === 'send' }">
            <span class="drop-indicator-icon">📎</span>
            <span class="drop-indicator-label">直接发送</span>
          </div>
          <template v-if="store.currentMessages.length === 0">
            <div class="empty-state">
              <div class="icon">💬</div>
              <p>暂无消息，发送第一条吧</p>
            </div>
          </template>
          <template v-for="(group, gi) in groupedMessages" :key="gi">
            <div class="system-message">{{ group.date }}</div>
            <div v-for="msg in group.items" :key="msg.id"
              class="message"
              :class="{ 'message-own': msg.userId === store.user?.id, 'pending': msg.pending }">
              <div class="message-avatar" :style="avatarColor(msg.userId)" @click.stop="showProfile(msg.userId, $event)">
                {{ msg.username[0] }}
              </div>
              <div class="message-body">
                <div class="message-meta">
                  <span class="msg-username" @click.stop="showProfile(msg.userId, $event)">{{ msg.username }}</span>
                  <span>{{ fmtTime(msg.time) }}</span>
                </div>
                <div class="message-bubble">{{ msg.content }}</div>
                <div v-if="msg.pending" class="message-status">发送中...</div>
              </div>
            </div>
          </template>
        </div>
        <div class="input-bar">
          <div v-if="dragOver" class="drop-indicator drop-indicator-input" :class="{ highlight: dragZone === 'attach' }">
            <span class="drop-indicator-icon">📎</span>
            <span class="drop-indicator-label">添加为附件</span>
          </div>
          <button class="input-attach-btn" title="附件" @click="toggleAttachPanel">＋</button>
          <input v-model="inputText" placeholder="输入消息..." @keydown.enter="send" :disabled="!store.user" />
          <button class="send-btn" @click="send" :disabled="!inputText.trim() || !store.user">➤</button>
        </div>

        <!-- ========== Attach Panel ========== -->
        <div v-if="showAttachPanel" class="attach-overlay" @click="showAttachPanel = false"></div>
        <div v-if="showAttachPanel" class="attach-panel">
          <div class="attach-panel-header">
            <span>功能</span>
            <button class="attach-panel-close" @click="showAttachPanel = false">×</button>
          </div>
          <div class="attach-panel-body">
            <div class="attach-item" @click="attachAction('image')">
              <div class="attach-icon">📷</div>
              <div class="attach-name">图片</div>
            </div>
            <div class="attach-item" @click="attachAction('file')">
              <div class="attach-icon">📎</div>
              <div class="attach-name">文件</div>
            </div>
            <div class="attach-item" @click="attachAction('poll')">
              <div class="attach-icon">📋</div>
              <div class="attach-name">投票</div>
            </div>
            <div class="attach-item" @click="attachAction('code')">
              <div class="attach-icon">💻</div>
              <div class="attach-name">代码块</div>
            </div>
            <div class="attach-item" @click="attachAction('audio')">
              <div class="attach-icon">🎵</div>
              <div class="attach-name">语音</div>
            </div>
            <div class="attach-item" @click="attachAction('video')">
              <div class="attach-icon">🎬</div>
              <div class="attach-name">视频</div>
            </div>
            <div class="attach-item" @click="attachAction('link')">
              <div class="attach-icon">🔗</div>
              <div class="attach-name">链接</div>
            </div>
            <div class="attach-item" @click="attachAction('emoji')">
              <div class="attach-icon">😊</div>
              <div class="attach-name">表情</div>
            </div>
            <div class="attach-item" @click="attachAction('location')">
              <div class="attach-icon">📍</div>
              <div class="attach-name">位置</div>
            </div>
            <div class="attach-item" @click="attachAction('reminder')">
              <div class="attach-icon">⏰</div>
              <div class="attach-name">提醒</div>
            </div>
            <div class="attach-item" @click="attachAction('file')">
              <div class="attach-icon">📁</div>
              <div class="attach-name">收藏</div>
            </div>
          </div>
        </div>
      </main>

      <!-- Empty state: no channel -->
      <main class="main-content" v-else>
        <div class="empty-state">
          <div class="icon">💬</div>
          <p>选择一个频道开始聊天</p>
          <button class="btn btn-primary" style="width:auto;margin-top:8px" @click="showChannelModal">+ 加入频道</button>
        </div>
      </main>

      <!-- ========== User Profile Popup ========== -->
      <div v-if="profileUser" class="profile-overlay" @click="closeProfilePopup"></div>
      <div v-if="profileUser" class="profile-popup profile-popup-wide" :style="profileStyle">
        <!-- Header -->
        <div class="profile-header">
          <div class="profile-avatar" :style="profileAvatarStyle">{{ profileUser.username[0] }}</div>
          <div class="profile-info">
            <div class="profile-name">{{ profileUser.username }}</div>
            <div class="profile-id">ID: {{ profileUser.id }}</div>
          </div>
          <div class="profile-status" :class="profileUser.status">
            <span class="status-dot"></span>
            {{ profileUser.status === 'online' ? '在线' : '离线' }}
          </div>
        </div>
        <div class="profile-bio">{{ profileUser.bio }}</div>

        <!-- 朋友资料（仅自己可见） -->
        <div class="profile-friend-section">
          <div class="profile-section-label">👤 朋友资料 <span class="profile-self-only">仅自己可见</span></div>
          <div class="profile-friend-row">
            <span class="profile-friend-label">备注</span>
            <input class="profile-friend-input" v-model="friendNotes[profileUser.id]" placeholder="设置备注名" @change="saveFriendData" />
          </div>
          <div class="profile-friend-row">
            <span class="profile-friend-label">标签</span>
            <div class="profile-tags">
              <span v-for="(tag, ti) in friendTags[profileUser.id] || []" :key="ti" class="profile-tag">
                {{ tag }}
                <span class="profile-tag-del" @click="removeTag(profileUser.id, ti)">×</span>
              </span>
              <input class="profile-tag-input" v-model="tagInput" placeholder="添加标签" @keydown.enter.prevent="addTag(profileUser.id)" @keydown.backspace.prevent="removeLastTag(profileUser.id)" style="width:70px" />
            </div>
          </div>
        </div>

        <!-- 更多信息 -->
        <div class="profile-more" @click="showMore = !showMore">
          <span>📋 更多信息</span>
          <span class="profile-more-arrow" :class="{ open: showMore }">▸</span>
        </div>
        <div v-if="showMore" class="profile-more-body">
          <div class="profile-more-row"><span>个性签名</span><span class="profile-more-val">{{ profileUser.bio }}</span></div>
          <div class="profile-more-row" @click="showSharedPanel = true" style="cursor:pointer">
            <span>共同群聊（{{ sharedGroupList.length }}）</span>
            <span class="profile-more-arrow open">▸</span>
          </div>
          <div class="profile-more-row"><span>来源</span><span class="profile-more-val">{{ friendSourceText }}</span></div>
          <div class="profile-more-row"><span>添加时间</span><span class="profile-more-val">{{ friendAddedTimeText }}</span></div>
          <div class="profile-more-row"><span>用户 ID</span><span class="profile-more-val">{{ profileUser.id }}</span></div>
          <div class="profile-more-row"><span>在线状态</span><span class="profile-more-val">{{ profileUser.status === 'online' ? '在线' : '离线' }}</span></div>
          <div class="profile-more-row"><span>最后活跃</span><span class="profile-more-val">{{ profileUser.lastSeen ? fmtDate(profileUser.lastSeen) : '未知' }}</span></div>
        </div>

        <!-- 朋友圈 -->
        <button class="profile-moments-btn" @click="showMoments">📷 朋友圈</button>

        <!-- Actions -->
        <div class="profile-actions">
          <button class="btn btn-primary" @click="startPrivateChat">💬 发送私聊</button>
          <button v-if="!store.isContact(profileUser.id)" class="btn btn-ghost" @click="addContactFromProfile">➕ 加为联系人</button>
          <button v-else class="btn btn-ghost" @click="removeContactFromProfile">✖ 删除联系人</button>
        </div>

        <!-- Shared Groups Panel -->
        <div v-if="showSharedPanel && profileUser" class="shared-panel" :style="sharedPanelStyle">
          <div class="shared-panel-header">
            <span>共同群聊</span>
            <button class="shared-panel-close" @click="showSharedPanel = false">×</button>
          </div>
          <div class="shared-panel-body">
            <div v-if="sharedGroupList.length === 0" class="shared-panel-empty">无共同群聊</div>
            <div v-for="g in sharedGroupList" :key="g.id" class="shared-panel-item" @click="goToSharedGroup(g)">
              <div class="shared-group-avatar" :style="groupAvatar(g.name)">{{ g.name[0] }}</div>
              <span class="shared-group-name"># {{ g.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== Channel Modal ========== -->
      <div v-if="showChannelModal_" class="modal-overlay" @click.self="showChannelModal_ = false">
        <div class="modal-card">
          <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:1px solid var(--border)">
            <button v-for="tab in channelTabs" :key="tab.key"
              style="flex:1;padding:8px 0;border:none;background:none;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;transition:all 0.15s"
              :style="channelTab === tab.key ? { color:'var(--primary)', borderBottomColor:'var(--primary)', fontWeight:600 } : { color:'var(--text-secondary)' }"
              @click="channelTab = tab.key">
              {{ tab.label }}
            </button>
          </div>

          <!-- Tab: 加入频道/群聊 -->
          <template v-if="channelTab === 'join'">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">输入频道 ID 加入，或从下方选择公开频道</p>
            <div class="form-group">
              <label>频道 ID</label>
              <input v-model="joinChannelId" placeholder="例如：g:general" @keydown.enter="joinChannel" />
            </div>
            <div v-if="availableChannels.length > 0" style="margin-top:12px">
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">推荐公开频道</div>
              <div v-for="ch in availableChannels" :key="ch.id"
                style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:6px;cursor:pointer;font-size:13px"
                :style="{ background: hoverJoin === ch.id ? 'var(--bg-sidebar)' : 'transparent' }"
                @mouseenter="hoverJoin = ch.id" @mouseleave="hoverJoin = null"
                @click="joinChannelById(ch)">
                <span><span style="margin-right:6px">{{ ch.icon }}</span>{{ ch.name }}</span>
                <span style="color:var(--text-muted);font-size:12px">{{ ch.memberCount }}人</span>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="showChannelModal_ = false">取消</button>
              <button class="btn btn-primary" @click="joinChannel" :disabled="!joinChannelId.trim()">加入</button>
            </div>
          </template>

          <!-- Tab: 添加联系人 -->
          <template v-if="channelTab === 'add-contact'">
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">输入用户 ID 搜索并添加为联系人</p>
            <div class="form-group">
              <label>用户 ID</label>
              <div style="display:flex;gap:8px">
                <input v-model="contactSearchId" placeholder="例如：user_001" @keydown.enter="searchUser" style="flex:1" />
                <button class="btn btn-primary" style="width:auto;padding:10px 16px" @click="searchUser" :disabled="!contactSearchId.trim() || contactSearchLoading">搜索</button>
              </div>
            </div>
            <div v-if="contactSearchLoading" style="text-align:center;padding:20px;color:var(--text-muted)">搜索中...</div>
            <div v-else-if="contactSearchResult" class="contact-search-result">
              <div class="contact-search-user">
                <div class="contact-search-avatar" :style="searchedAvatarStyle">{{ contactSearchResult.username[0] }}</div>
                <div>
                  <div class="contact-search-name">{{ contactSearchResult.username }}</div>
                  <div class="contact-search-bio">{{ contactSearchResult.bio }}</div>
                </div>
              </div>
              <button v-if="!store.isContact(contactSearchResult.id)" class="btn btn-primary" style="margin-top:12px" @click="addSearchedUser">➕ 加为联系人</button>
              <button v-else class="btn btn-ghost" style="margin-top:12px" disabled>已在联系人列表</button>
            </div>
            <div v-else-if="contactSearchError" class="auth-error">{{ contactSearchError }}</div>
          </template>

          <!-- Tab: 创建频道 -->
          <template v-if="channelTab === 'create-channel'">
            <div class="form-group">
              <label>频道名称</label>
              <input v-model="channelForm.name" placeholder="输入频道名称" maxlength="30" @keydown.enter="createChannel" />
            </div>
            <div class="form-group">
              <label>频道简介</label>
              <input v-model="channelForm.topic" placeholder="这个频道是干嘛的？" maxlength="60" />
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:-8px">创建后其他用户可搜索加入</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="showChannelModal_ = false">取消</button>
              <button class="btn btn-primary" @click="createChannel" :disabled="!channelForm.name.trim()">创建</button>
            </div>
          </template>

          <!-- Tab: 创建群聊 -->
          <template v-if="channelTab === 'create-group'">
            <div class="form-group">
              <label>群聊名称</label>
              <input v-model="groupForm.name" placeholder="给群聊起个名字" maxlength="30" @keydown.enter="createGroup" />
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-top:-8px">创建一个简单的群聊空间</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" @click="showChannelModal_ = false">取消</button>
              <button class="btn btn-primary" @click="createGroup" :disabled="!groupForm.name.trim()">创建</button>
            </div>
          </template>
        </div>
      </div>

    </div>
  `,
    data() {
        return {
            store,
            searchQuery: '',
            inputText: '',
            dragOver: false,
            dragZone: null,
            showAttachPanel: false,
            // Profile popup
            profileUser: null,
            profileStyle: {},
            showMore: false,
            showSharedPanel: false,
            tagInput: '',
            friendNotes: {},
            friendTags: {},
            friendMeta: {},
            // Channel modal
            showChannelModal_: false,
            channelTab: 'join',
            joinChannelId: '',
            hoverJoin: null,
            channelForm: { name: '', topic: '' },
            groupForm: { name: '' },
            // Contact search
            contactSearchId: '',
            contactSearchResult: null,
            contactSearchLoading: false,
            contactSearchError: '',
        };
    },
    computed: {
        connLabel() {
            const s = this.store.wsStatus;
            if (s === 'connected')
                return '● 已连接';
            if (s === 'reconnecting')
                return '⟳ 重连中';
            return '○ 离线';
        },
        connClass() {
            const s = this.store.wsStatus;
            if (s === 'connected')
                return 'online';
            if (s === 'reconnecting')
                return 'reconnecting';
            return 'offline';
        },
        filteredChannels() {
            if (!this.searchQuery)
                return this.store.channels;
            const q = this.searchQuery.toLowerCase();
            return this.store.channels.filter(c => c.name.toLowerCase().includes(q));
        },
        channelGroups() {
            if (!this.store.channels)
                return [];
            const items = this.searchQuery ? this.filteredChannels : this.store.channels;
            const group = i => i.type === 'group' && i.subtype === 'group';
            const channel = i => i.type === 'group' && i.subtype === 'channel';
            const contactItems = this.store.contacts.map(c => ({
                id: 'p:' + c.id,
                name: c.username,
                type: 'private',
                icon: '👤',
                unread: 0,
                _contactId: c.id,
            }));
            const filteredContacts = this.searchQuery
                ? contactItems.filter(c => c.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
                : contactItems;
            return [
                { label: '联系人', items: filteredContacts, emptyText: '暂无联系人' },
                { label: '频道', items: items.filter(channel), emptyText: '暂无频道' },
                { label: '群聊', items: items.filter(group), emptyText: '暂无群聊' },
                { label: '私聊', items: items.filter(c => c.type === 'private'), emptyText: '暂无私聊' },
            ];
        },
        channelTitle() {
            const ch = this.store.currentChannel;
            if (!ch)
                return '';
            return ch.type === 'private' ? `@ ${ch.name}` : `# ${ch.name}`;
        },
        channelTabs() {
            return [
                { key: 'join', label: '加入频道/群聊' },
                { key: 'add-contact', label: '添加联系人' },
                { key: 'create-channel', label: '创建频道' },
                { key: 'create-group', label: '创建群聊' },
            ];
        },
        availableChannels() {
            const joined = new Set(this.store.channels.map(c => c.id));
            return [
                { id: 'g:music', name: '音乐分享', subtype: 'channel', icon: '#', memberCount: 42, memberIds: [] },
                { id: 'g:games', name: '游戏交流', subtype: 'group', icon: '#', memberCount: 78, memberIds: [] },
                { id: 'g:reading', name: '读书会', subtype: 'channel', icon: '#', memberCount: 25, memberIds: [] },
                { id: 'g:travel', name: '旅行攻略', subtype: 'group', icon: '#', memberCount: 36, memberIds: [] },
            ].filter(c => !joined.has(c.id));
        },
        groupedMessages() {
            const msgs = this.store.currentMessages;
            if (!msgs || msgs.length === 0)
                return [];
            const groups = [];
            let cd = '', ci = [];
            for (const msg of msgs) {
                const d = this.dateLabel(msg.time);
                if (d !== cd) {
                    if (ci.length)
                        groups.push({ date: cd, items: ci });
                    cd = d;
                    ci = [];
                }
                ci.push(msg);
            }
            if (ci.length)
                groups.push({ date: cd, items: ci });
            return groups;
        },
        profileAvatarStyle() {
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < (this.profileUser?.id || '').length; i++)
                h = ((h << 5) - h) + this.profileUser.id.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
        sharedGroupList() {
            if (!this.profileUser)
                return [];
            return this.store.getSharedGroups(this.profileUser.id);
        },
        sharedPanelStyle() {
            if (!this.profileStyle || !this.profileStyle.left)
                return {};
            const left = parseFloat(this.profileStyle.left) + 320; // popup width + gap
            return { position: 'fixed', left: left + 'px', top: this.profileStyle.top };
        },
        friendSourceText() {
            if (!this.profileUser)
                return '';
            const meta = this.friendMeta[this.profileUser.id];
            return meta?.source || '未知';
        },
        friendAddedTimeText() {
            if (!this.profileUser)
                return '';
            const meta = this.friendMeta[this.profileUser.id];
            if (!meta?.addedTime)
                return '未知';
            return this.fmtFullDate(meta.addedTime);
        },
        searchedAvatarStyle() {
            if (!this.contactSearchResult)
                return {};
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < this.contactSearchResult.id.length; i++)
                h = ((h << 5) - h) + this.contactSearchResult.id.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
    },
    methods: {
        // ===== Channel =====
        select(id) { this.store.selectChannel(id); wsManager.connect(id); },
        handleChannelClick(ch) {
            if (ch._contactId) {
                this.startChatWithContact(ch._contactId);
            }
            else {
                this.select(ch.id);
            }
        },
        startChatWithContact(contactId) {
            const pid = 'p:' + contactId;
            let ch = this.store.channels.find(c => c.id === pid);
            if (!ch) {
                const contact = this.store.contacts.find(c => c.id === contactId);
                ch = { id: pid, name: contact?.username || contactId, type: 'private', unread: 0, icon: '👤' };
                this.store.channels.push(ch);
                if (!this.store.messages[pid])
                    this.store.messages[pid] = [];
            }
            this.store.selectChannel(pid);
            wsManager.connect(pid);
        },
        showChannelModal() {
            this.channelTab = 'join';
            this.joinChannelId = '';
            this.channelForm = { name: '', topic: '' };
            this.groupForm = { name: '' };
            this.contactSearchId = '';
            this.contactSearchResult = null;
            this.contactSearchLoading = false;
            this.contactSearchError = '';
            this.showChannelModal_ = true;
        },
        joinChannel() {
            const id = this.joinChannelId.trim();
            if (!id)
                return;
            if (this.store.channels.find(c => c.id === id)) {
                this.store.selectChannel(id);
                this.showChannelModal_ = false;
                return;
            }
            const name = id.includes(':') ? id.split(':')[1] : id;
            const isPvt = id.startsWith('p:');
            this.store.channels.push({ id, name, type: isPvt ? 'private' : 'group', subtype: isPvt ? undefined : 'channel', unread: 0, icon: isPvt ? '👤' : '#', memberIds: [this.store.user?.id] });
            if (!this.store.messages[id])
                this.store.messages[id] = [];
            this.store.selectChannel(id);
            this.showChannelModal_ = false;
        },
        joinChannelById(ch) {
            const entry = { ...ch, unread: 0, memberIds: [this.store.user?.id] };
            this.store.channels.push(entry);
            if (!this.store.messages[ch.id])
                this.store.messages[ch.id] = [];
            this.store.selectChannel(ch.id);
            this.showChannelModal_ = false;
        },
        createChannel() {
            const name = this.channelForm.name.trim();
            if (!name)
                return;
            const id = 'g:ch_' + name.toLowerCase().replace(/\s+/g, '-') + '_' + Date.now();
            this.store.channels.push({ id, name, subtype: 'channel', type: 'group', unread: 0, icon: '#', topic: this.channelForm.topic.trim(), memberIds: [this.store.user?.id] });
            if (!this.store.messages[id])
                this.store.messages[id] = [];
            this.store.selectChannel(id);
            this.showChannelModal_ = false;
        },
        createGroup() {
            const name = this.groupForm.name.trim();
            if (!name)
                return;
            const id = 'g:grp_' + name.toLowerCase().replace(/\s+/g, '-') + '_' + Date.now();
            this.store.channels.push({ id, name, subtype: 'group', type: 'group', unread: 0, icon: '#', memberIds: [this.store.user?.id] });
            if (!this.store.messages[id])
                this.store.messages[id] = [];
            this.store.selectChannel(id);
            this.showChannelModal_ = false;
        },
        // ===== Profile =====
        async showProfile(userId, event) {
            if (userId === this.store.user?.id)
                return;
            this.profileUser = await this.store.getProfile(userId);
            this.showMore = false;
            this.tagInput = '';
            this.$nextTick(() => {
                const rect = event?.target?.getBoundingClientRect();
                if (rect) {
                    const pw = 320;
                    let l = rect.left + 20, t = rect.top - 10;
                    if (l + pw > window.innerWidth - 20)
                        l = window.innerWidth - pw - 20;
                    if (t < 10)
                        t = 10;
                    this.profileStyle = { position: 'fixed', left: l + 'px', top: t + 'px' };
                }
            });
        },
        closeProfilePopup() { this.profileUser = null; this.showSharedPanel = false; },
        startPrivateChat() {
            if (!this.profileUser)
                return;
            const pid = 'p:' + this.profileUser.id;
            let ch = this.store.channels.find(c => c.id === pid);
            if (!ch) {
                ch = { id: pid, name: this.profileUser.username, type: 'private', unread: 0, icon: '👤' };
                this.store.channels.push(ch);
                if (!this.store.messages[pid])
                    this.store.messages[pid] = [];
            }
            this.profileUser = null;
            this.store.selectChannel(pid);
            wsManager.connect(pid);
        },
        showMoments() { alert('朋友圈功能开发中 🚧'); },
        goToSharedGroup(g) {
            this.store.selectChannel(g.id);
            wsManager.connect(g.id);
            this.closeProfilePopup();
        },
        groupAvatar(name) {
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < (name || '').length; i++)
                h = ((h << 5) - h) + name.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
        // ===== Contacts =====
        addContactFromProfile() {
            if (!this.profileUser)
                return;
            this.store.addContact({ id: this.profileUser.id, username: this.profileUser.username });
        },
        removeContactFromProfile() {
            if (!this.profileUser)
                return;
            this.store.removeContact(this.profileUser.id);
        },
        async searchUser() {
            const id = this.contactSearchId.trim();
            if (!id)
                return;
            this.contactSearchLoading = true;
            this.contactSearchResult = null;
            this.contactSearchError = '';
            try {
                const res = await api.getUser(id);
                if (res.success && res.content) {
                    this.contactSearchResult = {
                        id: res.content.id,
                        username: res.content.username,
                        bio: res.content.bio || '这个用户很懒，什么都没写',
                    };
                }
                else {
                    this.contactSearchError = '未找到该用户';
                }
            }
            catch (e) {
                this.contactSearchError = e.message || '搜索失败';
            }
            finally {
                this.contactSearchLoading = false;
            }
        },
        addSearchedUser() {
            if (!this.contactSearchResult)
                return;
            this.store.addContact({ id: this.contactSearchResult.id, username: this.contactSearchResult.username });
            this.contactSearchResult = null;
            this.contactSearchId = '';
        },
        // ===== Friend Tags / Notes =====
        saveFriendData() { },
        addTag(userId) {
            const tag = this.tagInput.trim();
            if (!tag)
                return;
            if (!this.friendTags[userId])
                this.friendTags[userId] = [];
            if (this.friendTags[userId].includes(tag))
                return;
            this.friendTags[userId].push(tag);
            this.tagInput = '';
        },
        removeTag(userId, idx) { if (this.friendTags[userId])
            this.friendTags[userId].splice(idx, 1); },
        removeLastTag(userId) {
            if (this.tagInput)
                return;
            const tags = this.friendTags[userId];
            if (tags && tags.length)
                tags.pop();
        },
        // ===== Messaging =====
        send() { const t = this.inputText.trim(); if (!t || !this.store.currentChannelId)
            return; wsManager.send(this.store.currentChannelId, t); this.inputText = ''; },
        toggleAttachPanel() { this.showAttachPanel = !this.showAttachPanel; },
        attachAction(type) { this.showAttachPanel = false; /* placeholder */ },
        toggleSidebar() { this.store.sidebarOpen = !this.store.sidebarOpen; },
        goHome() { this.store.currentChannelId = null; },
        goContacts() { this.$router.push('/contacts'); },
        goSettings() { this.$router.push('/settings'); },
        goDetails() {
            const ch = this.store.currentChannel;
            if (ch)
                this.$router.push('/details/' + encodeURIComponent(ch.id));
        },
        // ===== Utils =====
        fmtTime(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
        fmtDate(ts) { const d = new Date(ts); const n = new Date(); if (d.toDateString() === n.toDateString())
            return '今天 ' + this.fmtTime(ts); return `${d.getMonth() + 1}/${d.getDate()} ` + this.fmtTime(ts); },
        fmtFullDate(ts) { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${this.fmtTime(ts)}`; },
        dateLabel(ts) {
            const d = new Date(ts), n = new Date();
            if (d.toDateString() === n.toDateString())
                return '今天';
            const y = new Date(n);
            y.setDate(y.getDate() - 1);
            if (d.toDateString() === y.toDateString())
                return '昨天';
            return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
        },
        avatarColor(userId) {
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < (userId || '').length; i++)
                h = ((h << 5) - h) + userId.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
        scrollDown() { this.$nextTick(() => { const el = this.$refs.msgArea; if (el)
            el.scrollTop = el.scrollHeight; }); },
        // ===== Drag & Drop =====
        onDragOver(e) {
            const msgArea = this.$refs.msgArea;
            const inputBar = document.querySelector('.input-bar');
            if (!msgArea || !inputBar) {
                this.dragZone = null;
                return;
            }
            const mr = msgArea.getBoundingClientRect();
            const ir = inputBar.getBoundingClientRect();
            const x = e.clientX, y = e.clientY;
            if (x >= mr.left && x <= mr.right && y >= mr.top && y <= mr.bottom) {
                this.dragZone = 'send';
            }
            else if (x >= ir.left && x <= ir.right && y >= ir.top && y <= ir.bottom) {
                this.dragZone = 'attach';
            }
            else {
                this.dragZone = null;
            }
        },
        onDrop(e) {
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0)
                return;
            this.dragOver = false;
            if (this.dragZone === 'send') {
                this.sendFiles(files);
            }
            else {
                this.insertFileMeta(files[0]);
            }
            this.dragZone = null;
        },
        onDragLeave(e) {
            if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
                this.dragOver = false;
                this.dragZone = null;
            }
        },
        onDragEnd() {
            this.dragOver = false;
            this.dragZone = null;
        },
        _onWindowDragEnter(e) {
            if (e.dataTransfer?.types?.includes('Files')) {
                this.dragOver = true;
                this.dragZone = null;
            }
        },
        _onWindowDragLeave(e) {
            if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
                this.dragOver = false;
                this.dragZone = null;
            }
        },
        async sendFiles(files) {
            const file = files[0];
            if (!file)
                return;
            if (!confirm(`确认发送文件？\n\n文件名：${file.name}\n大小：${(file.size / 1024 / 1024).toFixed(1)} MB`))
                return;
            try {
                const res = await api.uploadFile(file, this.store.currentChannelId);
                if (res.success) {
                    const msg = { type: 'file', fileId: res.content.fileId, fileName: res.content.fileName, fileSize: res.content.fileSize, mimeType: res.content.mimeType, url: res.content.url };
                    wsManager.send(this.store.currentChannelId, JSON.stringify(msg));
                }
            }
            catch (_) {
                // Fallback: send as text
                wsManager.send(this.store.currentChannelId, `[文件：${file.name}]`);
            }
        },
        insertFileMeta(file) {
            const text = `[附件：${file.name}] `;
            const input = document.querySelector('.input-bar input');
            if (input) {
                const start = input.selectionStart || 0;
                const val = this.inputText;
                this.inputText = val.slice(0, start) + text + val.slice(start);
                this.$nextTick(() => { input.focus(); input.selectionStart = input.selectionEnd = start + text.length; });
            }
            else {
                this.inputText += text;
            }
        },
    },
    mounted() {
        const fid = this.store.currentChannelId || this.store.channels[0]?.id;
        if (fid) {
            this.store.selectChannel(fid);
            wsManager.connect(fid);
        }
        this.scrollDown();
        window.addEventListener('dragenter', this._onWindowDragEnter);
        window.addEventListener('dragleave', this._onWindowDragLeave);
    },
    beforeUnmount() {
        window.removeEventListener('dragenter', this._onWindowDragEnter);
        window.removeEventListener('dragleave', this._onWindowDragLeave);
    },
    watch: {
        'store.currentMessages': { handler() { this.scrollDown(); }, deep: true },
        'store.currentChannelId'() { this.scrollDown(); },
    },
};
