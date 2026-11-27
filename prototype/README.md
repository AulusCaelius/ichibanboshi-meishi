# 一番星 ICHIBANBOSHI · 原型使用说明（Round 1–3 + WebGL 真实材质）

本原型严格依据 [一番星 · 制作人名片设计平台 PRD.md](../一番星%20·%20制作人名片设计平台%20PRD.md)（v0.4）构建，采用纯静态 HTML / CSS / 原生 JS + 本地化 Three.js (`r149`) 实现，无需任何构建工具与外部 CDN 依赖。

## 本地启动方式

```bash
cd prototype
python3 -m http.server 8765
```

启动后在浏览器访问 `http://localhost:8765/index.html`。

## 完整业务流程与页面地址

完整端到端流程：**模板库（`templates.html`）→ 点击「使用此模板」→ 编辑器（`editor.html`）→ 我的作品管理（`works.html`） / Phygital 双栖（`phygital.html`）→ 独立 H5 实机页（`card.html`）→ 印前检查与导出（`export.html`）**

### Round 1 页面与状态直达

| 页面 / 状态 | 路由地址 | 说明 |
|-------------|----------|------|
| 首页落地页 | `http://localhost:8765/index.html` | 固定玻璃 Header（含制作人身份登录弹窗）、橙色渐变 Hero + 3D 扇形漂浮名片、4 卡特征网格、核心差异 3 行交互示意、8 卡 Pick Up 横滚精选、Art Deco 日芒 CTA 带与 Footer |
| 模板库 · 默认浏览态 | `http://localhost:8765/templates.html` | 预填框为空、开关关闭，缩略图显示占位示例 `制作人Producer / 〇〇担当 / 初星学園` |
| 模板库 · 信息预填激活态 | `http://localhost:8765/templates.html?state=active` | 自动填入 `制作人Producer / 花海咲季担当 / 初星学園`，开关激活，点亮 `#E30F25` 担当色并弹出 Toast |
| 模板库 · 超长文本边界态 | `http://localhost:8765/templates.html?state=long` | 验证 Auto-Layout 自动缩字与折行不溢出 |
| 模板库 · 筛选空状态 | `http://localhost:8765/templates.html?state=empty` | 预设筛选「正装 + 方形」，展示空星盘线稿插画 |
| 模板库 · 骨架屏加载态 | `http://localhost:8765/templates.html?state=loading` | 骨架屏 shimmer 占位态常驻 |

### Round 2 & Round 3 核心页面

| 页面 | 路由地址 | 核心能力 |
|------|----------|----------|
| **编辑器工作台** | `http://localhost:8765/editor.html` | 极简表单 ↔ 自由画布双模式、**全可编辑区域自由材质选择**（6 种特种纸基底含正反独立指定 + 9 种区域表面材质效果：原纸直印/缎面烫金/哑光烫银/赤铜烫印/击凸浮雕/活字压凹/立体厚墨/丝绒触感/拉丝金属）、动态出血线（0/2/3mm）与 **Three.js WebGL 纯真实材质 3D 预览**（无人工扫光反光，还原真实纸张厚度倒角、笔画级材质遮罩与影棚/舞台/窗光三环境） |
| **我的作品管理台** (Round 3) | `http://localhost:8765/works.html` | 本地多方案库 CRUD：检索筛选、热度/时间排序、正反面切换预览、复制副本、重命名、删除、点击直达编辑/双栖/导出与查看每套名刺的 H5 PV 汇总 |
| **Phygital 双栖视图** | `http://localhost:8765/phygital.html` | 左栏实体名片正反面联动 + H5 简介/SNS 开关/3 套布局选择；右栏 375×812 手机样机（支持点击复制 SNS、导出 `.vcf`）；底部支持一键打开 `card.html` 与实时联动 PV / 7 日趋势折线 |
| **独立 H5 电子名片页** (Round 3) | `http://localhost:8765/card.html?slug=hatsuboshi-p` | 独立移动端分享落地页，支持正反实体名刺对照弹层、SNS 一键复制、`.vcf` 通讯录交换并实时累加 `localStorage` 中的 PV 与保存数 |
| **印前检查与导出** | `http://localhost:8765/export.html` | 8 项 Preflight 印前质检 + 前端实时生成含出血与裁切线的真实 `PDF 1.4` / 高清 `PNG` / `JPG` / `SVG`，并开放「分离导出工艺专色通道」（K100 专色黑版实时预览与独立版下载） |

## 快捷键与 URL 参数说明

### 自由画布模式快捷键（非输入焦点时生效）

| 快捷键 | 功能 |
|--------|------|
| `↑ / ↓ / ← / →` | 微调选中元素位置 `0.5%` |
| `Shift + 方向键` | 加速移动选中元素 `2%` |
| `Delete` / `Backspace` | 删除选中元素（绑定字段的元素删除后同步清空表单并校验） |
| `Cmd / Ctrl + D` | 复制选中元素（偏移 `+3%`） |
| `Cmd / Ctrl + Z` | 撤销上一步 |
| `Shift + Cmd / Ctrl + Z` | 重做下一步 |
| `Esc` | 关闭模态框 |

### 编辑器 `?focus=` 与 `?work=` 定位参数

- `?work={workId}`：从「我的作品」切换并加载指定 ID 的名片方案。
- `?focus=field:name`：自动切换至极简表单模式并聚焦高亮 P 名输入框（支持 `enName` / `title` / `company` / `x`）。
- `?focus=el:{id}&side=front`：自动切换至自由画布模式与指定正/反面，并高亮选中目标元素。

## 本地存储（localStorage）说明

- `ichiban:project`：保存当前激活的名片设计方案全文。
- `ichiban:works`：保存多套制作人名片方案列表（含各自 H5 短链别名、PV、通讯录保存数与 7 日访问趋势）。
- `ichiban:user`：保存登录的制作人身份信息（P 名、主推担当偶像、担当色与所属事务所）。
- `ichiban:prefill`：保存模板库预填与登录同步的默认名片资料。
- 如需重置全部草稿与状态，可在浏览器开发者工具 Console 中执行：`localStorage.clear()` 后刷新页面。

## Round 2 问题排查修复清单（Round 3 前置完成）

1. **修复方形名片外框类名错配**：`card.js` 根据 `opts.dims` 动态输出 `.bcard-frame--h / --v / --s`，确保方形 `54×54` / `65×65` 在双栖页与导出页比例正确。
2. **补齐自由画布删除绑定字段同步与质检**：`editor.js` 删除唯一绑定字段元素时同步清空对应 `fields[bind]`；`preflight.js` 在自由画布下同样校验正面 `name` 可见且非空。
3. **修复切换模板反面自由排版残留**：自由画布切换模板时同时确认并重置正反两面 `canvas`。
4. **修复矢量 `.svg` 导出文字溢出**：通过 `print-export.js` 在测量沙盒执行 `fitText()` 后再序列化 `.svg`。
5. **修复编辑器出血尺寸联动**：`editor.js` 实时读取 `project.export.bleed`（0/2/3mm）并保持内缩安全线恒定 `3mm`。
6. **修复 3D 预览负角取模与全局拖拽释放**：`preview3d.js` 改用正向取模并在 `window` 绑定拖拽释放事件，同时增强烫金/烫银/局部 UV 高光与卡边光泽。
7. **全站统一 `?v=r3` 资源版本号**：避免静态资源本地缓存干扰。

## 已知说明

- **色彩空间说明**：浏览器 `<canvas>` 工作在 sRGB 色彩空间，当前前端可真实输出 300/600 DPI 含出血与裁切标记的多页 `PDF 1.4`、`PNG`、`JPG`、`SVG` 及 `K100` 专色黑版；正式印厂端 ICC CMYK 分色转换在后续接后端服务时无缝替换生成接口即可。
