'use strict';
/* 用 node-canvas 真渲染 drawCar，输出套件对照图供人工目检 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const root = path.join(__dirname, '..');
const code = ['data.js', 'physics.js', 'render.js'].map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
const exp = {};
new Function('window', 'performance', 'module',
  code + '\n;module.exports = {drawCar, COLORS, KIT_OPTIONS, KIT_KEYS, oppVisual, OPPONENTS, playerVisual, PRESETS, PATTERN_OPTIONS};')(
  {}, {now: () => Date.now()}, exp);
const D = exp.exports;

function sheet(filename, title, cells, cols, pitchX, pitchY, scale) {
  const rows = Math.ceil(cells.length / cols);
  const W = cols * pitchX + 60, H = rows * pitchY + 90;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#161c2b'); g.addColorStop(1, '#0b0e15');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,220,120,0.75)';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(title, 28, 40);
  cells.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = 60 + pitchX * col + pitchX / 2, y = 90 + pitchY * row + pitchY / 2 - 12;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeRect(x - pitchX / 2 + 8, y - pitchY / 2 + 4, pitchX - 16, pitchY - 34);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(c.label, x, y + pitchY / 2 - 22);
    D.drawCar(ctx, x, y, scale, c.vis, -0.35, {lights: true, noFlame: true});
    ctx.restore();
  });
  fs.writeFileSync(path.join(root, 'test', filename), cv.toBuffer('image/png'));
  console.log('written', filename);
}

const B = (over) => Object.assign({color: '#d43a3a', decal: 0, wheel: 1,
  frontBumper: 0, rearBumper: 0, sideSkirt: 0, wing: 1, hood: 0, exhaust: 0,
  pattern: 0, patternColor: '#ffd23f', stickers: []}, over);

sheet('kit_f.png', '前包围 · 机箱盖（基线=原厂）', [
  {vis: B({}), label: '基线：原厂包围+原厂机盖'},
  {vis: B({frontBumper: 1}), label: '前包围 竞技前铲'},
  {vis: B({frontBumper: 2}), label: '前包围 碳纤前唇+风刀'},
  {vis: B({frontBumper: 3}), label: '前包围 宽体进气前杠'},
  {vis: B({hood: 0, color: '#e9e7e2'}), label: '机盖 原厂（基线）'},
  {vis: B({hood: 1, color: '#e9e7e2'}), label: '机盖 碳纤维机盖'},
  {vis: B({hood: 2, color: '#e9e7e2'}), label: '机盖 中央进气开口'},
  {vis: B({hood: 3, color: '#e9e7e2'}), label: '机盖 散热开孔机盖'},
], 4, 300, 220, 50);

sheet('kit_r.png', '后包围 · 侧包围 · 尾翼', [
  {vis: B({color: '#2f6bd8', rearBumper: 1}), label: '后包围 碳纤扩散器'},
  {vis: B({color: '#2f6bd8', rearBumper: 2}), label: '后包围 街道后唇'},
  {vis: B({color: '#2f6bd8', rearBumper: 3}), label: '后包围 宽体后杠'},
  {vis: B({color: '#2f6bd8', sideSkirt: 1}), label: '侧包围 竞技侧裙'},
  {vis: B({color: '#2f6bd8', sideSkirt: 2}), label: '侧包围 碳纤侧裙'},
  {vis: B({color: '#2f6bd8', sideSkirt: 3}), label: '侧包围 宽体侧裙'},
  {vis: B({color: '#2f6bd8', wing: 0}), label: '尾翼 无尾翼'},
  {vis: B({color: '#2f6bd8', wing: 2}), label: '尾翼 GT 大尾翼'},
  {vis: B({color: '#2f6bd8', wing: 3}), label: '尾翼 双层竞技翼'},
], 3, 300, 220, 50);

sheet('kit_e.png', '尾气筒 · 组合 · 对手车辆', [
  {vis: B({color: '#f28f35', exhaust: 0}), label: '排气 原厂单出'},
  {vis: B({color: '#f28f35', exhaust: 1}), label: '排气 双出圆筒'},
  {vis: B({color: '#f28f35', exhaust: 2}), label: '排气 中出双筒'},
  {vis: B({color: '#f28f35', exhaust: 3}), label: '排气 侧出大口径'},
  {vis: B({color: '#3fae6a', decal: 1, wheel: 2, frontBumper: 3, rearBumper: 3, sideSkirt: 3, wing: 2, hood: 1, exhaust: 2}), label: '宽体全家福'},
  {vis: B({color: '#8f4fd1', decal: 4, wheel: 4, frontBumper: 2, rearBumper: 1, sideSkirt: 2, wing: 3, hood: 2, exhaust: 1}), label: '街道性能组合'},
  {vis: D.oppVisual(D.OPPONENTS[9]), label: '对手[9] 传奇·雷霆'},
  {vis: D.oppVisual(D.OPPONENTS[4]), label: '对手[4] 大排量·东叔'},
  {vis: D.oppVisual(D.OPPONENTS[0]), label: '对手[0] 新手小李'},
  {vis: D.oppVisual(D.OPPONENTS[3]), label: '对手[3] Mika'},
  {vis: D.oppVisual(D.OPPONENTS[5]), label: '对手[5] 铁手·阿坤'},
  {vis: D.oppVisual(D.OPPONENTS[8]), label: '对手[8] Zero'},
], 4, 300, 220, 50);

/* 整车套件方案（用统一橙色涂装渲染，模拟玩家自定义涂装叠加方案） */
sheet('kit_p.png', '整车套件方案（叠加自定义橙色涂装）', D.PRESETS.map(p => ({
  vis: Object.assign(B({color: '#f28f35'}), p.vis),
  label: '方案 ' + p.name,
})), 4, 300, 220, 50);

/* 自定义涂装：图案 + 贴花 */
sheet('kit_s.png', '自定义涂装 · 车身图案与贴花', [
  {vis: B({pattern: 1}), label: '图案 双色车顶(金)'},
  {vis: B({pattern: 2}), label: '图案 渐变涂装(金)'},
  {vis: B({pattern: 3}), label: '图案 斜纹拉花(金)'},
  {vis: B({pattern: 4}), label: '图案 赛道格纹(金)'},
  {vis: B({stickers: [{shape: 'badge', text: '07', color: '#ffd23f', pos: 'door', size: 1}]}), label: '贴花 号牌 07 车门'},
  {vis: B({stickers: [{shape: 'star', color: '#ffd23f', pos: 'front', size: 2}]}), label: '贴花 五角星 前翼子板 大'},
  {vis: B({stickers: [{shape: 'bolt', color: '#39d2ff', pos: 'rear', size: 1}]}), label: '贴花 闪电 后翼子板'},
  {vis: B({stickers: [{shape: 'bars', color: '#f2f2f2', pos: 'door', size: 1}]}), label: '贴花 斜纹块 车门'},
  {vis: B({color: '#123456', pattern: 3, patternColor: '#ffd23f', stickers: [
    {shape: 'badge', text: '88', color: '#ffd23f', pos: 'door', size: 1},
    {shape: 'star', color: '#ff5a5a', pos: 'front', size: 0},
  ], decal: 0, wheel: 2, frontBumper: 2, rearBumper: 1, sideSkirt: 2, wing: 2, hood: 1, exhaust: 1}), label: '综合示例：自定义色+斜纹+双贴花+套件'},
  {vis: B({color: '#e9e7e2', pattern: 1, patternColor: '#1a1c22', stickers: [
    {shape: 'badge', text: '7', color: '#1a1c22', pos: 'door', size: 2},
  ]}), label: '白色+黑顶+黑号牌'},
], 4, 300, 220, 50);
