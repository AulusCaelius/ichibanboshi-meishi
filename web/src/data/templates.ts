import type {
  CardFields,
  CardProject,
  CardTemplate,
  CraftMeta,
  CreatorProfile,
  PaperStockId,
  RegionCraftsMap,
  RegionMeta,
  SpecId,
  SpecMeta,
  StandeeConfig,
  StockMeta,
  SurfaceCraftId,
  TemplateStyle,
} from '../types/card';

export const TEMPLATE_STYLE_LABELS: Record<TemplateStyle, string> = {
  minimal: '极简留白',
  modern: '现代几何',
  editorial: '杂志社论',
  obsidian: '暗夜先锋',
  pastel: '柔和渐变',
  swiss: '秩序商务',
};

export const THEME_COLORS = [
  { id: 'c1', name: '晴空橙', hex: '#FF7600', accent: '#FFF1E6' },
  { id: 'c2', name: '深海蓝', hex: '#2563EB', accent: '#EFF6FF' },
  { id: 'c3', name: '曜石黑', hex: '#0F172A', accent: '#E2E8F0' },
  { id: 'c4', name: '松石青', hex: '#0D9488', accent: '#CCFBF1' },
  { id: 'c5', name: '绯红朱', hex: '#E11D48', accent: '#FFE4E6' },
  { id: 'c6', name: '暮光紫', hex: '#7C3AED', accent: '#EDE9FE' },
  { id: 'c7', name: '森野绿', hex: '#15803D', accent: '#DCFCE7' },
  { id: 'c8', name: '暖琥珀', hex: '#D97706', accent: '#FEF3C7' },
  { id: 'c9', name: '钴灰蓝', hex: '#475569', accent: '#F1F5F9' },
  { id: 'c10', name: '珊瑚粉', hex: '#F43F5E', accent: '#FFF1F2' },
  { id: 'c11', name: '靛蓝紫', hex: '#4F46E5', accent: '#E0E7FF' },
  { id: 'c12', name: '冷银灰', hex: '#64748B', accent: '#F8FAFC' },
];

export const ROLE_PRESETS = [
  '独立插画师 / Visual Artist',
  'UI / 品牌设计师',
  '独立开发者 / Creative Dev',
  '摄影师 / 视觉导演',
  '策展人 / 内容主理人',
  '自由撰稿 / 编辑策划',
];

export const CARD_SPECS: Record<SpecId, SpecMeta> = {
  cn: { id: 'cn', name: '国标名刺 90×54mm', w: 90, h: 54, ratio: 90 / 54, orient: 'h', note: '通行通用标准' },
  jp: { id: 'jp', name: '日系四号 91×55mm', w: 91, h: 55, ratio: 91 / 55, orient: 'h', note: '日系名刺标准' },
  eu: { id: 'eu', name: '欧标商务 85×55mm', w: 85, h: 55, ratio: 85 / 55, orient: 'h', note: '欧洲标准尺寸' },
  us: { id: 'us', name: '美标卡片 89×51mm', w: 89, h: 51, ratio: 89 / 51, orient: 'h', note: '修长比例横卡' },
  sq54: { id: 'sq54', name: '方形小卡 54×54mm', w: 54, h: 54, ratio: 1, orient: 's', note: '市集徽章方卡' },
  sq65: { id: 'sq65', name: '方形大卡 65×65mm', w: 65, h: 65, ratio: 1, orient: 's', note: '展示与特典方卡' },
};

export const PAPER_STOCKS: Record<PaperStockId, StockMeta> = {
  matte: { id: 'matte', name: '超感哑粉卡', gsm: '350gsm', desc: '细腻哑光表面，色彩还原精准，适合绝大多数插画与极简排版' },
  cotton: { id: 'cotton', name: '莫代尔棉卡', gsm: '400gsm', desc: '柔和自然纤维质感，触感蓬松厚实，压凹工艺极佳' },
  pearl: { id: 'pearl', name: '珠光星幻纸', gsm: '320gsm', desc: '微细珠光云母粒子底材，柔和金属丝光感，无刺眼眩光' },
  black: { id: 'black', name: '黑卡特种纸', gsm: '450gsm', desc: '通体黑芯高克重纸基，专金/专银/专铜覆盖力极强' },
  washi: { id: 'washi', name: '温润和纸卡', gsm: '330gsm', desc: '经典斜纹织理，保留纸浆温润手感，适合社论与手工风' },
  pvc: { id: 'pvc', name: '磨砂半透卡', gsm: '0.38mm', desc: '防水耐折磨砂 PVC 片材，呈现清爽透光科技氛围' },
};

export const SURFACE_CRAFTS: Record<SurfaceCraftId, CraftMeta> = {
  none: { id: 'none', name: '原纸本色', badge: 'NONE', desc: '无额外后道表面工艺，呈现纸张原生肌理' },
  gold: { id: 'gold', name: '哑金箔印', badge: 'GOLD', desc: '暖调香槟金金属质感，高对比度凸显主标题' },
  silver: { id: 'silver', name: '冷银箔印', badge: 'SILVER', desc: '冷静锐利银灰箔面，适合现代几何与暗夜风' },
  copper: { id: 'copper', name: '玫瑰铜箔', badge: 'COPPER', desc: '温润红铜质感，兼具复古与精致工艺氛围' },
  emboss: { id: 'emboss', name: '立体激凸', badge: 'EMBOSS', desc: '向上顶起约 0.25mm 的触感浮雕边缘阴影' },
  deboss: { id: 'deboss', name: '深压凹印', badge: 'DEBOSS', desc: '向纸基内压陷 0.2mm 的内嵌凹槽印记' },
  uv: { id: 'uv', name: '局部高光 UV', badge: 'SPOT UV', desc: '透明光油覆盖特定文字或图标，微斜视角呈现清漆对比' },
  velvet: { id: 'velvet', name: '触感绒膜', badge: 'VELVET', desc: '高粗糙度天鹅绒雾面阻尼感，柔和吸光' },
  brushed: { id: 'brushed', name: '拉丝金属', badge: 'BRUSHED', desc: '单向精密拉丝钛钢纹理，兼具工业质感' },
};

export const EDITABLE_REGIONS: RegionMeta[] = [
  { id: 'frontBg', label: '正面底纸/基调', side: 'front', group: '基底材质' },
  { id: 'decor', label: '装饰线/几何色块', side: 'front', group: '装饰结构' },
  { id: 'name', label: '主姓名 / 昵称', side: 'front', group: '核心文字' },
  { id: 'enName', label: '英文名 / 副标题', side: 'front', group: '核心文字' },
  { id: 'title', label: '职业 / 创作定位', side: 'front', group: '身份信息' },
  { id: 'company', label: '工作室 / 归属', side: 'front', group: '身份信息' },
  { id: 'codeTag', label: '编号 / 索引标签', side: 'front', group: '标签贴纸' },
  { id: 'eventTag', label: '场次 / 副签', side: 'front', group: '标签贴纸' },
  { id: 'x', label: 'X / Twitter 账号', side: 'front', group: '社交账号' },
  { id: 'weibo', label: '微博账号', side: 'front', group: '社交账号' },
  { id: 'bilibili', label: 'B站 / 视频主页', side: 'front', group: '社交账号' },
  { id: 'xhs', label: '小红书 / 作品集', side: 'front', group: '社交账号' },
  { id: 'website', label: '个人网址', side: 'front', group: '社交账号' },
  { id: 'motto', label: '个性签名 / Slogan', side: 'front', group: '核心文字' },
  { id: 'backBg', label: '背面底纸/基调', side: 'back', group: '背面基底' },
  { id: 'backTitle', label: '背面主标题', side: 'back', group: '背面元素' },
  { id: 'qr', label: '背面动态二维码', side: 'back', group: '背面元素' },
];

export const DEFAULT_CARD_FIELDS: CardFields = {
  name: '林栖 / Lin Qi',
  enName: 'LIN QI · CREATOR',
  title: '独立插画师 / 平面设计',
  company: 'STUDIO LUMEN · 个人工作室',
  codeTag: 'NO. 2048',
  eventTag: '创作市集 / 个人名刺',
  x: '@linqi_art',
  weibo: '@林栖_Lumen',
  bilibili: 'UID: 20480912',
  xhs: 'lumen_studio',
  website: 'lumen.example.org',
  motto: 'Keep light in every frame.',
  backTitle: 'CONNECT & PORTFOLIO',
  qrUrl: '',
};

export const DEFAULT_STANDEE_CONFIG: StandeeConfig = {
  enabled: false,
  dataUrl: '',
  fit: 'contain',
  scale: 100,
  offsetX: 0,
  offsetY: 0,
  opacity: 100,
  radius: 8,
  craft: 'none',
};

export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  nickname: '林栖 / Lin Qi',
  roleTitle: '独立插画师 / 平面设计',
  studioName: 'STUDIO LUMEN · 个人工作室',
  x: '@linqi_art',
  bilibili: 'UID: 20480912',
  website: 'lumen.example.org',
  motto: 'Keep light in every frame.',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function createDefaultRegionCrafts(fallback: SurfaceCraftId = 'none'): RegionCraftsMap {
  const map: Partial<RegionCraftsMap> = {};
  for (const r of EDITABLE_REGIONS) {
    map[r.id] = r.id === 'name' || r.id === 'decor' ? fallback : 'none';
  }
  return map as RegionCraftsMap;
}

interface RawTplSeed {
  id: string;
  name: string;
  subtitle: string;
  style: TemplateStyle;
  orient: 'h' | 'v' | 's';
  layout: string;
  color: string;
  accent: string;
  bgDark?: boolean;
  paper: PaperStockId;
  craft: SurfaceCraftId;
  tags: string[];
  desc: string;
  defaultMotto: string;
  defaultTitle: string;
}

const SEEDS: RawTplSeed[] = [
  // 1. Minimal (G01 - G10)
  { id: 'G01', name: '留白画室 Minimal 01', subtitle: 'Pure White Margin', style: 'minimal', orient: 'h', layout: 'clean', color: '#0F172A', accent: '#E2E8F0', paper: 'cotton', craft: 'deboss', tags: ['极简', '横版', '棉卡'], desc: '黄金比例大幅留白与细线锚点，突出姓名与社交句柄。', defaultMotto: 'Less noise, clearer signal.', defaultTitle: '独立插画师 / Visual Artist' },
  { id: 'G02', name: '晨光极简 Minimal 02', subtitle: 'Airy Daylight', style: 'minimal', orient: 'h', layout: 'split', color: '#FF7600', accent: '#FFF1E6', paper: 'matte', craft: 'uv', tags: ['极简', '橙灰', '哑粉'], desc: '暖橙单点缀配合高阅读度无衬线字体，轻量耐看。', defaultMotto: 'Design with warm clarity.', defaultTitle: 'UI / 品牌设计师' },
  { id: 'G03', name: '竖排素笺 Minimal 03', subtitle: 'Vertical Quietude', style: 'minimal', orient: 'v', layout: 'clean', color: '#334155', accent: '#F1F5F9', paper: 'cotton', craft: 'emboss', tags: ['极简', '竖版', '压凸'], desc: '纵置单栏名刺，右上角预留高清头像或插画窗。', defaultMotto: 'Quiet craftsmanship every day.', defaultTitle: '摄影师 / 视觉导演' },
  { id: 'G04', name: '纸白细格 Minimal 04', subtitle: 'Fine Microline', style: 'minimal', orient: 'h', layout: 'grid', color: '#0D9488', accent: '#CCFBF1', paper: 'washi', craft: 'deboss', tags: ['极简', '和纸', '青灰'], desc: '细微十字校准线划分信息层级，兼具冷静与温润。', defaultMotto: 'Precision meets tactile paper.', defaultTitle: '独立开发者 / Creative Dev' },
  { id: 'G05', name: '方寸留白 Minimal 05', subtitle: 'Square Silence', style: 'minimal', orient: 's', layout: 'frame', color: '#1E293B', accent: '#F8FAFC', paper: 'cotton', craft: 'emboss', tags: ['极简', '方卡', '无框感'], desc: '54×54mm 方形社交名刺，边缘四点对齐微标。', defaultMotto: 'Small square, big stories.', defaultTitle: '策展人 / 内容主理人' },
  { id: 'G06', name: '灰调素描 Minimal 06', subtitle: 'Graphite Note', style: 'minimal', orient: 'h', layout: 'band', color: '#475569', accent: '#F1F5F9', paper: 'matte', craft: 'none', tags: ['极简', '灰度', '百搭'], desc: '极细底部色条区隔联系方式，适合任意个人作品图片。', defaultMotto: 'Lines tell the first story.', defaultTitle: '自由撰稿 / 编辑策划' },
  { id: 'G07', name: '立轴极简 Minimal 07', subtitle: 'Vertical Hairline', style: 'minimal', orient: 'v', layout: 'split', color: '#2563EB', accent: '#EFF6FF', paper: 'pearl', craft: 'silver', tags: ['极简', '竖版', '冷银'], desc: '左栏垂直品牌色线搭配右栏清晰联系方式清单。', defaultMotto: 'Clear structure, open mind.', defaultTitle: '产品设计师 / Product Designer' },
  { id: 'G08', name: '浅杏微光 Minimal 08', subtitle: 'Warm Ivory Paper', style: 'minimal', orient: 'h', layout: 'clean', color: '#D97706', accent: '#FEF3C7', paper: 'washi', craft: 'copper', tags: ['极简', '铜箔', '暖调'], desc: '温润米白视觉重心与细铜线边框，极具线下交换亲和力。', defaultMotto: 'Warm tone in cold pixels.', defaultTitle: '概念画师 / Concept Artist' },
  { id: 'G09', name: '方卡画框 Minimal 09', subtitle: 'Gallery Frame', style: 'minimal', orient: 's', layout: 'clean', color: '#4F46E5', accent: '#E0E7FF', paper: 'matte', craft: 'uv', tags: ['极简', '方卡', 'UV'], desc: '专为高彩插画作品与方形二维码对称设计的展示方卡。', defaultMotto: 'Frame the best version.', defaultTitle: '3D 动态设计师' },
  { id: 'G10', name: '透明素卡 Minimal 10', subtitle: 'Frosted Clear', style: 'minimal', orient: 'h', layout: 'frame', color: '#64748B', accent: '#F8FAFC', paper: 'pvc', craft: 'silver', tags: ['极简', '磨砂PVC', '透卡'], desc: '适配半透明磨砂 PVC 材的简洁框线与高亮反白标题。', defaultMotto: 'See through the ordinary.', defaultTitle: '空间 / 装置设计师' },

  // 2. Modern (G11 - G20)
  { id: 'G11', name: '几何分割 Modern 11', subtitle: 'Split Block Mono', style: 'modern', orient: 'h', layout: 'split', color: '#FF7600', accent: '#FFF7ED', paper: 'matte', craft: 'uv', tags: ['现代', '撞色', '横版'], desc: '28% 主色侧边色块搭配大字号加粗姓名，视觉识别度极强。', defaultMotto: 'Bold color, sharp focus.', defaultTitle: '品牌视觉总监' },
  { id: 'G12', name: '斜角动能 Modern 12', subtitle: 'Dynamic Corner', style: 'modern', orient: 'h', layout: 'band', color: '#2563EB', accent: '#DBEAFE', paper: 'pearl', craft: 'silver', tags: ['现代', '蓝白', '珠光'], desc: '斜角切线与左下编号胶囊标签，适合创意工作室与科技开发者。', defaultMotto: 'Ship ideas with momentum.', defaultTitle: '全栈创意开发者' },
  { id: 'G13', name: '竖排几何 Modern 13', subtitle: 'Vertical Duo Block', style: 'modern', orient: 'v', layout: 'duo', color: '#0D9488', accent: '#CCFBF1', paper: 'matte', craft: 'emboss', tags: ['现代', '竖版', '几何'], desc: '上下二分块结构，上方主标与图像区，下方整齐社交矩阵。', defaultMotto: 'Balance function and delight.', defaultTitle: '交互设计师' },
  { id: 'G14', name: '霓虹框格 Modern 14', subtitle: 'Vector Badge', style: 'modern', orient: 'h', layout: 'badge', color: '#7C3AED', accent: '#EDE9FE', paper: 'matte', craft: 'uv', tags: ['现代', '徽章', '紫调'], desc: '圆角叶形容器加右下编号章，兼具展台市集与日常商务质感。', defaultMotto: 'Craft the unexpected.', defaultTitle: '动效与音频设计师' },
  { id: 'G15', name: '方块序列 Modern 15', subtitle: 'Square Matrix', style: 'modern', orient: 's', layout: 'grid', color: '#E11D48', accent: '#FFE4E6', paper: 'matte', craft: 'uv', tags: ['现代', '方卡', '红白'], desc: '高频对比色方块布局，单手握持一目了然。', defaultMotto: 'Compact grid, bold voice.', defaultTitle: '漫画家 / 分镜师' },
  { id: 'G16', name: '翠竹建筑 Modern 16', subtitle: 'Modular Arch', style: 'modern', orient: 'h', layout: 'frame', color: '#15803D', accent: '#DCFCE7', paper: 'cotton', craft: 'deboss', tags: ['现代', '绿调', '建筑感'], desc: '建筑比例分栏线与右上小徽章，适合个人建筑/工业设计名刺。', defaultMotto: 'Build things that endure.', defaultTitle: '建筑 / 工业设计师' },
  { id: 'G17', name: '竖版色带 Modern 17', subtitle: 'Pillar Stripe', style: 'modern', orient: 'v', layout: 'band', color: '#4F46E5', accent: '#E0E7FF', paper: 'pearl', craft: 'brushed', tags: ['现代', '竖版', '拉丝'], desc: '垂直主色色带贯通正反面，呈现强劲系列化视觉感。', defaultMotto: 'Signal over noise.', defaultTitle: '前端架构 / Design Engineer' },
  { id: 'G18', name: '暖橙胶囊 Modern 18', subtitle: 'Pill System', style: 'modern', orient: 'h', layout: 'duo', color: '#EA580C', accent: '#FFEDD5', paper: 'matte', craft: 'emboss', tags: ['现代', '胶囊', '活力'], desc: '多枚圆角状态标签聚合身份信息，读感轻松明快。', defaultMotto: 'Create freely, share warmly.', defaultTitle: '内容创作者 / UP 主' },
  { id: 'G19', name: '方卡斜切 Modern 19', subtitle: 'Cutout Square', style: 'modern', orient: 's', layout: 'split', color: '#0284C7', accent: '#E0F2FE', paper: 'pvc', craft: 'uv', tags: ['现代', '方卡', '科技蓝'], desc: '清爽蓝色折角几何配高对比编号，展位随手交换利器。', defaultMotto: 'Bright lines, crisp work.', defaultTitle: '独立游戏制作人' },
  { id: 'G20', name: '双色视窗 Modern 20', subtitle: 'Bicolor Viewport', style: 'modern', orient: 'h', layout: 'grid', color: '#D97706', accent: '#FEF3C7', paper: 'matte', craft: 'gold', tags: ['现代', '双色', '琥珀'], desc: '高识别视窗分割，左边视觉焦点与右边高密度社交链接。', defaultMotto: 'Every frame has rhythm.', defaultTitle: '视频剪辑 / 导演' },

  // 3. Editorial (G21 - G30)
  { id: 'G21', name: '刊首社论 Editorial 21', subtitle: 'Masthead Issue', style: 'editorial', orient: 'h', layout: 'frame', color: '#1E293B', accent: '#F8FAFC', paper: 'washi', craft: 'deboss', tags: ['社论', '衬线', '杂志'], desc: '杂志刊头风格衬线大标题配细栏线，适合人文出版与摄影师。', defaultMotto: 'Stories bound in ink.', defaultTitle: '自由撰稿 / 出版主理' },
  { id: 'G22', name: '画册目录 Editorial 22', subtitle: 'Exhibition Index', style: 'editorial', orient: 'v', layout: 'clean', color: '#9F1239', accent: '#FFF1F2', paper: 'cotton', craft: 'copper', tags: ['社论', '竖版', '玫瑰金'], desc: '美术馆展览图录式纵版排版，上下对称页眉页脚。', defaultMotto: 'Curating visual silence.', defaultTitle: '美术馆策展 / 版画作者' },
  { id: 'G23', name: '双栏刊物 Editorial 23', subtitle: 'Two-Column Press', style: 'editorial', orient: 'h', layout: 'split', color: '#0F766E', accent: '#F0FDFA', paper: 'cotton', craft: 'emboss', tags: ['社论', '双栏', '棉卡'], desc: '传统报刊双栏网格结构，清晰呈现双语姓名与个性签名。', defaultMotto: 'Editorial rigor in pocket size.', defaultTitle: '平面设计 / 字体研究' },
  { id: 'G24', name: '方寸书签 Editorial 24', subtitle: 'Colophon Square', style: 'editorial', orient: 's', layout: 'frame', color: '#78350F', accent: '#FEF3C7', paper: 'washi', craft: 'copper', tags: ['社论', '方卡', '复古'], desc: '仿书籍版权页方形卡片，搭配个人网站二维码极富书卷气。', defaultMotto: 'Printed to stay.', defaultTitle: '独立出版人 / Zine 作者' },
  { id: 'G25', name: '罗马章节 Editorial 25', subtitle: 'Chapter Serif', style: 'editorial', orient: 'h', layout: 'band', color: '#312E81', accent: '#EEF2FF', paper: 'cotton', craft: 'gold', tags: ['社论', '靛蓝', '烫金'], desc: '深靛蓝标题带搭配衬线体署名，优雅而有份量。', defaultMotto: 'A new chapter in every dialogue.', defaultTitle: '艺术指导 / Art Director' },
  { id: 'G26', name: '竖栏引文 Editorial 26', subtitle: 'Pull Quote Card', style: 'editorial', orient: 'v', layout: 'frame', color: '#374151', accent: '#F9FAFB', paper: 'washi', craft: 'deboss', tags: ['社论', '竖版', '引文'], desc: '将 Slogan 放大为视觉中心，适合文字与播客创作者。', defaultMotto: 'Words carry weight.', defaultTitle: '播客主理人 / 剧作' },
  { id: 'G27', name: '秋叶画报 Editorial 27', subtitle: 'Monograph Print', style: 'editorial', orient: 'h', layout: 'duo', color: '#B45309', accent: '#FFFBEB', paper: 'washi', craft: 'gold', tags: ['社论', '暖金', '和纸'], desc: '画册扉页风格与左侧图像预留区，适配风景或静物摄影。', defaultMotto: 'Light captured quietly.', defaultTitle: '胶片摄影师' },
  { id: 'G28', name: '灰框纪实 Editorial 28', subtitle: 'Archive Sheet', style: 'editorial', orient: 'h', layout: 'grid', color: '#4B5563', accent: '#F3F4F6', paper: 'matte', craft: 'none', tags: ['社论', '档案', '细格'], desc: '档案卡片式边框标注编号与日期，信息严谨不沉闷。', defaultMotto: 'Archive #2048 · Open Studio', defaultTitle: '纪录片导演 / 剪辑' },
  { id: 'G29', name: '立式书页 Editorial 29', subtitle: 'Folio Vertical', style: 'editorial', orient: 'v', layout: 'band', color: '#065F46', accent: '#ECFDF5', paper: 'cotton', craft: 'gold', tags: ['社论', '竖版', '墨绿'], desc: '经典墨绿底眉搭配柔和米白棉卡纹理。', defaultMotto: 'Slow design, deep roots.', defaultTitle: '花艺 / 生活美学主理' },
  { id: 'G30', name: '画刊方帖 Editorial 30', subtitle: 'Square Monograph', style: 'editorial', orient: 's', layout: 'clean', color: '#881337', accent: '#FFF1F2', paper: 'pearl', craft: 'copper', tags: ['社论', '方卡', '酒红'], desc: '高贵酒红标题与微细页码标识，适配精致艺术类个人名刺。', defaultMotto: 'Edition of one.', defaultTitle: '当代首饰 / 工艺设计师' },

  // 4. Obsidian (G31 - G40)
  { id: 'G31', name: '曜石金箔 Obsidian 31', subtitle: 'Noir & Matte Gold', style: 'obsidian', orient: 'h', layout: 'monolith', color: '#F59E0B', accent: '#1E293B', bgDark: true, paper: 'black', craft: 'gold', tags: ['暗夜', '黑卡', '金箔'], desc: '450gsm 通体黑卡配哑金主标，克制而高级的暗黑美学。', defaultMotto: 'Shine softly in the dark.', defaultTitle: '视觉总监 / 3D Artist' },
  { id: 'G32', name: '冷银锋芒 Obsidian 32', subtitle: 'Titanium Edge', style: 'obsidian', orient: 'h', layout: 'split', color: '#E2E8F0', accent: '#334155', bgDark: true, paper: 'black', craft: 'silver', tags: ['暗夜', '冷银', '黑卡'], desc: '冷冽银灰字体浮于深炭黑底，科技感与力量感并存。', defaultMotto: 'Forged in monochrome.', defaultTitle: '数字艺术家 / Technical Artist' },
  { id: 'G33', name: '竖版夜航 Obsidian 33', subtitle: 'Night Pillar', style: 'obsidian', orient: 'v', layout: 'monolith', color: '#FF7600', accent: '#27272A', bgDark: true, paper: 'black', craft: 'copper', tags: ['暗夜', '竖版', '橙金'], desc: '深炭黑底面上贯穿一抹高亮霓虹橙，极具先锋记忆点。', defaultMotto: 'After hours studio.', defaultTitle: '音乐制作人 / DJ' },
  { id: 'G34', name: '紫电暗夜 Obsidian 34', subtitle: 'Ultraviolet Noir', style: 'obsidian', orient: 'h', layout: 'frame', color: '#A78BFA', accent: '#1E1B4B', bgDark: true, paper: 'black', craft: 'uv', tags: ['暗夜', '局部UV', '深紫'], desc: '深夜紫框线与局部 UV 工艺字标，适合 CG 与独立游戏团队。', defaultMotto: 'Dreaming in shaders.', defaultTitle: '游戏美术 / VFX Artist' },
  { id: 'G35', name: '黑芯方卡 Obsidian 35', subtitle: 'Obsidian Square', style: 'obsidian', orient: 's', layout: 'monolith', color: '#38BDF8', accent: '#0F172A', bgDark: true, paper: 'black', craft: 'silver', tags: ['暗夜', '方卡', '冰蓝'], desc: '方形黑卡中心十字定位标配清冷冰蓝线条。', defaultMotto: 'Zero clutter, pure depth.', defaultTitle: '硬核硬件 / 模块合成器' },
  { id: 'G36', name: '拉丝黑钛 Obsidian 36', subtitle: 'Brushed Carbon', style: 'obsidian', orient: 'h', layout: 'band', color: '#94A3B8', accent: '#1E293B', bgDark: true, paper: 'black', craft: 'brushed', tags: ['暗夜', '拉丝', '黑钛'], desc: '模拟金属拉丝质感与微凹槽，尽显工业结构理性。', defaultMotto: 'Engineered aesthetic.', defaultTitle: '工业结构 / 键帽设计' },
  { id: 'G37', name: '竖排天鹅绒 Obsidian 37', subtitle: 'Velvet Matte Black', style: 'obsidian', orient: 'v', layout: 'frame', color: '#F472B6', accent: '#27272A', bgDark: true, paper: 'black', craft: 'velvet', tags: ['暗夜', '绒膜', '竖版'], desc: '吸光触感绒膜黑卡表面搭配暗粉单色徽标。', defaultMotto: 'Velvet touch, sharp vision.', defaultTitle: '夜间人像摄影师' },
  { id: 'G38', name: '深渊翠光 Obsidian 38', subtitle: 'Emerald Shadow', style: 'obsidian', orient: 'h', layout: 'grid', color: '#34D399', accent: '#064E3B', bgDark: true, paper: 'black', craft: 'uv', tags: ['暗夜', '黑绿', '数字感'], desc: '终端网格布局与翡翠绿高亮标签，开发者与安全研究者优选。', defaultMotto: 'Code as visual craft.', defaultTitle: '系统架构 / Creative Coder' },
  { id: 'G39', name: '铜锈古墨 Obsidian 39', subtitle: 'Bronze Noir', style: 'obsidian', orient: 's', layout: 'badge', color: '#FB923C', accent: '#292524', bgDark: true, paper: 'black', craft: 'copper', tags: ['暗夜', '铜箔', '方卡'], desc: '古墨棕黑纸基与玫瑰铜箔饰条，复古重工质感。', defaultMotto: 'Tactile permanence.', defaultTitle: '皮具 / 银饰手作人' },
  { id: 'G40', name: '极夜星轨 Obsidian 40', subtitle: 'Night Orbit', style: 'obsidian', orient: 'h', layout: 'clean', color: '#FACC15', accent: '#18181B', bgDark: true, paper: 'black', craft: 'gold', tags: ['暗夜', '星轨', '烫金'], desc: '深黑夜空一侧勾勒微弧轨道线条与金色署名。', defaultMotto: 'Follow your own orbit.', defaultTitle: '天文摄影 / 星空创作者' },

  // 5. Pastel (G41 - G50)
  { id: 'G41', name: '朝露蜜桃 Pastel 41', subtitle: 'Morning Peach', style: 'pastel', orient: 'h', layout: 'clean', color: '#FB7185', accent: '#FFF1F2', paper: 'pearl', craft: 'emboss', tags: ['柔和', '渐层', '暖粉'], desc: '晨曦暖桃渐变底色与温和圆角容器，极易拉近社交距离。', defaultMotto: 'Soft light, gentle pace.', defaultTitle: '日常插画 / 绘本作者' },
  { id: 'G42', name: '薄荷晴风 Pastel 42', subtitle: 'Mint Breeze', style: 'pastel', orient: 'h', layout: 'badge', color: '#14B8A6', accent: '#F0FDFA', paper: 'matte', craft: 'uv', tags: ['柔和', '薄荷', '清爽'], desc: '低饱和薄荷青渐层，适合市集手账、贴纸与轻量化作品。', defaultMotto: 'Fresh air on every desk.', defaultTitle: '手账 / 文创设计师' },
  { id: 'G43', name: '竖版熏衣草 Pastel 43', subtitle: 'Lavender Mist', style: 'pastel', orient: 'v', layout: 'duo', color: '#8B5CF6', accent: '#F5F3FF', paper: 'pearl', craft: 'silver', tags: ['柔和', '竖版', '淡紫'], desc: '柔和香芋紫顶栏过渡至奶白底区，适配竖构图角色原画。', defaultMotto: 'Dream softly, draw boldly.', defaultTitle: '角色美术 / 原画师' },
  { id: 'G44', name: '奶油方卡 Pastel 44', subtitle: 'Cream Square', style: 'pastel', orient: 's', layout: 'clean', color: '#F59E0B', accent: '#FFFBEB', paper: 'cotton', craft: 'deboss', tags: ['柔和', '方卡', '奶黄'], desc: '暖杏奶油方形名刺，温柔色调衬托明快头像图片。', defaultMotto: 'A cup of warm inspiration.', defaultTitle: '烘焙美学 / 生活方式博主' },
  { id: 'G45', name: '晴空淡蓝 Pastel 45', subtitle: 'Skyline Wash', style: 'pastel', orient: 'h', layout: 'split', color: '#38BDF8', accent: '#F0F9FF', paper: 'matte', craft: 'silver', tags: ['柔和', '天蓝', '清新'], desc: '水彩晕染感浅天蓝分栏，清爽不抢画作本身色彩。', defaultMotto: 'Blue sky above every page.', defaultTitle: '风景水彩画师' },
  { id: 'G46', name: '樱雾渐层 Pastel 46', subtitle: 'Blossom Haze', style: 'pastel', orient: 'v', layout: 'frame', color: '#EC4899', accent: '#FDF2F8', paper: 'washi', craft: 'emboss', tags: ['柔和', '和纸', '竖版'], desc: '细腻樱花粉雾气框边配温润和纸触感。', defaultMotto: 'Gentle details matter.', defaultTitle: '服饰 / 织物设计师' },
  { id: 'G47', name: '杏橘日落 Pastel 47', subtitle: 'Apricot Glow', style: 'pastel', orient: 'h', layout: 'band', color: '#F97316', accent: '#FFF7ED', paper: 'pearl', craft: 'gold', tags: ['柔和', '珠光', '杏橘'], desc: '温柔夕阳杏橘色带配珠光卡纸质感，温暖而有礼貌。', defaultMotto: 'Warm dusk, endless craft.', defaultTitle: '动画原画 / 分镜师' },
  { id: 'G48', name: '苔藓微绿 Pastel 48', subtitle: 'Sage Leaf', style: 'pastel', orient: 's', layout: 'frame', color: '#22C55E', accent: '#F0FDF4', paper: 'cotton', craft: 'deboss', tags: ['柔和', '方卡', '豆绿'], desc: '低饱和鼠尾草绿方卡，令人舒适的自然气息。', defaultMotto: 'Grow at your own rhythm.', defaultTitle: '植物艺术 / 园艺师' },
  { id: 'G49', name: '珍珠云母 Pastel 49', subtitle: 'Iridescent Cloud', style: 'pastel', orient: 'h', layout: 'duo', color: '#6366F1', accent: '#EEF2FF', paper: 'pearl', craft: 'uv', tags: ['柔和', '珠光', '多巴胺'], desc: '微粉蓝紫柔和渐变基底配高光 UV 标签徽章。', defaultMotto: 'Soft spectrum studio.', defaultTitle: '包装与周边设计师' },
  { id: 'G50', name: '奶茶素雅 Pastel 50', subtitle: 'Oat Latte', style: 'pastel', orient: 'v', layout: 'clean', color: '#A16207', accent: '#FEFCE8', paper: 'washi', craft: 'copper', tags: ['柔和', '燕麦色', '竖版'], desc: '燕麦拿铁浅棕系配极细铜框，日常社交最耐看的选择。', defaultMotto: 'Simple, warm, genuine.', defaultTitle: '咖啡馆 / 市集品牌主理' },

  // 6. Swiss (G51 - G60)
  { id: 'G51', name: '瑞士网格 Swiss 51', subtitle: 'Helvetica Matrix', style: 'swiss', orient: 'h', layout: 'grid', color: '#DC2626', accent: '#FEF2F2', paper: 'matte', craft: 'none', tags: ['商务', '瑞士网格', '经典红'], desc: '严格 12 栏比例推导的现代秩序名刺，重点突出姓名与编号。', defaultMotto: 'Form follows clarity.', defaultTitle: '资深品牌设计 / 工作室' },
  { id: 'G52', name: '精密蓝图 Swiss 52', subtitle: 'Blueprint Spec', style: 'swiss', orient: 'h', layout: 'frame', color: '#1D4ED8', accent: '#EFF6FF', paper: 'matte', craft: 'deboss', tags: ['商务', '工程感', '蓝图'], desc: '精确坐标刻线与右上编号方块，清晰传达职业专业度。', defaultMotto: 'Structured to scale.', defaultTitle: '软件工程 / 系统咨询' },
  { id: 'G53', name: '竖版目录 Swiss 53', subtitle: 'Index Vertical', style: 'swiss', orient: 'v', layout: 'grid', color: '#0F172A', accent: '#F1F5F9', paper: 'matte', craft: 'uv', tags: ['商务', '竖版', '索引'], desc: '高对比黑白表格化字段排列，每一行联系渠道都像目录索引。', defaultMotto: 'Order in every pixel.', defaultTitle: '设计系统 / UX 架构师' },
  { id: 'G54', name: '正方标牌 Swiss 54', subtitle: 'Signage Square', style: 'swiss', orient: 's', layout: 'band', color: '#FF7600', accent: '#FFF7ED', paper: 'matte', craft: 'emboss', tags: ['商务', '方卡', '导视'], desc: '借鉴公共导视标牌的方形结构，远距依然醒目可辨。', defaultMotto: 'Direct visual signage.', defaultTitle: '展陈 / 导视设计师' },
  { id: 'G55', name: '双色年鉴 Swiss 55', subtitle: 'Annual Report', style: 'swiss', orient: 'h', layout: 'split', color: '#047857', accent: '#ECFDF5', paper: 'cotton', craft: 'silver', tags: ['商务', '年鉴风', '秩序绿'], desc: '左侧浓绿信息标头配右侧大留白联系方式清单。', defaultMotto: 'Measured impact.', defaultTitle: '商业插画 / 视觉顾问' },
  { id: 'G56', name: '横栏标签 Swiss 56', subtitle: 'Tab Header Spec', style: 'swiss', orient: 'h', layout: 'badge', color: '#334155', accent: '#F8FAFC', paper: 'matte', craft: 'brushed', tags: ['商务', '灰蓝', '实用'], desc: '稳重灰蓝顶部标栏配工整等宽编号，大厂及独立团队通用。', defaultMotto: 'Reliable craft, clear delivery.', defaultTitle: '技术美术 / 研发主管' },
  { id: 'G57', name: '竖立简报 Swiss 57', subtitle: 'Briefing Vertical', style: 'swiss', orient: 'v', layout: 'split', color: '#7C2D12', accent: '#FFF7ED', paper: 'cotton', craft: 'copper', tags: ['商务', '竖版', '红棕'], desc: '沉稳深红棕边栏搭配清晰层次感个人履历字段。', defaultMotto: 'Crafted with discipline.', defaultTitle: '独立制片 / 项目监制' },
  { id: 'G58', name: '标准方格 Swiss 58', subtitle: 'Module 54', style: 'swiss', orient: 's', layout: 'grid', color: '#4338CA', accent: '#EEF2FF', paper: 'matte', craft: 'uv', tags: ['商务', '方卡', '靛蓝'], desc: '四象限模块排布，适合同时展示二维码、昵称与作品主页。', defaultMotto: 'Modular by nature.', defaultTitle: '音视频 / 互动制作' },
  { id: 'G59', name: '极简工牌 Swiss 59', subtitle: 'Studio Pass', style: 'swiss', orient: 'v', layout: 'badge', color: '#0369A1', accent: '#F0F9FF', paper: 'pvc', craft: 'silver', tags: ['商务', '工牌感', 'PVC'], desc: '高实用度展位通卡版式，兼容挂绳孔预留视觉与大字号昵称。', defaultMotto: 'All access to good work.', defaultTitle: '活动主办 / 展会合作' },
  { id: 'G60', name: '经典黑白 Swiss 60', subtitle: 'Monochrome Grid', style: 'swiss', orient: 'h', layout: 'clean', color: '#111827', accent: '#F3F4F6', paper: 'matte', craft: 'emboss', tags: ['商务', '黑白', '经典'], desc: '经得起时间检验的黑白瑞士排版，全能无短板的个人名刺基底。', defaultMotto: 'Timeless clarity.', defaultTitle: '创意总监 / 全案设计' },
];

export const SYSTEM_TEMPLATES: CardTemplate[] = SEEDS.map((s) => ({ ...s, isCustom: false }));

export function createProjectFromTemplate(
  tpl: CardTemplate,
  existing?: Partial<CardFields>,
): CardProject {
  const now = new Date().toISOString();
  const defaultSpec: SpecId = tpl.orient === 's' ? 'sq54' : 'cn';
  const regionCrafts = createDefaultRegionCrafts(tpl.craft);
  if (tpl.regionCraftsPreset) {
    Object.assign(regionCrafts, tpl.regionCraftsPreset);
  }
  const fields: CardFields = {
    ...DEFAULT_CARD_FIELDS,
    title: tpl.defaultTitle || DEFAULT_CARD_FIELDS.title,
    motto: tpl.defaultMotto || DEFAULT_CARD_FIELDS.motto,
    ...(tpl.fieldsPreset || {}),
    ...(existing || {}),
  };
  return {
    id: `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: `${tpl.name} 作品`,
    tplId: tpl.id,
    orient: tpl.orient,
    spec: defaultSpec,
    color: tpl.color,
    accent: tpl.accent,
    bgDark: Boolean(tpl.bgDark),
    paper: tpl.paper,
    craft: tpl.craft,
    rounded: true,
    side: 'front',
    fields,
    standee: {
      ...DEFAULT_STANDEE_CONFIG,
      ...(tpl.standeePreset || {}),
    },
    regionCrafts,
    customElements: [],
    createdAt: now,
    updatedAt: now,
  };
}
