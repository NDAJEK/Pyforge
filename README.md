# PyForge · Python 训练台

线上地址：**https://ndajek.github.io/Pyforge/**

**PyForge** 是面向计算机二级 Python 的刷题与上机训练台：分级题库、遗忘曲线复习、浏览器内代码判题、模拟考试。
纯静态页面，可挂 GitHub Pages；账号支持本地 / 自建服务端 / Supabase 三种后端。

## 功能

| 模块 | 说明 |
|---|---|
| 刷题 | 204 道选择题，8 个章节；键盘 1-4 或 A-D 选答，Enter 下一题 |
| 复习算法 | 答对间隔按 1 → 2.5 → 6 → 15 天递推，答错次日重来 |
| 错题本 | 按错误次数排序，展开看解析，可标记已掌握 |
| 模考 | 10 道公共基础 + 30 道 Python，30 分钟倒计时，交卷判分 |
| 编程题 | 8 道（对应 60 分上机题型），浏览器内运行 Python，按测试点判分 |
| 统计 | 章节正确率、近 7 天作答、编程题通过情况 |
| 账号 | 注册 / 登录 / 退出，进度按账号隔离 |

## 目录

```
exam2-python/
├── index.html
├── assets/
│   ├── style.css
│   ├── app.js        # 路由、刷题、错题本、模考、统计、判题
│   ├── auth.js       # 身份验证（本地 / 服务端 / Supabase 三种后端）
│   ├── supabase.js   # Supabase REST 适配层（不依赖 SDK）
│   └── config.js     # 云端配置（留空 = 本地模式）
├── data/
│   ├── questions.js  # 选择题题库
│   └── coding.js     # 编程题题库（含测试用例与参考解法）
├── vendor/           # Brython 运行时（本地化，离线可用）
└── server/app.py     # 可选：Python 标准库实现的账号服务
```

## 打开方式

**方式一：直接打开（本地模式）**

浏览器打开 `index.html` 即可。注册的账号和进度都保存在本机 localStorage，离线可用，换设备不带数据。

**方式二：服务端模式（账号 + 多端同步）**

```bash
python3 server/app.py --port 8080
# 浏览器访问 http://127.0.0.1:8080
```

前端启动时探测 `/api/health`，探测到服务端就自动切到服务端模式，账号存 SQLite、进度同步到服务器；探测不到就回退到本地模式。

## 部署到 GitHub Pages

```bash
git init && git add . && git commit -m "init"
git remote add origin git@github.com:<你>/<仓库>.git
git push -u origin main
# 仓库 Settings → Pages → Source 选 main 分支根目录
```

访问 `https://<你>.github.io/<仓库>/`。Pages 只能提供静态文件，前端探测不到 `/api/health` 会自动回退到**本地模式**——账号和进度存在每个浏览器自己的 localStorage 里，能正常用，但换设备不带数据。

国内访问 Pages 偶尔不稳，可以换 Cloudflare Pages / Vercel，同样是静态托管。

## 云端同步（Supabase）

默认是本地模式。想要「换设备打开就是同一份进度」，按下面四步接 Supabase（免费额度足够个人用）。

### 1. 建项目

[supabase.com](https://supabase.com) 注册 → New project，选个离你近的区域，等两分钟初始化。

### 2. 建表 + 行级安全

SQL Editor 里执行：

```sql
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "read own"   on public.progress for select using (auth.uid() = user_id);
create policy "insert own" on public.progress for insert with check (auth.uid() = user_id);
create policy "update own" on public.progress for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS 是关键：没有它，拿着公开的 anon key 的人能读所有人的数据。

### 3. 关掉邮箱确认（可选）

Authentication → Providers → Email → 关掉 **Confirm email**。
开着的话，注册后要先去邮箱点链接才能登录。

### 4. 填配置

Project Settings → API，复制 `Project URL` 和 `anon public` key，填进 `assets/config.js`：

```js
window.SUPA_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'
};
```

anon key 是设计上就公开的，可以放心提交到 GitHub；真正的权限由上面的 RLS 控制。**绝对不要**把 service_role key 放进前端。

同步是自动的：登录时拉取云端进度，每次答题后 800ms 防抖上传。

### 注意

- Supabase 免费项目**连续 7 天无请求会被暂停**，去后台点一下恢复即可。
- 同步策略是「后写覆盖」，两台设备同时离线刷题再联网，会丢掉一边的记录。
- 想换成自己的后端，把 `assets/config.js` 清空、用 `server/app.py` 即可，前端会自动回退。

## 账号与安全

- 密码用 **PBKDF2-HMAC-SHA256** 加盐哈希，不保存明文。
  - HTTPS / localhost（有 Web Crypto）：**210,000 轮原生实现**，约 50~70ms
  - minis:// 等非安全上下文：回退到 12,000 轮纯 JS 实现
  - 服务端模式：210,000 轮（`hashlib.pbkdf2_hmac`）
- 服务端令牌为 HMAC-SHA256 签名，7 天过期；密钥首次运行生成在 `server/data/secret.key`
- 登录失败 5 次锁定 60 秒
- **本地模式不是加密存储**：数据在 localStorage 里，能开开发者工具的人就能看到。它是「多人共用一台电脑时区分进度」的锁，不是防攻击的保险柜。真要防，就用服务端模式。

## 加题

选择题：往 `data/questions.js` 追加对象即可，格式：

```js
{id:"唯一ID", ch:"章节名", d:难度1-3, q:"题干", o:["A选项","B选项","C选项","D选项"], a:"B", e:"解析"}
```

编程题：往 `data/coding.js` 追加，`tests[].in` 是每次 `input()` 的返回值（多行输入要拆成多个元素），`out` 是期望的标准输出：

```js
{id:"c09", no:"题 9", type:"简单应用题", score:12, title:"标题",
 desc:"题目描述", sample:"输入/输出示例",
 starter:"初始代码（含待填空）", solution:"参考解法",
 tests:[{in:["第一行","第二行"], out:"期望输出"}]}
```

## 已知限制

- 编程题在浏览器里用 Brython 执行，覆盖标准库的常用部分；**文件读写、turtle 绘图跑不了**，这类题只能在电脑上练。
- 代码在主线程同步执行，写出死循环会卡住页面（还没做超时中断）。
- Brython 走的是 Python 3 语义，个别 CPython 扩展行为可能有差异。
- 题库按考纲章节自编，用于打基础；真题风格和难度还需要持续校准。
