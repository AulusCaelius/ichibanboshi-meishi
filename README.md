# 一番星 ICHIBANBOSHI · 纯本地个性名刺工坊

面向个人创作者、设计师与同好交流场景的**纯本地优先（Local-First）**多风格名刺设计与印刷工坊：**新版现代前端正式版源码位于 [`web/`](./web/package.json)**，采用 **React 19 + TypeScript + Vite + Zustand + Tailwind CSS** 架构；原有交互静态原型保留于 [`prototype/`](./prototype/README.md)。

## 架构亮点

- **零后端纯本地持久化**：彻底移除 `app/` Node + SQLite 服务端，全部名片作品、上传插画、修改/新建的自定义模板及个人偏好自动存储在浏览器 `IndexedDB`（`localStorage` 镜像兜底）。
- **工程与备份导入/导出续作**：内置全量备份（`.ichiban-backup.json`，支持合并/覆盖恢复）、单卡工程（`.ichiban-card.json`）与单模板文件（`.ichiban-template.json`），跨设备或清理缓存后可随时导入继续上次编辑。
- **60 套通用多风格模板**：去除了特定偶像角色设定，覆盖 **极简留白 / 现代几何 / 杂志社论 / 暗夜先锋 / 柔和渐变 / 秩序商务** 六大审美风格及横版/竖版/方卡画幅。
- **物理材质 3D & CMYK 印前直出**：内置 Three.js WebGL 实体纸卡 3D PBR 审样（无人工扫光）、17 个独立可编辑区域材质、Preflight 8 项自动修复，以及纯前端 `DeviceCMYK` PDF 1.4 与 K100 专色制版输出。

## 在线预览（GitHub Pages）

- **纯本地正式版（主站）**：<https://auluscaelius.github.io/ichibanboshi-meishi/>
  - 通用模板库：<https://auluscaelius.github.io/ichibanboshi-meishi/#/templates>
  - 在线设计台：<https://auluscaelius.github.io/ichibanboshi-meishi/#/editor>
  - 本地资产与模板管理：<https://auluscaelius.github.io/ichibanboshi-meishi/#/works>
  - 数字名片二维码联动：<https://auluscaelius.github.io/ichibanboshi-meishi/#/phygital>
  - 独立移动端数字名片：<https://auluscaelius.github.io/ichibanboshi-meishi/#/card>
  - Preflight 与 CMYK 导出：<https://auluscaelius.github.io/ichibanboshi-meishi/#/export>

## 本地开发与构建

```bash
cd web
npm install
npm run dev     # 启动 Vite 本地开发服务器
npm test        # 运行 Vitest 核心引擎单元测试
npm run build   # TypeScript 类型检查 + 生产构建 web/dist/
```
