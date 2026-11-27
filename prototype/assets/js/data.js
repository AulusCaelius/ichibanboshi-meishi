/* ==========================================================
   一番星 · 制作人名片设计平台 (v0.3) 预设模板与示例数据
   ========================================================== */

window.IchibanData = (function () {
  const IDOLS = [
    { name: '花海咲季', initial: '咲', color: '#E30F25', light: false },
    { name: '月村手毬', initial: '手', color: '#0C7BBB', light: false },
    { name: '藤田ことね', initial: 'こ', color: '#F8C112', light: true },
    { name: '有村麻央', initial: '麻', color: '#7F1184', light: false },
    { name: '葛城リーリヤ', initial: 'リ', color: '#EAFDFF', light: true },
    { name: '倉本千奈', initial: '千', color: '#F68B1F', light: false },
    { name: '紫雲清夏', initial: '清', color: '#7CFC00', light: true },
    { name: '篠澤広', initial: '広', color: '#00AFCC', light: false },
    { name: '姫崎莉波', initial: '莉', color: '#F6ADC6', light: true },
    { name: '花海佑芽', initial: '佑', color: '#EA533A', light: false },
    { name: '秦谷美鈴', initial: '美', color: '#7A99CF', light: false },
    { name: '十王星南', initial: '星', color: '#F6AE54', light: false },
    { name: '雨夜燕', initial: '燕', color: '#7B68EE', light: false }
  ];

  const TEMPLATES = [
    {
      id: 'T01',
      name: '第一名只能是我',
      jp: '一番は譲らない',
      idol: '花海咲季',
      initial: '咲',
      color: '#E30F25',
      persona: '不服输、首席入学、完美主义的姐姐',
      inspiration: '首席气场＋个人曲「Fighting My Way」＋支援卡台词体（如「相手にとって不足なしよ！」语感）',
      style: 'stage',
      styleLabel: '舞台',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '烫金',
      badges: ['HOT']
    },
    {
      id: 'T02',
      name: '不坦率的月光',
      jp: 'Luna say maybe',
      idol: '月村手毬',
      initial: '手',
      color: '#0C7BBB',
      persona: '歌唱力出众、嘴硬心软、爱吃拉面',
      inspiration: '个人曲＋傲娇语气',
      style: 'starlight',
      styleLabel: '星光',
      orient: 'v',
      sides: 2,
      layoutLabel: '竖版双面',
      craft: '烫银',
      badges: []
    },
    {
      id: 'T03',
      name: '世界第一可爱的我',
      jp: '世界一可愛い私',
      idol: '藤田ことね',
      initial: 'こ',
      color: '#F8C112',
      persona: '元气小恶魔、立志赚大钱、勤工俭学',
      inspiration: '个人曲＋支援卡「デ、デートのお誘い！？」语感',
      style: 'dreamy',
      styleLabel: '梦幻',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '镭射覆膜',
      badges: ['NEW']
    },
    {
      id: 'T04',
      name: '王子殿下的萤石',
      jp: 'Fluorite',
      idol: '有村麻央',
      initial: '麻',
      color: '#7F1184',
      persona: '宿舍长、帅气王子系、偷偷喜欢可爱事物',
      inspiration: '个人曲＋王子印象',
      style: 'stage',
      styleLabel: '舞台',
      orient: 'v',
      sides: 2,
      layoutLabel: '竖版双面',
      craft: '烫金',
      badges: ['烫金']
    },
    {
      id: 'T05',
      name: '越过那条白线',
      jp: '白線',
      idol: '葛城リーリヤ',
      initial: 'リ',
      color: '#EAFDFF',
      persona: '瑞典留学生、温柔内向、热爱日本御宅文化',
      inspiration: '个人曲＋起跑线意象',
      style: 'minimal',
      styleLabel: '极简',
      orient: 'h',
      sides: 1,
      layoutLabel: '横版单面',
      craft: '凹凸压纹',
      badges: []
    },
    {
      id: 'T06',
      name: '大小姐的奇妙音阶',
      jp: 'Wonder Scale',
      idol: '倉本千奈',
      initial: '千',
      color: '#F68B1F',
      persona: '天然大小姐、乐观直率、从倒数第一出发',
      inspiration: '个人曲＋支援卡「お嬢様、失礼いたします」语感',
      style: 'gakuen',
      styleLabel: '学园',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '烫金',
      badges: ['烫金']
    },
    {
      id: 'T07',
      name: '再向前一步',
      jp: 'Tame-Lie-One-Step',
      idol: '紫雲清夏',
      initial: '清',
      color: '#7CFC00',
      persona: '开朗辣妹、社交达人、藏着旧伤的坚强',
      inspiration: '个人曲',
      style: 'gakuen',
      styleLabel: '学园',
      orient: 'v',
      sides: 1,
      layoutLabel: '竖版单面',
      craft: '局部 UV',
      badges: []
    },
    {
      id: 'T08',
      name: '最不适合我的那条路',
      jp: '光景',
      idol: '篠澤広',
      initial: '広',
      color: '#00AFCC',
      persona: '跳级天才、体力垫底、享受挑战极限',
      inspiration: '个人曲＋「选最不适合自己的路」动机',
      style: 'minimal',
      styleLabel: '极简',
      orient: 'h',
      sides: 1,
      layoutLabel: '横版单面',
      craft: '烫银',
      badges: []
    },
    {
      id: 'T09',
      name: '青梅竹马的小把戏',
      jp: 'clumsy trick',
      idol: '姫崎莉波',
      initial: '莉',
      color: '#F6ADC6',
      persona: '包容力满分的大姐姐、青梅竹马、称呼「弟くん」',
      inspiration: '个人曲',
      style: 'dreamy',
      styleLabel: '梦幻',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '珠光纸',
      badges: []
    },
    {
      id: 'T10',
      name: '全力冲向姐姐！',
      jp: 'お姉ちゃん、待ってて！',
      idol: '花海佑芽',
      initial: '佑',
      color: '#EA533A',
      persona: '元气满满、体力派、追逐姐姐的妹妹',
      inspiration: '姐妹羁绊＋体力系印象',
      style: 'gakuen',
      styleLabel: '学园',
      orient: 's',
      sides: 2,
      layoutLabel: '方形双面',
      craft: '局部 UV',
      badges: []
    },
    {
      id: 'T11',
      name: '午睡的千层派',
      jp: 'すやすやマイペース',
      idol: '秦谷美鈴',
      initial: '美',
      color: '#7A99CF',
      persona: '慵懒爱睡、我行我素、实力深藏不露',
      inspiration: '午睡与甜点意象＋与手毬的羁绊',
      style: 'formal',
      styleLabel: '正装',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '无工艺（哑光）',
      badges: []
    },
    {
      id: 'T12',
      name: '一番星（旗舰）',
      jp: '小さな野望',
      idol: '十王星南',
      initial: '星',
      color: '#F6AE54',
      persona: '学生会长、顶级偶像「一番星」、孤高完美',
      inspiration: '「一番星」称号（与平台同名）＋个人曲',
      style: 'starlight',
      styleLabel: '星光',
      orient: 'h',
      sides: 2,
      layoutLabel: '横版双面',
      craft: '烫金',
      badges: ['HOT', '烫金']
    },
    {
      id: 'T13',
      name: '理论武装',
      jp: '理論武装して',
      idol: '雨夜燕',
      initial: '燕',
      color: '#7B68EE',
      persona: '严于律己、学园 No.2、凛然冷静',
      inspiration: '个人曲',
      style: 'formal',
      styleLabel: '正装',
      orient: 'v',
      sides: 2,
      layoutLabel: '竖版双面',
      craft: '烫银',
      badges: ['NEW']
    }
  ];

  const POPULAR_ORDER = [
    'T12', 'T01', 'T03', 'T02', 'T04', 'T06', 'T09',
    'T08', 'T05', 'T07', 'T10', 'T11', 'T13'
  ];

  const PICKUP_IDS = ['T12', 'T01', 'T02', 'T03', 'T04', 'T06', 'T08', 'T09'];

  const PLACEHOLDER = {
    name: '制作人Producer',
    title: '〇〇担当',
    company: '初星学園',
    sns: 'X @your_id'
  };

  const ACTIVE = {
    name: '制作人Producer',
    title: '花海咲季担当',
    company: '初星学園',
    sns: 'X @hatsuboshi_p'
  };

  const LONG = {
    name: '制作人Producer（初星学園プロデューサー科 首席）',
    title: '花海咲季・花海佑芽 姉妹担当',
    company: '765プロダクション × 初星学園 合同プロデュース部',
    sns: 'X @hatsuboshi_765_joint_producer'
  };

  return {
    IDOLS,
    TEMPLATES,
    POPULAR_ORDER,
    PICKUP_IDS,
    PLACEHOLDER,
    ACTIVE,
    LONG
  };
})();
