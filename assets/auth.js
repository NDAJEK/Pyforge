/* ============================================================
   身份验证模块（Auth）
   - local  模式：纯前端，账号存在本机 localStorage，离线可用
   - server 模式：检测到 /api/health 时启用，账号与进度存服务器
   密码一律用 PBKDF2-HMAC-SHA256 加盐哈希，不保存明文
   ============================================================ */
(function () {
  'use strict';

  /* ---------- SHA-256（纯 JS，兼容无 Web Crypto 的 WebView） ---------- */
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(bytes) {
    const l = bytes.length;
    const padded = new Uint8Array((((l + 9) >> 6) + 1) << 6);
    padded.set(bytes); padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    const bits = l * 8;
    dv.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
    dv.setUint32(padded.length - 4, bits >>> 0);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let i = 0; i < padded.length; i += 64) {
      for (let j = 0; j < 16; j++) w[j] = dv.getUint32(i + j * 4);
      for (let j = 16; j < 64; j++) {
        const a = w[j - 15], b = w[j - 2];
        w[j] = (w[j - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + w[j - 7] +
          (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let j = 0; j < 64; j++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
    return out;
  }

  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const unhex = s => { const a = new Uint8Array(s.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16); return a; };
  const b64 = b => btoa(String.fromCharCode.apply(null, b));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const rand = n => { const a = new Uint8Array(n); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256 | 0)); return a; };
  const now = () => Date.now();

  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    const k = new Uint8Array(64); k.set(key);
    const inner = new Uint8Array(64 + msg.length), outer = new Uint8Array(64 + 32);
    for (let i = 0; i < 64; i++) { inner[i] = k[i] ^ 0x36; outer[i] = k[i] ^ 0x5c; }
    inner.set(msg, 64);
    outer.set(sha256(inner), 64);
    return sha256(outer);
  }

  /* PBKDF2-HMAC-SHA256，bkLen=32 即单块 */
  function pbkdf2(pass, salt, iter) {
    const p = new TextEncoder().encode(pass);
    const s = new Uint8Array(salt.length + 4);
    s.set(salt); s[salt.length + 3] = 1;
    let u = hmac(p, s);
    const t = u.slice(0);
    for (let i = 1; i < iter; i++) {
      u = hmac(p, u);
      for (let j = 0; j < 32; j++) t[j] ^= u[j];
    }
    return t;
  }

  /* 有 Web Crypto（HTTPS / localhost）时走原生 PBKDF2，快几十倍，可用更高轮数 */
  const HAS_SUBTLE = !!(window.crypto && window.crypto.subtle && window.crypto.subtle.importKey);
  const ITER_JS = 12000;      // 纯 JS 兜底（minis:// 等非安全上下文）
  const ITER_WEB = 210000;    // 原生实现

  async function derive(pass, salt, iter) {
    if (!HAS_SUBTLE) return pbkdf2(pass, salt, iter);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
    return new Uint8Array(bits);
  }

  /* ---------- 常量 ---------- */
  const ACC_KEY = 'ncre2py_accounts';
  const SES_KEY = 'ncre2py_session';
  const DATA_PREFIX = 'ncre2py_data:';
  const TOKEN_KEY = 'ncre2py_token';
  const SESSION_DAYS = 7;

  const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const Auth = {
    mode: 'local',
    user: null,
    token: null,
    _server: null,

    /* ---------- 启动 ---------- */
    async init() {
      // 显式启动了 server/app.py 就用它（本地自建服务优先于云端配置）
      if (await this._probe()) {
        this.mode = 'server';
        return this._serverInit();
      }
      if (window.SupaAuth && window.SUPA_CONFIG &&
          window.SUPA_CONFIG.url && window.SUPA_CONFIG.anonKey) {
        this.mode = 'supabase';
        try {
          const s = await SupaAuth.init();
          this.user = s.user || null;
          return s;
        } catch (e) {
          this.user = null;
          return { user: null, data: null };
        }
      }
      this.mode = 'local';
      return this._localInit();
    },

    async _probe() {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 1200);
        const r = await fetch('api/health', { cache: 'no-store', signal: ctl.signal });
        clearTimeout(t);
        if (!r.ok) return false;
        const j = await r.json();
        return !!j.ok;
      } catch (e) { return false; }
    },

    /* ---------- 本地后端 ---------- */
    _localInit() {
      const s = readJSON(SES_KEY, null);
      if (s && s.exp > now() && readJSON(ACC_KEY, {})[s.u]) {
        this.user = s.u; this.token = s.t;
        return { user: s.u, data: readJSON(DATA_PREFIX + s.u, null) };
      }
      return { user: null, data: null };
    },

    _localAccounts() { return readJSON(ACC_KEY, {}); },

    _localSaveAccounts(a) { writeJSON(ACC_KEY, a); },

    async register(username, password) {
      username = String(username || '').trim();
      const bad = (this.mode === 'supabase' ? validateEmail(username) : validateUser(username))
        || validatePass(password);
      if (bad) return { ok: false, msg: bad };
      if (this.mode === 'supabase') {
        const r = await SupaAuth.register(username, password);
        if (r.ok) this.user = r.user;
        return r;
      }
      if (this.mode === 'server') return this._serverRegister(username, password);
      const acc = this._localAccounts();
      if (acc[username]) return { ok: false, msg: '这个用户名已经被占用了' };
      const salt = rand(16);
      const iter = HAS_SUBTLE ? ITER_WEB : ITER_JS;
      const hash = await derive(password, salt, iter);
      acc[username] = { salt: b64(salt), hash: hex(hash), iter, created: now() };
      this._localSaveAccounts(acc);
      // 首次注册时，把旧版（无账号时代）的进度迁移过来
      const legacy = readJSON('ncre2py_v1', null);
      if (legacy && !readJSON(DATA_PREFIX + username, null)) writeJSON(DATA_PREFIX + username, legacy);
      this._session(username);
      return { ok: true, user: username };
    },

    async login(username, password) {
      username = String(username || '').trim();
      if (this.mode === 'supabase') {
        const r = await SupaAuth.login(username, password);
        if (r.ok) this.user = r.user;
        return r;
      }
      if (this.mode === 'server') return this._serverLogin(username, password);
      if (locked(username)) return { ok: false, msg: `尝试次数过多，请 ${lockLeft(username)} 秒后再试` };
      const rec = this._localAccounts()[username];
      if (!rec) return fail(username, '用户名或密码错误');
      const hash = hex(await derive(password, unb64(rec.salt), rec.iter || ITER_JS));
      if (hash !== rec.hash) return fail(username, '用户名或密码错误');
      clearFail(username);
      this._session(username);
      return { ok: true, user: username };
    },

    _session(username) {
      const t = hex(rand(16));
      writeJSON(SES_KEY, { u: username, t, exp: now() + SESSION_DAYS * 864e5 });
      this.user = username; this.token = t;
    },

    async logout() {
      if (this.mode === 'supabase') {
        await SupaAuth.logout();
        this.user = null; this.token = null;
        return;
      }
      if (this.mode === 'server') { try { await fetch('api/logout', { method: 'POST', headers: this._hdr() }); } catch (e) {} localStorage.removeItem(TOKEN_KEY); }
      localStorage.removeItem(SES_KEY);
      this.user = null; this.token = null;
    },

    /* ---------- 进度读写 ---------- */
    save(data) {
      if (this.mode === 'supabase') { if (this.user) SupaAuth.save(data); return; }
      if (!this.user) return;
      writeJSON(DATA_PREFIX + this.user, data);      // 始终本地备份
      if (this.mode === 'server') this._push(data);
    },

    _push(data) {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        fetch('api/progress', { method: 'PUT', headers: this._hdr(), body: JSON.stringify(data) }).catch(() => {});
      }, 800);
    },

    _hdr() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (this.token || '') }; },

    /* ---------- 服务端后端 ---------- */
    async _serverInit() {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return { user: null, data: null };
      this.token = token;                      // 必须在请求前赋值，_hdr() 依赖它
      try {
        const r = await fetch('api/me', { headers: this._hdr() });
        if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); this.token = null; return { user: null, data: null }; }
        if (!r.ok) return { user: null, data: null };
        const j = await r.json();
        this.user = j.user;
        const p = await fetch('api/progress', { headers: this._hdr() });
        const data = p.ok ? await p.json() : null;
        return { user: this.user, data: data && Object.keys(data).length ? data : null };
      } catch (e) { return { user: null, data: null }; }
    },

    async _serverRegister(username, password) {
      try {
        const r = await fetch('api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const j = await r.json();
        if (!r.ok) return { ok: false, msg: j.msg || '注册失败' };
        localStorage.setItem(TOKEN_KEY, j.token);
        this.token = j.token; this.user = j.user;
        return { ok: true, user: j.user };
      } catch (e) { return { ok: false, msg: '无法连接服务器' }; }
    },

    async _serverLogin(username, password) {
      try {
        const r = await fetch('api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const j = await r.json();
        if (!r.ok) return { ok: false, msg: j.msg || '用户名或密码错误' };
        localStorage.setItem(TOKEN_KEY, j.token);
        this.token = j.token; this.user = j.user;
        return { ok: true, user: j.user };
      } catch (e) { return { ok: false, msg: '无法连接服务器' }; }
    },

    /* ---------- 登录页 ---------- */
    renderGate(onDone) {
      let tab = 'login';
      const host = document.getElementById('gate');
      host.style.display = 'flex';
      document.getElementById('main').style.display = 'none';
      document.querySelector('.side').style.display = 'none';

      const isSupa = this.mode === 'supabase';
      const paint = () => {
        host.innerHTML = `<div class="gate-card">
          <div class="gate-brand">Py<b>Forge</b></div>
          <div class="gate-sub">Python 训练台 · 登录后进度跟着账号走</div>
          <div class="tabs">
            <div class="tab ${tab === 'login' ? 'on' : ''}" data-t="login">登录</div>
            <div class="tab ${tab === 'register' ? 'on' : ''}" data-t="register">注册</div>
          </div>
          <form id="gf" autocomplete="off">
            <label>${isSupa ? '邮箱' : '用户名'}</label>
            <input id="u" type="${isSupa ? 'email' : 'text'}" maxlength="${isSupa ? 80 : 20}"
              placeholder="${isSupa ? 'you@example.com' : '3-20 位，字母/数字/下划线'}" autocomplete="username">
            <label>密码</label>
            <input id="p" type="password" maxlength="64" placeholder="至少 6 位" autocomplete="current-password">
            ${tab === 'register' ? `<label>确认密码</label><input id="p2" type="password" maxlength="64" placeholder="再输一次">` : ''}
            <div class="gerr" id="gerr"></div>
            <button class="btn primary wide" type="submit" id="gbtn">${tab === 'login' ? '登录' : '创建账号'}</button>
          </form>
          <div class="gate-foot"><a class="gate-link" onclick="openCloudConfig()">配置云端同步</a><br>
            ${this.mode === 'supabase' ? '云端账号（Supabase）· 进度自动同步到所有设备'
      : this.mode === 'server' ? '账号存储在服务器，可在多台设备上同步进度'
        : '本地模式：账号只保存在这台设备，离线可用'}
          </div>
        </div>`;
        host.querySelectorAll('.tab').forEach(t => t.onclick = () => { tab = t.dataset.t; paint(); });
        host.querySelector('#gf').onsubmit = async e => {
          e.preventDefault();
          const u = host.querySelector('#u').value.trim();
          const p = host.querySelector('#p').value;
          const err = host.querySelector('#gerr');
          const btn = host.querySelector('#gbtn');
          err.textContent = '';
          if (tab === 'register' && p !== host.querySelector('#p2').value) { err.textContent = '两次输入的密码不一致'; return; }
          btn.disabled = true; btn.textContent = '处理中…';
          let res;
          try {
            res = tab === 'login' ? await this.login(u, p) : await this.register(u, p);
          } catch (e) {
            res = { ok: false, msg: '连不上服务器，请检查网络后重试' };
          }
          if (!res.ok) { err.textContent = res.msg; btn.disabled = false; btn.textContent = tab === 'login' ? '登录' : '创建账号'; return; }
          host.style.display = 'none';
          document.getElementById('main').style.display = '';
          document.querySelector('.side').style.display = '';
          onDone(res.user);
        };
        setTimeout(() => host.querySelector('#u').focus(), 30);
      };
      paint();
    }
  };

  /* ---------- 校验与防爆破 ---------- */
  function validateUser(u) {
    if (!u) return '请输入用户名';
    if (u.length < 3 || u.length > 20) return '用户名长度需为 3-20 位';
    if (!/^[A-Za-z0-9_\u4e00-\u9fa5]+$/.test(u)) return '用户名只能包含字母、数字、下划线或中文';
    return '';
  }
  function validateEmail(e) {
    if (!e) return '请输入邮箱';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return '邮箱格式不正确';
    return '';
  }
  function validatePass(p) {
    if (!p) return '请输入密码';
    if (p.length < 6) return '密码至少 6 位';
    if (p.length > 64) return '密码太长了';
    return '';
  }
  const FAIL_KEY = 'ncre2py_fail';
  const MAX_FAIL = 5, LOCK_MS = 60000;
  function getFail() { return readJSON(FAIL_KEY, {}); }
  function fail(u, msg) {
    const f = getFail(); const r = f[u] || { n: 0, t: 0 };
    r.n++; r.t = now(); f[u] = r; writeJSON(FAIL_KEY, f);
    const left = MAX_FAIL - r.n;
    return { ok: false, msg: msg + (left > 0 ? `（还可以尝试 ${left} 次）` : '') };
  }
  function locked(u) { const r = getFail()[u]; return r && r.n >= MAX_FAIL && now() - r.t < LOCK_MS; }
  function lockLeft(u) { const r = getFail()[u]; return Math.ceil((LOCK_MS - (now() - r.t)) / 1000); }
  function clearFail(u) { const f = getFail(); delete f[u]; writeJSON(FAIL_KEY, f); }

  window.Auth = Auth;
})();
