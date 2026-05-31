const AdminPage = {
  template: `
    <div class="app-layout">
      <nav class="nav-bar">
        <div class="nav-logo" @click="goHome" title="FreeChat">F</div>
        <button class="nav-btn" title="频道" @click="goHome">💬</button>
        <div class="nav-spacer"></div>
        <button class="nav-btn active" title="管理">🛡️</button>
        <button class="nav-btn" title="设置" @click="goSettings">⚙️</button>
      </nav>
      <main class="admin-page">
        <h3>待审核内容</h3>
        <p v-if="reports.length === 0" style="color:var(--text-muted);font-size:14px;text-align:center;padding:40px 0">
          暂无待审核内容 ✅
        </p>
        <div v-for="(r, i) in reports" :key="i" class="report-card">
          <div class="report-meta">
            {{ r.reporter }} 在 #{{ r.channel }} 中报告了一条消息
            <span style="color:var(--text-muted)">· {{ formatTime(r.time) }}</span>
          </div>
          <div class="report-content">"{{ r.content }}"</div>
          <div class="report-actions">
            <button class="btn-sm-ignore" @click="dismiss(i)">忽略</button>
            <button class="btn-sm-delete" @click="deleteMsg(i)">删除</button>
            <button class="btn-sm-warn" @click="warnUser(i)">警告</button>
          </div>
        </div>
      </main>
    </div>
  `,
  data() {
    return {
      store,
      reports: [
        { reporter: '小明', channel: '通用', content: '这是一条测试举报数据，包含一些需要审核的内容', time: Date.now() - 1800000 },
        { reporter: '小红', channel: '技术讨论', content: '另一条示例举报数据，模拟待审核消息', time: Date.now() - 3600000 },
      ],
    };
  },
  methods: {
    goHome() { this.$router.push('/chat'); },
    goSettings() { this.$router.push('/settings'); },
    dismiss(i) { this.reports.splice(i, 1); },
    deleteMsg(i) { this.reports.splice(i, 1); },
    warnUser(i) { alert('已发送警告（待对接 API）'); this.reports.splice(i, 1); },
    formatTime(ts) {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    },
  },
};
