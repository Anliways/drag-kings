'use strict';
/* 无头 DOM 集成测试：完整 UI 流程（菜单→赛事→比赛→结算→车库→存档） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* Canvas 2D 桩：所有方法可调用、属性可写 */
function makeCtx2D() {
  const grad = { addColorStop: () => {} };
  return new Proxy({}, {
    get(_, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'canvas') return null;
      return () => {};
    },
    set() { return true; },
  });
}

const dom = new JSDOM(html, {
  url: 'http://127.0.0.1:8901/index.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx2D(); };
    if (!window.CanvasRenderingContext2D) {
      window.CanvasRenderingContext2D = function () {};
    }
    window.devicePixelRatio = 1;
    window.confirm = () => true;
  },
});
const { window } = dom;
const { document } = window;

/* 手动驱动 rAF 时钟 */
let rafCbs = [];
window.requestAnimationFrame = cb => { rafCbs.push(cb); return rafCbs.length; };
window.performance.now = () => simTime;
let simTime = 0;
function pump(frames, dtMs = 16.7) {
  for (let i = 0; i < frames; i++) {
    simTime += dtMs;
    const cbs = rafCbs; rafCbs = [];
    for (const cb of cbs) cb(simTime);
  }
}
const errors = [];
window.addEventListener('error', e => errors.push(String(e.message)));

/* 载入游戏脚本：拼成单次 eval 以共享顶层 const 作用域，并导出句柄 */
const scripts = ['assets.js', 'data.js', 'audio.js', 'physics.js', 'render.js', 'ui.js', 'game.js'];
const allCode = scripts.map(s => fs.readFileSync(path.join(root, 'js', s), 'utf8')).join('\n')
  + `\n;window.__T = {UI, Game, AudioSys, Render, GameAssets, loadSave, P, CarSim, statsFromUpgrades, playerVisual, PRESETS, PATTERN_OPTIONS, STICKER_SHAPES, OPPONENTS, TRACK_LEN};`;
window.eval(allCode);
const T = () => window.__T;

let failed = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); failed++; } else console.log('  ✓ ' + msg); };
const $ = id => document.getElementById(id);
const visible = id => !$(id).classList.contains('hidden');

console.log('=== 启动与主菜单 ===');
pump(5);
ok(errors.length === 0, '无 JS 错误 ' + (errors.length ? JSON.stringify(errors) : ''));
ok(window.__T.UI && window.__T.Game, '游戏对象已创建');

console.log('=== 客户端外壳（启动画面/PWA） ===');
ok(!!document.querySelector('link[rel="manifest"]'), 'manifest 已声明（可安装为应用）');
ok(JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')).orientation === 'any', 'manifest 允许横竖屏双方向');
ok(!!$('bootScreen') && visible('bootScreen'), '启动画面显示');
ok(!!$('btnFs'), '全屏按钮就位');
ok(visible('screenMenu'), '主菜单在启动画面之下就绪');
$('bootScreen').dispatchEvent(new window.Event('pointerdown', {bubbles: true}));
pump(40); // 500ms 淡出计时
ok(!visible('bootScreen'), '点击后启动画面淡出（音频解锁时机）');

ok(visible('screenMenu'), '主菜单可见');
ok($('menuStats').textContent.includes('性能分'), '菜单显示性能统计');

console.log('=== 进入赛事列表 ===');
window.__T.AudioSys.ensure = () => false; // jsdom 无音频
$('btnPlay').click();
pump(2);
ok(visible('screenEvents') && !visible('screenMenu'), '赛事列表已显示');
ok($('eventList').children.length === 10, '10 个对手条目');
ok($('eventList').children[0].querySelector('button[data-i]') != null, '第 1 场可挑战');
ok($('eventList').children[1].querySelector('button[data-i]') == null, '第 2 场已锁');

console.log('=== 开始比赛（含首场教学） ===');
$('eventList').children[0].querySelector('button[data-i]').click();
pump(2);
ok(window.__T.Game.state === 'race', '进入比赛状态');
ok(visible('tutorialOverlay'), '首次教学弹出');
$('btnTutClose').click();
pump(2);
ok(!visible('tutorialOverlay'), '教学关闭后开跑');
ok(!visible('raceHud') === false, '比赛 HUD 显示');

/* 跳过倒数 + 自动完美驾驶 */
window.DR.skipStaging();
window.DR.auto(true);
pump(60);
ok(window.__T.Game.race.phase === 'racing', '绿灯亮起，比赛进行中');
ok(window.__T.Game.race.lights.g === true, '绿灯状态正确');

/* 主动式氮气 */
window.dispatchEvent(new window.KeyboardEvent('keydown', {code: 'KeyN'}));
pump(30); // ≈0.5s
const psim = window.__T.Game.race.player.sim;
ok(psim.nitroActive === true && psim.nitroTank < 1, '按住 N 释放氮气（氮气罐消耗）');
window.dispatchEvent(new window.KeyboardEvent('keyup', {code: 'KeyN'}));
pump(10);
ok(psim.nitroActive === false && psim.nitroTank > 0, '松开 N 停止喷射（剩余氮气保留）');

/* CC0 素材集成（贴图车 + 软烟雾） */
{
  const GA = window.__T.GameAssets;
  ok(GA && typeof GA === 'object' && Array.isArray(GA.smoke), '素材注册表 GameAssets 存在');
  ok(GA.ready === true && GA.cars.audi && GA.cars.truck && GA.cars.supercar
     && GA.cars.audi4 && GA.cars.wedge_gold && GA.cars.wedge_blue, '六辆贴图车与烟雾贴图已注册');
  ok(window.__T.OPPONENTS[1].sprite === 'truck' && window.__T.OPPONENTS[7].sprite === 'audi'
     && window.__T.OPPONENTS[8].sprite === 'supercar', '三名对手已配置贴图车');
  ok(window.__T.OPPONENTS[3].sprite === 'audi4' && window.__T.OPPONENTS[4].sprite === 'wedge_blue'
     && window.__T.OPPONENTS[5].sprite === 'wedge_gold', 'Mika/东叔/阿坤 已配置贴图车');
  /* jsdom 图片不加载 → 现场比赛渲染已走程序化回退（不崩溃即通过） */
  /* 伪造贴图已加载，验证贴图分支渲染不崩溃 */
  const truckImg = GA.cars.truck.img;
  GA.cars.truck.img = {complete: true, naturalWidth: 1051, naturalHeight: 335};
  pump(10);
  GA.cars.truck.img = truckImg;
  ok(window.__T.Game.race.phase !== undefined, '贴图车分支渲染不崩溃（伪造加载图片）');
}

/* 横竖屏切换：布局平滑重排 + 比赛状态不丢失 */
{
  console.log('=== 横竖屏切换 ===');
  const w0=window.innerWidth, h0=window.innerHeight;
  const xBefore=psim.x;
  Object.defineProperty(window, 'innerWidth', {value: 390, configurable: true});
  Object.defineProperty(window, 'innerHeight', {value: 844, configurable: true});
  window.dispatchEvent(new window.Event('resize'));
  pump(6);
  ok(window.__T.Render.W===390 && window.__T.Render.H===844, '渲染器已切到竖屏度量（390×844）');
  ok(window.__T.Game.race.phase==='racing' && psim.finishT===null, '竖屏下比赛状态保持');
  ok(psim.x > xBefore, '竖屏下比赛继续推进（物理与布局解耦）');
  Object.defineProperty(window, 'innerWidth', {value: w0, configurable: true});
  Object.defineProperty(window, 'innerHeight', {value: h0, configurable: true});
  window.dispatchEvent(new window.Event('resize'));
  pump(6);
  ok(errors.length===0, '横竖屏往返切换全程无 JS 错误');
}

console.log('=== 等待比赛结束 ===');
for (let i = 0; i < 60 && window.__T.Game.race.phase !== 'over'; i++) pump(60); // 最多 ~60s 模拟
pump(120);
ok(window.__T.Game.state === 'result', '比赛进入结算');
ok(visible('screenResult'), '结算面板显示');
const panelText = $('resultPanel').textContent;
ok(panelText.includes('胜利') || panelText.includes('惜败'), '结算显示胜负: ' + (panelText.includes('胜利') ? '胜利' : '惜败'));
ok(/合计获得/.test(panelText), '结算显示金币明细');
const coinsAfter1 = window.__T.UI.save.coins;
ok(coinsAfter1 > 600, `结算后金币增加 (${coinsAfter1})`);
ok(window.__T.UI.save.races === 1, '场次记录 +1');
ok(window.__T.UI.save.beaten[0] === true, '对手[0]标记为已击败');
ok(window.__T.UI.save.best.opp[0] != null, '对手[0]最佳成绩已记录');

console.log('=== 结算按钮 ===');
$('btnResBack').click();
pump(2);
ok(visible('screenEvents'), '返回赛事列表');
ok($('eventList').children[1].querySelector('button[data-i]') != null, '击败后解锁第 2 场');

console.log('=== 车库：性能改装 ===');
$('btnGarageBack') /* 占位 */;
document.querySelector('#screenEvents .topbar .btn').click(); // ← 返回
pump(2);
$('btnGarage').click();
pump(2);
ok(visible('screenGarage'), '车库已显示');
ok($('partGrid').children.length === 4, '4 个改装部件卡片');
const engineCard = $('partGrid').children[0];
const buyBtn = engineCard.querySelector('button');
ok(!buyBtn.disabled, '引擎可购买');
const coinsBefore = window.__T.UI.save.coins;
buyBtn.click();
pump(2);
ok(window.__T.UI.save.up.engine === 1, '引擎升至 LV1');
ok(window.__T.UI.save.coins === coinsBefore - 420, `金币扣除正确 (${coinsBefore}→${window.__T.UI.save.coins})`);
ok($('garageEstimate').textContent.includes('0-100'), '性能预估已刷新');

console.log('=== 车库：外观定制 ===');
$('tabVis').click();
pump(2);
const swatches = document.querySelectorAll('#visPane .swatch[data-k="color"]');
ok(swatches.length === 10, '10 种预设车身颜色');
swatches[6].click(); // 霓虹紫
pump(2);
const chips = document.querySelectorAll('#visPane .chip[data-k="decal"]');
ok(chips.length === 6, '6 种贴纸');
chips[3].click(); // 街头火焰
pump(2);
ok(window.__T.UI.save.vis.color === 6 && window.__T.UI.save.vis.decal === 3, '外观选择已保存到内存');

console.log('=== 车库：外观包围套件 ===');
const groups = document.querySelectorAll('#visPane .vis-group');
ok(groups.length === 16, '16 个外观分组（车体/灯光/方案/涂装/漆面/图案/贴花/拉花/轮毂 + 7 个套件部件）');
ok(document.querySelectorAll('#visPane .chip[data-b]').length === 7, '车体套件提供 7 个选项（经典 + 6 贴图车体）');
ok(window.__T.UI.save.vis.body === 'classic' || window.__T.UI.save.vis.body == null, '默认车体为经典街车');
ok(document.querySelectorAll('#visPane .chip[data-k="fender"]').length === 4, '轮眉宽体提供 4 个选项');
ok(document.querySelectorAll('#visPane .chip[data-k="finish"]').length === 4, '车漆质感提供 4 个选项');
ok(document.querySelectorAll('#visPane .chip[data-k="headlight"]').length === 4, '大灯颜色提供 4 个选项');
ok(document.querySelectorAll('#visPane .chip[data-k="underglow"]').length === 6, '底盘霓虹提供 6 个选项');
['frontBumper','rearBumper','sideSkirt','wing','hood','exhaust'].forEach(k=>{
  ok(document.querySelectorAll(`#visPane .chip[data-k="${k}"]`).length === 4, `${k} 提供 4 个选项`);
});
document.querySelector('#visPane .chip[data-k="wing"][data-v="2"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="frontBumper"][data-v="2"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="exhaust"][data-v="3"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="hood"][data-v="1"]').click(); pump(2);
ok(window.__T.UI.save.vis.wing===2 && window.__T.UI.save.vis.frontBumper===2
   && window.__T.UI.save.vis.exhaust===3 && window.__T.UI.save.vis.hood===1, '套件选择已应用（预览即时重绘）');
/* APEX 式改装件 */
document.querySelector('#visPane .chip[data-k="finish"][data-v="3"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="fender"][data-v="2"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="underglow"][data-v="1"]').click(); pump(2);
document.querySelector('#visPane .chip[data-k="headlight"][data-v="1"]').click(); pump(2);
ok(window.__T.UI.save.vis.finish===3 && window.__T.UI.save.vis.fender===2
   && window.__T.UI.save.vis.underglow===1 && window.__T.UI.save.vis.headlight===1, 'APEX 改装件选择已应用');
const pvA = window.__T.playerVisual(window.__T.UI.save);
ok(pvA.finish===3 && pvA.fender===2 && pvA.underglow===1 && pvA.headlight===1, 'playerVisual 输出新改装件字段');
ok(JSON.parse(window.localStorage.getItem('dragKingsSaveV1')).vis.wing === 2, '套件选择已写入 localStorage');
ok(window.__T.loadSave().vis.wing===2 && window.__T.loadSave().vis.frontBumper===2 && window.__T.loadSave().vis.hood===1, 'loadSave 恢复套件选择');

console.log('=== 整车套件方案 ===');
const cards = document.querySelectorAll('#visPane .preset-card');
ok(cards.length === window.__T.PRESETS.length, `方案卡片渲染 ${window.__T.PRESETS.length} 个`);
const minis = document.querySelectorAll('#visPane .preset-card canvas.pv');
ok(minis.length === window.__T.PRESETS.length, '每个方案带缩略预览图');
cards[2].click(); pump(2); // 碳纤性能
ok(window.__T.UI.save.vis.frontBumper===2 && window.__T.UI.save.vis.wheel===2 && window.__T.UI.save.vis.wing===2,
   '套件方案一键应用 包围/机盖/尾翼/轮毂组合');
ok(window.__T.UI.save.vis.preset==='carbon', '方案高亮标记为 carbon');
ok(JSON.parse(window.localStorage.getItem('dragKingsSaveV1')).vis.preset==='carbon', '方案选择写入 localStorage');
document.querySelector('#visPane .chip[data-k="wing"][data-v="3"]').click(); pump(2);
ok(window.__T.UI.save.vis.preset==='custom', '手动微调后方案状态转为自定义');

console.log('=== 涂装编辑器 ===');
const pp=document.getElementById('paintPicker');
ok(pp != null, '自定义颜色选择器存在');
pp.value='#123456'; pp.dispatchEvent(new window.Event('input')); pump(2);
ok(window.__T.UI.save.vis.custom==='#123456', '自定义车身颜色已应用');
ok(window.__T.playerVisual(window.__T.UI.save).color==='#123456', 'playerVisual 输出自定义颜色');
document.querySelector('#visPane .swatch[data-k="color"][data-v="6"]').click(); pump(2);
ok(window.__T.UI.save.vis.custom===null && window.__T.playerVisual(window.__T.UI.save).color==='#8f4fd1',
   '预设色板覆盖自定义颜色');
document.querySelector('#visPane .chip[data-k="pattern"][data-v="3"]').click(); pump(2);
ok(window.__T.UI.save.vis.pattern===3, '车身图案（斜纹拉花）已应用');
const pl=document.getElementById('patternPicker');
ok(pl != null, '图案颜色选择器存在');
pl.value='#ffd23f'; pl.dispatchEvent(new window.Event('input')); pump(2);
ok(window.__T.UI.save.vis.patternColor==='#ffd23f', '图案颜色已应用');

console.log('=== 自定义贴花 ===');
document.querySelector('#visPane .chip[data-d="shape"][data-v="star"]').click(); pump(2);
document.querySelector('#visPane .chip[data-d="pos"][data-v="front"]').click(); pump(2);
document.querySelector('#visPane .chip[data-d="size"][data-v="2"]').click(); pump(2);
document.querySelector('#stkAdd').click(); pump(2);
ok(window.__T.UI.save.vis.stickers.length===1 && window.__T.UI.save.vis.stickers[0].shape==='star'
   && window.__T.UI.save.vis.stickers[0].pos==='front' && window.__T.UI.save.vis.stickers[0].size===2,
   '贴花（五角星/前翼子板/大）添加成功');
document.querySelector('#visPane .chip[data-d="shape"][data-v="badge"]').click(); pump(2);
const stkText=document.getElementById('stkText');
ok(stkText != null, '号牌贴花提供文字输入框');
stkText.value='AB'; stkText.dispatchEvent(new window.Event('input'));
document.querySelector('#visPane .swatch[data-d="color"][data-v="#ff5a5a"]').click(); pump(2);
document.querySelector('#stkAdd').click(); pump(2);
ok(window.__T.UI.save.vis.stickers.length===2 && window.__T.UI.save.vis.stickers[1].text==='AB'
   && window.__T.UI.save.vis.stickers[1].color==='#ff5a5a', '号牌贴花带自定义文字与颜色');
document.querySelector('#visPane .chip[data-d="shape"][data-v="bars"]').click(); pump(2);
document.querySelector('#stkAdd').click(); pump(2);
ok(window.__T.UI.save.vis.stickers.length===3, '第 3 枚贴花添加成功');
ok(document.getElementById('stkAdd')===null, '满 3 枚后添加表单隐藏');
ok(JSON.parse(window.localStorage.getItem('dragKingsSaveV1')).vis.stickers.length===3, '贴花写入 localStorage');
document.querySelector('.stk-del').click(); pump(2);
ok(window.__T.UI.save.vis.stickers.length===2, '删除贴花生效');
{
  const ls=window.__T.loadSave();
  ok(ls.vis.stickers.length===2 && ls.vis.pattern===3 && ls.vis.patternColor==='#ffd23f' && ls.vis.custom===null,
     'loadSave 完整恢复涂装与贴花');
}

console.log('=== 贴花自由拖动 ===');
/* jsdom 中 getBoundingClientRect 全 0 → clientX 直接映射画布坐标（与实现中的守卫一致） */
const pcv=document.getElementById('previewCanvas');
const psc=Math.min(920/6.6, 360/3.4);
const pgy=360*0.84;
const toCv=(lx,ly)=>({clientX:460+lx*psc, clientY:pgy-ly*psc, bubbles:true, pointerId:1});
const pev=(type,lx,ly)=>pcv.dispatchEvent(new window.MouseEvent(type, toCv(lx,ly)));
/* 命中检测取最上层（数组末位）贴花 */
const stkIdx=window.__T.UI.save.vis.stickers.length-1;
const stkTop=window.__T.UI.save.vis.stickers[stkIdx];
ok(Math.abs(stkTop.x-1.58)<1e-6 && Math.abs(stkTop.y+0.55)<1e-6, '新添贴花自带初始槽位坐标');
pev('pointerdown', stkTop.x, stkTop.y); pump(1);
pev('pointermove', 0.8, -0.45); pump(1);
pev('pointerup', 0, 0); pump(1);
ok(Math.abs(stkTop.x-0.8)<1e-6 && Math.abs(stkTop.y+0.45)<1e-6, `拖动生效 (${stkTop.x.toFixed(2)}, ${stkTop.y.toFixed(2)})`);
ok(Math.abs(JSON.parse(window.localStorage.getItem('dragKingsSaveV1')).vis.stickers[stkIdx].x-0.8)<1e-6, '拖动位置写入 localStorage');
pev('pointerdown', stkTop.x, stkTop.y); pump(1);
pev('pointermove', 3000, 3000); pump(1);
pev('pointerup', 0, 0); pump(1);
ok(Math.abs(stkTop.x-1.9)<1e-6 && Math.abs(stkTop.y+0.32)<1e-6, '拖出车身边界自动钳制（右缘 1.9 / 下缘 -0.32）');
document.querySelectorAll('.stk-reset')[stkIdx].click(); pump(2);
ok(stkTop.x===1.58 && stkTop.y===-0.55, '↺ 重置回初始槽位');
/* 旧存档迁移：仅含槽位、无 x/y 的贴花 */
const legacy=JSON.parse(window.localStorage.getItem('dragKingsSaveV1'));
legacy.vis.stickers=[{shape:'bolt', color:'#39d2ff', pos:'rear', size:1}];
window.localStorage.setItem('dragKingsSaveV1', JSON.stringify(legacy));
const mig=window.__T.loadSave();
ok(mig.vis.stickers.length===1 && mig.vis.stickers[0].x===-1.18 && mig.vis.stickers[0].y===-0.55,
   '旧存档贴花（仅槽位）自动迁移出自由坐标');

console.log('=== 车体套件切换 ===');
{
  const chip = document.querySelector('#visPane .chip[data-b="supercar"]');
  ok(!!chip, '贴图车体卡片存在');
  chip.click(); pump(2);
  ok(window.__T.UI.save.vis.body === 'supercar', '选择贴图车体已保存到内存');
  ok(!!window.__T.playerVisual(window.__T.UI.save).sprite, 'playerVisual 输出 sprite（比赛与预览使用贴图车体）');
  ok(!!document.querySelector('#visPane .vis-locked'), '贴图车体时经典专属自定义组降级显示');
  ok(window.localStorage.getItem('dragKingsSaveV1').includes('"body":"supercar"'), '车体选择写入 localStorage');
  document.querySelector('#visPane .chip[data-b="classic"]').click(); pump(2);
  ok(window.__T.UI.save.vis.body === 'classic' && !window.__T.playerVisual(window.__T.UI.save).sprite, '切回经典车体恢复自定义');
  ok(!document.querySelector('#visPane .vis-locked'), '经典车体恢复全部自定义组');
}

console.log('=== 存档持久化 ===');
const saved = JSON.parse(window.localStorage.getItem('dragKingsSaveV1'));
ok(saved.coins === window.__T.UI.save.coins, '金币已写入 localStorage');
ok(saved.up.engine === 1 && saved.vis.color === 6, '改装与外观已写入 localStorage');

console.log('=== 重新加载存档 ===');
/* 模拟刷新：重新执行全部脚本（新 jsdom 共享同一 localStorage 不可行，改为手动校验 loadSave 逻辑） */
const fresh = window.__T.loadSave();
ok(fresh.coins === saved.coins && fresh.up.engine === 1 && fresh.vis.color === 6 && fresh.beaten[0] === true, 'loadSave 正确恢复全部进度');

console.log('=== 音效开关 & 重置 ===');
$('btnGarageBack').click(); pump(2);
$('btnSound').click(); pump(2);
ok(JSON.parse(window.localStorage.getItem('dragKingsSaveV1')).sound === false, '音效开关持久化');
$('btnReset').click(); pump(2);
const afterReset = window.localStorage.getItem('dragKingsSaveV1');
ok(afterReset === null && window.__T.UI.save.coins === 600 && window.__T.UI.save.up.engine === 0, '重置存档生效（清空存储，内存回到默认）');

console.log('=== 暂停/退出流程 ===');
$('btnPlay').click(); pump(2);
$('eventList').children[0].querySelector('button[data-i]').click(); pump(2);
$('btnTutClose').click(); pump(2); // tut 已重置，教学会再次弹出
window.DR.skipStaging(); pump(60);
$('btnPause').click(); pump(2);
ok(window.__T.Game.race.paused === true, '暂停生效');
$('btnResume').click(); pump(2);
ok(window.__T.Game.race.paused === false, '恢复生效');
$('btnPause').click(); pump(2);
$('btnQuit').click(); pump(2);
ok(window.__T.Game.race == null && window.__T.Game.state === 'events', '退出比赛回到赛事列表');

console.log('=== 手柄（Gamepad API） ===');
{
  const map = window.__T.Game.mapGamepad;
  const mk = (pressedIdxs, valIdx) => ({connected: true,
    buttons: Array.from({length: 10}, (_, i) => ({pressed: pressedIdxs.includes(i), value: i === valIdx ? 0.8 : 0}))});
  ok(map(mk([0])).gas === true, '手柄 A = 油门');
  ok(map(mk([], 7)).gas === true, '手柄 RT 扳机 = 油门（模拟量 >0.5 触发）');
  ok(map(mk([2])).nitro === true, '手柄 X = 氮气');
  ok(map(mk([6])).nitro === true, '手柄 LT = 氮气');
  ok(map(mk([1])).shift === true && map(mk([5])).shift === true && map(mk([3])).shift === true, '手柄 B/RB/Y = 升挡');
  ok(map(mk([9])).pause === true, '手柄 Start = 暂停');
  const none = map(mk([]));
  ok(!none.gas && !none.nitro && !none.shift && !none.pause, '空手柄无任何输入');
  /* 轮询集成：getGamepads → pad 状态合并与复位 */
  const nav = window.navigator;
  nav.getGamepads = () => [mk([0, 2]), null];
  window.__T.Game.pollGamepad();
  ok(window.__T.Game.pad.gas === true && window.__T.Game.pad.nitro === true, '轮询将油门/氮气并入输入状态');
  nav.getGamepads = () => [null];
  window.__T.Game.pollGamepad();
  ok(window.__T.Game.pad.gas === false && window.__T.Game.pad.nitro === false, '手柄消失后输入复位');
  delete nav.getGamepads;
}

console.log('=== 全程错误检查 ===');
ok(errors.length === 0, '全程无 JS 错误 ' + (errors.length ? JSON.stringify(errors) : ''));

console.log(failed ? `\n${failed} 项断言失败` : '\n全部 DOM 断言通过 ✓');
process.exitCode = failed ? 1 : 0;
