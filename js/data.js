'use strict';
/* ================= 基础数据 ================= */
const TRACK_LEN = 402.3; // 四分之一英里

const COLORS = [
  {name:'烈焰红', c:'#d43a3a'},
  {name:'深海蓝', c:'#2f6bd8'},
  {name:'珍珠白', c:'#e9e7e2'},
  {name:'曜石黑', c:'#23262d'},
  {name:'荧光绿', c:'#3fae6a'},
  {name:'落日橙', c:'#f28f35'},
  {name:'霓虹紫', c:'#8f4fd1'},
  {name:'沙漠金', c:'#d8b34a'},
  {name:'冰川青', c:'#4fc3d8'},
  {name:'樱花粉', c:'#e06a9f'},
];
const DECALS = [
  {name:'纯净无贴', id:0}, {name:'竞速条纹', id:1}, {name:'号码 07', id:2},
  {name:'街头火焰', id:3}, {name:'雷霆闪电', id:4}, {name:'五角星芒', id:5},
];
const WHEELS = [
  {name:'钢圈', id:0}, {name:'五辐运动', id:1}, {name:'十辐竞技', id:2},
  {name:'多辐网状', id:3}, {name:'金色深凹', id:4},
];

/* 外观包围套件：前包围/后包围/侧包围/尾翼/机箱盖/尾气筒 */
const KIT_OPTIONS = {
  frontBumper: {label:'🔪 前包围', items:[
    {name:'原厂包围', id:0}, {name:'竞技前铲', id:1}, {name:'碳纤前唇+风刀', id:2}, {name:'宽体进气前杠', id:3}]},
  rearBumper: {label:'🧱 后包围', items:[
    {name:'原厂包围', id:0}, {name:'碳纤扩散器', id:1}, {name:'街道后唇', id:2}, {name:'宽体后杠', id:3}]},
  sideSkirt: {label:'📐 侧包围', items:[
    {name:'原厂侧裙', id:0}, {name:'竞技侧裙', id:1}, {name:'碳纤侧裙', id:2}, {name:'宽体侧裙', id:3}]},
  wing: {label:'🛫 尾翼', items:[
    {name:'无尾翼', id:0}, {name:'小鸭尾', id:1}, {name:'GT 大尾翼', id:2}, {name:'双层竞技翼', id:3}]},
  hood: {label:'🔧 机箱盖', items:[
    {name:'原厂引擎盖', id:0}, {name:'碳纤维机盖', id:1}, {name:'中央进气开口', id:2}, {name:'散热开孔机盖', id:3}]},
  exhaust: {label:'💨 尾气筒', items:[
    {name:'原厂单出', id:0}, {name:'双出圆筒', id:1}, {name:'中出双筒', id:2}, {name:'侧出大口径', id:3}]},
  fender: {label:'🛡️ 轮眉宽体', items:[
    {name:'原厂轮拱', id:0}, {name:'竞技小宽体', id:1}, {name:'铆钉宽体', id:2}, {name:'一体碳纤宽体', id:3}]},
};
const KIT_KEYS = Object.keys(KIT_OPTIONS);

/* APEX 式改装件：车漆质感 / 大灯颜色 / 底盘霓虹（均为程序化渲染，经典车体专属） */
const FINISH_OPTIONS = [
  {name:'原厂光泽', id:0}, {name:'哑光车漆', id:1}, {name:'金属漆', id:2}, {name:'镀铬', id:3}];
const HEADLIGHT_OPTIONS = [
  {name:'暖白卤素', id:0, c:'#ffe9b0', glow:'rgba(255,230,170,'},
  {name:'冰青 HID', id:1, c:'#9fdcff', glow:'rgba(120,200,255,'},
  {name:'雾紫 LED', id:2, c:'#c9a2ff', glow:'rgba(180,140,255,'},
  {name:'黄金灯', id:3, c:'#ffd23f', glow:'rgba(255,210,63,'}];
const GLOW_OPTIONS = [
  {name:'无', id:0}, {name:'冰青', id:1, c:'#39d2ff'}, {name:'霓虹紫', id:2, c:'#8f4fd1'},
  {name:'落日橙', id:3, c:'#ff8a2a'}, {name:'荧光绿', id:4, c:'#4ade80'}, {name:'樱花粉', id:5, c:'#e06a9f'}];

/* 整车套件方案：一键应用 包围+尾翼+机盖+排气+轮毂+拉花 组合（不含涂装，可与涂装编辑器叠加） */
const PRESETS = [
  {id:'stock',  name:'原厂街道', vis:{frontBumper:0, rearBumper:0, sideSkirt:0, wing:1, hood:0, exhaust:0, wheel:1, decal:0}},
  {id:'street', name:'街头竞技', vis:{frontBumper:1, rearBumper:2, sideSkirt:1, wing:1, hood:0, exhaust:1, wheel:1, decal:1}},
  {id:'carbon', name:'碳纤性能', vis:{frontBumper:2, rearBumper:1, sideSkirt:2, wing:2, hood:1, exhaust:1, wheel:2, decal:0}},
  {id:'wide',   name:'宽体街霸', vis:{frontBumper:3, rearBumper:3, sideSkirt:3, wing:2, hood:1, exhaust:2, wheel:3, decal:4}},
  {id:'race',   name:'厂队赛车', vis:{frontBumper:2, rearBumper:1, sideSkirt:2, wing:3, hood:3, exhaust:2, wheel:4, decal:2}},
  {id:'drag',   name:'直线加速', vis:{frontBumper:1, rearBumper:1, sideSkirt:1, wing:3, hood:3, exhaust:3, wheel:2, decal:3}},
  {id:'clean',  name:'极简清洁', vis:{frontBumper:0, rearBumper:0, sideSkirt:0, wing:0, hood:0, exhaust:0, wheel:4, decal:0}},
];

/* 自定义涂装：车身图案 */
const PATTERN_OPTIONS = [
  {id:0, name:'纯净车漆'}, {id:1, name:'双色车顶'}, {id:2, name:'渐变涂装'},
  {id:3, name:'斜纹拉花'}, {id:4, name:'赛道格纹'},
];
/* 自定义贴花：形状 / 位置 / 尺寸 */
const STICKER_SHAPES = [{id:'badge',name:'圆形号牌'},{id:'star',name:'五角星'},{id:'bolt',name:'闪电'},{id:'bars',name:'斜纹块'}];
const STICKER_POS   = [{id:'front',name:'前翼子板'},{id:'door',name:'车门'},{id:'rear',name:'后翼子板'}];
const STICKER_SIZES = [{id:0,name:'小'},{id:1,name:'中'},{id:2,name:'大'}];
const STICKER_COLORS = ['#ffd23f','#f2f2f2','#ff5a5a','#39d2ff','#4ade80','#1a1c22'];
/* 各初始位置槽位的车身局部坐标（x: -2.2车尾..2.2车头，y: 0地面..-1.31车顶），贴花可在预览图中自由拖动 */
const STICKER_SLOT = {front:[1.58,-0.55], door:[0.15,-0.60], rear:[-1.18,-0.55]};

const DEFAULT_VIS = {color:1, decal:0, wheel:1,
  frontBumper:0, rearBumper:0, sideSkirt:0, wing:1, hood:0, exhaust:0, fender:0,
  pattern:0, patternColor:'#111318', custom:null, stickers:[], preset:'stock', body:'classic',
  finish:0, headlight:0, underglow:0};

/* 车体套件：经典程序化车体（支持全部涂装/贴花/包围套件自定义）+ CC0 贴图车体（原厂涂装，素材来源见 assets/README.md） */
const BODY_OPTIONS = [
  {id:'classic',    name:'经典街车', note:'支持全部涂装与贴花自定义'},
  {id:'audi',       name:'蓝色敞篷', note:'CC0 贴图车体 · 原厂涂装'},
  {id:'audi4',      name:'绯红敞篷', note:'CC0 贴图车体 · 原厂涂装'},
  {id:'truck',      name:'货运卡车', note:'CC0 贴图车体 · 原厂涂装'},
  {id:'supercar',   name:'红色超跑', note:'CC0 贴图车体 · 原厂涂装'},
  {id:'wedge_gold', name:'金色楔形', note:'CC0 贴图车体 · 原厂涂装'},
  {id:'wedge_blue', name:'蓝色楔形', note:'CC0 贴图车体 · 原厂涂装'},
];

/* 玩家当前选择 -> 完整外观对象（含自定义涂装与贴花，颜色转 hex，补齐套件字段） */
function playerVisual(save){
  const v = save.vis;
  const vis = {
    color: v.custom || COLORS[v.color].c,
    decal: v.decal, wheel: v.wheel,
    pattern: v.pattern || 0,
    patternColor: v.patternColor || '#111318',
    stickers: Array.isArray(v.stickers) ? v.stickers.slice() : [],
    finish: v.finish || 0, headlight: v.headlight || 0, underglow: v.underglow || 0,
  };
  KIT_KEYS.forEach(k => vis[k] = v[k]);
  if(v.body && v.body !== 'classic') vis.sprite = v.body; /* 贴图车体：素材缺失时 drawCar 自动回退经典车体 */
  return vis;
}
/* 对手定义 -> 完整外观对象 */
function oppVisual(opp){
  const vis = {color: opp.color, decal: opp.decal, wheel: opp.wheel};
  KIT_KEYS.forEach(k => vis[k] = (opp.kit && opp.kit[k]!==undefined) ? opp.kit[k] : (k==='wing'?1:0));
  if(opp.sprite) vis.sprite = opp.sprite; /* CC0 贴图车（素材缺失时自动回退程序化外观） */
  if(opp.underglow) vis.underglow = opp.underglow;
  if(opp.headlight) vis.headlight = opp.headlight;
  return vis;
}

const PARTS = {
  engine:  {name:'引擎',   icon:'⚙️', desc:'压榨更多马力，直接提升加速与极速。', costs:[420,900,1600,2700,4200],  effect:'+18% 扭矩 / 级'},
  turbo:   {name:'涡轮',   icon:'🌀', desc:'高转速时爆发增压扭矩，大幅拉高中后段加速与极速。', costs:[480,1000,1800,2900,4400], effect:'+10% 增压扭矩 / 级，起压更早'},
  gearbox: {name:'变速箱', icon:'🔗', desc:'换挡更快，完美换挡区间更宽，减少动力空窗。', costs:[400,850,1500,2500,3900],  effect:'-0.065s 换挡时间 / 级'},
  tire:    {name:'轮胎',   icon:'🛞', desc:'更强抓地力，减少烧胎打滑，起步区间更宽。',     costs:[350,780,1400,2300,3600],  effect:'+0.11 抓地 / 级'},
};
const PART_KEYS = ['engine','turbo','gearbox','tire'];

const TIERS = ['街头新秀','菜鸟玩家','改装学徒','夜街新贵','大排量俱乐部','街区豪门','午夜传说','职业门槛','职业联赛','车神之巅'];

/* power = 基础扭矩倍率(相对玩家初始 320Nm)；boost = 增压扭矩倍率；两者相乘≈总实力
   kit = 外观包围套件 {frontBumper, rearBumper, sideSkirt, wing, hood, exhaust} */
const OPPONENTS = [
  {name:'新手小李', car:'1.5L 代步小车', quote:'刚拿驾照三个月，来试试运气。',
   color:'#8a9bb0', wheel:0, decal:0, kit:{frontBumper:0, rearBumper:0, sideSkirt:0, wing:0, hood:0, exhaust:0},
   power:0.55, boost:0.13, grip:0.98,
   shiftTime:0.50, react:0.55, shiftErr:1100, launchErr:1300, feather:0.15, lateBounce:0.40, reward:240},

  {name:'外卖骑士·阿强', car:'老捷达 1.6', quote:'红灯是我唯一的对手。',
   color:'#5a8f5a', wheel:1, decal:1, kit:{frontBumper:1, rearBumper:0, sideSkirt:1, wing:1, hood:0, exhaust:1},
   sprite:'truck',
   power:0.80, boost:0.15, grip:1.02,
   shiftTime:0.45, react:0.45, shiftErr:800, launchErr:950, feather:0.30, lateBounce:0.30, reward:420},

  {name:'涡轮玩家·老王', car:'刷了二阶的速锐', quote:'有涡必刷，刷完必飙。',
   color:'#b0503a', wheel:1, decal:4, kit:{frontBumper:2, rearBumper:1, sideSkirt:1, wing:2, hood:2, exhaust:1, fender:1},
   power:1.10, boost:0.18, grip:1.06,
   shiftTime:0.40, react:0.38, shiftErr:620, launchErr:750, feather:0.45, lateBounce:0.22, reward:640},

  {name:'夜街女王 Mika', car:'绯红敞篷跑车', quote:'车比话多，赢我再说。',
   color:'#e06a9f', wheel:2, decal:2, kit:{frontBumper:3, rearBumper:3, sideSkirt:3, wing:2, hood:1, exhaust:2},
   sprite:'audi4',
   power:1.35, boost:0.20, grip:1.12,
   shiftTime:0.36, react:0.32, shiftErr:500, launchErr:600, feather:0.55, lateBounce:0.16, reward:880},

  {name:'大排量·东叔', car:'蓝色经典楔形跑车', quote:'涡轮？那玩意儿会坏的。',
   color:'#3a3f8f', wheel:3, decal:1, kit:{frontBumper:1, rearBumper:2, sideSkirt:1, wing:0, hood:3, exhaust:3},
   sprite:'wedge_blue',
   power:1.60, boost:0.22, grip:1.16,
   shiftTime:0.32, react:0.28, shiftErr:400, launchErr:480, feather:0.65, lateBounce:0.12, reward:1150},

  {name:'铁手·阿坤', car:'金色经典楔形跑车', quote:'十年老司机，手比脑快。',
   color:'#d8b34a', wheel:2, decal:0, kit:{frontBumper:2, rearBumper:1, sideSkirt:2, wing:3, hood:1, exhaust:2},
   sprite:'wedge_gold',
   power:1.57, boost:0.24, grip:1.18,
   shiftTime:0.28, react:0.24, shiftErr:320, launchErr:380, feather:0.75, lateBounce:0.08, reward:1450},

  {name:'夜行者 Vito', car:'午夜灰色幽灵', quote:'你凌晨三点见过我吗？',
   color:'#3d434d', wheel:3, decal:4, kit:{frontBumper:3, rearBumper:1, sideSkirt:2, wing:2, hood:1, exhaust:1},
   underglow:2,
   power:2.00, boost:0.31, grip:1.28,
   shiftTime:0.24, react:0.20, shiftErr:240, launchErr:300, feather:0.85, lateBounce:0.05, reward:1800},

  {name:'车行老板·陈董', car:'限量版敞篷跑车', quote:'钱能买到的，我都买了。',
   color:'#2f6bd8', wheel:4, decal:5, kit:{frontBumper:2, rearBumper:1, sideSkirt:2, wing:2, hood:1, exhaust:1},
   underglow:3,
   sprite:'audi',
   power:1.82, boost:0.36, grip:1.32,
   shiftTime:0.21, react:0.16, shiftErr:170, launchErr:220, feather:0.90, lateBounce:0.03, reward:2200},

  {name:'职业车手 Zero', car:'厂队规格超跑', quote:'零失误，零情绪，零意外。',
   color:'#e9e7e2', wheel:4, decal:2, kit:{frontBumper:2, rearBumper:1, sideSkirt:2, wing:3, hood:3, exhaust:2},
   sprite:'supercar',
   power:2.15, boost:0.39, grip:1.38,
   shiftTime:0.18, react:0.12, shiftErr:110, launchErr:150, feather:1.00, lateBounce:0.00, reward:2700},

  {name:'传奇·雷霆', car:'千匹直线怪物', quote:'赛道尽头，等着你的名字。',
   color:'#23262d', wheel:4, decal:3, kit:{frontBumper:3, rearBumper:1, sideSkirt:3, wing:3, hood:3, exhaust:1, fender:3},
   underglow:2,
   power:1.95, boost:0.50, grip:1.45,
   shiftTime:0.16, react:0.08, shiftErr:60, launchErr:90, feather:1.00, lateBounce:0.00, reward:3400},
];

/* ---------- 存档 ---------- */
const SAVE_KEY = 'dragKingsSaveV1';
function defaultSave(){
  return {
    coins: 600,
    up: {engine:0, turbo:0, gearbox:0, tire:0},
    vis: Object.assign({}, DEFAULT_VIS),
    beaten: Array(OPPONENTS.length).fill(false),
    best: {quarter:null, opp:Array(OPPONENTS.length).fill(null)},
    races:0, wins:0, tut:false, sound:true,
  };
}
function loadSave(){
  const d = defaultSave();
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){
      const s = JSON.parse(raw);
      Object.assign(d, s);
      d.up = Object.assign({engine:0,turbo:0,gearbox:0,tire:0}, s.up||{});
      d.vis = Object.assign({}, DEFAULT_VIS, s.vis||{});
      if(!Array.isArray(d.vis.stickers)) d.vis.stickers = [];
      d.vis.stickers = d.vis.stickers.slice(0,3).map(st=>{
        const o = Object.assign({}, st);
        if(typeof o.x!=='number' || typeof o.y!=='number'){ // 旧档迁移：槽位 -> 自由坐标
          const slot = STICKER_SLOT[o.pos] || STICKER_SLOT.door;
          o.x = slot[0]; o.y = slot[1];
        }
        o.x = Math.max(-1.9, Math.min(1.9, o.x));
        o.y = Math.max(-0.86, Math.min(-0.32, o.y));
        return o;
      });
      if(d.vis.custom && !/^#[0-9a-fA-F]{6}$/.test(d.vis.custom)) d.vis.custom = null;
      if(d.vis.patternColor && !/^#[0-9a-fA-F]{6}$/.test(d.vis.patternColor)) d.vis.patternColor = DEFAULT_VIS.patternColor;
      if(!PRESETS.some(p=>p.id===d.vis.preset)) d.vis.preset = 'custom';
      if(!BODY_OPTIONS.some(b=>b.id===d.vis.body)) d.vis.body = 'classic'; /* 车体套件迁移：非法值回经典 */
      /* APEX 式改装件字段迁移：非法值回默认 */
      const rng = (val, max, dv) => (Number.isInteger(val) && val>=0 && val<=max) ? val : dv;
      d.vis.fender = rng(d.vis.fender, 3, 0);
      d.vis.finish = rng(d.vis.finish, 3, 0);
      d.vis.headlight = rng(d.vis.headlight, 3, 0);
      d.vis.underglow = rng(d.vis.underglow, 5, 0);
      if(!Array.isArray(d.beaten) || d.beaten.length!==OPPONENTS.length) d.beaten = defaultSave().beaten;
      if(!d.best || !Array.isArray(d.best.opp) || d.best.opp.length!==OPPONENTS.length) d.best = defaultSave().best;
    }
  }catch(e){}
  return d;
}
function persistSave(s){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }catch(e){}
}
