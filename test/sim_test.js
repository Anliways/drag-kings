'use strict';
/* 无头模拟测试：物理平衡 + AI 难度曲线 + 完整比赛流程（不含 DOM） */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const code = ['data.js', 'physics.js'].map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
const exp = {};
new Function('window', 'localStorage', 'performance', 'module', code + '\n;module.exports = {TRACK_LEN, COLORS, DECALS, WHEELS, PARTS, PART_KEYS, TIERS, OPPONENTS, P, clamp, gauss, torqueCurve, statsFromUpgrades, statsFromOpp, hpOf, perfScore, CarSim, AIController, simulateRun};')(
  {}, undefined, {now: () => Date.now()}, exp);
const D = exp.exports;

/* 固定随机种子，保证对战结果可复现 */
let _seed = 20261109;
Math.random = () => {
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return _seed / 4294967296;
};

let failed = 0;
const ok = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); failed++; } };

/* ---------- 1. 基础性能曲线 ---------- */
console.log('=== 各改装阶段的预估成绩（完美驾驶，含AI反应修正前的裸数据） ===');
let prev = null;
for (let lv = 0; lv <= 5; lv++) {
  const up = {engine: lv, turbo: lv, gearbox: lv, tire: lv};
  const stats = D.statsFromUpgrades(up);
  const est = D.simulateRun(stats);
  const hp = D.hpOf(stats);
  console.log(`LV${lv}  马力${hp.base}hp(增压${hp.boost})  0-100:${est.t100.toFixed(2)}s  402m:${est.quarter.toFixed(2)}s  尾速:${est.top}km/h  性能分:${D.perfScore(stats)}`);
  if (prev && !(est.quarter < prev)) ok(false, `LV${lv} 比 LV${lv-1} 更慢，改装没有正向收益`);
  prev = est.quarter;
}

/* ---------- 2. 玩家 vs AI（含 AI 反应时间与起步控速） ---------- */
function duel(playerStats, oppIdx, playerPerfect = true) {
  const opp = D.OPPONENTS[oppIdx];
  const player = new D.CarSim(playerStats, {player: true});
  const aiSim = new D.CarSim(D.statsFromOpp(opp), {});
  const ai = new D.AIController(opp);
  const pw = player.getWindows();
  player.launched = true; player.rpm = pw.launch.center; player.launchBonusT = 0.9;
  let t = 0; const dt = 1 / 120;
  while ((player.finishT == null || aiSim.finishT == null) && t < 32) {
    let th = 1, shift = false, nitro = false;
    if (playerPerfect) {
      if (player.slip > 0.35) th = Math.max(0.6, 1 - player.slip * 0.8);
      shift = player.rpm >= pw.perfect.center && player.gear < D.P.GEARS.length - 1;
      nitro = !player.tractionLimited; // 完美驾驶：不打滑才喷氮
    } else {
      th = 1; // 菜鸟：从不收油，换挡偏晚，氮气一起步就烧
      shift = player.rpm >= pw.perfect.hi + 600 || player.limiter;
      nitro = true;
    }
    player.step(dt, {throttle: th, shift, nitro}, t);
    if (!aiSim.launched && t >= opp.react) aiSim.launched = true; // AI 反应时间
    const octl = ai.step(dt, aiSim);
    aiSim.step(dt, octl, t);
    t += dt;
  }
  return {player: player.finishT, ai: aiSim.finishT, perfects: player.perfectShifts, spin: player.spinTime};
}

console.log('\n=== 玩家(完美操作) vs AI 对战表：目标 = 每级改装恰好推进2个对手 ===');
const tiers = [
  {label: 'LV0', up: {engine: 0, turbo: 0, gearbox: 0, tire: 0}, start: 0, end: 1},
  {label: 'LV1', up: {engine: 1, turbo: 1, gearbox: 1, tire: 1}, start: 2, end: 3},
  {label: 'LV2', up: {engine: 2, turbo: 2, gearbox: 2, tire: 2}, start: 4, end: 5},
  {label: 'LV3', up: {engine: 3, turbo: 3, gearbox: 3, tire: 3}, start: 6, end: 7},
  {label: 'LV4', up: {engine: 4, turbo: 4, gearbox: 4, tire: 4}, start: 8, end: 9},
  {label: 'LV5', up: {engine: 5, turbo: 5, gearbox: 5, tire: 5}, start: 9, end: 9},
];
for (const t of tiers) {
  const stats = D.statsFromUpgrades(t.up);
  for (let i = t.start; i <= t.end; i++) {
    /* AI 误差带随机性：5 战 3 胜 视为设计上可稳定通过 */
    let wins = 0, sample = null;
    for (let k = 0; k < 5; k++) {
      const r = duel(stats, i, true);
      if (r.player != null && (r.ai == null || r.player < r.ai)) wins++;
      if (k === 0) sample = r;
    }
    const r = sample;
    const gap = (r.player != null && r.ai != null) ? (r.ai - r.player).toFixed(2) : 'DNF';
    console.log(`${t.label} vs [${i}] ${D.OPPONENTS[i].name} → 5战${wins}胜 (样本: 你 ${r.player.toFixed(2)}s / AI ${r.ai ? r.ai.toFixed(2) + 's' : 'DNF'} 差 ${gap}s)`);
    ok(wins >= 3, `${t.label} 对对手[${i}] 应至少 5战3胜`);
  }
}

console.log('\n=== 反例验证 ===');
{
  const r = duel(D.statsFromUpgrades({engine: 0, turbo: 0, gearbox: 0, tire: 0}), 3, false);
  const win = r.player != null && (r.ai == null || r.player < r.ai);
  console.log(`初始车·乱操作 vs [3] ${D.OPPONENTS[3].name} → ${win ? '胜' : '败'} (你 ${r.player.toFixed(2)}s / AI ${r.ai.toFixed(2)}s)`);
  ok(!win, '乱操作不应该赢高3级的对手');
}
{
  const r = duel(D.statsFromUpgrades({engine: 5, turbo: 5, gearbox: 5, tire: 5}), 9, false);
  const win = r.player != null && (r.ai == null || r.player < r.ai);
  console.log(`满改·较晚换挡 vs [9] 传奇·雷霆 → ${win ? '胜' : '败'} (你 ${r.player.toFixed(2)}s / AI ${r.ai.toFixed(2)}s)`);
}

/* ---------- 3. 经济测算 ---------- */
console.log('\n=== 经济测算 ===');
let totalCost = 0;
D.PART_KEYS.forEach(k => { totalCost += D.PARTS[k].costs.reduce((a, b) => a + b, 0); });
const rewardSum = D.OPPONENTS.reduce((a, o) => a + o.reward, 0);
console.log(`全改总花费: 🪙${totalCost}  |  全对手首胜收入(含50%加成): 🪙${Math.round(rewardSum * 1.5)}  + 评价加成约🪙500`);
console.log(`→ 约 ${Math.ceil(totalCost / (Math.round(rewardSum * 1.5) / 10 + 50))} 场首胜通关，刷钱复赛约每场 0.45×奖励`);

/* ---------- 4. 极限行为验证 ---------- */
console.log('\n=== 极限行为验证 ===');
{
  // 断油事件不应抖动
  const sim = new D.CarSim(D.statsFromUpgrades({engine: 2, turbo: 2, gearbox: 2, tire: 2}), {player: true});
  sim.launched = true; sim.rpm = 5000;
  let t = 0; const dt = 1 / 120; let limitT = 0;
  while (t < 3) {
    sim.step(dt, {throttle: 1, shift: false}, t); t += dt;
    if (sim.limiter) limitT += dt;
  }
  const evCount = sim.events.length;
  sim.events.length = 0;
  console.log(`不换挡3s: limiter累计=${limitT.toFixed(2)}s rpm=${sim.rpm.toFixed(0)} gear=${sim.gear} 断油事件数=${evCount}`);
  ok(limitT > 0.5, '不换挡应持续触发断油');
  ok(evCount <= 3, `断油事件抖动（3秒内出现 ${evCount} 次）`);
}
{
  // 大马力+弱轮胎（改装错配）：起步应严重烧胎
  const sim = new D.CarSim(D.statsFromUpgrades({engine: 5, turbo: 5, gearbox: 5, tire: 0}), {player: true});
  const w = sim.getWindows();
  sim.launched = true; sim.rpm = w.launch.hi;
  let t = 0; const dt = 1 / 120; let peakSlip = 0;
  while (t < 2.5) { sim.step(dt, {throttle: 1, shift: false}, t); t += dt; peakSlip = Math.max(peakSlip, sim.slip); }
  console.log(`LV5引擎+LV0轮胎起步2.5s: slip峰值=${peakSlip.toFixed(2)} 烧胎=${sim.spinTime.toFixed(2)}s 速度=${(sim.v * 3.6).toFixed(0)}km/h`);
  ok(peakSlip > 1.0, '大马力弱胎应当严重打滑');
  ok(sim.spinTime > 1.0, '错配改装下烧胎时间应当显著');
}
{
  // 满改满胎：打滑应显著减轻
  const sim = new D.CarSim(D.statsFromUpgrades({engine: 5, turbo: 5, gearbox: 5, tire: 5}), {player: true});
  const w = sim.getWindows();
  sim.launched = true; sim.rpm = w.launch.hi;
  let t = 0; const dt = 1 / 120; let peakSlip = 0;
  while (t < 2.5) { sim.step(dt, {throttle: 1, shift: false}, t); t += dt; peakSlip = Math.max(peakSlip, sim.slip); }
  console.log(`LV5引擎+LV5轮胎起步2.5s: slip峰值=${peakSlip.toFixed(2)} 烧胎=${sim.spinTime.toFixed(2)}s 速度=${(sim.v * 3.6).toFixed(0)}km/h`);
}
{
  // 完美换挡应产生 overboost 事件
  const sim = new D.CarSim(D.statsFromUpgrades({engine: 2, turbo: 2, gearbox: 2, tire: 2}), {player: true});
  sim.launched = true; sim.rpm = 5000;
  let t = 0; const dt = 1 / 120; let perfects = 0, shifts = 0;
  while (sim.gear < 5 && t < 20) {
    const w = sim.getWindows().perfect;
    const shift = sim.rpm >= (w.lo + w.hi) / 2;
    sim.step(dt, {throttle: 1, shift}, t); t += dt;
  }
  for (const e of sim.events) { if (e.t === 'perfect') perfects++; if (e.t === 'shifted') shifts++; }
  console.log(`全程完美换挡: 5挡用时=${t.toFixed(2)}s 完美换挡=${perfects}/${shifts}`);
  ok(perfects === shifts && shifts >= 4, '中心换挡应全部判为完美');
}

/* ---------- 5. 氮气机制 ---------- */
console.log('\n=== 氮气机制验证 ===');
{
  // 智能氮气收益
  const stats = D.statsFromUpgrades({engine: 2, turbo: 2, gearbox: 2, tire: 2});
  const run = (useNitro) => {
    const sim = new D.CarSim(stats, {player: true});
    const w = sim.getWindows();
    sim.launched = true; sim.rpm = w.launch.center; sim.launchBonusT = 0.9;
    let t = 0; const dt = 1 / 120;
    while (sim.finishT == null && t < 30) {
      let th = 1;
      if (sim.slip > 0.35) th = Math.max(0.6, 1 - sim.slip * 0.8);
      const shift = sim.rpm >= w.perfect.center && sim.gear < D.P.GEARS.length - 1;
      sim.step(dt, {throttle: th, shift, nitro: useNitro && !sim.tractionLimited}, t);
      t += dt;
    }
    return sim.finishT;
  };
  const on = run(true), off = run(false);
  console.log(`氮气收益: 不喷 ${off.toFixed(2)}s → 智能喷射 ${on.toFixed(2)}s (−${(off - on).toFixed(2)}s)`);
  ok(off - on >= 0.15, '智能氮气应带来 ≥0.15s 收益');
  ok(off - on <= 0.9, '氮气收益不应过分夸张');
}
{
  // 消耗与自动切断（不换挡，无补给）
  const stats = D.statsFromUpgrades({engine: 0, turbo: 0, gearbox: 0, tire: 0});
  const sim = new D.CarSim(stats, {player: true});
  sim.launched = true; sim.rpm = 3000;
  let t = 0; const dt = 1 / 120; let activeTime = 0; let sawActive = false, sawCutoff = false;
  while (t < 8) {
    sim.step(dt, {throttle: 1, shift: false, nitro: true}, t);
    t += dt;
    if (sim.nitroActive) { activeTime += dt; sawActive = true; }
    if (sawActive && !sim.nitroActive && sim.nitroTank <= 0) sawCutoff = true;
  }
  console.log(`持续喷氮: 活跃 ${activeTime.toFixed(2)}s 罐=${sim.nitroTank.toFixed(2)} 自动切断=${sawCutoff}`);
  ok(sawActive && sawCutoff, '氮气罐耗尽后自动切断');
  ok(Math.abs(activeTime - D.P.NITRO_TIME) < 0.3, `满罐应持续约 ${D.P.NITRO_TIME}s`);
}
{
  // 完美换挡补氮：总喷射时长超过基础罐容量
  const stats = D.statsFromUpgrades({engine: 2, turbo: 2, gearbox: 2, tire: 2});
  const sim = new D.CarSim(stats, {player: true});
  const w = sim.getWindows();
  sim.launched = true; sim.rpm = w.launch.center; sim.launchBonusT = 0.9;
  let t = 0; const dt = 1 / 120; let activeTime = 0;
  while (sim.finishT == null && t < 30) {
    let th = 1;
    if (sim.slip > 0.35) th = Math.max(0.6, 1 - sim.slip * 0.8);
    const shift = sim.rpm >= w.perfect.center && sim.gear < D.P.GEARS.length - 1;
    sim.step(dt, {throttle: th, shift, nitro: true}, t);
    t += dt;
    if (sim.nitroActive) activeTime += dt;
  }
  console.log(`完美换挡补氮: 总喷射 ${activeTime.toFixed(2)}s（基础罐 4.0s）`);
  ok(activeTime > D.P.NITRO_TIME + 0.5, '完美换挡应补充氮气、延长喷射时间');
}

console.log(failed ? `\n${failed} 项断言失败` : '\n全部断言通过 ✓');
process.exitCode = failed ? 1 : 0;
