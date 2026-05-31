"use strict";
// 本地开发使用 Cloudflare Turnstile 测试密钥（始终通过验证）
const TURNSTILE_SITE_KEY = '0x4AAAAAADADPM_qobuHis41';
const LoginPage = {
    template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-title">
          <h1>FreeChat</h1>
          <p>{{ isRegister ? '创建新账号' : '登录你的账号' }}</p>
        </div>
        <div v-if="error" class="auth-error">{{ error }}</div>
        <form @submit.prevent="submit">
          <div class="form-group">
            <label>用户 ID</label>
            <input v-model="form.id" placeholder="例如：user_001" required />
          </div>
          <div v-if="isRegister" class="form-group">
            <label>用户名</label>
            <input v-model="form.username" placeholder="你的昵称" required />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="form.password" type="password" placeholder="输入密码" required />
            <div class="hint">密码将在本地进行 SHA-256 哈希，不会明文传输</div>
          </div>
          <div v-if="isRegister" class="form-group">
            <label>确认密码</label>
            <input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" required />
          </div>
          <div v-if="isRegister" class="form-group">
            <label>邀请码 <span style="color:#999;font-weight:normal">（如已关闭注册则必填）</span></label>
            <input v-model="form.invcode" placeholder="请输入邀请码" />
          </div>
          <div v-if="isRegister" ref="turnstileContainer" class="captcha-placeholder"></div>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? '处理中...' : (isRegister ? '注册' : '登录') }}
          </button>
        </form>
        <div class="auth-link">
          <template v-if="isRegister">
            已有账号？<a @click="switchMode">登录</a>
          </template>
          <template v-else>
            没有账号？<a @click="switchMode">注册</a>
          </template>
        </div>
      </div>
    </div>
  `,
    data() {
        return {
            isRegister: false,
            loading: false,
            error: '',
            form: { id: '', username: '', password: '', confirmPassword: '', invcode: '' },
            turnstileWidgetId: null,
            turnstileToken: '',
        };
    },
    methods: {
        switchMode() {
            const target = this.isRegister ? '/login' : '/register';
            this.$router.replace(target);
        },
        removeTurnstile() {
            if (this.turnstileWidgetId != null) {
                try {
                    turnstile.remove(this.turnstileWidgetId);
                }
                catch (_) { }
                this.turnstileWidgetId = null;
                this.turnstileToken = '';
            }
        },
        async initTurnstile() {
            while (typeof turnstile === 'undefined') {
                await new Promise(r => setTimeout(r, 100));
            }
            this.$nextTick(() => {
                const el = this.$refs.turnstileContainer;
                if (!el)
                    return;
                el.innerHTML = '';
                this.turnstileWidgetId = turnstile.render(el, {
                    sitekey: TURNSTILE_SITE_KEY,
                    callback: (token) => {
                        this.turnstileToken = token;
                    },
                });
            });
        },
        async submit() {
            this.loading = true;
            this.error = '';
            try {
                if (this.isRegister && this.form.password !== this.form.confirmPassword) {
                    throw new Error('两次输入的密码不一致');
                }
                const clientHash = await this.sha256(this.form.password);
                if (this.isRegister) {
                    await api.register(this.form.id, this.form.username, clientHash, this.turnstileToken, this.form.invcode);
                    this.removeTurnstile();
                    const res = await api.login(this.form.id, this.form.username, clientHash);
                    store.login({ id: this.form.id, username: this.form.username, token: res.token });
                    this.$router.push('/chat');
                }
                else {
                    const res = await api.login(this.form.id, this.form.username, clientHash);
                    store.login({ id: this.form.id, username: this.form.username, token: res.token });
                    this.$router.push('/chat');
                }
            }
            catch (e) {
                this.error = e.message;
                if (this.turnstileWidgetId != null) {
                    turnstile.reset(this.turnstileWidgetId);
                    this.turnstileToken = '';
                }
            }
            finally {
                this.loading = false;
            }
        },
        async sha256(str) {
            const enc = new TextEncoder().encode(str);
            const hash = await crypto.subtle.digest('SHA-256', enc);
            return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        },
        onRouteChange() {
            const isReg = this.$route.path === '/register';
            this.isRegister = isReg;
            this.error = '';
            if (isReg) {
                this.$nextTick(() => this.initTurnstile());
            }
            else {
                this.removeTurnstile();
            }
        },
    },
    mounted() {
        this.onRouteChange();
    },
    watch: {
        '$route.path'() {
            this.onRouteChange();
        },
    },
};
