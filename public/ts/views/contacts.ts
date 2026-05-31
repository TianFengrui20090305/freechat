const ContactsPage = {
  template: `
    <div class="app-layout">
      <!-- Nav Bar -->
      <nav class="nav-bar">
        <div class="nav-logo" @click="goHome" title="FreeChat">F</div>
        <button class="nav-btn" title="聊天" @click="goHome">💬</button>
        <button class="nav-btn active" title="联系人">👥</button>
        <div class="nav-spacer"></div>
        <button class="nav-btn" title="设置" @click="goSettings">⚙️</button>
        <img v-if="store.user" class="nav-avatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect fill='%234f7cff' width='30' height='30' rx='15'/%3E%3Ctext x='15' y='20' text-anchor='middle' fill='%23fff' font-size='14' font-weight='bold'%3E{{store.user.username[0]}}%3C/text%3E%3C/svg%3E" :alt="store.user.username" @click="goSettings" />
      </nav>

      <!-- Main -->
      <main class="contacts-page">
        <div class="contacts-tabs">
          <button v-for="tab in tabs" :key="tab.key"
            class="contacts-tab"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key">
            {{ tab.label }}
          </button>
        </div>

        <!-- ===== Tab: New Friends ===== -->
        <div v-if="activeTab === 'requests'" class="contacts-body">
          <div v-if="store.friendRequests.length === 0" class="contacts-empty">
            <div class="contacts-empty-icon">👥</div>
            <p>暂无好友请求</p>
          </div>
          <div v-for="req in store.friendRequests" :key="req.id" class="request-card">
            <div class="request-avatar" :style="avatarColor(req.id)">{{ req.username[0] }}</div>
            <div class="request-info">
              <div class="request-name">{{ req.username }}</div>
              <div class="request-msg">{{ req.msg || '请求添加你为好友' }}</div>
              <div class="request-time">{{ fmtTime(req.time) }}</div>
            </div>
            <div class="request-actions">
              <template v-if="req.status === 'pending'">
                <button class="btn btn-sm btn-primary" @click="acceptReq(req.id)">接受</button>
                <button class="btn btn-sm btn-ghost" @click="rejectReq(req.id)">拒绝</button>
              </template>
              <span v-else-if="req.status === 'accepted'" class="request-badge accepted">已添加</span>
              <span v-else class="request-badge rejected">已拒绝</span>
            </div>
          </div>
        </div>

        <!-- ===== Tab: Tags ===== -->
        <div v-if="activeTab === 'tags'" class="contacts-body">
          <div v-if="allTags.length === 0" class="contacts-empty">
            <div class="contacts-empty-icon">🏷️</div>
            <p>暂无标签</p>
          </div>
          <div v-for="tag in allTags" :key="tag" class="tag-group">
            <div class="tag-header" @click="toggleTag(tag)">
              <span class="tag-arrow" :class="{ open: expandedTags[tag] }">▸</span>
              <span class="tag-label">{{ tag }}</span>
              <span class="tag-count">{{ store.getContactsByTag(tag).length }}</span>
            </div>
            <div v-if="expandedTags[tag]" class="tag-contacts">
              <div v-for="c in store.getContactsByTag(tag)" :key="c.id" class="contact-item" @click="showProfile(c.id, $event)">
                <div class="contact-avatar" :style="avatarColor(c.id)">{{ c.username[0] }}</div>
                <div class="contact-info">
                  <div class="contact-name">{{ c.username }}</div>
                  <div class="contact-meta">{{ store.getContactMeta(c.id).notes || c.id }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Tab: Contact List ===== -->
        <div v-if="activeTab === 'list'" class="contacts-body">
          <div class="contacts-search-bar">
            <input v-model="searchQuery" placeholder="搜索联系人..." />
          </div>

          <!-- Starred -->
          <div v-if="starredContacts.length > 0" class="alpha-group">
            <div class="alpha-header">⭐ 星标联系人</div>
            <div v-for="c in starredContacts" :key="c.id" class="contact-item" @click="showProfile(c.id, $event)">
              <div class="contact-avatar" :style="avatarColor(c.id)">{{ c.username[0] }}</div>
              <div class="contact-info">
                <div class="contact-name">
                  {{ c.username }}
                  <span v-if="store.getContactMeta(c.id).notes" class="contact-remark">（{{ store.getContactMeta(c.id).notes }}）</span>
                </div>
              </div>
            </div>
          </div>

          <!-- A-Z groups -->
          <div v-for="letter in alphaKeys" :key="letter" class="alpha-group">
            <div class="alpha-header">{{ letter }}</div>
            <div v-for="c in alphaGroups[letter]" :key="c.id" class="contact-item" @click="showProfile(c.id, $event)">
              <div class="contact-avatar" :style="avatarColor(c.id)">{{ c.username[0] }}</div>
              <div class="contact-info">
                <div class="contact-name">{{ c.username }}</div>
              </div>
            </div>
          </div>

          <div v-if="filteredContacts.length === 0 && searchQuery" class="contacts-empty">
            <p>没有匹配的联系人</p>
          </div>
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
            <input class="profile-friend-input" v-model="profileNotes" placeholder="设置备注名" @change="saveNote" />
          </div>
          <div class="profile-friend-row">
            <span class="profile-friend-label">标签</span>
            <div class="profile-tags">
              <span v-for="(tag, ti) in profileTags" :key="ti" class="profile-tag">
                {{ tag }}
                <span class="profile-tag-del" @click="removeProfileTag(ti)">×</span>
              </span>
              <input class="profile-tag-input" v-model="tagInput" placeholder="添加标签" @keydown.enter.prevent="addProfileTag" @keydown.backspace.prevent="removeLastProfileTag" style="width:70px" />
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
          <div class="profile-more-row"><span>最后活跃</span><span class="profile-more-val">{{ profileUser.lastSeen ? fmtFullDate(profileUser.lastSeen) : '未知' }}</span></div>
        </div>

        <!-- Actions -->
        <div class="profile-actions">
          <button class="btn btn-primary" @click="startPrivateChat">💬 发送私聊</button>
          <button class="btn btn-ghost" @click="toggleStarContact">{{ store.getContactMeta(profileUser.id).starred ? '⭐ 取消星标' : '☆ 设为星标' }}</button>
        </div>
      </div>

        <!-- Shared Groups Panel -->
        <div v-if="showSharedPanel && profileUser" class="shared-panel" :style="sharedPanelStyle">
          <div class="shared-panel-header">
            <span>共同群聊</span>
            <button class="shared-panel-close" @click="showSharedPanel = false">×</button>
          </div>
          <div class="shared-panel-body">
            <div v-if="sharedGroupList.length === 0" class="shared-panel-empty">无共同群聊</div>
            <div v-for="g in sharedGroupList" :key="g.id" class="shared-panel-item" @click="goToGroup(g)">
              <div class="shared-group-avatar" :style="groupAvatar(g.name)">{{ g.name[0] }}</div>
              <span class="shared-group-name"># {{ g.name }}</span>
            </div>
          </div>
        </div>
    </div>
  `,
  data() {
    return {
      store,
      activeTab: 'list',
      searchQuery: '',
      expandedTags: {},

      // Profile popup
      profileUser: null,
      profileStyle: {},
      showMore: false,
      showSharedPanel: false,
      tagInput: '',
    };
  },
  computed: {
    tabs() {
      return [
        { key: 'requests', label: '新朋友' },
        { key: 'tags', label: '标签' },
        { key: 'list', label: '好友列表' },
      ];
    },
    profileTags() {
      if (!this.profileUser) return [];
      return this.store.getContactMeta(this.profileUser.id).tags;
    },
    profileNotes: {
      get() {
        if (!this.profileUser) return '';
        return this.store.getContactMeta(this.profileUser.id).notes;
      },
      set(val) {
        if (!this.profileUser) return;
        const meta = this.store.getContactMeta(this.profileUser.id);
        meta.notes = val;
        localStorage.setItem('fc_contact_meta', JSON.stringify(this.store.contactMeta));
      },
    },
    profileAvatarStyle() {
      const colors = ['#4f7cff','#2ed573','#ff4757','#ffa502','#a55eea','#1e90ff','#ff6b81','#7bed9f'];
      let h = 0;
      for (let i = 0; i < (this.profileUser?.id || '').length; i++) h = ((h << 5) - h) + this.profileUser.id.charCodeAt(i);
      return { background: colors[Math.abs(h) % colors.length] };
    },
    sharedGroupList() {
      if (!this.profileUser) return [];
      return this.store.getSharedGroups(this.profileUser.id);
    },
    sharedPanelStyle() {
      if (!this.profileStyle || !this.profileStyle.left) return {};
      const left = parseFloat(this.profileStyle.left) + 320;
      return { position: 'fixed', left: left + 'px', top: this.profileStyle.top };
    },
    friendSourceText() {
      if (!this.profileUser) return '';
      return '搜索添加';
    },
    friendAddedTimeText() {
      if (!this.profileUser) return '';
      const contact = this.store.contacts.find(c => c.id === this.profileUser.id);
      if (!contact?.addedAt) return '未知';
      return this.fmtFullDate(contact.addedAt);
    },

    filteredContacts() {
      if (!this.searchQuery) return this.store.contacts;
      const q = this.searchQuery.toLowerCase();
      return this.store.contacts.filter(c => c.username.toLowerCase().includes(q));
    },
    starredContacts() {
      return this.filteredContacts.filter(c => {
        const meta = this.store.getContactMeta(c.id);
        return meta && meta.starred;
      });
    },
    allTags() {
      return this.store.getAllTags();
    },
    nonStarredContacts() {
      return this.filteredContacts.filter(c => {
        const meta = this.store.getContactMeta(c.id);
        return !meta || !meta.starred;
      });
    },
    alphaGroups() {
      const groups = {};
      for (const c of this.nonStarredContacts) {
        const first = c.username[0].toUpperCase();
        const key = /[A-Z]/.test(first) ? first : '#';
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      }
      for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.username.localeCompare(b.username, 'zh-CN'));
      }
      return groups;
    },
    alphaKeys() {
      const keys = Object.keys(this.alphaGroups).sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      });
      return keys;
    },
  },
  methods: {
    goHome() { this.$router.push('/chat'); },
    goSettings() { this.$router.push('/settings'); },

    acceptReq(id) { this.store.acceptFriendRequest(id); },
    rejectReq(id) { this.store.rejectFriendRequest(id); },

    toggleTag(tag) {
      this.expandedTags[tag] = !this.expandedTags[tag];
    },

    // ===== Profile =====
    async showProfile(userId, event) {
      if (userId === this.store.user?.id) return;
      this.profileUser = await this.store.getProfile(userId);
      this.showMore = false;
      this.tagInput = '';
      this.$nextTick(() => {
        // Center the popup
        this.profileStyle = {
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        };
      });
    },
    closeProfilePopup() { this.profileUser = null; this.showSharedPanel = false; },
    startPrivateChat() {
      if (!this.profileUser) return;
      this.$router.push('/chat');
      // Need to create the private channel and select it
      const pid = 'p:' + this.profileUser.id;
      let ch = this.store.channels.find(c => c.id === pid);
      if (!ch) {
        ch = { id: pid, name: this.profileUser.username, type: 'private', unread: 0, icon: '👤' };
        this.store.channels.push(ch);
        if (!this.store.messages[pid]) this.store.messages[pid] = [];
      }
      this.store.selectChannel(pid);
      wsManager.connect(pid);
      this.profileUser = null;
    },
    toggleStarContact() {
      if (!this.profileUser) return;
      this.store.toggleStar(this.profileUser.id);
    },
    goToGroup(g) {
      this.$router.push('/chat');
      this.store.selectChannel(g.id);
      wsManager.connect(g.id);
      this.closeProfilePopup();
    },
    groupAvatar(name) {
      const colors = ['#4f7cff','#2ed573','#ff4757','#ffa502','#a55eea','#1e90ff','#ff6b81','#7bed9f'];
      let h = 0;
      for (let i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
      return { background: colors[Math.abs(h) % colors.length] };
    },

    // ===== Tags / Notes =====
    saveNote() {
      localStorage.setItem('fc_contact_meta', JSON.stringify(this.store.contactMeta));
    },
    addProfileTag() {
      const tag = this.tagInput.trim();
      if (!tag || !this.profileUser) return;
      const meta = this.store.getContactMeta(this.profileUser.id);
      if (meta.tags.includes(tag)) return;
      meta.tags.push(tag);
      localStorage.setItem('fc_contact_meta', JSON.stringify(this.store.contactMeta));
      this.tagInput = '';
    },
    removeProfileTag(idx) {
      if (!this.profileUser) return;
      const meta = this.store.getContactMeta(this.profileUser.id);
      meta.tags.splice(idx, 1);
      localStorage.setItem('fc_contact_meta', JSON.stringify(this.store.contactMeta));
    },
    removeLastProfileTag() {
      if (this.tagInput) return;
      if (!this.profileUser) return;
      const meta = this.store.getContactMeta(this.profileUser.id);
      if (meta.tags.length) meta.tags.pop();
      localStorage.setItem('fc_contact_meta', JSON.stringify(this.store.contactMeta));
    },

    // ===== Utils =====
    fmtTime(ts) {
      const d = new Date(ts);
      const n = new Date();
      const diff = n.getTime() - d.getTime();
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
      if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + '天前';
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    fmtFullDate(ts) {
      const d = new Date(ts);
      return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    },

    avatarColor(userId) {
      const colors = ['#4f7cff','#2ed573','#ff4757','#ffa502','#a55eea','#1e90ff','#ff6b81','#7bed9f'];
      let h = 0;
      for (let i = 0; i < (userId || '').length; i++) h = ((h << 5) - h) + userId.charCodeAt(i);
      return { background: colors[Math.abs(h) % colors.length] };
    },
  },
};
