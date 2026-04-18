# 📜 古今英雄测 · Which Historical Hero Are You?

> 八维人格测试 · 基于 60+ 位历史与神话公共领域人物原型 · 每次从 80 题题库随机抽 30 题。
> 前端静态托管在 **GitHub Pages**，后端用 **Cloudflare Workers + D1**，访问数据保留 30 天自动清理。

**在线访问**：<https://nicedeeric.github.io/>
**管理看板**：<https://nicedeeric.github.io/admin/>

---

## 设计说明

### 八维人格模型

| 维度 | 左极 | 右极 |
|------|------|------|
| 锋芒 | 守 · 稳扎稳打 | 锋 · 主动出击 |
| 群独 | 群 · 合作共生 | 独 · 独立为王 |
| 谋觉 | 直 · 直觉本能 | 谋 · 运筹帷幄 |
| 远近 | 近 · 活在当下 | 远 · 目光长远 |
| 钢柔 | 柔 · 能屈能伸 | 钢 · 宁折不弯 |
| 热冷 | 冷 · 喜怒不形色 | 热 · 情感外露 |
| 义利 | 利 · 务实取舍 | 义 · 原则至上 |
| 明隐 | 隐 · 韬光养晦 | 明 · 光明磊落 |

每位用户做完测试会得到在这 8 个维度上的 0-10 分数，并获得对应的人格评语。最终通过曼哈顿距离在 60+ 位历史/神话英雄中找到最匹配的那位。

### 英雄原型范围

全部采用**公共领域**的历史与神话人物：上古神话（盘古/女娲/后羿/嫦娥...）、诸子百家（孔子/老子/庄周/墨子/孙子/鬼谷子...）、春秋战国（屈原/廉颇/白起/嬴政/西施/荆轲...）、两汉（刘邦/韩信/张良/项羽/虞姬/王昭君...）、三国（关羽/张飞/赵云/诸葛亮/曹操/周瑜/吕布...）、隋唐（李白/狄仁杰/武则天/花木兰/程咬金...），以及世界名人（雅典娜/宫本武藏/马可波罗）。

项目与任何游戏 IP 无关，所有人物均为历史与文化遗产。

---

## 项目结构

```
.
├── index.html                  # 前端主页
├── admin/index.html            # Admin 登录 + 访问看板
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js              # 答题 / 评分 / 渲染
│       └── api.js              # 后端调用封装
├── data/
│   ├── questions.json          # 80 题 + 8 维度权重
│   └── heroes.json             # 60+ 英雄画像
├── worker/                     # Cloudflare Worker 后端
│   ├── src/index.js
│   ├── schema.sql
│   ├── wrangler.toml
│   └── package.json
├── .github/workflows/
│   ├── deploy-pages.yml
│   └── deploy-worker.yml
├── DEPLOYMENT.md
└── README.md
```

## 快速开始

- **部署上线**：看 [DEPLOYMENT.md](./DEPLOYMENT.md)
- **本地预览**：
  ```bash
  python3 -m http.server 8080
  # 访问 http://localhost:8080
  ```

## 数据与隐私

- 前端写入 `localStorage` 一个随机的 `visitor_id`（无任何个人信息）
- 后端只记录访问时间、visitor_id、路径、referrer、UA、国家（CF 自动给）、IP 的 **sha256 截断 16 位**（不存明文 IP）
- 所有记录 **30 天自动删除**

## License

MIT — 代码随意使用。所有人物原型均为公共领域历史/神话人物，本项目为非商业性质的趣味测试。
