'use strict';
/* ================= WebAudio 合成音效 ================= */
const AudioSys = {
  ctx:null, master:null, eng:null, enabled:true, ready:false,

  ensure(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return false;
    try{ this.ctx = new AC(); }catch(e){ return false; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // 白噪声缓冲
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
    this.ready = true;
    return true;
  },
  setEnabled(on){
    this.enabled = on;
    if(this.master) this.master.gain.value = on ? 0.9 : 0;
  },

  _distCurve(k){
    const n = 512, c = new Float32Array(n);
    for(let i=0;i<n;i++){ const x = i/(n-1)*2-1; c[i] = Math.tanh(k*x); }
    return c;
  },

  startEngine(){
    if(!this.ensure() || this.eng) return;
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0;
    const filt = c.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=800; filt.Q.value=1.1;
    const shaper = c.createWaveShaper(); shaper.curve = this._distCurve(3.2);
    const o1 = c.createOscillator(); o1.type='sawtooth';
    const o2 = c.createOscillator(); o2.type='square';
    const og2 = c.createGain(); og2.gain.value = 0.55;
    o1.connect(shaper); o2.connect(og2); og2.connect(shaper);
    shaper.connect(filt); filt.connect(g); g.connect(this.master);
    // 进气噪声
    const nSrc = c.createBufferSource(); nSrc.buffer=this.noiseBuf; nSrc.loop=true;
    const nFilt = c.createBiquadFilter(); nFilt.type='bandpass'; nFilt.frequency.value=900; nFilt.Q.value=0.6;
    const nGain = c.createGain(); nGain.gain.value=0;
    nSrc.connect(nFilt); nFilt.connect(nGain); nGain.connect(this.master);
    // 涡轮哨声
    const tOsc = c.createOscillator(); tOsc.type='sine'; tOsc.frequency.value=900;
    const tGain = c.createGain(); tGain.gain.value=0;
    tOsc.connect(tGain); tGain.connect(this.master);
    // 轮胎摩擦
    const sSrc = c.createBufferSource(); sSrc.buffer=this.noiseBuf; sSrc.loop=true;
    const sFilt = c.createBiquadFilter(); sFilt.type='bandpass'; sFilt.frequency.value=750; sFilt.Q.value=0.8;
    const sGain = c.createGain(); sGain.gain.value=0;
    sSrc.connect(sFilt); sFilt.connect(sGain); sGain.connect(this.master);
    // 氮气喷射气流
    const n2Src = c.createBufferSource(); n2Src.buffer=this.noiseBuf; n2Src.loop=true;
    const n2Filt = c.createBiquadFilter(); n2Filt.type='highpass'; n2Filt.frequency.value=2000;
    const n2Gain = c.createGain(); n2Gain.gain.value=0;
    n2Src.connect(n2Filt); n2Filt.connect(n2Gain); n2Gain.connect(this.master);
    o1.start(); o2.start(); nSrc.start(); tOsc.start(); sSrc.start(); n2Src.start();
    this.eng = {o1,o2,filt,g,nGain,tOsc,tGain,sGain,n2Gain,srcs:[nSrc,sSrc,n2Src]};
  },
  stopEngine(){
    const e = this.eng; if(!e) return;
    try{
      e.o1.stop(); e.o2.stop(); e.tOsc.stop();
      e.srcs.forEach(s=>s.stop());
    }catch(err){}
    this.eng = null;
  },
  updateEngine(rpm, throttle, limiter, slip, boost, nitro){
    const e = this.eng; if(!e || !this.ctx) return;
    const t = this.ctx.currentTime;
    const f = Math.min(560, Math.max(30, rpm/60*2));
    e.o1.frequency.setTargetAtTime(f, t, 0.02);
    e.o2.frequency.setTargetAtTime(f*0.5, t, 0.02);
    e.filt.frequency.setTargetAtTime(320 + rpm*0.22, t, 0.05);
    let vol = (0.14 + 0.30*throttle) * (0.32 + 0.68*Math.min(1,rpm/7800));
    if(limiter) vol *= (Math.floor(t*30)%2===0 ? 1 : 0.12); // 断油"嘭嘭"
    vol *= 0.42;
    e.g.gain.setTargetAtTime(vol, t, 0.03);
    e.nGain.gain.setTargetAtTime(0.015 + throttle*0.045, t, 0.08);
    e.tOsc.frequency.setTargetAtTime(700 + boost*2400, t, 0.06);
    e.tGain.gain.setTargetAtTime(boost*0.035*(throttle>0.7?1:0.15), t, 0.07);
    e.sGain.gain.setTargetAtTime(slip>0.3 ? Math.min(0.20,(slip-0.3)*0.28) : 0, t, 0.05);
    e.n2Gain.gain.setTargetAtTime(nitro ? 0.09 : 0, t, 0.04);
  },

  _noiseBurst(dur, f0, f1, vol, type){
    if(!this.ensure()) return;
    const c=this.ctx, t=c.currentTime;
    const src=c.createBufferSource(); src.buffer=this.noiseBuf;
    const bp=c.createBiquadFilter(); bp.type=type||'bandpass'; bp.Q.value=1.4;
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(Math.max(60,f1),t+dur);
    const g=c.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t+dur+0.05);
  },
  blowoff(strong){
    if(!this.ensure()) return;
    this._noiseBurst(strong?0.30:0.20, strong?3200:2400, 650, strong?0.28:0.16);
  },
  backfire(){
    if(!this.ensure()) return;
    const c=this.ctx, t=c.currentTime;
    const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(85,t); o.frequency.exponentialRampToValueAtTime(45,t+0.09);
    const g=c.createGain(); g.gain.setValueAtTime(0.5,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+0.12);
    this._noiseBurst(0.06, 2400, 900, 0.2, 'highpass');
  },
  beep(freq, dur, vol, type){
    if(!this.ensure()) return;
    const c=this.ctx, t=c.currentTime;
    const o=c.createOscillator(); o.type=type||'square'; o.frequency.value=freq;
    const g=c.createGain();
    g.gain.setValueAtTime(vol||0.2, t); g.gain.setValueAtTime(vol||0.2, t+(dur||0.12)-0.015);
    g.gain.linearRampToValueAtTime(0.0001, t+(dur||0.12));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+(dur||0.12)+0.02);
  },
  seq(notes, gap, dur, vol, type){
    if(!this.ensure()) return;
    notes.forEach((n,i)=> setTimeout(()=>this.beep(n, dur, vol, type), i*gap*1000));
  },
  coin(){ this.seq([1318,1760],0.07,0.09,0.14,'sine'); },
  win(){ this.seq([523,659,784,1046],0.11,0.20,0.18,'triangle'); },
  lose(){ this.seq([392,311,262],0.18,0.26,0.15,'triangle'); },
  click(){ this.beep(760,0.04,0.10); },
  perfectChime(){ this.seq([1046,1568],0.06,0.09,0.13,'sine'); },
};
