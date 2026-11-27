# 一番星 · 制作人名片设计平台（ICHIBANBOSHI）

> 面向偶像延伸文化爱好者（制作人 / 动漫与地偶同好）及独立创作者的**纯本地离线优先（100% Local-First）**名刺设计、WebGL PBR 物理材质审样、印前质检导出与 Phygital 双栖 H5 名片平台。

- **在线体验（GitHub Pages）**：https://auluscaelius.github.io/ichibanboshi-meishi/
- **静态原型归档**：https://auluscaelius.github.io/ichibanboshi-meishi/prototype/ （源码位于 [`prototype/`](./prototype/)）
- **可编辑 UI 设计稿（Figma）**：https://www.figma.com/design/mer2asPSDgBDXqSGC0OJdv
- **产品需求文档（PRD）**：[`一番星 · 制作人名片设计平台 PRD.md`](./%E4%B8%80%E7%95%AA%E6%98%9F%20%C2%B7%20%E5%88%B6%E4%BD%9C%E4%BA%BA%E5%90%8D%E7%89%87%E8%AE%BE%E8%AE%A1%E5%B9%B3%E5%8F%B0%20PRD.md)

---

## 核心特性

- **60 套通用多风格模板与 3 秒信息速填**
  - 内置 `G01`–`G60` 六大美学风格通用模板（`极简留白 minimal`、`现代几何 modern`、`杂志社论 editorial`、`暗夜先锋 obsidian`、`柔和渐变 pastel`、`秩序商务 swiss`），不含特定官方角色与 IP 商标文字。
  - 在模板库输入 `P 名`、职位（内置 13 组担当快捷选择）与事务所，开启「预览效果」开关即可把全站模板切换为真实个人成品；支持按 13 组色系圆点进行 HSL 感知色域筛选、版式/工艺筛选及收藏管理。
- **双模式编辑器与全可编辑区域自由材质**
  - 支持 **极简表单** 与 **自由画布** 无缝切换，内置 25 步撤销/重做栈（`undoStack` / `redoStack`）、6 种尺寸规格（`cn 90×54mm`、`jp 91×55mm`、`eu 85×55mm`、`us 89×51mm`、`sq54`、`sq65`）、直角 / `3mm` / `5mm` 裁切圆角与出血/裁切/安全区引导线。
  - 支持本地立绘/插画/徽章上传裁切，正反面独立更换 **6 种特种纸基底**（哑光铜版纸、手工质感棉纸、云母珠光纸、深邃黑卡、越前和纸、磨砂半透 PVC），并对 **17 个可编辑区域** 独立配置 **9 种表面工艺**（原纸直印、缎面烫金、哑光烫银、赤铜烫印、击凸浮雕、活字压凹、立体厚墨 UV、丝绒触感膜、拉丝金属）。
- **Three.js WebGL PBR 真实材质 3D 审样**
  - 基于 `MeshStandardMaterial` 程序化生成纸张纤维高度与云母闪烁纹理、卡片真实厚度挤出倒角与 3 套环境光照（柔光影棚 / 舞台聚光 / 学园窗光）；彻底移除虚假人工扫光动效，支持右侧迷你预览与 360° 大弹窗审样。
- **8 项 Preflight 印前质检与原生前端导出**
  - 自动检查图像 DPI、3mm 安全区越界、最小字号（≥6pt）、极细线宽（≥0.25pt）、CMYK 映射、SIL OFL 字体授权、必填身份字段与 K100 单色黑防重影保护，支持一键修复与定位回编辑器图层。
  - 前端原生封装生成含 `0 / 2 / 3mm` 出血与套准裁切标的 `DeviceCMYK` / `DeviceRGB` 多页 `PDF 1.4`、`DeviceGray` K100 工艺专色附页与独立 `.svg` 专色版、双面 `.png` / `.jpg` 自动打包 `.zip` 及 `.txt` 印刷规格工艺单。
- **Phygital 双栖 H5 与免后端分享**
  - `shareCodec.ts` 将卡面设计、正反纸基、区域工艺与 H5 布局编码为 `?slug=...&d=...` Base64url 载荷，内置原生 UTF-8 QR 矩阵编码与 `${safeName}-meishi.vcf` vCard 3.0 通讯录下载，并在本地实时累加访问 PV 与保存统计。
- **纯本地持久化与工程备份续作**
  - 全部名刺方案、自定义改版模板、上传插画与个人档案自动异步写入浏览器 `IndexedDB`（`ichiban_local_studio_v2`，含 `localStorage` 镜像兜底）；支持导出及合并/覆盖导入 `.ichiban-backup.json`（全量工作台）、`.ichiban-card.json`（单张工程）与 `.ichiban-template.json`（单套模板）。

---

## 页面路由一览

应用采用客户端 `HashRouter`，区分 **Showcase 展示壳**（含全局双语玻璃导航 Header 与 Footer）、**Focus 焦点工作台壳**（`#F0F0F0` 高对比底色 + `64px` 紧凑顶栏）与 **独立 H5 轻壳**：

| 路由 | 页面名称 | 对应源码 | 界面壳模式 |
|------|----------|----------|------------|
| `#/` | 首页落地页 | [`web/src/pages/HomePage.tsx`](./web/src/pages/HomePage.tsx) | Showcase |
| `#/templates` | 模板库与 3 秒速填 | [`web/src/pages/TemplatesPage.tsx`](./web/src/pages/TemplatesPage.tsx) | Showcase |
| `#/works` | 我的作品与模板管理台 | [`web/src/pages/WorksPage.tsx`](./web/src/pages/WorksPage.tsx) | Showcase |
| `#/editor` | 名片双模式与材质编辑器 | [`web/src/pages/EditorPage.tsx`](./web/src/pages/EditorPage.tsx) | Focus 工作台 |
| `#/phygital` | Phygital 实体 × 数字双栖联动 | [`web/src/pages/PhygitalPage.tsx`](./web/src/pages/PhygitalPage.tsx) | Focus 工作台 |
| `#/export` | 印前检查（Preflight）与印刷导出 | [`web/src/pages/ExportPage.tsx`](./web/src/pages/ExportPage.tsx) | Focus 工作台 |
| `#/card` | 独立移动端 H5 电子名刺页 | [`web/src/pages/DigitalCardPage.tsx`](./web/src/pages/DigitalCardPage.tsx) | 独立 H5 轻壳 |

---

## 技术栈与目录结构

- **前端栈**：React 19 · TypeScript 5.8 · Vite 8 · Zustand 5 · React Router 7 · Tailwind CSS v4 · Three.js 0.187 · Lucide React · Vitest 5

```text
.
├── prototype/                              # 早期静态多页高保真原型归档（HTML + CSS + JS）
├── web/                                    # v1.0 纯前端 React + TS 正式工程
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── __tests__/engines.test.ts       # 模板合规、ShareCodec/QR、备份、Preflight 与 CMYK/ZIP 单测
│       ├── components/                     # Header、Footer、CardFaceView、CardPreview3D、BackupModal、ProfileModal、Toast
│       ├── data/templates.ts               # G01–G60 通用模板库、13 组色系/担当预设、纸基与工艺元数据
│       ├── engines/                        # renderCardHtml、preview3d、preflight、printExport、qrcode、shareCodec
│       ├── pages/                          # HomePage、TemplatesPage、WorksPage、EditorPage、PhygitalPage、ExportPage、DigitalCardPage
│       ├── storage/                        # idb.ts (IndexedDB + localStorage 兜底) & backup.ts (.ichiban-*.json 协议)
│       ├── stores/                         # useStudioStore.ts & useToastStore.ts
│       ├── styles/                         # index.css、prd.css、card.css
│       └── types/card.ts                   # 完整强类型定义
├── 一番星 · 制作人名片设计平台 PRD.md      # 同步至 v1.0 的产品需求与设计规范文档
└── README.md
```

---

## 本地开发与验证命令

需要 Node.js（建议 20+）环境：

```bash
cd web
npm install      # 安装依赖
npm run dev      # 启动 Vite 本地开发服务器
npm test         # 运行 Vitest 单元测试
npm run build    # 执行 tsc --noEmit 类型检查并打包生产产物到 web/dist/
npm run preview  # 本地预览生产构建 (127.0.0.1:4173)
```

---

## 素材与字体合规说明

- 平台界面及内置 `G01`–`G60` 模板**不包含任何官方 IP 商标文字、游戏截图、角色立绘或官方 LOGO**，用户自主上传的插画素材仅存储在本地浏览器 `IndexedDB` 与用户导出的个人备份文件中，不上传至任何服务端。
- 内置界面及导出使用字体（`Poppins`、`Noto Sans SC`、`Noto Serif SC`、`M PLUS Rounded 1c`、`Zen Antique Soft`、`JetBrains Mono`）均采用 **SIL Open Font License (OFL)** 或兼容开源许可。
