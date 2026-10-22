# PyForge · Python 训练台

线上地址：**https://ndajek.github.io/Pyforge/**

**PyForge** 是面向计算机二级 Python 的刷题与上机训练台：分级题库、遗忘曲线复习、浏览器内代码判题、模拟考试。
纯静态页面，可挂 GitHub Pages；账号支持本地 / 自建服务端 / Supabase 三种后端。

## 功能

| 模块 | 说明 |
|---|---|
| 刷题 | **双科目**：Python 265 题 / Office 99 题，按 2025 版考纲分章；键盘 1-4 或 A-D 选答 |
| 复习算法 | 答对间隔按 1 → 2.5 → 6 → 15 → 30 天递推，答错次日重来；到期的题进「待复习」 |
| 错题本 | 按错误次数排序，展开看解析，可标记已掌握 |
| 模考 | 10 道公共基础 + 30 道 Python，30 分钟倒计时，交卷判分 |
| 编程题 | 8 道（Python 60 分上机题型），浏览器内运行 Python，按测试点判分 |
| Office 实训 | Word / Excel / PPT 各 1 道，下载素材→真机操作→上传，浏览器内判 30/30/20 分 |
| 统计 | 章节正确率、近 7 天作答、编程题通过情况 |
| 考纲对照 | 2025 版大纲八章 + 公共基础，逐章显示题量与掌握度，点击直达练习 |
| 账号 | 注册 / 登录 / 退出，进度按账号隔离 |
| 手机端 | 底部标签栏、单列布局、适配刘海屏安全区 |

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
│   ├── coding.js     # 编程题题库（含测试用例与参考解法）
│   └── office-questions.js  # Office 选择题（计算机基础/Word/Excel/PPT）
├── office/task-0N/    # Office 实训素材与参考答案
├── tools/             # 生成素材的脚本（docx/xlsx/pptx）
├── vendor/           # Brython 运行时 + JSZip（本地化，离线可用）
└── server/app.py     # 可选：Python 标准库实现的账号服务
```

## 打开方式

**方式一：直接打开（本地模式）**

浏览器打开 `index.html` 即可。注册的账号和进度都保存在本机 localStorage，离线可用，换设备不带数据。

注意：如果 `assets/config.js` 里填了 Supabase 配置，直接打开会走云端账号（要邮箱登录，离线打不开）。
想用纯本地模式，把 `config.js` 里的 `url` / `anonKey` 清空，或在「统计 → 云端配置」里点清除。

**方式二：服务端模式（账号 + 多端同步）**

```bash
python3 server/app.py --port 8080
# 浏览器访问 http://127.0.0.1:8080
```

前端启动时先探测 `/api/health`：探测到就切到服务端模式（账号存 SQLite、进度同步到服务器），
优先级高于 `config.js` 里的云端配置；探测不到才回落 Supabase 或本地模式。
也就是说，本机起了服务端，就一定连本机的服务端。

## 部署到 GitHub Pages

```bash
git init && git add . && git commit -m "init"
git remote add origin git@github.com:<你>/<仓库>.git
git push -u origin main
# 仓库 Settings → Pages → Source 选 main 分支根目录
```

访问 `https://<你>.github.io/<仓库>/`。Pages 只能提供静态文件，前端探测不到 `/api/health`：
`config.js` 填了 Supabase 就走云端账号，没填则回退到**本地模式**——账号和进度存在每个浏览器自己的
localStorage 里，能正常用，但换设备不带数据。

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
- 静态资源只对外提供 `index.html`、`assets/`、`data/`、`vendor/`：`server/`、`setup/`、`.git/` 和点文件一律 404，
  数据库与签名密钥不会被下载；目录列表已关闭
- 登录失败 5 次锁定 60 秒
- **本地模式不是加密存储**：数据在 localStorage 里，能开开发者工具的人就能看到。它是「多人共用一台电脑时区分进度」的锁，不是防攻击的保险柜。真要防，就用服务端模式。

## 考纲

`docs/` 下存放中国教育考试网发布的官方大纲（2025 年版）原文整理：

- `大纲-二级Python.md`
- `大纲-二级Office.md`
- `大纲-公共基础.md`

App 内的「考纲对照」页把每道题归到对应章节，并显示该章题量与正确率。

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
- 题库按 2025 版考纲章节自编：公共基础 35、语法元素 32、基本数据类型 28、程序控制结构 32、
  函数与代码复用 25、组合数据类型 30、文件与数据格式 19、程序设计方法 20、计算生态 31、
  面向对象 13（大纲未列，属拓展）
- 答案字母已均匀分布（A/B/C/D 各约 25%），不要靠选项位置蒙。
- 题库仍以打基础为主，真题风格和难度还需要持续校准。
