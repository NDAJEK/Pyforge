/* ============================================================
   云端同步配置（Supabase）
   1. 去 https://supabase.com 建一个免费项目
   2. 项目 → Project Settings → API，复制 Project URL 和 anon public key
   3. 填到下面两个引号里，保存
   anon key 是设计上就公开的密钥，提交到 GitHub 安全；真正的权限由数据库的
   行级安全策略（RLS）控制，见 README。
   留空则使用本地模式（账号存在浏览器里）。
   ============================================================ */
window.SUPA_CONFIG = {
  url: 'https://xqnboewtaufjzgxiokry.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbmJvZXd0YXVmanpneGlva3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1Nzk4MTEsImV4cCI6MjEwODE1NTgxMX0.DxcTNbHZ-tEjTTrassb4niUbAa5_o5BGTFzpunBhs3U'
};
