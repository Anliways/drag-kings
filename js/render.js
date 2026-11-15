'use strict';
/* ================= 画布渲染 ================= */
const Render = {
  cv:null, ctx:null, W:0, H:0, dpr:1,
  cam:{x:-14}, shake:0,
  particles:[], stars:null, crowd:null, cityA:null, cityB:null, vign:null, nosVign:null,

  init(cv){
    this.cv = cv;
    /* alpha:false + desynchronized：比赛画布整帧重绘且不需透明，客户端级合成路径 */
    this.ctx = cv.getContext('2d', {alpha:false, desynchronized:true}) || cv.getContext('2d');
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    if(typeof GameAssets !== 'undefined') GameAssets.init();
  },
  S(){
    /* 竖屏按宽度定标，横屏按高度定标（双方向一致的车辆视觉占比） */
    const portrait = this.H > this.W;
    return clamp(portrait ? this.W*0.065 : this.H*0.055, 18, 34);
  }, // 玩家车道 px/m

  resize(){
    const dpr = Math.min(2, window.devicePixelRatio||1);
    this.dpr = dpr;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W*dpr);
    this.cv.height = Math.round(this.H*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    this.genScenery();
    this.genVignette();
    this.particles.length = 0;
  },

  genScenery(){
    const W = Math.max(800, this.W);
    /* 星星 */
    this.stars = [];
    for(let i=0;i<90;i++) this.stars.push({x:Math.random()*W, y:Math.random()*this.H*0.36, r:Math.random()*1.3+0.4, a:Math.random()*0.5+0.15});
    /* 人群 */
    this.crowd = [];
    for(let i=0;i<64;i++){
      this.crowd.push({
        wx:-24+Math.random()*22, dy:Math.random()*10,
        c:['#5a647d','#6d5a4e','#4e5a6d','#7a6455','#556052'][i%5],
        stick:Math.random()<0.4, sc:['#ff8a2a','#39d2ff','#4ade80','#e06a9f'][i%4],
      });
    }
    /* 城市剪影两层 */
    this.cityA = this.makeCityLayer(W, 120, 14, '#12161f', 0.55);
    this.cityB = this.makeCityLayer(W, 78, 30, '#1a2030', 0.8);
  },
  makeCityLayer(w, h, seed, color, winA){
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    let x = 0, k = seed;
    const rnd = ()=>{ k = (k*9301+49297)%233280; return k/233280; };
    while(x < w){
      const bw = 34+rnd()*90, bh = h*(0.35+rnd()*0.62);
      c.fillStyle = color;
      c.fillRect(x, h-bh, bw, bh);
      // 天线
      if(rnd()<0.3){ c.fillRect(x+bw*0.5-1, h-bh-8-rnd()*8, 2, 14); }
      // 窗户
      const cols = Math.max(1, Math.floor(bw/11)), rows = Math.max(1, Math.floor(bh/13));
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
        if(rnd()<0.28){
          c.fillStyle = rnd()<0.7 ? `rgba(255,190,90,${winA})` : `rgba(120,200,255,${winA*0.8})`;
          c.fillRect(x+4+i*11, h-bh+4+j*13, 4, 5);
        }
      }
      // 霓虹灯带/招牌（一次性画进缓存层，无每帧开销）
      if(bh > 34 && rnd() < 0.42){
        const NEON = ['#39d2ff','#e06a9f','#4ade80','#ff8a2a','#b39dff'];
        const col = NEON[Math.floor(rnd()*NEON.length)];
        const ny = h-bh + 6 + rnd()*(bh-20);
        c.save();
        c.shadowColor = col; c.shadowBlur = 7; c.globalAlpha = 0.8;
        c.fillStyle = col;
        if(rnd() < 0.6){
          c.fillRect(x + (rnd()<0.5 ? 2 : bw-4), ny, 2, 16+rnd()*24);   // 楼边竖灯带
        } else {
          const sw = Math.min(bw-8, 26+rnd()*36);
          c.fillRect(x + (bw-sw)/2, ny, sw, 3);                          // 横向霓虹招牌
        }
        c.restore(); c.globalAlpha = 1;
      }
      x += bw + 4 + rnd()*10;
    }
    return cv;
  },
  genVignette(){
    const cv = document.createElement('canvas');
    cv.width = Math.max(2,this.W); cv.height = Math.max(2,this.H);
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(this.W/2, this.H*0.45, Math.min(this.W,this.H)*0.42, this.W/2, this.H*0.5, Math.max(this.W,this.H)*0.75);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.5)');
    c.fillStyle = g; c.fillRect(0,0,this.W,this.H);
    this.vign = cv;
    /* 氮气边缘脉冲（紫色辉光，仅在 nitroActive 时叠出） */
    const nv = document.createElement('canvas');
    nv.width = cv.width; nv.height = cv.height;
    const c2 = nv.getContext('2d');
    const g2 = c2.createRadialGradient(this.W/2, this.H*0.5, Math.min(this.W,this.H)*0.30, this.W/2, this.H*0.5, Math.max(this.W,this.H)*0.72);
    g2.addColorStop(0,'rgba(90,46,214,0)'); g2.addColorStop(1,'rgba(122,80,255,0.42)');
    c2.fillStyle = g2; c2.fillRect(0,0,nv.width,nv.height);
    this.nosVign = nv;
  },

  addShake(v){ this.shake = Math.min(10, this.shake+v); },

  /* ---------- 每帧渲染 ---------- */
  frame(race, dt){
    const ctx = this.ctx, W = this.W, H = this.H;
    if(!race){ ctx.fillStyle='#0b0d12'; ctx.fillRect(0,0,W,H); return; }
    const S = this.S(), So = S*0.78;
    /* 横竖屏双布局：竖屏压缩天空、抬高地平线，双车道紧随其后，底部留给触控与仪表 */
    const portrait = H > W;
    const hor = portrait ? H*0.34 : H*0.44;
    const yOpp = hor + H*(portrait ? 0.065 : 0.10);
    const yPl = hor + H*(portrait ? 0.21 : 0.32);
    const pl = race.player.sim, op = race.oppCar.sim;

    /* 相机跟随 */
    const targetX = pl.x - (W*0.35)/S;
    this.cam.x += (targetX-this.cam.x)*Math.min(1, dt*8);
    let camX = Math.max(-14, this.cam.x);
    this.shake = Math.max(0, this.shake - dt*7);
    const shk = this.shake + Math.min(1.6, pl.slip*1.1);
    const shX = (Math.random()*2-1)*shk, shY = (Math.random()*2-1)*shk*0.6;

    const w2s = wx => (wx-camX)*S;

    ctx.save();
    ctx.translate(shX, shY);

    /* --- 天空 --- */
    let g = ctx.createLinearGradient(0,0,0,hor);
    g.addColorStop(0,'#090c16'); g.addColorStop(0.65,'#141326'); g.addColorStop(1,'#2a1e38');
    ctx.fillStyle=g; ctx.fillRect(-20,-20,W+40,hor+20);
    // 星星
    for(const st of this.stars){
      ctx.globalAlpha = st.a*(0.7+0.3*Math.sin(performance.now()/900+st.x));
      ctx.fillStyle='#cdd6ee'; ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    ctx.globalAlpha=1;
    // 月亮
    const mg = ctx.createRadialGradient(W*0.82, hor*0.36, 8, W*0.82, hor*0.36, 60);
    mg.addColorStop(0,'rgba(230,235,255,0.9)'); mg.addColorStop(0.25,'rgba(210,220,255,0.28)'); mg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(W*0.82, hor*0.36, 60, 0, 7); ctx.fill();
    ctx.fillStyle='#e8ecff'; ctx.beginPath(); ctx.arc(W*0.82, hor*0.36, 13, 0, 7); ctx.fill();
    ctx.fillStyle='rgba(178,188,215,0.6)';
    ctx.beginPath(); ctx.arc(W*0.82+4, hor*0.36-3, 3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(W*0.82-4, hor*0.36+4, 2.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(W*0.82-1, hor*0.36-6, 1.6, 0, 7); ctx.fill();

    /* --- 城市剪影（视差） --- */
    const drawCity = (layer, par, yBase)=>{
      const w = layer.width;
      let off = -((camX*S*par) % w); if(off>0) off-=w;
      for(let x=off; x<W; x+=w) ctx.drawImage(layer, x, yBase-layer.height);
    };
    drawCity(this.cityA, 0.16, hor);
    drawCity(this.cityB, 0.34, hor);

    /* --- 地面与赛道 --- */
    g = ctx.createLinearGradient(0,hor,0,H);
    g.addColorStop(0,'#191d26'); g.addColorStop(0.25,'#101319'); g.addColorStop(1,'#07080c');
    ctx.fillStyle=g; ctx.fillRect(-20,hor,W+40,H-hor+20);
    // 起终点横线（带霓虹光带）
    const drawLineAt = (wx, col, alpha, glowCol)=>{
      const sx = w2s(wx);
      if(sx>-60 && sx<W+60){
        if(glowCol){
          const gg = ctx.createLinearGradient(sx-14,0,sx+14,0);
          gg.addColorStop(0,'rgba(0,0,0,0)'); gg.addColorStop(0.5,glowCol); gg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.globalAlpha=0.30; ctx.fillStyle=gg; ctx.fillRect(sx-14, hor, 28, H-hor);
        }
        ctx.globalAlpha=alpha; ctx.fillStyle=col;
        ctx.fillRect(sx-3, hor, 6, H-hor); ctx.globalAlpha=1;
      }
    };
    drawLineAt(0,'#c8cede',0.5,'rgba(57,210,255,0.55)');
    drawLineAt(TRACK_LEN,'#c8cede',0.5,'rgba(255,210,63,0.55)');

    // 车道虚线
    ctx.fillStyle='rgba(200,210,230,0.22)';
    const dashStart = Math.floor(camX/6)*6;
    for(let wx=dashStart; wx<camX+W/S+6; wx+=6){
      const sx=w2s(wx);
      ctx.fillRect(sx, (yOpp+yPl)/2-8, 3, 16);
    }
    // 上下边线（底部一层低透明青色假辉光）
    ctx.fillStyle='rgba(57,210,255,0.05)';
    ctx.fillRect(0, yOpp-34*S/26-2, W, 6);
    ctx.fillRect(0, yPl+8-2, W, 7);
    ctx.fillStyle='rgba(200,210,230,0.13)';
    ctx.fillRect(0, yOpp-34*S/26, W, 2);
    ctx.fillRect(0, yPl+8, W, 3);

    /* --- 路灯 --- */
    const lampStart = Math.floor((camX-10)/30)*30;
    for(let wx=lampStart; wx<camX+W/S+30; wx+=30){
      const sx=w2s(wx);
      const lg = ctx.createRadialGradient(sx, hor-52, 4, sx, hor-52, 85);
      lg.addColorStop(0,'rgba(255,190,110,0.16)'); lg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(sx, hor-52, 85, 0, 7); ctx.fill();
      ctx.strokeStyle='rgba(140,150,170,0.4)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx, hor-48); ctx.lineTo(sx, hor-6); ctx.stroke();
      ctx.fillStyle='#ffca7a'; ctx.beginPath(); ctx.arc(sx, hor-50, 3, 0, 7); ctx.fill();
    }

    /* --- 人群（起点附近） --- */
    if(camX < 40){
      for(const p of this.crowd){
        const sx = w2s(p.wx);
        if(sx<-20||sx>W+20) continue;
        const y = hor - 10 - p.dy;
        ctx.fillStyle=p.c; ctx.fillRect(sx-2, y-6, 4, 7);
        ctx.beginPath(); ctx.arc(sx, y-8, 2.4, 0, 7); ctx.fill();
        if(p.stick){ ctx.fillStyle=p.sc; ctx.fillRect(sx+3, y-12, 1.6, 7); }
      }
    }

    /* --- 距离牌 / 起点 / 终点 --- */
    const boardStart = Math.max(50, Math.ceil((camX-6)/50)*50);
    for(let wx=boardStart; wx<=TRACK_LEN-10; wx+=50){
      const sx=w2s(wx);
      if(sx<-40||sx>W+40) continue;
      ctx.fillStyle='rgba(30,36,48,0.9)'; ctx.fillRect(sx-16, hor-34, 32, 15);
      ctx.strokeStyle='rgba(90,100,120,0.8)'; ctx.lineWidth=1; ctx.strokeRect(sx-16, hor-34, 32, 15);
      ctx.fillStyle='#9aa4ba'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(wx+'m', sx, hor-26);
    }
    const drawGantry = (wx, label, checker)=>{
      const sx=w2s(wx);
      if(sx<-80||sx>W+80) return;
      ctx.strokeStyle='rgba(150,160,180,0.75)'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(sx, hor); ctx.lineTo(sx, hor-92); ctx.stroke();
      // 横幅
      const bw=118, bh=30, bx=sx-bw*0.35, by=hor-124;
      ctx.fillStyle='#181c26'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle='#4a5468'; ctx.lineWidth=2; ctx.strokeRect(bx, by, bw, bh);
      /* 霓虹灯管描边（起点青色 / 终点金色） */
      ctx.save();
      ctx.shadowColor = checker ? '#ffd23f' : '#39d2ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = checker ? 'rgba(255,210,63,0.95)' : 'rgba(57,210,255,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx+1, by+1, bw-2, bh-2);
      ctx.restore();
      if(checker){
        const cs=7;
        for(let i=0;i<Math.floor(bw/cs);i++) for(let j=0;j<2;j++){
          if((i+j)%2===0){ ctx.fillStyle='#dfe4ee'; ctx.fillRect(bx+i*cs, by+j*cs, cs, cs); }
          else { ctx.fillStyle='#12141c'; ctx.fillRect(bx+i*cs, by+j*cs, cs, cs); }
        }
        ctx.fillStyle='#12141c'; ctx.fillRect(bx, by+bh*0.62, bw, bh*0.38);
      }
      ctx.fillStyle=checker?'#ffd23f':'#9aa4ba';
      ctx.font='bold 13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(label, bx+bw/2, by+bh*0.8);
    };
    drawGantry(0, 'START', false);
    drawGantry(TRACK_LEN, 'FINISH 402m', true);

    /* --- 烟雾粒子（车后） --- */
    this.updateParticles(dt);
    this.drawParticles(ctx, camX, S);

    /* --- 车辆 --- */
    const oppSX = w2s(op.x), plSX = w2s(pl.x);
    const oppVis = race.oppCar.vis, plVis = race.player.vis;
    const offL = clamp(-op.lastAcc*0.008, -0.045, 0.02);
    const offP = clamp(-pl.lastAcc*0.008, -0.045, 0.02);
    drawCar(ctx, oppSX, yOpp, So, oppVis, race.oppCar.rot,
      {pitch:offL, boost:op.boost, limiter:op.limiter, slip:op.slip, brake:op.finishT!=null, nitro:op.nitroActive});
    drawCar(ctx, plSX, yPl, S, plVis, race.player.rot,
      {pitch:offP, boost:pl.boost, limiter:pl.limiter, slip:pl.slip, brake:pl.finishT!=null, nitro:pl.nitroActive, lights:true});

    /* 对手出屏指示 */
    if(oppSX > W+40 || oppSX < -40){
      const ahead = op.x > pl.x;
      const ex = ahead ? W-26 : 26;
      ctx.fillStyle='rgba(255,90,90,0.9)';
      ctx.beginPath();
      if(ahead){ ctx.moveTo(ex+8,yOpp-14); ctx.lineTo(ex-8,yOpp-24); ctx.lineTo(ex-8,yOpp-4); }
      else { ctx.moveTo(ex-8,yOpp-14); ctx.lineTo(ex+8,yOpp-24); ctx.lineTo(ex+8,yOpp-4); }
      ctx.closePath(); ctx.fill();
    }

    /* --- 速度线（氮气时更密，叠加发光） --- */
    const spd = pl.v;
    if(spd>33 || pl.nitroActive){
      const n = Math.min(16, Math.floor((spd-30)/4) + (pl.nitroActive?8:0));
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle= pl.nitroActive ? 'rgba(150,180,255,0.16)' : 'rgba(180,195,230,0.13)';
      ctx.lineWidth=2;
      for(let i=0;i<n;i++){
        const yy = hor+10+((i*53+Math.floor(pl.x*3))%(H-hor-20));
        const len = spd*0.14;
        const xx = (i*127+performance.now()*spd*0.4)%(W+len);
        ctx.beginPath(); ctx.moveTo(xx-len, yy); ctx.lineTo(xx, yy); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    /* --- 暗角 --- */
    if(this.vign) ctx.drawImage(this.vign, 0, 0, W, H);
    /* --- 氮气：紫色边缘脉冲 --- */
    if(pl.nitroActive && this.nosVign){
      ctx.globalAlpha = 0.5 + 0.22*Math.sin(performance.now()/90);
      ctx.drawImage(this.nosVign, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    /* --- 中央提示 --- */
    if(race.flash && race.flash.ttl>0){
      race.flash.ttl -= dt;
      const f = race.flash;
      const a = Math.min(1, f.ttl*2.5);
      const sc = 1 + Math.max(0,(f.ttl-0.75))*2;
      ctx.save();
      ctx.translate(W/2, hor*0.52); ctx.scale(sc,sc); ctx.globalAlpha=a;
      ctx.fillStyle=f.color; ctx.font='900 46px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor=f.color; ctx.shadowBlur=24;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    /* 起步提示 */
    if(race.phase==='staging'){
      ctx.fillStyle='rgba(190,200,220,0.85)';
      ctx.font='600 15px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('轰油门！把指针保持在绿色起步区间', W/2, hor-84);
    }

    /* --- 仪表盘 --- */
    this.drawTach(ctx, race, S);
  },

  /* ---------- 粒子 ---------- */
  spawnSmoke(wx, laneY, vBack, scale){
    if(this.particles.length>220) return;
    this.particles.push({
      wx, y:laneY-4, vx:vBack+(Math.random()*3-1.5), vy:-(14+Math.random()*30),
      r:(5+Math.random()*6)*scale, life:0.7+Math.random()*0.5, max:1.1,
      si:(Math.random()*3)|0, rot:Math.random()*Math.PI*2,
    });
  },
  updateParticles(dt){
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.wx+=p.vx*dt; p.y+=p.vy*dt; p.r+=26*dt; p.life-=dt; p.rot+=dt*0.7;
      if(p.life<=0) this.particles.splice(i,1);
    }
  },
  drawParticles(ctx, camX, S){
    const GA = (typeof GameAssets !== 'undefined') ? GameAssets : null;
    for(const p of this.particles){
      const sx=(p.wx-camX)*S;
      if(sx<-60||sx>this.W+60) continue;
      ctx.globalAlpha = Math.max(0, Math.min(0.38, p.life/p.max*0.42));
      const img = GA && GA.smoke[p.si % GA.smoke.length];
      if(img && img.complete && img.naturalWidth > 0){
        /* CC0 软烟雾贴图（Kenney）：柔和边缘比实心圆更自然 */
        const r = p.r*2.6;
        ctx.save();
        ctx.translate(sx, p.y); ctx.rotate(p.rot);
        ctx.drawImage(img, -r/2, -r/2, r, r);
        ctx.restore();
      } else {
        ctx.fillStyle='#b9bfca';
        ctx.beginPath(); ctx.arc(sx, p.y, p.r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  },

  /* ---------- 仪表盘 ---------- */
  drawTach(ctx, race, S){
    const W=this.W, H=this.H;
    const k = clamp(Math.min(W,H)/760, 0.72, 1.12) * (H > W ? 0.88 : 1);
    const r = 88*k, cx = W*0.5;
    /* 竖屏：仪表抬升到底部触控区之上（横屏贴底） */
    const cy = (H > W) ? H - r - 128 : H - r - 16;
    const pl = race.player.sim;
    const w = pl.getWindows();
    const ang = rpm => (135 + 270*clamp(rpm,0,8000)/8000)*Math.PI/180;

    // 底盘
    ctx.fillStyle='rgba(10,12,17,0.78)';
    ctx.beginPath(); ctx.arc(cx,cy,r+10,0,7); ctx.fill();
    ctx.strokeStyle = pl.limiter ? '#f87171' : '#39415a';
    ctx.lineWidth = 2.5;
    if(pl.limiter){ ctx.shadowColor='#f87171'; ctx.shadowBlur=14; }
    ctx.stroke(); ctx.shadowBlur=0;

    // 红区
    ctx.beginPath(); ctx.arc(cx,cy,r-4,ang(7300),ang(8000));
    ctx.strokeStyle='rgba(248,113,113,0.85)'; ctx.lineWidth=6*k; ctx.stroke();

    // 动态区间
    const zone = (lo,hi,col,lw)=>{ ctx.beginPath(); ctx.arc(cx,cy,r-4,ang(lo),ang(hi)); ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.stroke(); };
    if(race.phase==='staging'){
      zone(w.launch.lo, w.launch.hi, '#4ade80', 9*k);
      ctx.fillStyle='#4ade80'; ctx.font=`bold ${11*k}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('起步区间', cx, cy-r-2);
    } else {
      zone(w.perfect.lo-1100, w.perfect.lo, 'rgba(74,222,128,0.35)', 7*k);
      zone(w.perfect.lo, w.perfect.hi, '#4ade80', 9*k);
      ctx.fillStyle='#4ade80'; ctx.font=`bold ${11*k}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('完美换挡区', cx, cy-r-2);
    }

    // 刻度
    ctx.strokeStyle='#7f8aa3'; ctx.lineWidth=2;
    ctx.fillStyle='#9aa4ba'; ctx.font=`600 ${11*k}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(let i=0;i<=8;i++){
      const a=ang(i*1000);
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*(r-14*k), cy+Math.sin(a)*(r-14*k));
      ctx.lineTo(cx+Math.cos(a)*(r-4), cy+Math.sin(a)*(r-4));
      ctx.stroke();
      ctx.fillText(String(i), cx+Math.cos(a)*(r-24*k), cy+Math.sin(a)*(r-24*k));
    }
    ctx.beginPath();
    for(let i=0;i<16;i++){ const a=ang(i*500);
      ctx.moveTo(cx+Math.cos(a)*(r-9*k), cy+Math.sin(a)*(r-9*k));
      ctx.lineTo(cx+Math.cos(a)*(r-4), cy+Math.sin(a)*(r-4));
    }
    ctx.lineWidth=1; ctx.stroke();

    // 指针
    const na = ang(pl.rpm);
    const inWin = race.phase!=='staging' && pl.rpm>=w.perfect.lo && pl.rpm<=w.perfect.hi;
    ctx.strokeStyle = inWin ? '#4ade80' : (pl.limiter?'#f87171':'#e8ecf4');
    ctx.lineWidth=3.5; ctx.lineCap='round';
    if(inWin){ ctx.shadowColor='#4ade80'; ctx.shadowBlur=8; }
    ctx.beginPath();
    ctx.moveTo(cx-Math.cos(na)*10, cy-Math.sin(na)*10);
    ctx.lineTo(cx+Math.cos(na)*(r-20*k), cy+Math.sin(na)*(r-20*k));
    ctx.stroke(); ctx.shadowBlur=0; ctx.lineCap='butt';

    // 中心盖 + 数字
    ctx.fillStyle='#1a2029'; ctx.beginPath(); ctx.arc(cx,cy,15*k,0,7); ctx.fill();
    ctx.strokeStyle='#39415a'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#ffd23f'; ctx.font=`900 ${30*k}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(race.phase==='staging'?'N':String(pl.gear+1), cx, cy+2);
    ctx.fillStyle='#8a93a6'; ctx.font=`600 ${10*k}px sans-serif`;
    ctx.fillText(pl.limiter?'断油!':`${Math.round(pl.v*3.6)} km/h`, cx, cy+r*0.62);
    ctx.fillText('RPM ×1000', cx, cy+r*0.80);

    // 涡轮条 + 氮气条
    const bh=r*1.5, by=cy-bh/2;
    const bar=(bx, bw, frac, stops, label, active, activeCol)=>{
      ctx.fillStyle='rgba(10,12,17,0.78)';
      ctx.beginPath(); ctx.roundRect(bx-6,by-6,bw+12,bh+12,6); ctx.fill();
      ctx.strokeStyle='#39415a'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.roundRect(bx-6,by-6,bw+12,bh+12,6); ctx.stroke();
      const fh=bh*clamp(frac,0,1);
      const g2=ctx.createLinearGradient(0,by+bh,0,by);
      stops.forEach(([p,c])=>g2.addColorStop(p,c));
      ctx.fillStyle=g2;
      if(fh>2){ ctx.beginPath(); ctx.roundRect(bx, by+bh-fh, bw, fh, 3); ctx.fill(); }
      if(active){
        ctx.strokeStyle=activeCol; ctx.shadowColor=activeCol; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.roundRect(bx-6,by-6,bw+12,bh+12,6); ctx.stroke(); ctx.shadowBlur=0;
      }
      ctx.fillStyle='#5f6982'; ctx.font=`600 ${10*k}px sans-serif`; ctx.textAlign='center';
      ctx.fillText(label, bx+bw/2, by+bh+16);
    };
    const bx=cx-r-34*k, bw=14*k;
    bar(bx, bw, pl.boost, [[0,'#1668d6'],[0.6,'#39d2ff'],[1,'#b5f3ff']], '涡轮', pl.boost>=0.99, '#39d2ff');
    const nx=bx-28*k, nw=12*k;
    bar(nx, nw, pl.nitroTank||0, [[0,'#5a2ed6'],[0.6,'#7f6dff'],[1,'#c9bfff']], '氮气', pl.nitroActive, '#b39dff');
  },
};

/* ================= 车辆绘制 ================= */
function bodyPath(ctx){
  ctx.beginPath();
  ctx.moveTo(-2.12,-0.24);
  ctx.lineTo(-2.2,-0.52);
  ctx.quadraticCurveTo(-2.22,-0.72,-1.95,-0.80);
  ctx.lineTo(-1.15,-0.90);
  ctx.quadraticCurveTo(-0.75,-0.94,-0.40,-1.22);
  ctx.lineTo(-0.25,-1.31);
  ctx.lineTo(0.30,-1.31);
  ctx.quadraticCurveTo(0.75,-1.28,1.00,-0.95);
  ctx.lineTo(1.95,-0.78);
  ctx.quadraticCurveTo(2.22,-0.72,2.22,-0.50);
  ctx.lineTo(2.16,-0.24);
  ctx.lineTo(1.92,-0.24);
  ctx.quadraticCurveTo(1.45,-0.98,0.98,-0.24);
  ctx.lineTo(-0.98,-0.24);
  ctx.quadraticCurveTo(-1.45,-0.98,-1.92,-0.24);
  ctx.closePath();
}
function shade(hex, amt){
  const n = parseInt(hex.slice(1),16);
  const r = clamp((n>>16)+amt,0,255), g=clamp((n>>8&255)+amt,0,255), b=clamp((n&255)+amt,0,255);
  return `rgb(${r},${g},${b})`;
}
/* --- 轮眉宽体（APEX 式）：盖在轮胎上沿，铆钉款带固定螺栓；经典车体专属 --- */
function drawFenders(ctx, vis){
  const fd = vis.fender ?? 0;
  if(!fd) return;
  const arc = (wx, R, lw, style) => {
    ctx.save();
    if(style === 3){ /* 一体碳纤宽体 */
      ctx.strokeStyle = CARBON; ctx.lineWidth = lw; ctx.lineCap = 'butt';
    } else {
      ctx.strokeStyle = 'rgba(13,15,20,0.95)'; ctx.lineWidth = lw;
    }
    ctx.beginPath(); ctx.arc(wx, -0.34, R, Math.PI, Math.PI * 2); ctx.stroke();
    if(style === 3){ /* 碳纤纹路高光 */
      ctx.strokeStyle = CARBON_HI; ctx.lineWidth = lw * 0.18;
      ctx.beginPath(); ctx.arc(wx, -0.34, R - lw * 0.32, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    }
    if(style === 2){ /* 铆钉 */
      ctx.fillStyle = 'rgba(210,218,232,0.85)';
      for(let a = Math.PI * 1.14; a < Math.PI * 1.9; a += Math.PI * 0.19){
        ctx.beginPath();
        ctx.arc(wx + Math.cos(a) * R, -0.34 + Math.sin(a) * R, 0.028, 0, 7);
        ctx.fill();
      }
    }
    ctx.restore();
  };
  const conf = fd === 1 ? {R: 0.52, lw: 0.075}
             : fd === 2 ? {R: 0.60, lw: 0.085}
             : {R: 0.56, lw: 0.10};
  arc(1.45, conf.R, conf.lw, fd);
  arc(-1.45, conf.R, conf.lw, fd);
}
function drawWheel(ctx, cx, cy, style, rot){
  ctx.fillStyle='#111318';
  ctx.beginPath(); ctx.arc(cx,cy,0.345,0,7); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.65)'; ctx.lineWidth=0.03; ctx.stroke();
  const r=0.215;
  const gold = style===4;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.fillStyle = gold?'#7a611c':'#6f757f';
  ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
  const rimCol = gold?'#d4af37':'#c8cdd6';
  const spokes = [{n:0},{n:5,w:0.095},{n:10,w:0.05},{n:15,w:0.032},{n:6,w:0.115}][style];
  if(spokes.n===0){
    ctx.fillStyle=rimCol;
    ctx.beginPath(); ctx.arc(0,0,r*0.72,0,7); ctx.fill();
    ctx.fillStyle='#3a3f4a';
    for(let i=0;i<4;i++){ const a=i*Math.PI/2+0.4; ctx.beginPath(); ctx.arc(Math.cos(a)*r*0.4, Math.sin(a)*r*0.4, r*0.14, 0, 7); ctx.fill(); }
  } else {
    ctx.fillStyle=rimCol;
    for(let i=0;i<spokes.n;i++){
      ctx.save(); ctx.rotate(i*2*Math.PI/spokes.n);
      ctx.beginPath();
      ctx.moveTo(-spokes.w/2,-r*0.16);
      ctx.lineTo(spokes.w/2,-r*0.16);
      ctx.lineTo(spokes.w*0.28,-r);
      ctx.lineTo(-spokes.w*0.28,-r);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  if(gold){ ctx.strokeStyle='#f0d060'; ctx.lineWidth=0.045; ctx.beginPath(); ctx.arc(0,0,r*0.86,0,7); ctx.stroke(); }
  ctx.strokeStyle=rimCol; ctx.lineWidth=0.035;
  ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.stroke();
  ctx.fillStyle='#2a2e38'; ctx.beginPath(); ctx.arc(0,0,0.055,0,7); ctx.fill();
  ctx.restore();
}
function drawDecal(ctx, vis){
  ctx.save();
  bodyPath(ctx); ctx.clip();
  if(vis.decal===1){
    ctx.fillStyle='rgba(244,242,236,0.92)';
    ctx.fillRect(-2.3,-0.88,4.6,0.11);
    ctx.fillStyle='rgba(24,26,32,0.92)';
    ctx.fillRect(-2.3,-0.77,4.6,0.09);
    ctx.fillStyle='rgba(244,242,236,0.92)';
    ctx.fillRect(-2.3,-0.68,4.6,0.11);
  } else if(vis.decal===2){
    ctx.fillStyle='#f4f2ec';
    ctx.beginPath(); ctx.arc(0.55,-0.60,0.30,0,7); ctx.fill();
    ctx.strokeStyle='#22242a'; ctx.lineWidth=0.035; ctx.stroke();
    ctx.save(); ctx.scale(0.05,0.05);
    ctx.fillStyle='#22242a'; ctx.font='bold 11px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('07', 11, -12.2);
    ctx.restore();
  } else if(vis.decal===3){
    ctx.fillStyle='rgba(255,110,26,0.92)';
    ctx.beginPath();
    ctx.moveTo(2.18,-0.92);
    ctx.quadraticCurveTo(1.55,-0.98,1.10,-0.62);
    ctx.quadraticCurveTo(1.42,-0.64,1.28,-0.40);
    ctx.quadraticCurveTo(0.98,-0.50,0.72,-0.34);
    ctx.quadraticCurveTo(1.18,-0.30,1.52,-0.36);
    ctx.quadraticCurveTo(1.95,-0.30,2.18,-0.50);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,210,63,0.9)';
    ctx.beginPath();
    ctx.moveTo(2.18,-0.78);
    ctx.quadraticCurveTo(1.72,-0.86,1.38,-0.58);
    ctx.quadraticCurveTo(1.68,-0.60,1.55,-0.42);
    ctx.quadraticCurveTo(1.30,-0.48,1.10,-0.38);
    ctx.quadraticCurveTo(1.60,-0.36,1.90,-0.42);
    ctx.closePath(); ctx.fill();
  } else if(vis.decal===4){
    ctx.fillStyle='#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0.95,-0.92); ctx.lineTo(0.45,-0.58); ctx.lineTo(0.68,-0.54);
    ctx.lineTo(0.30,-0.26); ctx.lineTo(0.38,-0.56); ctx.lineTo(0.18,-0.60);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=0.02; ctx.stroke();
  } else if(vis.decal===5){
    ctx.fillStyle='#f4f2ec';
    ctx.save(); ctx.translate(0.5,-0.60); ctx.beginPath();
    for(let i=0;i<5;i++){
      const a=-Math.PI/2+i*2*Math.PI/5, a2=a+Math.PI/5;
      ctx.lineTo(Math.cos(a)*0.26, Math.sin(a)*0.26);
      ctx.lineTo(Math.cos(a2)*0.11, Math.sin(a2)*0.11);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
/* ---------- 自定义涂装：车身图案与贴花 ---------- */
function drawPattern(ctx, vis){
  const p = vis.pattern || 0;
  if(!p) return;
  const pc = vis.patternColor || '#111318';
  if(p===1){            // 双色车顶
    ctx.fillStyle = pc;
    ctx.fillRect(-0.55, -1.37, 1.15, 0.30);
  } else if(p===2){     // 渐变涂装（自车顶向下淡出）
    const g = ctx.createLinearGradient(0,-1.31,0,-0.42);
    g.addColorStop(0, pc); g.addColorStop(1, pc+'00');
    ctx.fillStyle = g;
    ctx.fillRect(-2.3, -1.37, 4.6, 1.0);
  } else if(p===3){     // 斜纹拉花
    ctx.save();
    ctx.rotate(-0.18);
    ctx.fillStyle = pc;
    for(let i=0;i<12;i++) ctx.fillRect(-3.1+i*0.5, -1.6, 0.17, 2.4);
    ctx.restore();
  } else if(p===4){     // 赛道格纹带
    ctx.fillStyle = pc;
    for(let i=0;i<30;i++) for(let j=0;j<2;j++){
      if((i+j)%2===0) ctx.fillRect(-2.2+i*0.15, -0.78+j*0.15, 0.15, 0.15);
    }
  }
}
function hexLum(hex){
  const n = parseInt(hex.slice(1),16);
  return (0.299*(n>>16&255) + 0.587*(n>>8&255) + 0.114*(n&255)) / 255;
}
function drawStickers(ctx, vis, o){
  const list = vis.stickers;
  if(!list || !list.length) return;
  ctx.save();
  bodyPath(ctx); ctx.clip();
  let si = 0;
  for(const st of list){
    const slot = STICKER_SLOT[st.pos] || STICKER_SLOT.door;
    const px = (typeof st.x==='number') ? st.x : slot[0];
    const py = (typeof st.y==='number') ? st.y : slot[1];
    const r = [0.13,0.19,0.26][st.size||0];
    const col = st.color || '#ffd23f';
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = col;
    if(st.shape==='badge'){
      ctx.beginPath(); ctx.arc(0,0,r,0,7); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=0.02; ctx.stroke();
      ctx.save();
      ctx.scale(0.05,0.05);
      ctx.fillStyle = hexLum(col)>0.55 ? '#1a1c22' : '#f2f2f2';
      ctx.font='bold 9px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(st.text||'07').slice(0,3), 0, 0);
      ctx.restore();
    } else if(st.shape==='star'){
      ctx.beginPath();
      for(let i=0;i<5;i++){
        const a=-Math.PI/2+i*2*Math.PI/5, a2=a+Math.PI/5;
        ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        ctx.lineTo(Math.cos(a2)*r*0.45, Math.sin(a2)*r*0.45);
      }
      ctx.closePath(); ctx.fill();
    } else if(st.shape==='bolt'){
      ctx.beginPath();
      ctx.moveTo(r*0.5,-r); ctx.lineTo(-r*0.45,r*0.15); ctx.lineTo(-r*0.05,r*0.2);
      ctx.lineTo(-r*0.55,r); ctx.lineTo(r*0.4,-r*0.1); ctx.lineTo(0,-r*0.18);
      ctx.closePath(); ctx.fill();
    } else {              // bars 斜纹块
      ctx.rotate(-0.3);
      ctx.fillRect(-r*1.1,-r*0.85,r*2.2,r*0.42);
      ctx.fillRect(-r*1.1,r*0.1,r*2.2,r*0.42);
    }
    ctx.restore();
    /* 编辑态指示圈：悬停高亮 / 拖动中虚线 */
    if(o && o.stickersActive){
      const drag = o.activeSticker===si, hover = o.hoverSticker===si;
      ctx.save();
      if(drag){ ctx.strokeStyle='rgba(255,210,63,0.95)'; ctx.lineWidth=0.03; ctx.setLineDash([0.07,0.055]); }
      else if(hover){ ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=0.028; }
      else { ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=0.022; ctx.setLineDash([0.06,0.05]); }
      ctx.beginPath(); ctx.arc(px,py,r+0.06,0,7); ctx.stroke();
      ctx.restore();
    }
    si++;
  }
  ctx.restore();
}

/* ---------- 外观包围套件绘制 ---------- */
const CARBON = '#202329', CARBON_HI = '#3d434f';
/* 各排气类型的尾焰锚点 */
const FLAME_POS = [[-2.18,-0.30],[-2.29,-0.28],[-0.22,-0.105],[-1.02,-0.292]];

function drawKit(ctx, vis, col){
  const fb = vis.frontBumper ?? 0, rb = vis.rearBumper ?? 0, ss = vis.sideSkirt ?? 0;
  const wing = vis.wing ?? 1, hood = vis.hood ?? 0, ex = vis.exhaust ?? 0;

  /* --- 侧包围 --- */
  if(ss===0){
    ctx.fillStyle='rgba(12,14,19,0.9)';
    ctx.fillRect(-1.0,-0.24,2.0,0.10);
  } else if(ss===1){
    ctx.fillStyle='rgba(12,14,19,0.92)';
    ctx.beginPath();
    ctx.moveTo(-1.08,-0.22); ctx.lineTo(1.08,-0.22);
    ctx.lineTo(1.02,-0.40); ctx.lineTo(-1.02,-0.40); ctx.closePath(); ctx.fill();
  } else if(ss===2){
    ctx.fillStyle=CARBON;
    ctx.beginPath();
    ctx.moveTo(-1.10,-0.22); ctx.lineTo(1.10,-0.22);
    ctx.lineTo(1.04,-0.42); ctx.lineTo(-1.04,-0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CARBON_HI; ctx.lineWidth=0.018;
    ctx.beginPath(); ctx.moveTo(-0.9,-0.30); ctx.lineTo(0.9,-0.30); ctx.stroke();
  } else {
    ctx.fillStyle='rgba(12,14,19,0.92)';
    ctx.beginPath();
    ctx.moveTo(-1.16,-0.22); ctx.lineTo(1.16,-0.22);
    ctx.lineTo(1.10,-0.42); ctx.lineTo(-1.10,-0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle=shade(col,-55);
    ctx.fillRect(1.0,-0.72,0.13,0.5);
    ctx.fillRect(-1.16,-0.72,0.13,0.5);
    ctx.fillStyle='rgba(10,12,16,0.85)';
    ctx.beginPath();
    ctx.moveTo(-0.98,-0.66); ctx.lineTo(-0.84,-0.62);
    ctx.lineTo(-0.84,-0.50); ctx.lineTo(-0.98,-0.54);
    ctx.closePath(); ctx.fill();
  }

  /* --- 前包围 --- */
  if(fb===0){
    ctx.fillStyle='rgba(12,14,19,0.9)';
    ctx.fillRect(1.72,-0.26,0.52,0.09);
  } else if(fb===1){
    ctx.fillStyle='rgba(12,14,19,0.95)';
    ctx.beginPath();
    ctx.moveTo(1.5,-0.24); ctx.lineTo(2.50,-0.24);
    ctx.lineTo(2.42,-0.36); ctx.lineTo(1.55,-0.38); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.02,-0.52); ctx.lineTo(2.30,-0.46);
    ctx.lineTo(2.28,-0.37); ctx.lineTo(2.04,-0.42); ctx.closePath(); ctx.fill();
  } else if(fb===2){
    ctx.fillStyle=CARBON;
    ctx.beginPath();
    ctx.moveTo(1.45,-0.24); ctx.lineTo(2.52,-0.24);
    ctx.lineTo(2.44,-0.38); ctx.lineTo(1.50,-0.40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CARBON_HI; ctx.lineWidth=0.016;
    ctx.beginPath(); ctx.moveTo(1.62,-0.31); ctx.lineTo(2.40,-0.30); ctx.stroke();
    ctx.fillStyle=CARBON;
    ctx.beginPath();
    ctx.moveTo(1.86,-0.50); ctx.lineTo(2.14,-0.46);
    ctx.lineTo(2.12,-0.40); ctx.lineTo(1.88,-0.44); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.02,-0.60); ctx.lineTo(2.24,-0.57);
    ctx.lineTo(2.23,-0.51); ctx.lineTo(2.04,-0.54); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle='rgba(12,14,19,0.95)';
    ctx.beginPath();
    ctx.moveTo(1.45,-0.24); ctx.lineTo(2.50,-0.24);
    ctx.lineTo(2.44,-0.38); ctx.lineTo(1.50,-0.38); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.90,-0.62); ctx.lineTo(2.24,-0.56);
    ctx.lineTo(2.22,-0.42); ctx.lineTo(1.92,-0.46); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CARBON_HI; ctx.lineWidth=0.02;
    ctx.beginPath(); ctx.moveTo(1.98,-0.56); ctx.lineTo(2.20,-0.52); ctx.stroke();
  }

  /* --- 后包围 --- */
  if(rb===0){
    ctx.fillStyle='rgba(12,14,19,0.9)';
    ctx.fillRect(-2.34,-0.30,0.20,0.16);
  } else if(rb===1){
    ctx.fillStyle=CARBON;
    ctx.beginPath();
    ctx.moveTo(-2.42,-0.20); ctx.lineTo(-1.90,-0.20);
    ctx.lineTo(-1.95,-0.34); ctx.lineTo(-2.44,-0.34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CARBON_HI; ctx.lineWidth=0.015;
    for(let i=0;i<4;i++){
      const x=-2.36+i*0.12;
      ctx.beginPath(); ctx.moveTo(x,-0.21); ctx.lineTo(x-0.03,-0.33); ctx.stroke();
    }
  } else if(rb===2){
    ctx.fillStyle='rgba(12,14,19,0.95)';
    ctx.beginPath();
    ctx.moveTo(-2.20,-0.22); ctx.lineTo(-2.46,-0.22);
    ctx.lineTo(-2.44,-0.32); ctx.lineTo(-2.20,-0.34); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle='rgba(12,14,19,0.95)';
    ctx.beginPath();
    ctx.moveTo(-2.42,-0.18); ctx.lineTo(-1.85,-0.18);
    ctx.lineTo(-1.90,-0.36); ctx.lineTo(-2.44,-0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle=shade(col,-55);
    ctx.fillRect(-1.34,-0.74,0.13,0.52);
  }

  /* --- 尾翼 --- */
  if(wing===1){
    ctx.strokeStyle=shade(col,-70); ctx.lineWidth=0.07;
    ctx.beginPath(); ctx.moveTo(-1.92,-0.84); ctx.lineTo(-2.26,-1.04); ctx.stroke();
    ctx.fillStyle=shade(col,-70);
    ctx.beginPath();
    ctx.moveTo(-2.38,-1.10); ctx.lineTo(-2.12,-1.06);
    ctx.lineTo(-2.10,-0.99); ctx.lineTo(-2.36,-1.02);
    ctx.closePath(); ctx.fill();
  } else if(wing===2 || wing===3){
    ctx.strokeStyle='rgba(18,20,26,0.95)'; ctx.lineWidth=0.05;
    ctx.beginPath();
    ctx.moveTo(-1.74,-0.86); ctx.lineTo(-1.92,-1.22);
    ctx.moveTo(-2.06,-0.86); ctx.lineTo(-2.20,-1.22);
    ctx.stroke();
    ctx.fillStyle='#14161c';
    ctx.beginPath();
    ctx.moveTo(-2.50,-1.22); ctx.lineTo(-1.64,-1.28);
    ctx.lineTo(-1.62,-1.38); ctx.lineTo(-2.52,-1.32);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-2.54,-1.38,0.10,0.20);
    ctx.fillRect(-1.66,-1.42,0.08,0.18);
    if(wing===3){
      ctx.strokeStyle='rgba(18,20,26,0.95)'; ctx.lineWidth=0.035;
      ctx.beginPath();
      ctx.moveTo(-2.10,-1.30); ctx.lineTo(-2.16,-1.52);
      ctx.moveTo(-1.94,-1.30); ctx.lineTo(-1.98,-1.52);
      ctx.stroke();
      ctx.fillStyle='#14161c';
      ctx.beginPath();
      ctx.moveTo(-2.44,-1.52); ctx.lineTo(-1.72,-1.56);
      ctx.lineTo(-1.70,-1.66); ctx.lineTo(-2.46,-1.62);
      ctx.closePath(); ctx.fill();
    }
  }

  /* --- 机箱盖（引擎盖） --- */
  ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=0.014;
  ctx.beginPath(); ctx.moveTo(1.04,-0.87); ctx.quadraticCurveTo(1.5,-0.82,2.02,-0.72); ctx.stroke();
  if(hood===1){
    ctx.fillStyle=CARBON;
    ctx.beginPath();
    ctx.moveTo(1.02,-0.935); ctx.lineTo(1.95,-0.775);
    ctx.lineTo(2.20,-0.70); ctx.lineTo(2.20,-0.55);
    ctx.lineTo(1.90,-0.685); ctx.lineTo(1.05,-0.815);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=CARBON_HI; ctx.lineWidth=0.012;
    ctx.beginPath(); ctx.moveTo(1.15,-0.87); ctx.lineTo(2.05,-0.72); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.35,-0.87); ctx.lineTo(2.12,-0.66); ctx.stroke();
  } else if(hood===2){
    ctx.fillStyle=shade(col,-45);
    ctx.beginPath();
    ctx.moveTo(1.24,-0.83); ctx.lineTo(1.62,-0.795);
    ctx.lineTo(1.60,-0.94); ctx.lineTo(1.27,-0.98);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(8,10,14,0.9)';
    ctx.beginPath();
    ctx.moveTo(1.27,-0.975); ctx.lineTo(1.60,-0.935);
    ctx.lineTo(1.59,-0.885); ctx.lineTo(1.29,-0.925);
    ctx.closePath(); ctx.fill();
  } else if(hood===3){
    ctx.fillStyle='rgba(10,12,16,0.9)';
    for(let i=0;i<3;i++){
      const x=1.30+i*0.22;
      ctx.beginPath();
      ctx.moveTo(x,-0.80); ctx.lineTo(x+0.15,-0.755);
      ctx.lineTo(x+0.15,-0.71); ctx.lineTo(x,-0.755);
      ctx.closePath(); ctx.fill();
    }
  }

  /* --- 尾气筒（排气） --- */
  if(ex===0){
    ctx.fillStyle='#3a3f4a';
    ctx.fillRect(-2.24,-0.36,0.10,0.09);
  } else if(ex===1){
    for(const y of [-0.35,-0.22]){
      ctx.fillStyle='#565e6e';
      ctx.beginPath(); ctx.arc(-2.28,y,0.058,0,7); ctx.fill();
      ctx.fillStyle='#101216';
      ctx.beginPath(); ctx.arc(-2.28,y,0.038,0,7); ctx.fill();
    }
  } else if(ex===2){
    for(const x of [-0.15,0.12]){
      ctx.fillStyle='#565e6e';
      ctx.beginPath(); ctx.arc(x,-0.105,0.05,0,7); ctx.fill();
      ctx.fillStyle='#101216';
      ctx.beginPath(); ctx.arc(x,-0.105,0.032,0,7); ctx.fill();
    }
  } else {
    ctx.fillStyle='#8b929e';
    ctx.fillRect(-0.92,-0.335,1.45,0.085);
    ctx.fillStyle='rgba(0,0,0,0.25)';
    for(let i=0;i<5;i++) ctx.fillRect(-0.80+i*0.26,-0.335,0.03,0.085);
    ctx.fillStyle='#565e6e';
    ctx.beginPath(); ctx.arc(-0.94,-0.292,0.068,0,7); ctx.fill();
    ctx.fillStyle='#101216';
    ctx.beginPath(); ctx.arc(-0.94,-0.292,0.042,0,7); ctx.fill();
  }
}

function drawCar(ctx, x, y, s, vis, rot, o){
  o = o||{};
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if(!o.noShadow){
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0,-0.02,2.45,0.15,0,0,7); ctx.fill();
  }
  /* 底盘霓虹灯（APEX 式）：地面彩色光池呼吸脉动；倒影层跳过 */
  if(vis.underglow && !o.noShadow){
    const gOpt = (typeof GLOW_OPTIONS !== 'undefined') ? GLOW_OPTIONS[vis.underglow] : null;
    if(gOpt && gOpt.c){
      ctx.save();
      ctx.globalAlpha = 0.30 + 0.14*Math.sin(performance.now()/320);
      ctx.shadowColor = gOpt.c; ctx.shadowBlur = 18;
      ctx.fillStyle = gOpt.c;
      ctx.beginPath(); ctx.ellipse(0, 0.03, 2.75, 0.17, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  ctx.translate(0,-0.62); ctx.rotate(o.pitch||0); ctx.translate(0,0.62);

  /* CC0 贴图车支持：素材已裁剪 alpha 边界并统一朝右，加载失败自动回退程序化车身 */
  const GA = (typeof GameAssets !== 'undefined') ? GameAssets : null;
  const sprEntry = vis.sprite && GA && GA.cars[vis.sprite];
  const sprOk = !!(sprEntry && sprEntry.img.complete && sprEntry.img.naturalWidth > 0);

  const col = vis.color;
  /* 大灯颜色（APEX 式灯光改装） */
  const hl = (typeof HEADLIGHT_OPTIONS !== 'undefined' && HEADLIGHT_OPTIONS[vis.headlight]) ? HEADLIGHT_OPTIONS[vis.headlight] : (typeof HEADLIGHT_OPTIONS !== 'undefined' ? HEADLIGHT_OPTIONS[0] : null);
  /* 车灯前照光锥 */
  if(o.lights!==false){
    ctx.fillStyle = hl ? hl.glow + '0.04)' : 'rgba(255,230,170,0.035)';
    ctx.beginPath();
    ctx.moveTo(2.1,-0.55); ctx.lineTo(5.4,-1.15); ctx.lineTo(5.4,-0.05); ctx.closePath(); ctx.fill();
  }
  if(sprOk){
    /* 贴图车：素材车身（轮毂已烘焙），阴影/光锥/尾焰仍走公共逻辑 */
    const img = sprEntry.img;
    const h = 4.6 * img.naturalHeight / img.naturalWidth;
    ctx.drawImage(img, -2.3, -h, 4.6, h);
  } else {
  /* 车身 */
  bodyPath(ctx);
  ctx.fillStyle = col; ctx.fill();
  ctx.save(); bodyPath(ctx); ctx.clip();
  /* 车漆质感（APEX 式）：光泽 / 哑光 / 金属漆 / 镀铬 */
  const FIN_STOPS = [
    [[0,'rgba(255,255,255,0.22)'],[0.3,'rgba(255,255,255,0.04)'],[0.75,'rgba(0,0,0,0.12)'],[1,'rgba(0,0,0,0.42)']],
    [[0,'rgba(255,255,255,0.07)'],[0.5,'rgba(255,255,255,0.02)'],[1,'rgba(0,0,0,0.24)']],
    [[0,'rgba(255,255,255,0.44)'],[0.16,'rgba(255,255,255,0.10)'],[0.55,'rgba(255,255,255,0.04)'],[1,'rgba(0,0,0,0.52)']],
    [[0,'rgba(255,255,255,0.78)'],[0.28,'rgba(222,232,246,0.30)'],[0.52,'rgba(0,0,0,0.20)'],[0.78,'rgba(255,255,255,0.12)'],[1,'rgba(0,0,0,0.64)']],
  ];
  const grad = ctx.createLinearGradient(0,-1.31,0,-0.2);
  for(const [p,c] of (FIN_STOPS[vis.finish] || FIN_STOPS[0])) grad.addColorStop(p, c);
  ctx.fillStyle=grad; ctx.fillRect(-2.3,-1.35,4.6,1.2);
  drawPattern(ctx, vis);
  ctx.restore();
  drawDecal(ctx, vis);
  bodyPath(ctx);
  ctx.strokeStyle='rgba(8,10,14,0.7)'; ctx.lineWidth=0.028; ctx.stroke();

  /* 轮拱暗部 */
  ctx.fillStyle='#0c0e13';
  ctx.beginPath(); ctx.arc(1.45,-0.34,0.44,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(-1.45,-0.34,0.44,0,7); ctx.fill();

  /* 车窗 */
  ctx.beginPath();
  ctx.moveTo(0.92,-0.97); ctx.lineTo(0.28,-1.24); ctx.lineTo(-0.20,-1.24); ctx.lineTo(-0.78,-0.93);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0,-1.24,0,-0.9);
  wg.addColorStop(0,'rgba(140,170,215,0.85)'); wg.addColorStop(1,'rgba(30,40,60,0.95)');
  ctx.fillStyle=wg; ctx.fill();
  ctx.strokeStyle='rgba(10,12,18,0.8)'; ctx.lineWidth=0.025; ctx.stroke();
  // B柱
  ctx.strokeStyle=shade(col,-60); ctx.lineWidth=0.05;
  ctx.beginPath(); ctx.moveTo(0.04,-1.24); ctx.lineTo(0.08,-0.92); ctx.stroke();

  /* 外观包围套件（前/后/侧包围、尾翼、机盖、排气） */
  drawKit(ctx, vis, col);
  /* 自定义贴花最后绘制（可自由拖动），避免被轮拱暗部/机盖/套件遮挡 */
  drawStickers(ctx, vis, o);

  /* 门缝与把手 */
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=0.02;
  ctx.beginPath(); ctx.moveTo(0.42,-0.9); ctx.quadraticCurveTo(0.5,-0.6,0.44,-0.3); ctx.stroke();
  ctx.fillStyle='rgba(20,22,28,0.8)'; ctx.fillRect(0.02,-0.74,0.16,0.04);
  /* 后视镜 */
  ctx.fillStyle=shade(col,-30);
  ctx.beginPath(); ctx.moveTo(0.95,-1.0); ctx.lineTo(1.13,-1.06); ctx.lineTo(1.13,-0.96); ctx.closePath(); ctx.fill();

  /* 车灯 */
  if(o.lights!==false && hl){
    ctx.fillStyle=hl.c; ctx.fillRect(1.98,-0.68,0.20,0.10);
    ctx.shadowColor=hl.glow + '0.9)'; ctx.shadowBlur=8;
    ctx.fillRect(1.98,-0.68,0.20,0.10);
    ctx.shadowBlur=0;
  }
  ctx.fillStyle=o.brake?'#ff3b30':'#a03028';
  if(o.brake){ ctx.shadowColor='#ff3b30'; ctx.shadowBlur=0.15; }
  ctx.fillRect(-2.2,-0.66,0.10,0.09);
  ctx.shadowBlur=0;
  }

  /* 尾焰（涡轮/断油/氮气）：位置随排气套件变化；贴图车用素材排气锚点 */
  const flame = (o.boost>0.8 || o.limiter || o.nitro);
  if(flame && !o.noFlame){
    const fp = sprOk ? sprEntry.flame : (FLAME_POS[vis.exhaust ?? 0] || FLAME_POS[0]);
    let len, fg;
    if(o.nitro){
      len = 0.9+Math.random()*0.5;
      fg = ctx.createLinearGradient(fp[0],0,fp[0]-len,0);
      fg.addColorStop(0,'rgba(215,240,255,0.95)');
      fg.addColorStop(0.4,'rgba(90,150,255,0.85)');
      fg.addColorStop(1,'rgba(60,90,255,0)');
    } else {
      len = o.limiter ? 0.5+Math.random()*0.5 : 0.25+o.boost*0.4+Math.random()*0.15;
      fg = ctx.createLinearGradient(fp[0],0,fp[0]-len,0);
      fg.addColorStop(0,'rgba(255,240,200,0.95)');
      fg.addColorStop(0.4,'rgba(255,140,40,0.8)');
      fg.addColorStop(1,'rgba(255,60,20,0)');
    }
    ctx.fillStyle=fg;
    /* 尾焰辉光（shadowBlur 为设备像素，不受 transform 缩放影响） */
    ctx.shadowColor = o.nitro ? 'rgba(90,150,255,0.85)' : 'rgba(255,140,40,0.75)';
    ctx.shadowBlur = o.nitro ? 24 : 14;
    ctx.beginPath();
    ctx.moveTo(fp[0],fp[1]-0.06); ctx.lineTo(fp[0],fp[1]+0.06);
    ctx.lineTo(fp[0]-len,fp[1]+Math.random()*0.05); ctx.closePath(); ctx.fill();
    ctx.shadowBlur=0;
  }

  /* 车轮（贴图车的轮毂已烘焙在素材内） */
  if(!sprOk){
    drawWheel(ctx, 1.45, -0.34, vis.wheel, rot);
    drawWheel(ctx, -1.45, -0.34, vis.wheel, rot);
    drawFenders(ctx, vis); /* 轮眉盖在轮胎上沿 */
  }

  ctx.restore();
}

/* ---------- 车库/主菜单预览 ---------- */
Render.drawPreview = function(cv, vis, opts){
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const workshop = !!(opts && opts.workshop);
  ctx.clearRect(0,0,W,H);
  let g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#161c2b'); g.addColorStop(1,'#0b0e15');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  if(workshop){
    /* ---- 改装间车间环境（仅车库调用） ---- */
    // 墙面竖向面板缝
    ctx.strokeStyle='rgba(255,255,255,0.045)'; ctx.lineWidth=1;
    for(let x=W*0.08; x<W; x+=W*0.085){
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H*0.66); ctx.stroke();
    }
    // 顶部霓虹灯管 + 向下光锥
    const tubeY = H*0.075;
    ctx.save();
    ctx.shadowColor='#8ad4ff'; ctx.shadowBlur=16;
    ctx.fillStyle='rgba(160,220,255,0.95)';
    ctx.fillRect(W*0.14, tubeY, W*0.72, 3);
    ctx.restore();
    g = ctx.createLinearGradient(0,tubeY,0,H*0.8);
    g.addColorStop(0,'rgba(140,210,255,0.10)'); g.addColorStop(1,'rgba(140,210,255,0)');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.moveTo(W*0.14,tubeY+3); ctx.lineTo(W*0.86,tubeY+3);
    ctx.lineTo(W*0.97,H*0.8); ctx.lineTo(W*0.03,H*0.8);
    ctx.closePath(); ctx.fill();
    // 墙上霓虹招牌
    ctx.save();
    ctx.font=`bold ${Math.max(13, H*0.052)}px sans-serif`; ctx.textAlign='center';
    ctx.shadowColor='#ff8a2a'; ctx.shadowBlur=12;
    ctx.fillStyle='rgba(255,160,80,0.9)';
    ctx.fillText('SPEED SHOP · 改装间', W*0.5, H*0.20);
    ctx.restore();
    // 角落剪影：工具柜（左）与轮胎垛（右）
    ctx.fillStyle='rgba(12,15,22,0.85)';
    const cabW=W*0.052, cabH=H*0.30, cabX=W*0.035, cabY=H*0.84-cabH;
    ctx.fillRect(cabX, cabY, cabW, cabH);
    ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1;
    for(let i=1;i<4;i++){
      ctx.beginPath(); ctx.moveTo(cabX, cabY+cabH*i/4); ctx.lineTo(cabX+cabW, cabY+cabH*i/4); ctx.stroke();
    }
    for(let i=0;i<4;i++){
      const ty=H*0.84-(i+0.5)*H*0.052, tw=W*0.052, tx=W-tw*1.6;
      ctx.fillStyle='rgba(12,15,22,0.85)';
      ctx.beginPath(); ctx.ellipse(tx, ty, tw*0.55, H*0.026, 0, 0, 7); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.ellipse(tx, ty, tw*0.28, H*0.011, 0, 0, 7); ctx.stroke();
    }
  }
  g = ctx.createRadialGradient(W/2,H*0.38,10,W/2,H*0.38,W*0.55);
  g.addColorStop(0,'rgba(120,150,220,0.18)'); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // 地面网格
  const gy = H*0.84;
  ctx.strokeStyle='rgba(90,110,150,0.18)'; ctx.lineWidth=1;
  for(let i=0;i<10;i++){
    const y = gy + i*i*1.15;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
  const s = Math.min(W/6.6, H/3.4);
  drawCar(ctx, W/2, gy, s, vis, -0.35, Object.assign({lights:true}, opts||{}));
  // 倒影
  ctx.save();
  ctx.translate(0,gy); ctx.scale(1,-0.42); ctx.translate(0,-gy);
  ctx.globalAlpha=0.13;
  drawCar(ctx, W/2, gy, s, vis, -0.35, Object.assign({noShadow:true, noFlame:true}, opts||{}, {stickersActive:false}));
  ctx.restore();
};
