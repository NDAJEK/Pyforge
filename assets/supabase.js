/* ============================================================
   Supabase 后端适配（REST 直连，不依赖 SDK）
   认证：GoTrue  /auth/v1/*
   数据：PostgREST /rest/v1/progress
   配置写在 assets/config.js
   ============================================================ */
(function () {
  'use strict';

  const SESS_KEY = 'ncre2py_sb_session';
  const CFG_KEY = 'pf_supa';

  /* 应用内配置优先：允许不碰源码，直接把 URL 和 anon key 存在本机 */
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c && c.url && c.anonKey) window.SUPA_CONFIG = c;
  } catch (e) {}
  const C = () => window.SUPA_CONFIG || {};
  const base = () => (C().url || '').replace(/\/+$/, '');
  const anon = () => C().anonKey || '';

  let sess = null;              // { access_token, refresh_token, expires_at, user:{id,email} }
  let pushing = false, pending = null, timer = null;

  const read = () => { try { return JSON.parse(localStorage.getItem(SESS_KEY)); } catch (e) { return null; } };
  const write = s => { if (s) localStorage.setItem(SESS_KEY, JSON.stringify(s)); else localStorage.removeItem(SESS_KEY); };

  function headers(token) {
    const h = { 'apikey': anon(), 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  async function api(path, opt) {
    opt = opt || {};
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(base() + path, {
        method: opt.method || 'GET',
        headers: Object.assign(headers(opt.token), opt.headers || {}),
        body: opt.body ? JSON.stringify(opt.body) : undefined,
        signal: ctl.signal
      });
      let data = null;
      const txt = await r.text();
      if (txt) { try { data = JSON.parse(txt); } catch (e) { data = txt; } }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null, net: true };   // 断网 / 超时 / CORS
    } finally {
      clearTimeout(timer);
    }
  }

  /* 把 Supabase 的英文错误翻译成能看懂的话 */
  function humanise(d, status) {
    if (status === 0) return '连不上云端，请检查网络后重试';
    const msg = (d && (d.msg || d.error_description || d.message || d.error)) || '';
    if (/Invalid login credentials/i.test(msg)) return '邮箱或密码错误';
    if (/Email not confirmed/i.test(msg)) return '邮箱还没验证，请先点邮件里的确认链接';
    if (/User already registered/i.test(msg)) return '这个邮箱已经注册过了';
    if (/Password should be at least/i.test(msg)) return '密码太短了，至少 6 位';
    if (/Unable to validate email/i.test(msg)) return '邮箱格式不对';
    if (/rate limit|too many/i.test(msg)) return '请求太频繁，稍等一会儿再试';
    if (status === 401) return '登录状态已失效，请重新登录';
    return msg || ('请求失败（' + status + '）');
  }

  async function refresh() {
    if (!sess || !sess.refresh_token) return false;
    const r = await api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: sess.refresh_token }
    });
    if (!r.ok) { sess = null; write(null); return false; }
    setSession(r.data);
    return true;
  }

  function setSession(d) {
    const u = d.user || (sess && sess.user) || {};
    sess = {
      access_token: d.access_token,
      refresh_token: d.refresh_token || (sess && sess.refresh_token),
      expires_at: Date.now() + (d.expires_in || 3600) * 1000,
      user: { id: u.id, email: u.email }
    };
    write(sess);
  }

  async function token() {
    if (!sess) return null;
    if (sess.expires_at - 60000 < Date.now()) {
      const ok = await refresh();
      if (!ok) return null;
    }
    return sess.access_token;
  }

  const SupaAuth = {
    mode: 'supabase',

    async init() {
      sess = read();
      if (!sess) return { user: null, data: null };
      const t = await token();
      if (!t) return { user: null, data: null };
      const me = await api('/auth/v1/user', { token: t });
      if (!me.ok) { sess = null; write(null); return { user: null, data: null }; }
      const email = (me.data && me.data.email) || sess.user.email;
      sess.user = { id: me.data.id, email };
      write(sess);
      const data = await this.load();
      return { user: email, data };
    },

    async register(email, password) {
      const r = await api('/auth/v1/signup', { method: 'POST', body: { email, password } });
      if (!r.ok) return { ok: false, msg: humanise(r.data, r.status) };
      // 开启了邮箱确认时，signup 不返回 token
      if (!r.data.access_token) {
        return { ok: false, msg: '注册成功，确认邮件已发送。点邮件里的链接验证后再登录（也可以在 Supabase 后台关掉邮箱确认）' };
      }
      setSession(r.data);
      return { ok: true, user: r.data.user.email };
    },

    async login(email, password) {
      const r = await api('/auth/v1/token?grant_type=password', {
        method: 'POST', body: { email, password }
      });
      if (!r.ok) return { ok: false, msg: humanise(r.data, r.status) };
      setSession(r.data);
      return { ok: true, user: r.data.user.email };
    },

    async logout() {
      const t = sess && sess.access_token;
      if (t) { try { await api('/auth/v1/logout', { method: 'POST', token: t }); } catch (e) {} }
      sess = null; write(null);
    },

    async load() {
      const t = await token();
      if (!t) return null;
      const uid = sess.user.id;
      const r = await api('/rest/v1/progress?select=payload&user_id=eq.' + uid, { token: t });
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
      const p = r.data[0].payload;
      return p && Object.keys(p).length ? p : null;
    },

    /* 800ms 防抖 + 串行化，避免并发写冲突 */
    save(data) {
      pending = data;
      clearTimeout(timer);
      timer = setTimeout(() => this.flush(), 800);
    },

    async flush() {
      if (pushing || !pending) return;
      pushing = true;
      const payload = pending; pending = null;
      try {
        const t = await token();
        if (!t) return;
        await api('/rest/v1/progress?on_conflict=user_id', {
          method: 'POST',
          token: t,
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: { user_id: sess.user.id, payload, updated: new Date().toISOString() }
        });
      } catch (e) {
        console.warn('同步失败', e);
        pending = pending || payload;       // 失败留待下次
      } finally {
        pushing = false;
        if (pending) setTimeout(() => this.flush(), 1500);
      }
    },

    configured() { return !!(base() && anon()); }
  };

  window.SupaAuth = SupaAuth;
})();
