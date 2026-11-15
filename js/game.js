'use strict';
/* ================= 游戏主循环 ================= */
function makeRace(idx){
  const opp=OPPONENTS[idx];
  const pStats=statsFromUpgrades(UI.save.up);
  const oStats=statsFromOpp(opp);
  return {
    oppIdx:idx, opp, phase:'staging', paused:false,
    stagingT:0, raceT:0, greenAt:2.7,
    lights:{a1:false,a2:false,a3:false,g:false},
    flash:null,
    player:{
      sim:new CarSim(pStats,{player:true}),
      vis:playerVisual(UI.save),
      rot:0, reaction:null, heldAtGreen:false, launch:null, launchText:'',
    },
    oppCar:{
      sim:new CarSim(oStats,{}),
      vis:oppVisual(opp),
      rot:0, ai:new AIController(opp),
    },
    update(dt, input){
      if(this.paused) return;
      const pl=this.player, oc=this.oppCar;
      if(this.phase==='staging'){
        this.stagingT+=dt;
        const L=this.lights;
        const setL=(k,t)=>{ if(!L[k] && this.stagingT>=t){ L[k]=true; AudioSys.beep(520,0.12,0.18); } };
        setL('a1',0.9); setL('a2',1.5); setL('a3',2.1);
        pl.sim.step(dt, {throttle:(input.gas||Game.pad.gas)?1:0, shift:false}, 0);
        const octl=oc.ai.step(dt, oc.sim);
        oc.sim.step(dt, octl, 0);
        if(this.stagingT>=this.greenAt){
          this.phase='racing'; this.raceT=0;
          L.a1=L.a2=L.a3=false; L.g=true;
          AudioSys.beep(880,0.42,0.24);
          this.flash={text:'GO!', color:'#4ade80', ttl:0.9};
          /* 玩家起步评价 */
          const sim=pl.sim, w=sim.getWindows(), r=sim.rpm;
          sim.launched=true;
          if(r>=w.launch.lo && r<=w.launch.hi){
            pl.launch='perfect'; pl.launchText='完美弹射';
            sim.launchBonusT=0.9; UI.popup('完美弹射!','perfect'); Render.addShake(3);
          } else if(r>w.launch.hi){
            pl.launch='spin'; pl.launchText='起步打滑'; UI.popup('转速过高，打滑了!','bad');
          } else if(r<w.launch.lo-500){
            pl.launch='bog'; pl.launchText='起步无力'; UI.popup('转速太低，起步无力','bad');
          } else { pl.launch='good'; pl.launchText='良好起步'; }
          if((input.gas||Game.pad.gas)){ pl.reaction=0; pl.heldAtGreen=true; UI.popup('完美预判 0.00s','info'); }
          /* 对手起步评价（不加成显示） */
          const os=oc.sim, ow=os.getWindows(), orr=os.rpm;
          os.launched=true;
          if(orr>=ow.launch.lo && orr<=ow.launch.hi) os.launchBonusT=0.9;
        }
      }
      else if(this.phase==='racing'){
        this.raceT+=dt;
        const os=oc.sim;
        if(!os.launched && this.raceT>=this.opp.react) os.launched=true;
        let pctl={throttle:(input.gas||Game.pad.gas)?1:0, shift:input.shiftQ||Game.pad.shiftQ, nitro:input.nitro||Game.pad.nitro};
        input.shiftQ=false; Game.pad.shiftQ=false;
        if(Game.auto){
          const w=pl.sim.getWindows();
          pctl.throttle = pl.sim.slip>0.35?Math.max(0.6,1-pl.sim.slip*0.8):1;
          pctl.shift = pl.sim.rpm>=w.perfect.center && pl.sim.gear<P.GEARS.length-1;
          pl.heldAtGreen=true;
          Game.pad.shiftQ=false; /* 自动驾驶吞掉手柄升挡请求，避免退出 auto 后残留 */
        }
        pl.sim.step(dt, pctl, this.raceT);
        if((input.gas||Game.pad.gas) && pl.reaction==null && !pl.heldAtGreen) pl.reaction=this.raceT;
        const octl=oc.ai.step(dt, os);
        os.step(dt, octl, this.raceT);
        /* 车轮转动 */
        pl.rot += pl.sim.v/P.WHEEL_R*dt;
        oc.rot += os.v/P.WHEEL_R*dt;
        if(pl.sim.finishT!=null && this.phase==='racing' && pl.sim.finishT!==null && !pl.flashFinish){
          pl.flashFinish=true;
        }
        if((pl.sim.finishT!=null && os.finishT!=null) || this.raceT>30){
          this.phase='done'; this.doneT=0;
        }
      }
      else if(this.phase==='done'){
        this.doneT+=dt;
        this.player.sim.step(dt,{throttle:0,shift:false},this.raceT);
        this.oppCar.sim.step(dt,{throttle:0,shift:false},this.raceT);
        this.player.rot += this.player.sim.v/P.WHEEL_R*dt;
        this.oppCar.rot += this.oppCar.sim.v/P.WHEEL_R*dt;
        if(this.doneT>1.2){ this.phase='over'; Game.endRace(); }
      }
    },
  };
}

const Game = {
  state:'menu', race:null, input:{gas:false, shiftQ:false, nitro:false},
  pad:{gas:false, shiftQ:false, nitro:false}, _gpPrev:{shift:false, pause:false},
  auto:false, lastT:0, acc:0, popupCd:{},

  init(){
    if(!CanvasRenderingContext2D.prototype.roundRect){
      CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){
        const r=Math.min(6,w/2,h/2);
        this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r);
        this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+w,y,r); this.closePath(); return this;
      };
    }
    Render.init(document.getElementById('raceCanvas'));
    UI.init();
    this.bindInput();
    this.bindRaceButtons();
    this.bindClientShell();
    requestAnimationFrame(t=>this.loop(t));
  },

  /* ---------- 客户端外壳：启动画面 / PWA / 全屏 / 横屏提示 ---------- */
  bindClientShell(){
    /* 启动画面：点击开始（同时完成音频解锁）；淡出用 rAF 驱动（帧同步） */
    const boot=document.getElementById('bootScreen');
    if(boot){
      const dismiss=()=>{
        if(boot.classList.contains('boot-out')) return;
        AudioSys.ensure();
        boot.classList.add('boot-out');
        const t0=performance.now();
        const fade=()=>{
          if(performance.now()-t0 >= 500) boot.classList.add('hidden');
          else requestAnimationFrame(fade);
        };
        requestAnimationFrame(fade);
      };
      boot.addEventListener('pointerdown', dismiss);
      boot.addEventListener('keydown', dismiss);
    }
    /* PWA：仅 http(s) 注册 Service Worker（file:// 自动跳过，游戏本体不受影响） */
    if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
      const hadController=!!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange', ()=>{
        /* 首次安装静默；存在旧控制器时才提示为版本更新 */
        if(hadController) UI.toast('🚀 已更新到新版本，离线可玩');
      });
    }
    /* 全屏切换 */
    const fsBtn=document.getElementById('btnFs');
    if(fsBtn) fsBtn.onclick=()=>{
      AudioSys.click();
      try{
        if(document.fullscreenElement){ document.exitFullscreen(); }
        else if(document.documentElement.requestFullscreen){ document.documentElement.requestFullscreen().catch(()=>{}); }
      }catch(err){}
    };
    /* 画布上禁用右键菜单（客户端手感） */
    window.addEventListener('contextmenu', e=>{
      if(e.target && e.target.tagName==='CANVAS') e.preventDefault();
    });
    /* 手柄连接提示 */
    window.addEventListener('gamepadconnected', e=>{
      UI.toast('🎮 手柄已连接：' + ((e.gamepad && e.gamepad.id) || '').slice(0, 24));
    });
    window.addEventListener('gamepaddisconnected', ()=>{
      UI.toast('🎮 手柄已断开');
      this.pad = {gas:false, shiftQ:false, nitro:false};
      this._gpPrev = {shift:false, pause:false};
    });
  },
  /* ---------- 手柄（Gamepad API）：A/RT 油门 · B/RB/Y 升挡 · X/LT 氮气 · Start 暂停 ---------- */
  mapGamepad(gp){
    const btn = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    return {
      gas: btn(0) || btn(7),
      shift: btn(1) || btn(5) || btn(3),
      nitro: btn(2) || btn(6),
      pause: btn(9),
    };
  },
  pollGamepad(){
    if(!navigator.getGamepads) return;
    let gp = null;
    try{
      for(const g of navigator.getGamepads()){ if(g && g.connected){ gp = g; break; } }
    }catch(err){ return; }
    if(!gp){ /* 手柄消失（部分平台 disconnect 事件不可靠）：输入立即复位 */
      this.pad = {gas:false, shiftQ:false, nitro:false};
      this._gpPrev = {shift:false, pause:false};
      return;
    }
    const st = this.mapGamepad(gp);
    this.pad.gas = st.gas;
    this.pad.nitro = st.nitro;
    this.pad.shiftQ = !!(st.shift && !this._gpPrev.shift); /* 升挡沿触发：按一次挡一次 */
    if(st.pause && !this._gpPrev.pause) this.togglePause();
    this._gpPrev = {shift: st.shift, pause: st.pause};
  },
  buzz(pattern){
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(err){}
  },

  /* ---------- 输入 ---------- */
  bindInput(){
    window.addEventListener('keydown', e=>{
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code)) e.preventDefault();
      AudioSys.ensure();
      if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){ this.input.gas=true; }
      if(e.code==='KeyN'){ this.input.nitro=true; }
      if(!e.repeat && ['KeyF','ShiftLeft','ShiftRight','Enter','ArrowRight'].includes(e.code)){ this.input.shiftQ=true; }
      if(e.code==='Escape') this.togglePause();
    });
    window.addEventListener('keyup', e=>{
      if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){ this.input.gas=false; }
      if(e.code==='KeyN'){ this.input.nitro=false; }
    });
    window.addEventListener('pointerdown', ()=>AudioSys.ensure());
    /* 触屏按钮 */
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints>0;
    const gasBtn=document.getElementById('btnGas'), shiftBtn=document.getElementById('btnShift');
    if(isTouch){
      document.getElementById('touchControls').classList.remove('hidden');
      gasBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); gasBtn.setPointerCapture(e.pointerId); this.input.gas=true; gasBtn.classList.add('pressed'); });
      const up=()=>{ this.input.gas=false; gasBtn.classList.remove('pressed'); };
      gasBtn.addEventListener('pointerup', up);
      gasBtn.addEventListener('pointercancel', up);
      shiftBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); this.input.shiftQ=true; shiftBtn.classList.add('pressed'); setTimeout(()=>shiftBtn.classList.remove('pressed'),120); });
      const nosBtn=document.getElementById('btnNos');
      nosBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); nosBtn.setPointerCapture(e.pointerId); this.input.nitro=true; nosBtn.classList.add('pressed'); });
      const nosUp=()=>{ this.input.nitro=false; nosBtn.classList.remove('pressed'); };
      nosBtn.addEventListener('pointerup', nosUp);
      nosBtn.addEventListener('pointercancel', nosUp);
    }
  },
  bindRaceButtons(){
    document.getElementById('btnPause').onclick=()=>this.togglePause();
    document.getElementById('btnResume').onclick=()=>this.togglePause();
    document.getElementById('btnRestart').onclick=()=>{ document.getElementById('pauseOverlay').classList.add('hidden'); this.startRace(this.race.oppIdx); };
    document.getElementById('btnQuit').onclick=()=>{ this.exitRace(); };
    document.getElementById('btnTutClose').onclick=()=>{
      AudioSys.click();
      document.getElementById('tutorialOverlay').classList.add('hidden');
      UI.save.tut=true; persistSave(UI.save);
      if(this.race) this.race.paused=false;
    };
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden && this.state==='race' && this.race && !this.race.paused && this.race.phase!=='over') this.togglePause();
    });
  },

  togglePause(){
    if(this.state!=='race' || !this.race || this.race.phase==='over') return;
    const ov=document.getElementById('pauseOverlay');
    this.race.paused=!this.race.paused;
    ov.classList.toggle('hidden', !this.race.paused);
    if(this.race.paused) AudioSys.stopEngine(); else AudioSys.startEngine();
  },

  /* ---------- 比赛流程 ---------- */
  startRace(idx){
    UI.hideResult();
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('tutorialOverlay').classList.toggle('hidden', !!UI.save.tut);
    document.getElementById('popupLayer').innerHTML='';
    UI.hideScreens();
    document.getElementById('raceHud').classList.remove('hidden');
    document.getElementById('rtP').textContent='';
    document.getElementById('rtO').textContent='';
    this.popupCd={};
    this.race=makeRace(idx);
    this.state='race';
    this.input.gas=false; this.input.shiftQ=false;
    AudioSys.ensure(); AudioSys.startEngine();
    if(!UI.save.tut) this.race.paused=true;
  },
  exitRace(){
    AudioSys.stopEngine();
    UI.hideResult();
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('raceHud').classList.add('hidden');
    this.race=null;
    UI.showScreen('events');
  },

  endRace(){
    const race=this.race;
    const res=computeResults(race);
    this.state='result';
    AudioSys.stopEngine();
    this.buzz(res.win?80:[50,40,50]);
    UI.showResult(res);
  },

  /* ---------- 主循环 ---------- */
  loop(t){
    requestAnimationFrame(tt=>this.loop(tt));
    const dt=Math.min(0.05, (t-this.lastT)/1000 || 0);
    this.lastT=t;
    if((this.state==='race'||this.state==='result') && this.race){
      if(this.state==='race'){
        this.pollGamepad(); /* 暂停时也轮询：Start 键可恢复 */
        if(!this.race.paused){
          this.acc+=dt;
          const step=1/120; let n=0;
          while(this.acc>=step && n<10){
            this.race.update(step, this.input);
            this.acc-=step; n++;
            if(this.race.phase==='over') break;
          }
          this.drainEvents();
          this.updateEngineSound();
        }
      }
      if(this.state==='race'){
        this.updateHud();
        Render.frame(this.race, dt);
      } else {
        Render.frame(this.race, 0);
      }
    }
  },
  drainEvents(){
    const sim=this.race.player.sim;
    if(!sim.events.length) return;
    const now=performance.now();
    for(const ev of sim.events){
      if(ev.t==='perfect'){
        UI.popup('完美换挡! 扭矩+15%','perfect');
        AudioSys.perfectChime(); Render.addShake(3);
      } else if(ev.t==='early'){
        UI.popup('换挡过早!','bad');
      } else if(ev.t==='limiter'){
        if(!this.popupCd.limiter || now-this.popupCd.limiter>800){
          UI.popup('断油!快升挡','bad'); this.popupCd.limiter=now;
        }
        AudioSys.backfire(); Render.addShake(2);
      } else if(ev.t==='finish'){
        UI.popup('冲线!','perfect'); this.buzz(40);
      } else if(ev.t==='nitroStart'){
        if(!this.popupCd.ns || now-this.popupCd.ns>900){
          UI.popup('氮气喷射!','info'); this.popupCd.ns=now;
        }
        Render.addShake(2.5); this.buzz(25);
      } else if(ev.t==='nitroEmpty'){
        if(!this.popupCd.ne || now-this.popupCd.ne>1200){
          UI.popup('氮气耗尽!','bad'); this.popupCd.ne=now;
        }
      } else if(ev.t==='shifted'){
        AudioSys.blowoff(ev.q==='perfect');
      }
    }
    sim.events.length=0;
  },
  updateEngineSound(){
    const sim=this.race.player.sim;
    AudioSys.updateEngine(sim.rpm, (this.input.gas||this.pad.gas)?1:0, sim.limiter, sim.slip, sim.boost, sim.nitroActive);
  },
  updateHud(){
    const r=this.race;
    const timer=document.getElementById('raceTimer');
    timer.textContent=(r.phase==='staging'?0:r.raceT).toFixed(2)+'s';
    const pct=x=>clamp(x/TRACK_LEN*100,0,100)+'%';
    document.getElementById('pPlayer').style.left=pct(r.player.sim.x);
    document.getElementById('pOpp').style.left=pct(r.oppCar.sim.x);
    const gap=document.getElementById('gapText');
    if(r.phase==='racing'||r.phase==='done'){
      const d=r.player.sim.x-r.oppCar.sim.x;
      if(Math.abs(d)>0.5){
        gap.textContent=(d>0?'领先 ':'落后 ')+Math.abs(d).toFixed(1)+'m';
        gap.style.color=d>0?'#4ade80':'#f87171';
      } else { gap.textContent='并驾齐驱!'; gap.style.color='#ffd23f'; }
    } else gap.textContent='';
    /* 灯树 */
    const L=r.lights, on=(id,v)=>document.getElementById(id).classList.toggle('on',v);
    on('ltA1',L.a1); on('ltA2',L.a2); on('ltA3',L.a3); on('ltG',L.g);
    on('ltB1',L.a1); on('ltB2',L.a2); on('ltB3',L.a3); on('ltGO',L.g);
    if(L.g){
      if(document.getElementById('rtP').textContent===''){
        document.getElementById('rtP').textContent = r.player.reaction!=null
          ? (r.player.reaction===0?'预判 0.00s':'反应 '+r.player.reaction.toFixed(2)+'s') : '';
      }
      if(r.raceT>=r.opp.react && document.getElementById('rtO').textContent===''){
        document.getElementById('rtO').textContent='反应 '+r.opp.react.toFixed(2)+'s';
      }
    }
  },
};

/* ---------- 结算 ---------- */
function computeResults(race){
  const pl=race.player, oc=race.oppCar, st=pl.sim, ost=oc.sim;
  const pt=st.finishT, ot=ost.finishT;
  const win = pt!=null && (ot==null || pt<ot);
  const first = !UI.save.beaten[race.oppIdx];
  const base=race.opp.reward;
  let coins=0; const lines=[];
  if(win){
    if(first){ const b=Math.round(base*0.5); coins=base+b; lines.push(['基础奖励',base],['首胜加成',b]); }
    else { coins=Math.round(base*0.45); lines.push(['复赛奖励 (45%)',coins]); }
  } else {
    coins=Math.round(base*0.3); lines.push(['参与奖励',coins]);
  }
  /* 本场评价 */
  let sc=0;
  if(pl.reaction!=null){
    if(pl.reaction<=0.18) sc+=2; else if(pl.reaction<=0.35) sc+=1;
  }
  if(pl.launch==='perfect') sc+=2; else if(pl.launch==='good') sc+=1;
  if(st.perfectShifts>=3) sc+=2; else if(st.perfectShifts>=1) sc+=1;
  if(st.spinTime<0.6) sc+=1;
  if(win) sc+=2;
  const rating = sc>=7?'S':sc>=5?'A':sc>=3?'B':'C';
  const bonus={S:80,A:50,B:25,C:0}[rating];
  if(bonus){ coins+=bonus; lines.push([`评价 ${rating} 加成`,bonus]); }
  /* 写入存档 */
  UI.save.coins+=coins;
  UI.save.races++; if(win) UI.save.wins++;
  if(win && first) UI.save.beaten[race.oppIdx]=true;
  if(pt!=null){
    if(UI.save.best.quarter==null || pt<UI.save.best.quarter) UI.save.best.quarter=pt;
    const ob=UI.save.best.opp[race.oppIdx];
    if(ob==null || pt<ob) UI.save.best.opp[race.oppIdx]=pt;
  }
  persistSave(UI.save);
  return {
    win, pt, ot, margin:(pt!=null&&ot!=null)?Math.abs(pt-ot):null,
    reaction:pl.reaction, launch:pl.launchText,
    perfectShifts:st.perfectShifts, spin:st.spinTime,
    top:Math.round(st.topSpeed), rating, coins, lines, first,
  };
}

/* ---------- 启动 & 调试钩子 ---------- */
Game.init();
window.DR = {
  Game, UI, AudioSys, Render, P, CarSim,
  setGas(v){ Game.input.gas=!!v; },
  setNitro(v){ Game.input.nitro=!!v; },
  shift(){ Game.input.shiftQ=true; },
  skipStaging(){ if(Game.race){ Game.race.stagingT=Game.race.greenAt; } },
  auto(v){ Game.auto=v===undefined?!Game.auto:!!v; },
};
