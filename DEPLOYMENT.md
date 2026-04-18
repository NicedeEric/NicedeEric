# 王者测试 · 部署指南

本项目由**两部分**组成，需要**分别部署**：

| 组件 | 位置 | 技术栈 | 托管 | 费用 |
|------|------|--------|------|------|
| 前端（静态页） | `/index.html`、`/assets/`、`/admin/`、`/data/` | HTML + 原生 JS | GitHub Pages | 免费 |
| 后端（API + 数据库） | `/worker/` | Cloudflare Workers + D1 (SQLite) | Cloudflare | 免费额度够用 |

下面是**从零开始**的完整步骤。

---

## 0. 前置要求

- 一个 GitHub 账户（你已经有了 `NicedeEric`）
- 一个 Cloudflare 账户（免费注册：<https://dash.cloudflare.com/sign-up>）
- 本地装好 `git`、`node`（>= 18）、`npm`

---

## 1. 把项目推到 GitHub

```bash
# 在你本地的某个目录
cd <这个项目的本地拷贝>

git init
git branch -M main
git remote add origin https://github.com/NicedeEric/NicedeEric.git

# 如果这是空仓库，直接推
git add .
git commit -m "feat: initial 王者测试"
git push -u origin main

# 如果仓库已有 README.md，先 pull：
# git pull origin main --rebase
# git push -u origin main
```

> ⚠️ `NicedeEric/NicedeEric` 是 **GitHub 的 Profile 仓库**（用户名和仓库名相同）。
> 它根目录的 `README.md` 会显示在你的 GitHub 主页上，但 GitHub Pages 仍然可以开启。

---

## 2. 部署前端 → GitHub Pages

### 2.1 启用 Pages

1. 浏览器打开 <https://github.com/NicedeEric/NicedeEric/settings/pages>
2. 找到 **Source**，选择 `GitHub Actions`（**不要** 选 "Deploy from a branch"）
3. 保存

### 2.2 触发部署

推代码后，GitHub Actions 会自动跑 `.github/workflows/deploy-pages.yml`，大约 1 分钟。

部署完成后的访问地址：

- 首页：<https://nicedeeric.github.io/>
- 管理看板：<https://nicedeeric.github.io/admin/>

> 如果 Pages 构建失败，去 **Actions** 面板看日志；常见原因是没选 "GitHub Actions" 作为 source。

---

## 3. 部署后端 → Cloudflare Workers + D1

这部分建议**第一次手动操作**（比 CI 直观），之后想改代码直接推 `git` 就会由 GitHub Actions 自动发布。

### 3.1 安装 Wrangler

```bash
cd worker
npm install
```

### 3.2 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会跳出授权页面，点同意即可。

### 3.3 创建 D1 数据库

```bash
npx wrangler d1 create wzry-db
```

输出类似：

```
✅ Successfully created DB 'wzry-db'
[[d1_databases]]
binding = "DB"
database_name = "wzry-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**复制 `database_id`**，粘贴到 `worker/wrangler.toml` 里：

```toml
[[d1_databases]]
binding = "DB"
database_name = "wzry-db"
database_id = "<粘贴这里>"
```

### 3.4 初始化表结构

```bash
npm run db:init
# 等价于: npx wrangler d1 execute wzry-db --remote --file=./schema.sql
```

### 3.5 设置密钥（Secrets）

```bash
# 管理员密码
npx wrangler secret put ADMIN_PASSWORD
# 粘贴你的密码后回车

# JWT 签名密钥（随便一串 32+ 字符的随机字符串）
npx wrangler secret put JWT_SECRET
# 粘贴，例如：openssl rand -hex 32 生成的那种
```

> 用户名默认 `admin`，存在 `wrangler.toml` 的 `[vars]` 里，想改就改。

### 3.6 改 CORS 白名单（重要）

编辑 `worker/wrangler.toml`：

```toml
[vars]
CORS_ORIGINS = "https://nicedeeric.github.io,http://localhost:8080"
```

这决定了**哪些前端域名**能访问 API。如果以后绑了自定义域名，也要加进去。

### 3.7 发布 Worker

```bash
npm run deploy
# 等价于: npx wrangler deploy
```

输出里会告诉你 Worker 的访问地址：

```
Published wzry-api (1.23 sec)
  https://wzry-api.<你的子域>.workers.dev
```

**复制这个 URL**，下一步要用。

### 3.8 验证后端工作

```bash
curl https://wzry-api.<你的子域>.workers.dev/
# 预期：{"ok":true,"service":"wzry-api","time":...}
```

---

## 4. 把前端连到后端

编辑 `index.html`（或 `admin/index.html`）所在目录的 `assets/js/api.js`，
**或者更简单**：在加载 `api.js` **之前**注入一个全局变量：

### 方式 A：直接改 `api.js`

```js
const API_BASE = (window.__API_BASE__ || "https://wzry-api.<你的子域>.workers.dev").replace(/\/$/, "");
```

### 方式 B（推荐）：在 `index.html` 和 `admin/index.html` 里加一行

在 `<script src="./assets/js/api.js"></script>` **前面**加：

```html
<script>window.__API_BASE__ = "https://wzry-api.<你的子域>.workers.dev";</script>
```

提交并推送：

```bash
git add -A
git commit -m "chore: wire frontend to worker"
git push
```

---

## 5. 自动部署（CI）

已经写好两个 workflow：

- `.github/workflows/deploy-pages.yml` — 改前端文件自动部署到 Pages（不用配任何 secret）
- `.github/workflows/deploy-worker.yml` — 改 `worker/` 目录自动部署到 Cloudflare

Worker 的 CI 需要两个 GitHub Secret：

1. 打开 <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** → 用模板 **Edit Cloudflare Workers**（会自动包含 Workers + D1 权限）
2. 在 <https://github.com/NicedeEric/NicedeEric/settings/secrets/actions> 添加：
   - `CLOUDFLARE_API_TOKEN` = 刚才那段 token
   - `CLOUDFLARE_ACCOUNT_ID` = 在 Cloudflare 控制台右侧能看到的 32 位 hex

之后改完 `worker/` 下的任意文件推到 `main`，自动发布。

---

## 6. 管理员看板使用

1. 打开 <https://nicedeeric.github.io/admin/>
2. 用 `admin` + 你在 3.5 步设置的密码登录
3. 看板会显示：
   - 累计访问 / 独立访客 / 完成测试数 / 今日访问
   - 最近 30 天访问折线图
   - 英雄分布 TOP 15
   - 最近 50 条测试记录

Token 有效期 6 小时，自动存 `localStorage`，过期后会自动跳回登录页。

---

## 7. 数据保留 1 个月 —— 怎么做到的？

1. 所有查询都从 `visits` / `results` 两张表读取。
2. Worker 配置了 Cron：`0 3 * * *`（每天 UTC 03:00 自动运行）。
3. 这个定时任务会执行：
   ```sql
   DELETE FROM visits  WHERE visited_at < now - 30d;
   DELETE FROM results WHERE created_at < now - 30d;
   ```
4. 所以任何数据 **最长只保留 30 天**，之后自动清理，不占存储。

> 想手动触发一次清理测试一下：在 Cloudflare 控制台 Workers → 你的 Worker → Triggers → Cron Triggers → "Trigger manually"。

---

## 8. 常见问题

**Q: 首页能访问但 "累计测试数" 是 — 号？**
A: 前端没连后端。走一遍第 4 步。F12 看 Network 有没有 404/CORS 错误。

**Q: 登录 admin 一直 "invalid username or password"**
A: 用户名默认是 `admin`（在 wrangler.toml 里）。密码是 `wrangler secret put ADMIN_PASSWORD` 设置的那个。
   如果改过 `ADMIN_USERNAME`，记得 `wrangler deploy` 重新发布。

**Q: CORS 错误**
A: 检查 `wrangler.toml` 的 `CORS_ORIGINS` 是否包含你的 Pages 域名。改完要重新 `wrangler deploy`。

**Q: Pages 部署时报 "deploy-pages failed"**
A: GitHub → Settings → Pages → Source 必须是 **GitHub Actions**，不是 "Deploy from a branch"。

**Q: 能不能只用前端不开后端？**
A: 可以。不配 `API_BASE` 时 API 调用会静默失败，测试还是能做，只是不统计。

**Q: 免费额度够用吗？**
A:
- **Cloudflare Workers 免费版**：10 万请求/天
- **D1 免费版**：5 GB 存储 + 500 万行读/天 + 10 万行写/天
- **GitHub Pages**：100 GB 流量/月

即使每天 1 万访客 × 每人 2 次请求（一次 track 一次 result）= 2 万次，离上限远得很。
