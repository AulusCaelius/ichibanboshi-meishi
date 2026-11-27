export type TemplateStyle =
  | 'minimal'
  | 'modern'
  | 'editorial'
  | 'obsidian'
  | 'pastel'
  | 'swiss';

export type TemplateOrient = 'h' | 'v' | 's';

export type PaperStockId =
  | 'matte'
  | 'cotton'
  | 'pearl'
  | 'black'
  | 'washi'
  | 'pvc';

export type SurfaceCraftId =
  | 'none'
  | 'gold'
  | 'silver'
  | 'copper'
  | 'emboss'
  | 'deboss'
  | 'uv'
  | 'velvet'
  | 'brushed';

export type SpecId = 'cn' | 'jp' | 'eu' | 'us' | 'sq54' | 'sq65';

export type RenderEnvId = 'studio' | 'stage' | 'sunlit';

export type EditableRegionId =
  | 'frontBg'
  | 'decor'
  | 'name'
  | 'enName'
  | 'title'
  | 'company'
  | 'codeTag'
  | 'eventTag'
  | 'x'
  | 'weibo'
  | 'bilibili'
  | 'xhs'
  | 'website'
  | 'motto'
  | 'backBg'
  | 'backTitle'
  | 'qr';

export type RegionCraftsMap = Record<EditableRegionId, SurfaceCraftId>;

export interface CardFields {
  name: string;
  enName: string;
  title: string;
  company: string;
  codeTag: string;
  eventTag: string;
  x: string;
  weibo: string;
  bilibili: string;
  xhs: string;
  website: string;
  motto: string;
  backTitle: string;
  qrUrl: string;
}

export interface StandeeConfig {
  enabled: boolean;
  dataUrl: string;
  fit: 'contain' | 'cover';
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
  radius: number;
  craft: SurfaceCraftId;
}

export interface CanvasElement {
  id: string;
  side: 'front' | 'back';
  type: 'text' | 'image' | 'rect' | 'circle' | 'pill' | 'qr';
  label?: string;
  text?: string;
  src?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  bg?: string;
  radius?: number;
  opacity?: number;
  craft?: SurfaceCraftId;
  locked?: boolean;
  hidden?: boolean;
}

export interface H5Config {
  bio: string;
  layout: 'card' | 'poster' | 'list';
  slug: string;
  showSns: {
    x: boolean;
    weibo: boolean;
    bilibili: boolean;
    xhs: boolean;
    website: boolean;
  };
}

export interface CardStats {
  pv: number;
  saves: number;
  trend: number[];
}

export interface CardTemplate {
  id: string;
  name: string;
  subtitle: string;
  style: TemplateStyle;
  orient: TemplateOrient;
  layout: string;
  sides?: 1 | 2;
  badge?: 'NEW' | 'HOT' | '烫金';
  color: string;
  accent: string;
  bgDark?: boolean;
  paper: PaperStockId;
  craft: SurfaceCraftId;
  tags: string[];
  desc: string;
  defaultMotto: string;
  defaultTitle: string;
  isCustom?: boolean;
  baseTemplateId?: string;
  createdAt?: string;
  updatedAt?: string;
  fieldsPreset?: Partial<CardFields>;
  regionCraftsPreset?: Partial<RegionCraftsMap>;
  standeePreset?: Partial<StandeeConfig>;
}

export interface CardProject {
  id: string;
  title: string;
  tplId: string;
  orient: TemplateOrient;
  sides: 1 | 2;
  spec: SpecId;
  color: string;
  accent: string;
  bgDark: boolean;
  paper: PaperStockId;
  frontPaper?: PaperStockId;
  backPaper?: PaperStockId;
  craft: SurfaceCraftId;
  rounded: boolean;
  cornerMm: 0 | 3 | 5;
  showQr: boolean;
  side: 'front' | 'back';
  fields: CardFields;
  standee: StandeeConfig;
  regionCrafts: RegionCraftsMap;
  customElements: CanvasElement[];
  h5: H5Config;
  stats: CardStats;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile {
  nickname: string;
  roleTitle: string;
  tantou?: string;
  tantouColor?: string;
  studioName: string;
  x: string;
  weibo?: string;
  bilibili: string;
  xhs?: string;
  website: string;
  motto: string;
  updatedAt: string;
}

export interface PrefillState {
  name: string;
  title: string;
  company: string;
  accentColor: string;
  enabled: boolean;
}

export interface WorkspaceBackup {
  format: 'ichiban-workspace-backup';
  version: 2;
  exportedAt: string;
  profile: CreatorProfile;
  favorites: string[];
  works: CardProject[];
  customTemplates: CardTemplate[];
  activeProjectId?: string;
}

export interface SingleCardFile {
  format: 'ichiban-card';
  version: 2;
  exportedAt: string;
  card: CardProject;
}

export interface SingleTemplateFile {
  format: 'ichiban-template';
  version: 2;
  exportedAt: string;
  template: CardTemplate;
}

export interface SpecMeta {
  id: SpecId;
  name: string;
  w: number;
  h: number;
  ratio: number;
  orient: TemplateOrient;
  note: string;
}

export interface StockMeta {
  id: PaperStockId;
  name: string;
  gsm: string;
  desc: string;
}

export interface CraftMeta {
  id: SurfaceCraftId;
  name: string;
  badge: string;
  desc: string;
}

export interface RegionMeta {
  id: EditableRegionId;
  label: string;
  side: 'front' | 'back';
  group: string;
}

export interface IdolPreset {
  id: string;
  name: string;
  short: string;
  color: string;
  light?: boolean;
}
