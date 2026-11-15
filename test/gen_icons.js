'use strict';
/* 一次性脚本：程序化生成 PWA 应用图标（暗底 + 霓虹跑车剪影 + 速度线） */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUT = path.join(__dirname, '..', 'assets', 'icons');
fs.mkdirSync(OUT, { recursive: true });

function drawIcon(size, maskable) {
  const cv = createCanvas(size, size);
  const ctx = cv.getContext('2d');
  // 背景（maskable 需全出血纯底）
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#1a2133'); g.addColorStop(1, '#0b0e15');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  if (!maskable) {
    // 非遮罩图标画圆角描边（内缩一半线宽，标准圆角矩形路径）
    const lw = size * 0.045, i = lw / 2, r = size * 0.18;
    ctx.strokeStyle = 'rgba(255,138,42,0.9)'; ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(r, i);
    ctx.lineTo(size - r, i); ctx.arcTo(size - i, i, size - i, r, r);
    ctx.lineTo(size - i, size - r); ctx.arcTo(size - i, size - i, size - r, size - i, r);
    ctx.lineTo(r, size - i); ctx.arcTo(i, size - i, i, size - r, r);
    ctx.lineTo(i, r); ctx.arcTo(i, i, r, i, r);
    ctx.closePath(); ctx.stroke();
  }
  // 速度线（青色霓虹）
  ctx.save();
  ctx.shadowColor = '#39d2ff'; ctx.shadowBlur = size * 0.03;
  ctx.strokeStyle = 'rgba(57,210,255,0.85)'; ctx.lineWidth = size * 0.028; ctx.lineCap = 'round';
  const pad = maskable ? 0.30 : 0.20;
  for (let i = 0; i < 3; i++) {
    const y = size * (0.40 + i * 0.09), x0 = size * pad, x1 = size * (pad + 0.16 + i * 0.045);
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
  ctx.restore();
  // 跑车剪影（朝右，运动感低趴）
  const cx = size / 2, gy = size * 0.70, s = size * (maskable ? 0.34 : 0.40);
  ctx.save();
  ctx.translate(cx, gy);
  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 1.05, s * 0.07, 0, 0, 7); ctx.fill();
  // 车身（橙色渐变）
  const bg = ctx.createLinearGradient(0, -s * 0.62, 0, 0);
  bg.addColorStop(0, '#ffb04a'); bg.addColorStop(1, '#e0491a');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-s * 1.02, 0);                       // 尾部下缘
  ctx.lineTo(-s * 1.02, -s * 0.30);               // 尾部
  ctx.quadraticCurveTo(-s * 0.55, -s * 0.36, -s * 0.42, -s * 0.52);  // 后肩
  ctx.lineTo(-s * 0.10, -s * 0.56);               // 车顶
  ctx.quadraticCurveTo(s * 0.38, -s * 0.54, s * 0.62, -s * 0.30);    // 前挡下溜
  ctx.lineTo(s * 1.02, -s * 0.26);                // 车头
  ctx.quadraticCurveTo(s * 1.08, -s * 0.12, s * 1.00, 0);            // 前唇
  ctx.closePath(); ctx.fill();
  // 车窗
  ctx.fillStyle = '#0d1524';
  ctx.beginPath();
  ctx.moveTo(-s * 0.30, -s * 0.50); ctx.lineTo(-s * 0.06, -s * 0.52);
  ctx.quadraticCurveTo(s * 0.24, -s * 0.50, s * 0.42, -s * 0.32);
  ctx.lineTo(-s * 0.30, -s * 0.32); ctx.closePath(); ctx.fill();
  // 车轮（暗轮 + 亮轮毂）
  const wheel = (wx) => {
    ctx.fillStyle = '#0a0c11';
    ctx.beginPath(); ctx.arc(wx, -s * 0.10, s * 0.21, 0, 7); ctx.fill();
    ctx.fillStyle = '#c8d2e4';
    ctx.beginPath(); ctx.arc(wx, -s * 0.10, s * 0.095, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a4356';
    ctx.beginPath(); ctx.arc(wx, -s * 0.10, s * 0.035, 0, 7); ctx.fill();
  };
  wheel(-s * 0.55); wheel(s * 0.55);
  // 大灯
  ctx.save();
  ctx.shadowColor = '#ffe9b0'; ctx.shadowBlur = s * 0.10;
  ctx.fillStyle = '#ffe9b0';
  ctx.fillRect(s * 0.80, -s * 0.24, s * 0.16, s * 0.06);
  ctx.restore();
  // 尾焰（氮气蓝焰）
  ctx.save();
  ctx.shadowColor = '#5a9dff'; ctx.shadowBlur = s * 0.12;
  const fg = ctx.createLinearGradient(-s * 1.02, 0, -s * 1.55, 0);
  fg.addColorStop(0, 'rgba(200,230,255,0.95)'); fg.addColorStop(1, 'rgba(70,120,255,0)');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-s * 1.00, -s * 0.22); ctx.lineTo(-s * 1.00, -s * 0.06);
  ctx.lineTo(-s * 1.55, -s * 0.10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  return cv;
}

for (const [name, size, maskable] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['icon-maskable-512.png', 512, true]]) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, drawIcon(size, maskable).toBuffer('image/png'));
  console.log('written', p, fs.statSync(p).size, 'bytes');
}
