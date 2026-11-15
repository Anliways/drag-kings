'use strict';
/* ================= 车辆物理 ================= */
const P = {
  IDLE:900, REDLINE:7800,
  GEARS:[3.4,2.3,1.65,1.28,1.03,0.86], FINAL:3.9, WHEEL_R:0.34,
  MASS:1250, CDA:0.80, RR:14, RHO:1.2, G:9.81,
  NITRO_BOOST:0.35,  // 氮气扭矩加成
  NITRO_TIME:4.0,    // 满罐可持续秒数
};

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function smoothstep(t){ t=clamp(t,0,1); return t*t*(3-2*t); }
function gauss(){ return (Math.random()+Math.random()+Math.random())/1.5-1; } // 近似 -1..1，中间集中

/* 扭矩曲线：0.66R 处峰值 1.04，红线处 0.84 */
function torqueCurve(rpm){
  const x = clamp(rpm/P.REDLINE, 0, 1.06);
  if(x<=0.66) return 0.42 + 0.62*Math.pow(x/0.66, 0.85);
  return 1.04 - 0.20*Math.pow((x-0.66)/0.40, 1.5);
}

/* 玩家改装 -> 性能参数 */
function statsFromUpgrades(u){
  return {
    torque:   320*(1+0.18*u.engine),
    boostMax: 0.12 + 0.10*u.turbo,
    spool:    2.6 - 0.26*u.turbo,
    boostRpm: 4600 - 220*u.turbo,
    shiftTime:0.50 - 0.065*u.gearbox,
    grip:     0.95 + 0.11*u.tire,
  };
}
/* 对手定义 -> 性能参数 */
function statsFromOpp(opp){
  return {
    torque: 320*opp.power, boostMax:opp.boost, spool:2.2, boostRpm:4300,
    shiftTime:opp.shiftTime, grip:opp.grip,
  };
}
/* 马力展示（5600rpm 处功率） */
function hpOf(stats){
  const kw = stats.torque*586/1000;
  return { base: Math.round(kw*1.36), boost: Math.round(kw*1.36*(1+stats.boostMax)) };
}
/* 性能分 */
function perfScore(stats){
  return Math.round(stats.torque*(1+stats.boostMax)/320*38
    + (stats.grip-0.9)*45
    + Math.max(0,(0.5-stats.shiftTime))*80);
}

/* ---------- 车辆仿真 ---------- */
class CarSim {
  constructor(stats, opts){
    this.s = stats;
    this.player = !!(opts && opts.player);
    this.reset();
  }
  reset(){
    this.x=0; this.v=0; this.rpm=P.IDLE; this.gear=0;
    this.boost=0; this.slip=0; this.slipRpm=0;
    this.shiftT=0; this.overbT=0; this.earlyT=0; this.launchBonusT=0;
    this.limiter=false; this.limEp=false;
    this.launched=false; this.finishT=null;
    this.throttleSm=0; this.lastAcc=0;
    this.perfectShifts=0; this.spinTime=0; this.topSpeed=0; this.t100=null;
    this.nitroTank=1; this.nitroActive=false; this.nitroEmptyEp=false;
    this.tractionLimited=false;
    this.events=[];
  }
  getWindows(){
    const s=this.s;
    const lc  = 4800 + (s.grip-0.95)*2600;
    const lhw = 420  + (s.grip-0.95)*420;
    const gbLv = clamp((0.5-s.shiftTime)/0.065, 0, 5);
    const pLo = P.REDLINE*(0.875-0.012*gbLv);
    const pHi = P.REDLINE*(0.965+0.004*gbLv);
    return {
      launch:{lo:lc-lhw, hi:lc+lhw, center:lc},
      perfect:{lo:pLo, hi:pHi, center:(pLo+pHi)/2},
    };
  }
  /* tNow: 当前比赛计时（用于记录 0-100 / 冲线时间） */
  step(dt, ctl, tNow){
    const s=this.s;
    if(this.finishT!=null){ // 冲线后滑行减速
      this.v = Math.max(0, this.v-4.5*dt);
      this.x += this.v*dt;
      this.rpm = Math.max(P.IDLE, this.rpm-(this.rpm-P.IDLE)*2.5*dt);
      this.slip = Math.max(0,this.slip-3*dt);
      this.nitroActive=false;
      return;
    }
    if(!this.launched){ this.stagedStep(dt, ctl); return; }

    this.throttleSm += (ctl.throttle-this.throttleSm)*Math.min(1,12*dt);
    const thr = this.throttleSm;

    /* --- 换挡（完美换挡补充氮气） --- */
    if(ctl.shift && this.gear<P.GEARS.length-1 && this.shiftT<=0){
      const w = this.getWindows().perfect, r = this.rpm;
      let q;
      if(r>=w.lo && r<=w.hi){ q='perfect'; this.shiftT=s.shiftTime*0.75; this.overbT=1.6; this.perfectShifts++; this.nitroTank=Math.min(1,this.nitroTank+0.12); }
      else if(r>=w.lo-1100){ q='good'; this.shiftT=s.shiftTime; this.nitroTank=Math.min(1,this.nitroTank+0.05); }
      else { q='early'; this.shiftT=s.shiftTime; this.earlyT=0.9; }
      this.gear++; this.boost*=0.55;
      this.events.push({t:'shifted', q});
      if(q==='perfect') this.events.push({t:'perfect'});
      else if(q==='early') this.events.push({t:'early'});
    }
    if(this.shiftT>0) this.shiftT -= dt;
    const shifting = this.shiftT>0;

    /* --- 发动机转速追踪 --- */
    const ratio = P.GEARS[this.gear]*P.FINAL;
    const wheelRpm = this.v/P.WHEEL_R*60/(2*Math.PI)*ratio;
    const targetRpm = Math.max(P.IDLE, wheelRpm + this.slipRpm);
    const rate = targetRpm>this.rpm ? 9.5 : 6.0;
    this.rpm += (targetRpm-this.rpm)*Math.min(1, rate*dt);

    this.limiter=false;
    if(this.rpm>=P.REDLINE){
      this.rpm=P.REDLINE;
      if(this.gear<P.GEARS.length-1 && !shifting){
        this.limiter=true;
        if(!this.limEp){ this.limEp=true; this.events.push({t:'limiter'}); }
      }
    } else if(this.rpm<P.REDLINE-350) this.limEp=false; // 迟滞：避免红线边缘抖动重复触发

    /* --- 扭矩输出 --- */
    let tq = torqueCurve(this.rpm)*s.torque;
    tq *= 0.35 + 0.65*smoothstep((this.rpm-P.IDLE)/1300);      // 低转"顿挫"
    const spool = thr>0.72 && this.rpm>s.boostRpm && !shifting && !this.limiter;
    if(spool) this.boost = Math.min(1, this.boost+dt/s.spool);
    else      this.boost = Math.max(0, this.boost-dt*1.5);
    tq *= 1 + s.boostMax*this.boost;
    /* --- 主动式氮气：按住释放，打滑时多出的动力只会加剧空转 --- */
    const wantNitro = !!ctl.nitro;
    if(wantNitro && this.nitroTank<=0 && !this.nitroEmptyEp){
      this.nitroEmptyEp=true; this.events.push({t:'nitroEmpty'});
    }
    if(this.nitroTank>0.3) this.nitroEmptyEp=false;
    const nitroActive = wantNitro && this.nitroTank>0;
    if(nitroActive && !this.nitroActive) this.events.push({t:'nitroStart'});
    if(!nitroActive && this.nitroActive) this.events.push({t:'nitroEnd'});
    this.nitroActive = nitroActive;
    if(nitroActive) this.nitroTank = Math.max(0, this.nitroTank - dt/P.NITRO_TIME);
    if(nitroActive) tq *= 1 + P.NITRO_BOOST;
    if(this.overbT>0){ this.overbT-=dt; tq*=1.20; }
    if(this.earlyT>0){ this.earlyT-=dt; tq*=0.85; }
    tq *= thr;
    if(shifting) tq=0;
    if(this.limiter) tq*=0.22;
    const Fdrive = tq*ratio/P.WHEEL_R;

    /* --- 抓地与打滑 --- */
    const transfer = clamp(this.lastAcc*0.045, 0, 0.16);       // 加速重心后移
    if(this.launchBonusT>0) this.launchBonusT-=dt;
    const gripMul = 1 + 0.12*(this.launchBonusT>0?1:0);
    const Fmax = s.grip*P.MASS*P.G*(0.52+transfer)*gripMul;
    this.tractionLimited = Fdrive>Fmax; // 附着极限：此时加动力只会加剧打滑
    let Feff;
    if(Fdrive>Fmax){
      const over = (Fdrive-Fmax)/Fmax;
      this.slip    = Math.min(1.6, this.slip + over*3.4*dt);
      this.slipRpm = Math.min(2800, this.slipRpm + over*9000*dt);
      Feff = Fmax*(1-0.12*Math.min(this.slip,1.2));
      this.spinTime += dt;
    } else {
      Feff = Fdrive;
      this.slip    = Math.max(0, this.slip-2.8*dt);
      this.slipRpm = Math.max(0, this.slipRpm-3200*dt);
    }

    /* --- 合力与位移 --- */
    const drag = 0.5*P.RHO*P.CDA*this.v*this.v + P.RR*this.v;
    const a = (Feff-drag)/P.MASS;
    this.lastAcc = a;
    this.v = Math.max(0, this.v+a*dt);
    this.x += this.v*dt;
    if(this.v*3.6>this.topSpeed) this.topSpeed=this.v*3.6;
    if(this.t100==null && this.v>=27.78) this.t100=tNow;
    if(this.x>=TRACK_LEN){ this.finishT=tNow; this.events.push({t:'finish'}); }
  }
  /* 起步前：原地轰油门 */
  stagedStep(dt, ctl){
    if(ctl.throttle>0.02){
      this.rpm = Math.min(P.REDLINE, this.rpm + 5200*ctl.throttle*dt);
      if(this.rpm>=P.REDLINE){
        this.rpm = P.REDLINE-40;
        this.limiter=true;
        if(!this.limEp){ this.limEp=true; this.events.push({t:'limiter'}); }
      } else {
        this.limiter=false;
        if(this.rpm<P.REDLINE-350) this.limEp=false; // 同样加迟滞
      }
    } else {
      this.rpm -= (this.rpm-P.IDLE)*1.9*dt;
      this.rpm = Math.max(P.IDLE, this.rpm);
      this.limiter=false; this.limEp=false;
    }
    this.throttleSm = ctl.throttle;
    this.boost = 0;
  }
}

/* ---------- 对手 AI ---------- */
class AIController {
  constructor(opp){
    this.sk = opp;
    this.errLaunch = gauss()*opp.launchErr;
    this.errLaunch = clamp(this.errLaunch, -opp.launchErr*1.2, opp.launchErr*1.2);
    this.launchTarget = null;
    this.nextShiftRpm = null;
    this.limT = 0;
  }
  step(dt, sim){
    const w = sim.getWindows();
    if(this.launchTarget==null) this.launchTarget = w.launch.center + this.errLaunch;
    if(sim.finishT!=null) return {throttle:0, shift:false};
    if(!sim.launched){ // 原地控转速
      let th;
      if(sim.rpm < this.launchTarget-140) th=0.9;
      else if(sim.rpm > this.launchTarget+140) th=0;
      else th=0.16;
      return {throttle:th, shift:false};
    }
    let th = 1;
    if(sim.slip>0.26) th = Math.max(0.48, 1-this.sk.feather*sim.slip*1.15); // 收油防打滑
    let shift = false;
    if(this.nextShiftRpm==null) this.nextShiftRpm = w.perfect.center + gauss()*this.sk.shiftErr;
    if(sim.rpm>=this.nextShiftRpm) shift=true;
    if(sim.limiter){ this.limT+=dt; if(this.limT>=this.sk.lateBounce+0.04) shift=true; }
    else this.limT=0;
    if(shift) this.nextShiftRpm=null;
    /* 氮气使用水平随技术分层：高手等到功率受限段再喷，菜鸟一起步就烧完 */
    let nitro=false;
    if(this.sk.feather>=0.8) nitro = !sim.tractionLimited;
    else if(this.sk.feather>=0.5) nitro = sim.gear>=2;
    else nitro = true;
    return {throttle:th, shift, nitro};
  }
}

/* ---------- 车库性能预估（完美驾驶模拟） ---------- */
function simulateRun(stats){
  const sim = new CarSim(stats, {});
  const w = sim.getWindows();
  sim.launched = true;
  sim.rpm = w.launch.center;
  sim.launchBonusT = 0.9;
  let t=0, top=0, guard=0;
  const dt = 1/120;
  while(sim.finishT==null && t<45 && guard++<6000){
    let th = 1;
    if(sim.slip>0.35) th = Math.max(0.6, 1-sim.slip*0.8);
    const shift = sim.rpm>=w.perfect.center && sim.gear<P.GEARS.length-1;
    const nitro = !sim.tractionLimited; // 完美驾驶：离开附着极限段才喷氮
    sim.step(dt, {throttle:th, shift, nitro}, t);
    t+=dt; top=Math.max(top, sim.v);
  }
  return { t100:sim.t100, quarter:sim.finishT, top:Math.round(top*3.6) };
}
