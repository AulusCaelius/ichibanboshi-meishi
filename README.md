# 一番星 ICHIBANBOSHI · 制作人名片（P名刺）设计平台

面向偶像文化与动画游戏爱好者的双栖制作人名片（P名刺）设计平台：**正式版源码位于 [`app/`](./app/README.md)**（`Node 24 + SQLite` 全栈 & 静态部署双模），原有交互原型完整保留于 [`prototype/`](./prototype/README.md)。

## 在线预览（GitHub Pages）

- **正式版（主站）**：<https://auluscaelius.github.io/ichibanboshi-meishi/>
  - 128 套偶像模板库：<https://auluscaelius.github.io/ichibanboshi-meishi/templates.html>
  - 双模式全区域材质编辑器：<https://auluscaelius.github.io/ichibanboshi-meishi/editor.html>
  - 我的作品管理：<https://auluscaelius.github.io/ichibanboshi-meishi/works.html>
  - Phygital 双栖视图：<https://auluscaelius.github.io/ichibanboshi-meishi/phygital.html>
  - 独立 H5 电子名刺：<https://auluscaelius.github.io/ichibanboshi-meishi/card.html?slug=hatsuboshi-p>
  - Preflight 与 CMYK 导出：<https://auluscaelius.github.io/ichibanboshi-meishi/export.html>
- **交互原型对照版**：<https://auluscaelius.github.io/ichibanboshi-meishi/prototype/>

## 目录说明

- [`app/`](./app/README.md)：可独立运行与构建的正式版全栈工程（ES Modules + Node 24 SQLite 服务端 + 静态打包双模，含真实 ISO 二维码、个人立绘裁剪、128 套模板、Preflight 一键修复、`DeviceCMYK` PDF 1.4 与双面 PNG/JPG ZIP 导出）。
- [`prototype/`](./prototype/README.md)：高保真静态原型与 Design Tokens 验证版。
- [`一番星 · 制作人名片设计平台 PRD.md`](./一番星%20·%20制作人名片设计平台%20PRD.md)：产品需求文档（v0.4）。

## 本地启动正式版

```bash
cd app
npm test    # 运行单元与 API 集成测试
npm start   # 启动 Node 24 全栈正式版 (http://localhost:8780/ ，含 /prototype/)
npm run build # 构建纯静态发行目录 app/dist/
```
