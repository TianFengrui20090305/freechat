"use strict";
const DetailsPage = {
    template: `
    <div class="app-layout">
      <!-- Nav Bar -->
      <nav class="nav-bar">
        <div class="nav-logo" @click="goHome" title="FreeChat">F</div>
        <button class="nav-btn" title="聊天" @click="goHome">💬</button>
        <button class="nav-btn" title="联系人" @click="goContacts">👥</button>
        <div class="nav-spacer"></div>
        <button class="nav-btn" title="设置" @click="goSettings">⚙️</button>
        <img v-if="store.user" class="nav-avatar" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect fill='%234f7cff' width='30' height='30' rx='15'/%3E%3Ctext x='15' y='20' text-anchor='middle' fill='%23fff' font-size='14' font-weight='bold'%3E{{store.user.username[0]}}%3C/text%3E%3C/svg%3E" :alt="store.user.username" @click="goSettings" />
      </nav>

      <main class="details-page" v-if="channel">
        <div class="details-header">
          <button class="btn btn-ghost" @click="goBack">← 返回</button>
          <h2>{{ channel.type === 'private' ? '聊天详情' : '群聊详情' }}</h2>
        </div>

        <!-- Info Card -->
        <div class="details-card">
          <div class="details-card-avatar" :style="avatarStyle">
            {{ channel.name[0] }}
          </div>
          <div class="details-card-name">{{ channel.name }}</div>
          <div class="details-card-type">{{ channel.type === 'private' ? '私聊' : '群聊' }}</div>
        </div>

        <!-- Group Only: Members -->
        <div v-if="channel.type !== 'private'" class="details-section">
          <div class="details-section-title">成员</div>
          <div class="details-members">
            <div v-for="m in mockMembers" :key="m.id" class="details-member" @click="showProfile(m)">
              <div class="details-member-avatar" :style="memberColor(m)">{{ m.name[0] }}</div>
              <div class="details-member-name">{{ m.name }}</div>
            </div>
          </div>
        </div>

        <!-- Info rows -->
        <div class="details-section">
          <div class="details-section-title">基本信息</div>
          <div class="details-row">
            <span class="details-label">频道 ID</span>
            <span class="details-value">{{ channel.id }}</span>
          </div>
          <div class="details-row">
            <span class="details-label">类型</span>
            <span class="details-value">{{ channel.type === 'private' ? '私聊' : '群聊' }}</span>
          </div>
          <div v-if="channel.type !== 'private'" class="details-row">
            <span class="details-label">成员数</span>
            <span class="details-value">{{ mockMembers.length }} 人</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="details-actions">
          <button class="btn btn-ghost details-action-btn" @click="goBack">关闭</button>
        </div>
      </main>

      <!-- Fallback -->
      <main class="main-content" v-else>
        <div class="empty-state">
          <div class="icon">🔍</div>
          <p>未找到频道信息</p>
          <button class="btn btn-primary" style="width:auto;margin-top:8px" @click="goHome">返回聊天</button>
        </div>
      </main>
    </div>
  `,
    data() {
        return {
            store,
            mockMembers: [],
        };
    },
    computed: {
        channelId() {
            return this.$route.params.roomId;
        },
        channel() {
            return this.store.channels.find(c => c.id === this.channelId) || null;
        },
        avatarStyle() {
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < (this.channel?.name || '').length; i++)
                h = ((h << 5) - h) + this.channel.name.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
    },
    methods: {
        goHome() { this.$router.push('/chat/' + this.channelId); },
        goContacts() { this.$router.push('/contacts'); },
        goSettings() { this.$router.push('/settings'); },
        goBack() { this.$router.push('/chat/' + this.channelId); },
        showProfile(user) {
            // Placeholder for profile viewing
        },
        memberColor(m) {
            const colors = ['#4f7cff', '#2ed573', '#ff4757', '#ffa502', '#a55eea', '#1e90ff', '#ff6b81', '#7bed9f'];
            let h = 0;
            for (let i = 0; i < (m.id || '').length; i++)
                h = ((h << 5) - h) + m.id.charCodeAt(i);
            return { background: colors[Math.abs(h) % colors.length] };
        },
    },
};
