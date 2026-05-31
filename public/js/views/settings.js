"use strict";
const SettingsPage = {
    template: `
    <div class="app-layout">
      <nav class="nav-bar">
        <div class="nav-logo" @click="goHome" title="FreeChat">F</div>
        <button class="nav-btn" title="频道" @click="goHome">💬</button>
        <div class="nav-spacer"></div>
        <button class="nav-btn active" title="设置">⚙️</button>
      </nav>
      <main class="settings-page">
        <!-- Profile -->
        <div class="settings-section">
          <h3>个人资料</h3>
          <div class="settings-profile">
            <div class="settings-avatar">{{ store.user?.username?.[0] || '?' }}</div>
            <div class="settings-fields">
              <div class="form-group">
                <label>用户名</label>
                <input v-model="form.username" />
              </div>
              <div class="form-group">
                <label>个人简介</label>
                <input v-model="form.bio" placeholder="介绍一下自己..." />
              </div>
              <div style="font-size:12px;color:var(--text-muted)">ID: {{ store.user?.id }}</div>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-primary" @click="saveProfile">保存修改</button>
          </div>
        </div>

        <!-- Preferences -->
        <div class="settings-section">
          <h3>通知设置</h3>
          <div class="toggle-row">
            <label>消息通知</label>
            <div class="toggle" :class="{ active: store.notificationEnabled }" @click="toggle('notificationEnabled')"></div>
          </div>
          <div class="toggle-row">
            <label>声音提示</label>
            <div class="toggle" :class="{ active: store.soundEnabled }" @click="toggle('soundEnabled')"></div>
          </div>
        </div>

        <!-- Danger zone -->
        <div class="settings-section">
          <h3>账号</h3>
          <div class="settings-actions">
            <button class="btn btn-outline" @click="changePassword">修改密码</button>
            <button class="btn btn-danger" @click="logout">退出登录</button>
          </div>
        </div>
      </main>
    </div>
  `,
    data() {
        return {
            store,
            form: {
                username: store.user?.username || '',
                bio: '',
            },
        };
    },
    async mounted() {
        try {
            const res = await api.getMe();
            if (res.success && res.content) {
                this.form.username = res.content.username || store.user?.username || '';
                this.form.bio = res.content.bio || '';
                // Sync store user data
                if (store.user) {
                    store.user.username = res.content.username;
                    store.user.bio = res.content.bio;
                }
            }
        }
        catch (_) {
            // Use store values as fallback
            this.form.bio = store.user?.bio || '';
        }
    },
    methods: {
        goHome() { this.$router.push('/chat'); },
        async saveProfile() {
            try {
                await api.updateMe(this.form);
                alert('保存成功');
            }
            catch (e) {
                alert(e.message);
            }
        },
        toggle(key) {
            store[key] = !store[key];
            api.updateSettings({ [key]: store[key] }).catch(() => { });
        },
        changePassword() {
            alert('修改密码功能待对接 API');
        },
        logout() {
            store.logout();
            wsManager.disconnect();
            this.$router.push('/login');
        },
    },
};
