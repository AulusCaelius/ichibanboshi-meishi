# 一番星 ICHIBANBOSHI · 制作人名片设计平台（正式版 v1.0）

独立正式版工程位于 `app/` 目录，在完整保留 `prototype/` 原型对照的同时，补齐并升级 Round 1–3 全部核心业务闭环，采用 **Node 24 (`node:sqlite`) 全栈 + 静态 GitHub Pages 双模兼容** 架构。

## 核心升级亮点（对比原型版）

1. **真实云端 + 本地双模持久层**
   - 服务端（[server/index.mjs](server/index.mjs)）：基于 Node `v24` 原生 `node:sqlite`，支持多用户账号注册/密码登录（`scrypt` 加盐哈希）、SQLite 云端多作品同步、8MB 图片二进制托管、`/p/:slug` 短链跳转与每日 PV/vCard 数据统计。
   - 静态部署降级：在 GitHub Pages 等无后端环境自动无缝切换至 IndexedDB（解除 5MB `localStorage` 上限）+ 跨设备 `?d=` 压缩参数。
2. **Round 1 补全：128 套真实偶像模板与收藏搜索**
   - `core/catalog.mjs` 完整构建 `T01`–`T128` 共 **128 套不重样偶像/765PRO 制作人模板**。
   - 支持关键词实时搜索、全工艺筛选、`★ 我的收藏` 与「存为我的模板」。
3. **Round 2 补全：ISO 二维码、个人立绘裁剪与自由画布增强**
   - `core/qrcode.mjs` 实现纯 JS **ISO/IEC 18004 真实可扫描二维码**（GF(256) Reed-Solomon 纠错）。
   - 极简表单支持上传 **个人专属立绘 / 卡面插画**（缩放 + XY 位置裁剪）、单/双面切换、游戏 `P-ID`、参战活动印记、背面标题与副文案定制，以及全 16 区域 6 种纸张 + 9 种表面工艺自由搭配。
   - 自由画布支持 **旋转角度**、**安全区 6 向对齐**、**装饰艺术图形库**、`Cmd/Ctrl+C/V` 复制粘贴及切回表单自动暂存恢复。
4. **Round 3 补全：Preflight 一键自动修复与真 DeviceCMYK 印刷导出**
   - `core/preflight.mjs` 支持细线加粗、`K100` 单色黑保护、安全区回缩与小字号放大的**一键自动修复**。
   - `core/print-engine.mjs` 支持真实 **`/DeviceCMYK` + `/FlateDecode` PDF 1.4**、**300/600 DPI 双面 PNG/JPG `.zip` 打包导出**、K100 专色黑版导出及 `.ichiban.json` 工程文件导入导出。

## 启动、测试与构建命令

```bash
cd app

# 运行单元测试与服务端 API 集成测试
npm test

# 启动全栈正式版服务 (http://localhost:8780/ ，含原型对照 http://localhost:8780/prototype/)
npm start

# 构建纯静态发行包（输出至 app/dist/，可直接发布至 GitHub Pages）
npm run build
```
