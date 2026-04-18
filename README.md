# 👑 王者测试 · Which Honor of Kings Hero Are You?

> 一个仿 [wh40k-test.xyz](https://wh40k-test.xyz) 风格的性格测试 Web App，30 道题，结果是王者荣耀里的某位英雄。
> 前端静态托管在 **GitHub Pages**，后端用 **Cloudflare Workers + D1**，访问数据保留 30 天自动清理。

**在线访问**：<https://nicedeeric.github.io/>
**管理看板**：<https://nicedeeric.github.io/admin/>

---

## 项目结构

```
.
├── index.html                  # 前端主页（答题 + 结果）
├── admin/
│   └── index.html              # Admin 登录 + 访问看板
├── assets/
│   ├── css/style.css           # 王者荣耀紫金配色
│   └── js/
│       ├── app.js              # 答题 / 评分 / 雷达图
│       └── api.js              # 后端调用封装
├── data/
│   ├── questions.json          # 30 题 + 每题 4 选项 + 6 维度权重
│   └── heroes.json             # 30 位英雄画像向量
├── worker/                     # Cloudflare Worker 后端
│   ├── src/index.js            # API + Cron + JWT
│   ├── schema.sql              # D1 建表 SQL
│   ├── wrangler.toml           # 部署配置
│   └── package.json
├── .github/workflows/
│   ├── deploy-pages.yml        # 自动发布前端到 GitHub Pages
│   └── deploy-worker.yml       # 自动发布 Worker 到 Cloudflare
├── DEPLOYMENT.md               # 完整部署指南（看这个！）
└── README.md
```

## 快速开始

- **想上线？** 👉 直接看 [DEPLOYMENT.md](./DEPLOYMENT.md)
- **本地预览？**
  ```bash
  # 根目录直接跑任何静态服务器就行
  npx serve .
  # 访问 http://localhost:3000
  ```

## 打分原理

每道题的选项对 6 个维度加权：

| 维度 | 含义 |
|------|------|
| A | 攻击 Aggressive |
| D | 防御 Defensive |
| T | 团队 Team |
| L | 独行 Lone |
| S | 智谋 Strategic |
| I | 直觉 Intuitive |

答完 30 题 → 得到一个 6 维向量 → 与每个英雄的预设向量做**余弦相似度**匹配 → 取最接近的那个作为结果。

## 数据与隐私

- 前端写入 `localStorage` 一个随机的 `visitor_id`（无任何个人信息）
- 后端只记录：访问时间、visitor_id、路径、referrer、UA、国家（CF 自动给）、IP 的 **sha256 截断 16 位**（不存明文 IP）
- 所有记录 **30 天自动删除**

## License

MIT — 代码随便用。英雄名称、台词、形象版权归腾讯《王者荣耀》所有；本项目为非官方**趣味测试**，与腾讯无关。
