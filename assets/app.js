/* ===== PyForge · Python 训练台 ===== */
const ALL = (window.QUESTIONS || []).slice();
const byId = {};
ALL.forEach(q => byId[q.id] = q);

/* 进度由 Auth 托管：本地模式写 localStorage，服务端模式同步到服务器 */
let S = { rec: {}, days: {}, ver: 2 };
function save() { Auth.save(S); }

const CHAPS = [...new Set(ALL.map(q => q.ch))];
const DAY = 86400000;

function stats() {
  let seen = 0, right = 0, tries = 0, due = 0;
  const ch = {};
  CHAPS.forEach(c => ch[c] = { total: 0, seen: 0, right: 0, tries: 0 });
  ALL.forEach(q => {
    ch[q.ch].total++;
    const r = S.rec[q.id];
    if (r && r.s > 0) {
      seen++; ch[q.ch].seen++;
      right += r.c; tries += r.s; ch[q.ch].right += r.c; ch[q.ch].tries += r.s;
      if ((r.due || 0) <= Date.now()) due++;
    }
  });
  return { seen, right, tries, due, ch, total: ALL.length,
    acc: tries ? Math.round(right / tries * 100) : 0,
    wrongCount: Object.values(S.rec).filter(r => r.w > 0).length };
}
function streak() {
  let n = 0; const d = new Date();
  for (;;) {
    const k = dkey(d);
    if (S.days[k]) { n++; d.setDate(d.getDate() - 1); } else break;
  }
  return n;
}
function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() { return dkey(new Date()); }
function tickDay() { S.days[today()] = (S.days[today()] || 0) + 1; }

/* 记忆曲线：答对后按这几档往后推，答错次日重来 */
const STEPS = [1, 2.5, 6, 15, 30];
function nextInt(cur) {
  for (const v of STEPS) if (v > cur) return v;
  return STEPS[STEPS.length - 1];
}

function answer(q, choice) {
  const r = S.rec[q.id] || { s: 0, c: 0, w: 0, int: 0, due: 0 };
  const ok = choice === q.a;
  r.s++;
  if (ok) { r.c++; r.int = nextInt(r.int || 0); r.due = Date.now() + r.int * DAY; }
  else { r.w++; r.int = 0; r.due = Date.now() + DAY; }
  r.last = Date.now();
  S.rec[q.id] = r;
  tickDay(); save();
  return ok;
}

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- 轻提示 ---------- */
function toast(msg, type) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 280); }, 2300);
}

/* ---------- 确认弹窗（替代原生 confirm，样式统一） ---------- */
function confirmDialog(o) {
  return new Promise(resolve => {
    const m = document.getElementById('modal');
    m.querySelector('.modal-box').innerHTML =
      '<h4>' + esc(o.title || '确认操作') + '</h4>' +
      '<p>' + esc(o.text || '') + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn ghost" data-act="no">取消</button>' +
        '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-act="yes">' + esc(o.ok || '确定') + '</button>' +
      '</div>';
    m.classList.add('on');
    const done = v => { m.classList.remove('on'); m.onclick = null; resolve(v); };
    m.querySelectorAll('[data-act]').forEach(b => b.onclick = () => done(b.dataset.act === 'yes'));
    m.onclick = e => { if (e.target === m) done(false); };
  });
}
const main = () => $('#main');
const LETTERS = ['A', 'B', 'C', 'D'];

let timer = null;
function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

/* ---------- router ---------- */
let view = 'home';
function go(v, opt) {
  clearTimer(); view = v; opt = opt || {};
  document.querySelectorAll('#nav a, #tabbar a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
  main().scrollTop = 0;
  const fn = { home: renderHome, wrong: renderWrong, exam: renderExam, stats: renderStats, code: renderCode }[v];
  if (v === 'quiz') startQuiz(opt); else fn();
  if (v !== 'quiz') paintSide();
}

/* ---------- sidebar ---------- */
function paintSide() {
  const st = stats();
  const pct = st.total ? Math.round(st.seen / st.total * 100) : 0;
  $('#ring').style.background = `conic-gradient(var(--accent) ${pct * 3.6}deg, #e9ecf2 ${pct * 3.6}deg)`;
  $('#ringTxt').textContent = pct + '%';
  $('#doneCnt').textContent = st.seen;
  $('#totalCnt').textContent = st.total;
  $('#navWrong').textContent = st.wrongCount ? st.wrongCount : '';
  const tw = document.getElementById('tabWrong');
  if (tw) tw.textContent = st.wrongCount ? st.wrongCount : '';
}

/* ---------- home ---------- */
function renderHome() {
  const st = stats();
  const s = streak();
  const tdy = S.days[today()] || 0;
  let heroBig, heroUnit, heroTitle, heroNote;
  if (st.due > 0) {
    heroBig = st.due; heroUnit = '道待复习';
    heroTitle = '先把到期的复习题清掉';
    heroNote = '按记忆曲线，这些题现在做效果最好';
  } else if (st.seen > 0) {
    heroBig = tdy; heroUnit = '次今日已练';
    heroTitle = '接着上次的进度往下推';
    heroNote = `累计正确率 ${st.acc}% · 错题 ${st.wrongCount} 道 · 连续 ${s} 天`;
  } else {
    heroBig = st.total; heroUnit = '道题待解锁';
    heroTitle = '从第一题开始';
    heroNote = '每天 20 题，两周能把选择题过一遍';
  }
  main().innerHTML = `<div class="page">
    <h1>今天刷几道？</h1>
    <div class="sub">Python 训练台 · 题库 ${st.total} 道 · 连续学习 ${s} 天</div>
    <div class="hero">
      <div class="big">${heroBig}<small>${heroUnit}</small></div>
      <div class="txt"><h2>${heroTitle}</h2><p>${heroNote}</p></div>
      <button class="btn primary" onclick="go('quiz',{mode:'due'})">${st.due ? '开始复习' : '开始刷题'}</button>
    </div>
    <div class="cards">
      <div class="card"><div class="k">已练题目</div><div class="v">${st.seen}<small>/ ${st.total}</small></div></div>
      <div class="card"><div class="k">总正确率</div><div class="v">${st.acc}<small>%</small></div></div>
      <div class="card hl"><div class="k">今日已练</div><div class="v">${S.days[today()] || 0}<small>次</small></div></div>
      <div class="card"><div class="k">错题本</div><div class="v">${st.wrongCount}<small>道</small></div></div>
    </div>
    <div class="row-actions">
      <button class="btn" onclick="go('quiz',{mode:'new'})">只做新题</button>
      <button class="btn" onclick="go('wrong')">错题本</button>
      <button class="btn ghost" onclick="go('exam')">模拟考试</button>
      <button class="btn ghost" onclick="go('code')">编程题</button>
    </div>
    <div class="section-title">按章节练习</div>
    <div class="chlist">${CHAPS.map(c => {
      const o = st.ch[c]; const pc = o.seen ? Math.round(o.right / o.tries * 100) : 0;
      return `<div class="chrow" onclick="go('quiz',{mode:'ch',ch:'${esc(c)}'})">
        <div class="nm">${esc(c)}</div>
        <div class="cnt">${o.seen}/${o.total}</div>
        <div class="bar"><i class="${pc < 60 && o.tries ? 'low' : ''}" style="width:${o.seen ? pc : 0}%"></i></div>
        <div class="pc">${o.seen ? pc + '%' : '—'}</div>
      </div>`;
    }).join('')}</div>
  </div>`;
}

/* ---------- quiz ---------- */
let Q = null;
function startQuiz(opt) {
  opt = opt || {};
  let list = ALL.slice();
  if (opt.mode === 'ch') list = list.filter(q => q.ch === opt.ch);
  else if (opt.mode === 'new') list = list.filter(q => !S.rec[q.id] || S.rec[q.id].s === 0);
  else if (opt.mode === 'due') {
    const due = list.filter(q => { const r = S.rec[q.id]; return r && r.s > 0 && (r.due || 0) <= Date.now(); });
    const fresh = list.filter(q => !S.rec[q.id] || S.rec[q.id].s === 0);
    list = due.concat(shuffle(fresh)).concat(shuffle(list.filter(q => !due.includes(q) && !fresh.includes(q))));
  }
  if (!list.length) { main().innerHTML = `<div class="page"><div class="empty"><div class="big">✓</div>这一类题已经清空了</div></div>`; return; }
  Q = { list: shuffle(list), i: 0, picked: {}, mode: opt.mode, ch: opt.ch || '' };
  paintQ();
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; }

function paintQ() {
  const { list, i } = Q, q = list[i], picked = Q.picked[i];
  const answered = picked !== undefined;
  const label = q.ch;
  main().innerHTML = `<div class="page">
    <div class="qhead">
      <span>${i + 1} / ${list.length}</span>
      <div class="prog"><i style="width:${(i + 1) / list.length * 100}%"></i></div>
      <span>${esc(label)}</span>
    </div>
    <div class="stem">${esc(q.q)}</div>
    <div class="meta">难度 ${'●'.repeat(q.d)}${'○'.repeat(3 - q.d)}</div>
    <div class="opts">${q.o.map((t, k) => {
      let cls = 'opt';
      if (answered) {
        cls += ' locked';
        if (LETTERS[k] === q.a) cls += ' right';
        else if (LETTERS[k] === picked) cls += ' wrong';
      } else if (picked === LETTERS[k]) cls += ' pick';
      return `<div class="${cls}" onclick="pick('${LETTERS[k]}')"><span class="letter">${LETTERS[k]}</span><span>${esc(t)}</span></div>`;
    }).join('')}</div>
    <div class="kbdhint">1-4 或 A-D 选择 · Enter 下一题 · ← → 上下翻</div>
    ${answered ? `<div class="explain">
      <span class="res ${picked === q.a ? 'ok' : 'no'}">${picked === q.a ? '回答正确' : '回答错误'}</span>
      正确答案 <b>${q.a}</b>${picked === q.a ? '' : '，你选了 ' + picked}
      <div style="margin-top:8px">${esc(q.e)}</div>
    </div>` : ''}
    <div class="navbtns">
      <button class="btn ghost" onclick="prevQ()" ${i === 0 ? 'disabled' : ''}>← 上一题</button>
      <div class="spacer"></div>
      <button class="btn ghost" onclick="go('home')">退出</button>
      ${answered
      ? `<button class="btn primary" onclick="nextQ()">${i === list.length - 1 ? '完成' : '下一题 →'}</button>`
      : `<button class="btn primary" onclick="reveal()">不会，看解析</button>`}
    </div>
  </div>`;
}
function pick(letter) {
  const i = Q.i; if (Q.picked[i] !== undefined) return;
  Q.picked[i] = letter; answer(Q.list[i], letter);
  paintQ(); paintSide();
}
function reveal() { const i = Q.i; if (Q.picked[i] === undefined) { Q.picked[i] = ''; answer(Q.list[i], ''); paintQ(); paintSide(); } }
function nextQ() {
  if (Q.i < Q.list.length - 1) { Q.i++; paintQ(); main().scrollTop = 0; }
  else finishQuiz();
}
function finishQuiz() {
  const total = Q.list.length;
  const answered = Object.keys(Q.picked).length;
  let right = 0;
  Q.list.forEach((q, i) => { if (Q.picked[i] === q.a) right++; });
  const acc = answered ? Math.round(right / answered * 100) : 0;
  main().innerHTML = `<div class="page"><div class="panel" style="text-align:center;padding:48px 24px 40px">
    <div style="font-size:13px;color:var(--muted);margin-bottom:12px">本轮完成</div>
    <div style="font-size:52px;font-weight:750;letter-spacing:-2px;line-height:1.1">${acc}<span style="font-size:17px;color:var(--muted);font-weight:500">%</span></div>
    <div style="color:var(--muted);font-size:13.5px;margin:8px 0 26px">共 ${total} 题 · 答对 ${right} 题 · 未作答 ${total - answered} 题</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn" onclick="go('wrong')">看错题</button>
      <button class="btn" onclick="go('stats')">看统计</button>
      <button class="btn primary" onclick="go('home')">回到概览</button>
    </div></div></div>`;
  clearTimer(); paintSide();
  toast('本轮正确率 ' + acc + '%', acc >= 60 ? 'ok' : 'no');
}
function prevQ() { if (Q.i > 0) { Q.i--; paintQ(); main().scrollTop = 0; } }

/* ---------- wrong book ---------- */
function renderWrong() {
  const ids = Object.keys(S.rec).filter(id => S.rec[id].w > 0 && byId[id]);
  ids.sort((a, b) => S.rec[b].w - S.rec[a].w);
  main().innerHTML = `<div class="page wide">
    <h1>错题本</h1>
    <div class="sub">共 ${ids.length} 道 · 点击展开解析</div>
    ${ids.length ? ids.map(id => {
      const q = byId[id], r = S.rec[id];
      return `<div class="wq" id="w${id}">
        <div class="hd" onclick="this.parentNode.classList.toggle('open')">
          <div class="qt">${esc(q.q)}</div>
          <div class="badge">错 ${r.w} 次</div>
        </div>
        <div class="bd">
          <div class="ops">${q.o.map((t, k) => `<div class="${LETTERS[k] === q.a ? 'r' : ''}">${LETTERS[k]}. ${esc(t)}</div>`).join('')}</div>
          <div class="ans">正确答案 <b>${q.a}</b> · ${esc(q.ch)}</div>
          <div class="ex">${esc(q.e)}</div>
          <div style="margin-top:14px;display:flex;gap:8px">
            <button class="btn" onclick="event.stopPropagation();go('quiz',{mode:'ch',ch:'${esc(q.ch)}'})">练这一章</button>
            <button class="btn ghost" onclick="event.stopPropagation();master('${id}')">标记已掌握</button>
          </div>
        </div>
      </div>`;
    }).join('') : `<div class="empty"><div class="big">◎</div>还没有错题。去刷几道吧。</div>`}
  </div>`;
}
function master(id) { S.rec[id].w = 0; save(); renderWrong(); paintSide(); }

/* ---------- exam ---------- */
let EX = null;
function renderExam() {
  const pub = ALL.filter(q => q.ch === '公共基础知识');
  const rest = ALL.filter(q => q.ch !== '公共基础知识');
  const paper = shuffle(pub).slice(0, 10).concat(shuffle(rest).slice(0, 30));
  EX = { list: shuffle(paper), ans: {}, left: 30 * 60, done: false };
  main().innerHTML = `<div class="page wide">
    <div class="exam-top">
      <div class="clock" id="clock">30:00</div>
      <div class="info" id="exInfo">选择部分模拟 · ${EX.list.length} 题 · 每题 1 分 · 已答 0</div>
      <button class="btn" onclick="go('home')">放弃</button>
      <button class="btn primary" onclick="submitExam()">交卷</button>
    </div>
    <div id="paper">${EX.list.map((q, i) => `<div class="q-mini">
      <div class="no">第 ${i + 1} 题 · ${esc(q.ch)}</div>
      <div class="st">${esc(q.q)}</div>
      <div class="opts">${q.o.map((t, k) => `<div class="opt" data-i="${i}" data-l="${LETTERS[k]}" onclick="examPick(this)">
        <span class="letter">${LETTERS[k]}</span><span>${esc(t)}</span></div>`).join('')}</div>
    </div>`).join('')}</div>
    <div class="row-actions" style="margin-top:24px"><button class="btn primary" onclick="submitExam()">交卷</button></div>
    <div id="result"></div>
  </div>`;
  timer = setInterval(() => {
    EX.left--; const m = Math.floor(EX.left / 60), s = EX.left % 60;
    const el = $('#clock'); if (!el) return;
    el.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    if (EX.left <= 300) el.classList.add('warn');
    if (EX.left <= 0) submitExam();
  }, 1000);
}
function examPick(el) {
  if (EX.done) return;
  const i = el.dataset.i, l = el.dataset.l;
  EX.ans[i] = l;
  document.querySelectorAll(`.opt[data-i="${i}"]`).forEach(x => {
    x.classList.toggle('pick', x.dataset.l === l);
  });
  const inf = $('#exInfo');
  if (inf) inf.textContent = `选择部分模拟 · ${EX.list.length} 题 · 每题 1 分 · 已答 ${Object.keys(EX.ans).length}`;
}
function submitExam() {
  if (!EX || EX.done) return;
  EX.done = true; clearTimer();
  let score = 0; const wrongs = [];
  EX.list.forEach((q, i) => {
    const l = EX.ans[i] || '';
    const ok = l === q.a;
    if (ok) score++; else wrongs.push({ q, l });
    answer(q, l);
  });
  const pct = Math.round(score / EX.list.length * 100);
  document.querySelectorAll('.q-mini .opt').forEach(x => {
    const i = +x.dataset.i, q = EX.list[i];
    if (x.dataset.l === q.a) x.classList.add('right');
    else if (x.dataset.l === EX.ans[i]) x.classList.add('wrong');
    x.classList.add('locked');
  });
  const el = $('#result');
  if (el) el.innerHTML = `<div class="panel" style="margin-top:26px">
    <h3>本次成绩</h3>
    <div style="font-size:34px;font-weight:700;margin-bottom:4px">${score} <span style="font-size:15px;color:var(--muted)">/ ${EX.list.length} 分</span></div>
    <div style="color:var(--muted);font-size:13.5px;margin-bottom:16px">${pct >= 60 ? '及格线以上，按这个节奏走。' : '还差一点，重点看错题。'} 用时 ${Math.floor((30 * 60 - EX.left) / 60)} 分钟</div>
    ${wrongs.length ? `<div style="font-size:13.5px;color:#4a4f58">错题 ${wrongs.length} 道已自动进错题本</div>` : ''}
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn" onclick="go('wrong')">看错题</button>
      <button class="btn primary" onclick="go('exam')">再考一次</button>
    </div>
  </div>`;
  paintSide();
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ---------- stats ---------- */
function renderStats() {
  const st = stats();
  const last7 = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7.push({ k: dkey(d), n: S.days[dkey(d)] || 0, lbl: (d.getMonth() + 1) + '/' + d.getDate() }); }
  const max = Math.max(1, ...last7.map(x => x.n));
  main().innerHTML = `<div class="page wide">
    <h1>学习统计</h1>
    <div class="sub">连续 ${streak()} 天 · 累计作答 ${st.tries} 次</div>
    <div class="cards" style="grid-template-columns:repeat(3,1fr)">
      <div class="card"><div class="k">总正确率</div><div class="v">${st.acc}<small>%</small></div></div>
      <div class="card"><div class="k">错题存量</div><div class="v">${st.wrongCount}<small>道</small></div></div>
      <div class="card"><div class="k">待复习</div><div class="v">${st.due}<small>道</small></div></div>
    </div>
    <div class="stat-grid">
      <div class="panel"><h3>各章节正确率</h3>
        ${CHAPS.map(c => { const o = st.ch[c]; const pc = o.tries ? Math.round(o.right / o.tries * 100) : 0;
    return `<div class="hbar"><div class="l">${esc(c)}</div><div class="t"><i style="width:${pc}%"></i></div><div class="n">${o.tries ? pc + '%' : '—'}</div></div>`; }).join('')}
      </div>
      <div class="panel"><h3>近 7 天作答</h3>
        <div class="days">${last7.map(x => `<div class="day"><i class="${x.n ? 'has' : ''}" style="height:${Math.max(4, x.n / max * 100)}%"></i><span>${x.lbl}</span></div>`).join('')}</div>
        <div style="margin-top:18px;font-size:12.5px;color:var(--muted)">共 ${last7.reduce((a, b) => a + b.n, 0)} 次作答</div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><h3>编程题通过情况</h3>
      ${(window.CODING || []).map(p => {
    const r = (S.codeDone || {})[p.id];
    const pc = r ? Math.round(r.pass / r.total * 100) : 0;
    return `<div class="hbar"><div class="l">${esc(p.title)}</div><div class="t"><i style="width:${pc}%"></i></div><div class="n">${r ? r.pass + '/' + r.total : '未做'}</div></div>`;
  }).join('')}
    </div>
    <div class="panel" style="margin-top:16px"><h3>账号</h3>
      <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:12px">
        <span style="color:var(--muted)">当前账号</span><b>${esc(Auth.user || '未登录')}</b>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:16px">
        <span style="color:var(--muted)">同步方式</span>
        <b>${Auth.mode === 'supabase' ? '云端 · Supabase' : Auth.mode === 'server' ? '自建服务器' : '仅本机'}</b>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="toggleTheme()">切换深浅色</button>
        <button class="btn ghost" onclick="openCloudConfig()">云端配置</button>
        <button class="btn ghost" onclick="doLogout()">退出登录</button>
      </div>
    </div>
    <div style="margin-top:20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn" onclick="exportData()">导出进度</button>
      <button class="btn" onclick="importData()">导入进度</button>
      <button class="btn ghost" onclick="resetAll()">清空全部进度</button>
      <input type="file" id="impFile" accept=".json,application/json" style="display:none">
    </div>
    <div class="tip" style="margin-top:10px">导出的 JSON 可以拿到另一台设备导入——没有服务器时，这就是跨设备同步的办法。</div>
  </div>`;
}

function exportData() {
  const blob = new Blob([JSON.stringify({
    app: 'ncre2py', ver: 2, user: Auth.user,
    exported: new Date().toISOString(), data: S
  }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ncre2py-' + (Auth.user || 'guest') + '-' + today() + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function importData() {
  const inp = $('#impFile');
  if (!inp) return;
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        const d = j.data || j;
        if (!d.rec) throw new Error('这不是本应用导出的进度文件');
        let n = 0;
        Object.keys(d.rec).forEach(k => {
          const a = S.rec[k], b = d.rec[k];
          if (!a || (b.s || 0) > (a.s || 0)) { S.rec[k] = b; n++; }
        });
        Object.keys(d.days || {}).forEach(k => { S.days[k] = Math.max(S.days[k] || 0, d.days[k] || 0); });
        if (d.code) S.code = Object.assign(S.code || {}, d.code);
        if (d.codeDone) S.codeDone = Object.assign(S.codeDone || {}, d.codeDone);
        save(); renderStats(); paintSide();
        toast('已合并 ' + n + ' 条题目记录', 'ok');
      } catch (e) { toast('导入失败：' + e.message, 'no'); }
    };
    r.readAsText(f);
  };
  inp.click();
}async function resetAll() {
  const okd = await confirmDialog({
    title: '清空全部进度', danger: true, ok: '清空',
    text: '所有答题记录、错题本、代码草稿都会被删除，无法恢复。'
  });
  if (!okd) return;
  S = { rec: {}, days: {}, ver: 2 }; save(); go('home'); toast('已重置');
}

/* ---------- 编程题 ---------- */
let CIDX = 0;
let pyReady = null;

function ensurePy() {
  if (pyReady) return pyReady;
  if (window.__BRYTHON__ && __BRYTHON__.runPythonSource) { pyReady = Promise.resolve(); return pyReady; }
  const load = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load fail ' + src));
    document.head.appendChild(s);
  });
  pyReady = load('vendor/brython.min.js?v=11')
    .then(() => load('vendor/brython_stdlib.js?v=11'))
    .then(() => { runPy('print(0)', []); });
  return pyReady;
}

/* 把用户代码包进一个捕获输出与异常的外壳里执行 */
function runPy(user, inputs) {
  const body = String(user).replace(/\r/g, '').split('\n')
    .map(l => l.trim() === '' ? '' : '    ' + l).join('\n');
  const src = `import sys, traceback
class _W:
    def __init__(self): self.p = []
    def write(self, x): self.p.append(str(x))
    def flush(self): pass
_w = _W(); _old = sys.stdout; sys.stdout = _w
_inputs = ${JSON.stringify(inputs || [])}
_i = [0]
def input(p=''):
    if _i[0] < len(_inputs):
        v = _inputs[_i[0]]
        _i[0] += 1
        return v
    return ''
_err = ''
try:
${body}
except Exception:
    _err = traceback.format_exc(limit=2)
finally:
    sys.stdout = _old
OUT = ''.join(_w.p)
ERR = _err`;
  try {
    const m = __BRYTHON__.runPythonSource(src);
    return { out: String(m.OUT || ''), err: String(m.ERR || '') };
  } catch (e) {
    let cls = '', msg = '';
    try { cls = (e.__class__ && e.__class__.__name__) || ''; } catch (_) {}
    try { msg = String(e.args[0]); } catch (_) {}
    if (!msg) msg = (e && e.msg) || String(e);
    return { out: '', err: `语法错误（${cls || 'SyntaxError'}）：${msg}` };
  }
}

function renderCode() {
  const list = window.CODING || [];
  if (!list.length) { main().innerHTML = `<div class="page"><div class="empty">还没有编程题</div></div>`; return; }
  if (CIDX >= list.length) CIDX = 0;
  const p = list[CIDX];
  const saved = (S.code && S.code[p.id]) || p.starter || '';
  main().innerHTML = `<div class="page wide">
    <h1>编程题</h1>
    <div class="sub">浏览器内跑 Python，按测试点判分 · 共 ${list.length} 题 · 对应考纲 60 分上机部分</div>
    <div class="row-actions">${list.map((x, i) => `<button class="btn ${i === CIDX ? 'primary' : ''}" onclick="pickCode(${i})">${esc(x.no)} ${esc(x.title)}</button>`).join('')}</div>
    <div class="code-grid">
      <div class="code-panel">
        <h3>${esc(p.no)} · ${esc(p.title)}<span class="chip">${esc(p.type)} · ${p.score} 分</span></h3>
        <div class="desc">${esc(p.desc)}</div>
        ${p.sample ? `<div class="sample">${esc(p.sample)}</div>` : ''}
        <h3 style="margin-top:18px;font-size:13px;color:var(--muted)">测试用例</h3>
        <div class="tests">${p.tests.map((t, i) => `<div class="tcase" id="tc${i}">
          <span class="st">·</span><span class="nm">用例 ${i + 1}</span>
          <span class="dt">输入：${esc(t.in.join(' ⏎ '))}</span></div>`).join('')}</div>
        <div style="margin-top:16px"><button class="btn ghost" onclick="showSolution()">看参考解法</button></div>
      </div>
      <div>
        <textarea class="editor" id="ed" spellcheck="false"></textarea>
        <div class="runbar">
          <button class="btn primary" id="runbtn" onclick="runCode()">运行并判分</button>
          <button class="btn ghost" onclick="resetCode()">重置代码</button>
          <span class="hint">Ctrl + Enter 运行</span>
        </div>
        <div class="console" id="con"><span class="sys">代码只在你的设备上执行。首次运行需要加载 Python 运行时（约 5MB，2~3 秒）。</span></div>
      </div>
    </div>
  </div>`;
  const ed = $('#ed');
  ed.value = saved;
  ed.addEventListener('input', () => {
    S.code = S.code || {}; S.code[p.id] = ed.value; save();
  });
  ed.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const st = ed.selectionStart, en = ed.selectionEnd;
      ed.value = ed.value.slice(0, st) + '    ' + ed.value.slice(en);
      ed.selectionStart = ed.selectionEnd = st + 4;
    }
  });
}

function pickCode(i) { CIDX = i; renderCode(); main().scrollTop = 0; }

async function resetCode() {
  const p = window.CODING[CIDX];
  const okd = await confirmDialog({ title: '重置代码', text: '回到初始的填空版本，你写的内容会丢失。', ok: '重置', danger: true });
  if (!okd) return;
  $('#ed').value = p.starter;
  S.code = S.code || {}; S.code[p.id] = p.starter; save();
}

async function showSolution() {
  const p = window.CODING[CIDX];
  const okd = await confirmDialog({ title: '查看参考解法', text: '直接看答案会少一次练习机会，建议先自己跑一遍测试。', ok: '仍然查看' });
  if (!okd) return;
  $('#ed').value = p.solution;
  S.code = S.code || {}; S.code[p.id] = p.solution; save();
}

const normOut = s => String(s).split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();

async function runCode() {
  const p = window.CODING[CIDX];
  const code = $('#ed').value;
  const btn = $('#runbtn'), con = $('#con');
  btn.disabled = true; btn.textContent = '运行中…';
  con.innerHTML = '<span class="sys">正在加载 Python 运行时…</span>';
  try { await ensurePy(); }
  catch (e) {
    con.innerHTML = '<span class="no">运行时加载失败，请检查 vendor/ 目录是否完整。</span>';
    btn.disabled = false; btn.textContent = '运行并判分'; return;
  }
  con.innerHTML = '<span class="sys">执行中…</span>';
  await new Promise(r => setTimeout(r, 30));
  const t0 = Date.now();
  const res = p.tests.map((t, i) => {
    const r = runPy(code, t.in);
    const got = normOut(r.out), exp = normOut(t.out);
    return { ok: !r.err && got === exp, got: r.out, exp: t.out, err: r.err };
  });
  const ms = Date.now() - t0;
  const pass = res.filter(r => r.ok).length;
  const allOk = pass === res.length;

  res.forEach((r, i) => {
    const el = $('#tc' + i); if (!el) return;
    el.classList.toggle('p', r.ok); el.classList.toggle('f', !r.ok);
    el.querySelector('.st').textContent = r.ok ? '✓' : '✗';
  });

  let html = `<span class="${allOk ? 'ok' : 'no'}">${allOk ? '全部通过 ✓' : '通过 ' + pass + ' / ' + res.length}</span>`
    + ` <span class="sys">（${ms} ms）</span>\n\n`;
  if (!allOk) {
    const first = res.find(r => !r.ok);
    if (first.err) {
      html += `<span class="no">运行出错：</span>\n${esc(first.err.split('\n').slice(-4).join('\n'))}`;
    } else {
      html += `<span class="sys">期望输出：</span>\n${esc(first.exp.trim()) || '(空)'}\n\n`
        + `<span class="sys">实际输出：</span>\n${esc(first.got.trim()) || '(空)'}`;
    }
  } else {
    html += `<span class="sys">标准输出：</span>\n${esc(res[0].got.trim()) || '(空)'}`;
  }
  con.innerHTML = html;

  S.codeDone = S.codeDone || {};
  S.codeDone[p.id] = { pass, total: res.length, ts: Date.now() };
  S.code = S.code || {}; S.code[p.id] = code;
  save();
  if (allOk) { tickDay(); save(); }

  btn.disabled = false; btn.textContent = '运行并判分';
}

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const k = e.key.toLowerCase();
  if (view === 'quiz' && Q) {
    if (['1', '2', '3', '4'].includes(k)) { pick(LETTERS[+k - 1]); e.preventDefault(); }
    else if (['a', 'b', 'c', 'd'].includes(k)) { pick(k.toUpperCase()); e.preventDefault(); }
    else if (k === 'enter' || k === ' ') { if (Q.picked[Q.i] !== undefined) nextQ(); else reveal(); e.preventDefault(); }
    else if (k === 'arrowleft') { prevQ(); e.preventDefault(); }
    else if (k === 'arrowright') { if (Q.picked[Q.i] !== undefined) nextQ(); e.preventDefault(); }
  }
});

/* ---------- 云端配置面板 ---------- */
function openCloudConfig() {
  const cur = window.SUPA_CONFIG || {};
  const m = document.getElementById('modal');
  m.querySelector('.modal-box').innerHTML =
    '<h4>云端同步设置</h4>' +
    '<p>把 Supabase 项目的 URL 和 anon key 粘进来。只在你的浏览器里保存，不会上传到任何地方。</p>' +
    '<label class="cfg-label">Project URL</label>' +
    '<input class="cfg-in" id="cfgUrl" placeholder="https://xxxx.supabase.co" value="' + esc(cur.url || '') + '">' +
    '<label class="cfg-label">anon public key</label>' +
    '<input class="cfg-in" id="cfgKey" placeholder="eyJhbGciOiJIUzI1NiIs..." value="' + esc(cur.anonKey || '') + '">' +
    '<div class="gerr" id="cfgErr"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn ghost" id="cfgClear">清除配置</button>' +
      '<button class="btn primary" id="cfgSave">保存</button>' +
    '</div>';
  m.classList.add('on');
  const close = () => { m.classList.remove('on'); };
  m.onclick = e => { if (e.target === m) close(); };
  m.querySelector('#cfgSave').onclick = () => {
    const url = (m.querySelector('#cfgUrl').value || '').trim().replace(/\/+$/, '');
    const key = (m.querySelector('#cfgKey').value || '').trim();
    const err = m.querySelector('#cfgErr');
    if (!/^https?:\/\/[\w.-]+/.test(url)) { err.textContent = 'URL 要以 https:// 开头'; return; }
    if (key.length < 40) { err.textContent = 'anon key 看起来不完整'; return; }
    localStorage.setItem('pf_supa', JSON.stringify({ url, anonKey: key }));
    localStorage.removeItem('ncre2py_sb_session');
    location.reload();
  };
  m.querySelector('#cfgClear').onclick = () => {
    localStorage.removeItem('pf_supa');
    localStorage.removeItem('ncre2py_sb_session');
    location.reload();
  };
}

/* ---------- 主题 ---------- */
const THEME_KEY = 'pf_theme';
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(THEME_KEY, t);
  const l = $('#themeLabel'); if (l) l.textContent = t === 'dark' ? '深色' : '浅色';
}
(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
})();
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
$('#themeBtn').addEventListener('click', toggleTheme);

/* ---------- nav ---------- */
document.querySelectorAll('#nav a, #tabbar a').forEach(a => a.addEventListener('click', () => {
  const v = a.dataset.view;
  // 同一入口重复点击：刷题/模考不重开一轮，避免手滑丢掉当前进度
  if (v === view && (v === 'quiz' ? !!Q : v === 'exam' ? !!(EX && !EX.done) : true)) return;
  go(v);
}));
$('#logout').addEventListener('click', doLogout);
async function doLogout() {
  const okd = await confirmDialog({ title: '退出登录', text: '进度已经保存在账号里，下次登录接着来。', ok: '退出' });
  if (!okd) return;
  await Auth.logout(); location.reload();
}

/* ---------- boot ---------- */
(async function boot() {
  try {
    const sess = await Auth.init();
    if (!sess.user) { Auth.renderGate(() => location.reload()); return; }
    const d = sess.data || {};
    S = { rec: d.rec || {}, days: d.days || {}, code: d.code || {}, codeDone: d.codeDone || {}, ver: 2 };
    $('#uname').textContent = sess.user;
    $('#avatar').textContent = [...sess.user][0].toUpperCase();
    paintSide(); go('home');
  } catch (err) {
    document.body.innerHTML = '<pre style="padding:30px;font-size:13px;color:#dc2626">启动失败：' +
      (err && err.message) + '\n' + (err && err.stack) + '</pre>';
  }
})();
