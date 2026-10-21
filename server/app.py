#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
二级 Python 刷题台 —— 可选的服务端身份验证

零依赖，只用标准库：
    python3 server/app.py --port 8080
然后浏览器打开 http://127.0.0.1:8080

前端会自动探测 /api/health：
    探测成功 -> 服务端模式（真实账号、PBKDF2 210k 轮、HMAC 签名令牌、进度多端同步）
    探测失败 -> 本地模式（账号存本机 localStorage）

安全说明：
  - 密码只存 PBKDF2-HMAC-SHA256 加盐哈希，不存明文
  - 令牌为 HMAC-SHA256 签名，7 天过期；密钥首次运行随机生成并写入 data/secret.key
  - 登录失败 5 次锁定 60 秒（按用户名 + IP）
  - 生产部署请放在 HTTPS 反向代理之后
"""
import argparse, base64, hashlib, hmac, json, os, re, sqlite3, secrets, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, 'server', 'data')
DB_PATH = os.path.join(DATA_DIR, 'app.db')
SECRET_PATH = os.path.join(DATA_DIR, 'secret.key')

ITER = 210000
TOKEN_TTL = 7 * 24 * 3600
MAX_FAIL, LOCK_SEC = 5, 60

os.makedirs(DATA_DIR, exist_ok=True)


def load_secret():
    if os.path.exists(SECRET_PATH):
        return open(SECRET_PATH, 'rb').read()
    s = secrets.token_bytes(32)
    with open(SECRET_PATH, 'wb') as f:
        f.write(s)
    os.chmod(SECRET_PATH, 0o600)
    return s


SECRET = load_secret()


def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        salt TEXT NOT NULL,
        hash TEXT NOT NULL,
        created REAL NOT NULL)""")
    c.execute("""CREATE TABLE IF NOT EXISTS progress(
        user_id INTEGER PRIMARY KEY,
        payload TEXT NOT NULL,
        updated REAL NOT NULL)""")
    return c


def hash_pw(pw, salt_hex):
    return hashlib.pbkdf2_hmac('sha256', pw.encode(), bytes.fromhex(salt_hex), ITER).hex()


def b64u(b):
    return base64.urlsafe_b64encode(b).decode().rstrip('=')


def unb64u(s):
    return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))


def make_token(username):
    body = json.dumps({'u': username, 'exp': int(time.time()) + TOKEN_TTL}, ensure_ascii=False).encode()
    sig = hmac.new(SECRET, body, hashlib.sha256).digest()
    return b64u(body) + '.' + b64u(sig)


def verify_token(tok):
    try:
        a, b = tok.split('.')
        body = unb64u(a)
        if not hmac.compare_digest(hmac.new(SECRET, body, hashlib.sha256).digest(), unb64u(b)):
            return None
        d = json.loads(body)
        if d['exp'] < time.time():
            return None
        return d['u']
    except Exception:
        return None


FAILS = {}   # key -> (count, ts)


def locked(key):
    n, t = FAILS.get(key, (0, 0))
    return n >= MAX_FAIL and time.time() - t < LOCK_SEC


def note_fail(key):
    n, t = FAILS.get(key, (0, 0))
    if time.time() - t > LOCK_SEC:
        n = 0
    FAILS[key] = (n + 1, time.time())


USER_RE = re.compile(r'^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$')


class Handler(SimpleHTTPRequestHandler):
    server_version = 'ExamPy/2.0'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=BASE, **kw)

    # ---------- 工具 ----------
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > 2_000_000:
            return {}
        try:
            return json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return {}

    def send_json(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def user_from_token(self):
        h = self.headers.get('Authorization', '')
        if not h.startswith('Bearer '):
            return None
        return verify_token(h[7:])

    def client_key(self, u):
        return (u or '') + '|' + (self.client_address[0] if self.client_address else '')

    # ---------- 路由 ----------
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/health':
            return self.send_json({'ok': True, 'mode': 'server', 'time': int(time.time())})
        if path == '/api/me':
            u = self.user_from_token()
            if not u:
                return self.send_json({'msg': '未登录'}, 401)
            return self.send_json({'ok': True, 'user': u})
        if path == '/api/progress':
            u = self.user_from_token()
            if not u:
                return self.send_json({'msg': '未登录'}, 401)
            c = db()
            row = c.execute("SELECT p.payload FROM progress p JOIN users u ON u.id=p.user_id WHERE u.username=?",
                            (u,)).fetchone()
            c.close()
            if not row:
                return self.send_json({})
            try:
                return self.send_json(json.loads(row['payload']))
            except Exception:
                return self.send_json({})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/register':
            return self.register()
        if path == '/api/login':
            return self.login()
        if path == '/api/logout':
            return self.send_json({'ok': True})
        return self.send_json({'msg': 'not found'}, 404)

    def do_PUT(self):
        path = urlparse(self.path).path
        if path != '/api/progress':
            return self.send_json({'msg': 'not found'}, 404)
        u = self.user_from_token()
        if not u:
            return self.send_json({'msg': '未登录'}, 401)
        data = self.body()
        raw = json.dumps(data, ensure_ascii=False)
        if len(raw) > 1_500_000:
            return self.send_json({'msg': '数据过大'}, 413)
        c = db()
        uid = c.execute("SELECT id FROM users WHERE username=?", (u,)).fetchone()['id']
        c.execute("INSERT INTO progress(user_id,payload,updated) VALUES(?,?,?) "
                  "ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload, updated=excluded.updated",
                  (uid, raw, time.time()))
        c.commit()
        c.close()
        return self.send_json({'ok': True})

    # ---------- 账号 ----------
    def register(self):
        d = self.body()
        u = str(d.get('username', '')).strip()
        p = str(d.get('password', ''))
        if not USER_RE.match(u):
            return self.send_json({'msg': '用户名需为 3-20 位字母、数字、下划线或中文'}, 400)
        if len(p) < 6 or len(p) > 64:
            return self.send_json({'msg': '密码长度需为 6-64 位'}, 400)
        salt = secrets.token_hex(16)
        h = hash_pw(p, salt)
        c = db()
        try:
            c.execute("INSERT INTO users(username,salt,hash,created) VALUES(?,?,?,?)",
                      (u, salt, h, time.time()))
            c.commit()
        except sqlite3.IntegrityError:
            c.close()
            return self.send_json({'msg': '这个用户名已经被占用了'}, 409)
        c.close()
        return self.send_json({'ok': True, 'user': u, 'token': make_token(u)})

    def login(self):
        d = self.body()
        u = str(d.get('username', '')).strip()
        p = str(d.get('password', ''))
        key = self.client_key(u)
        if locked(key):
            return self.send_json({'msg': '尝试次数过多，请 60 秒后再试'}, 429)
        c = db()
        row = c.execute("SELECT salt,hash FROM users WHERE username=?", (u,)).fetchone()
        c.close()
        if not row or not hmac.compare_digest(hash_pw(p, row['salt']), row['hash']):
            note_fail(key)
            return self.send_json({'msg': '用户名或密码错误'}, 401)
        FAILS.pop(key, None)
        return self.send_json({'ok': True, 'user': u, 'token': make_token(u)})

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            return


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--host', default='127.0.0.1')
    a = ap.parse_args()
    print(f'刷题台已启动： http://{a.host}:{a.port}   (Ctrl+C 停止)')
    ThreadingHTTPServer((a.host, a.port), Handler).serve_forever()
