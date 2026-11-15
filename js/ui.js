'use strict';
/* ================= 界面逻辑 ================= */
const UI = {
  save:null, garageTab:'perf', openEst:null,
  stkDraft:{shape:'badge', text:'07', color:'#ffd23f', pos:'door', size:1},
  hoverStk:null, dragStk:null, dragOff:null,

  init(){
    this.save = loadSave();
    AudioSys.enabled = this.save.sound;
    this.bindStatic();
    this.bindPaintDrag();
    this.showScreen('menu');
    /* 改装间打开时跟随窗口尺寸/方向重排预览画布（多分辨率清晰） */
    window.addEventListener('resize', ()=>{
      if(Game.state!=='garage') return;
      this.resizePreview();
      Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(this.save), this.previewOpts());
      if(this.garageTab==='vis') this.drawPresetMinis();
    });
  },
  /* 预览画布内部分辨率对齐 CSS 尺寸×dpr（jsdom 中 clientWidth 为 0 时回落 920×360） */
  resizePreview(){
    const cv=document.getElementById('previewCanvas');
    if(!cv) return;
    const dpr=Math.min(2, window.devicePixelRatio||1);
    const w=cv.clientWidth||920, h=cv.clientHeight||360;
    const W=Math.round(w*dpr), H=Math.round(h*dpr);
    if(cv.width!==W || cv.height!==H){ cv.width=W; cv.height=H; }
  },
  fmt(n){ return Math.round(n).toLocaleString('en-US'); },
  fmtT(t){ return t==null?'—':t.toFixed(2)+'s'; },

  showScreen(name){
    const map = {menu:'screenMenu', events:'screenEvents', garage:'screenGarage'};
    for(const k in map) document.getElementById(map[k]).classList.toggle('hidden', k!==name);
    if(name==='menu') this.renderMenu();
    if(name==='events') this.renderEvents();
    if(name==='garage'){ this.openEst=null; this.renderGarage(); }
    Game.state = name;
  },
  hideScreens(){
    ['screenMenu','screenEvents','screenGarage'].forEach(id=>document.getElementById(id).classList.add('hidden'));
  },
  refreshCoins(){
    ['coinsEvents','coinsGarage'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent='🪙 '+this.fmt(this.save.coins);
    });
  },

  bindStatic(){
    const $=id=>document.getElementById(id);
    $('btnPlay').onclick = ()=>{ AudioSys.click(); this.showScreen('events'); };
    $('btnGarage').onclick = ()=>{ AudioSys.click(); this.showScreen('garage'); };
    $('btnEventsBack').onclick = ()=>{ AudioSys.click(); this.showScreen('menu'); };
    $('btnGarageBack').onclick = ()=>{ AudioSys.click(); this.showScreen('menu'); };
    $('btnHowto').onclick = ()=>{ AudioSys.click(); $('howtoModal').classList.remove('hidden'); };
    $('btnHowtoClose').onclick = ()=>{ AudioSys.click(); $('howtoModal').classList.add('hidden'); };
    $('btnSound').onclick = ()=>{
      this.save.sound = !this.save.sound;
      AudioSys.setEnabled(this.save.sound);
      persistSave(this.save);
      this.renderSoundBtn();
    };
    $('btnReset').onclick = ()=>{
      if(confirm('确定要重置全部存档吗？金币、改装与进度都会清空。')){
        try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
        this.save = loadSave();
        AudioSys.setEnabled(this.save.sound);
        this.showScreen('menu');
        this.toast('存档已重置');
      }
    };
    $('tabPerf').onclick = ()=>{ this.garageTab='perf'; AudioSys.click(); this.renderGarage(); };
    $('tabVis').onclick = ()=>{ this.garageTab='vis'; AudioSys.click(); this.renderGarage(); };
    this.renderSoundBtn();
  },
  renderSoundBtn(){
    document.getElementById('btnSound').textContent = this.save.sound ? '🔊 音效:开' : '🔇 音效:关';
  },

  /* ---------- 主菜单 ---------- */
  renderMenu(){
    const s=this.save, stats=statsFromUpgrades(s.up);
    document.getElementById('menuStats').innerHTML =
      `<div>性能分 <b>${perfScore(stats)}</b></div>`+
      `<div>金币 <b>🪙 ${this.fmt(s.coins)}</b></div>`+
      `<div>最佳402m <b>${this.fmtT(s.best.quarter)}</b></div>`+
      `<div>战绩 <b>${s.wins}胜</b>/${s.races}场</div>`;
    Render.drawPreview(document.getElementById('menuCar'), playerVisual(s));
  },

  /* ---------- 赛事列表 ---------- */
  renderEvents(){
    this.refreshCoins();
    const s=this.save;
    document.getElementById('eventsSub').textContent =
      `总战绩 ${s.wins}胜 ${s.races}场 · 最佳402m ${this.fmtT(s.best.quarter)} · 逐个击败对手，冲击车神之巅！`;
    const list=document.getElementById('eventList');
    list.innerHTML='';
    OPPONENTS.forEach((o,i)=>{
      const unlocked = i===0 || s.beaten[i-1];
      const beaten = s.beaten[i];
      const row=document.createElement('div');
      row.className='ev-row'+(unlocked?'':' locked')+(beaten?' done':'');
      const best = s.best.opp[i];
      row.innerHTML = `
        <div class="ev-chip" style="background:${o.color}"><span class="tier-no">${i+1}</span></div>
        <div class="ev-info">
          <b>${TIERS[i]} · ${o.name}</b>
          <div class="car-line">${o.car} — “${o.quote}”</div>
          <div class="quote-line">${beaten?`✓ 已击败 · 你方最佳 ${this.fmtT(best)}`:`胜场奖励 🪙 ${o.reward}${unlocked?'':' · 🔒 需先击败上一名对手'}`}</div>
        </div>
        <div class="ev-meta">
          <div>性能分 <span class="score">${perfScore(statsFromOpp(o))}</span></div>
          <div>你的性能分 <span class="score">${perfScore(statsFromUpgrades(s.up))}</span></div>
        </div>
        ${unlocked?`<button class="btn small" data-i="${i}">⚡ 挑战</button>`:`<button class="btn small" disabled>🔒</button>`}
      `;
      list.appendChild(row);
      const btn=row.querySelector('button[data-i]');
      if(btn) btn.onclick = ()=>{ AudioSys.click(); Game.startRace(i); };
    });
  },

  /* ---------- 车库 ---------- */
  renderGarage(){
    this.refreshCoins();
    const s=this.save;
    this.resizePreview();
    Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
    document.getElementById('tabPerf').classList.toggle('sel', this.garageTab==='perf');
    document.getElementById('tabVis').classList.toggle('sel', this.garageTab==='vis');
    document.getElementById('perfPane').classList.toggle('hidden', this.garageTab!=='perf');
    document.getElementById('visPane').classList.toggle('hidden', this.garageTab!=='vis');
    if(this.garageTab==='perf') this.renderParts(); else this.renderVis();
    this.renderEstimate();
  },
  renderEstimate(){
    const stats=statsFromUpgrades(this.save.up);
    const est=simulateRun(stats);
    const d=(cur,base,unit,inv)=>{
      if(this.openEst && base!=null && Math.abs(cur-base)>1e-4){
        const better = inv? cur<base : cur>base;
        const diff = cur-base;
        return ` <span class="${better?'delta-up':'delta-down'}">(${diff>0?'+':''}${diff.toFixed(unit==='s'?2:0)}${unit})</span>`;
      }
      return '';
    };
    const t100d = this.openEst&&this.openEst.t100!=null&&est.t100!=null ? (est.t100-this.openEst.t100) : null;
    const qd = this.openEst&&this.openEst.quarter!=null&&est.quarter!=null ? (est.quarter-this.openEst.quarter) : null;
    const td = this.openEst ? est.top-this.openEst.top : null;
    document.getElementById('garageEstimate').innerHTML =
      `<div>⚙️ 性能分 <b>${perfScore(stats)}</b> ｜ 马力 <b>${hpOf(stats).base}</b> hp（增压峰值 <b>${hpOf(stats).boost}</b> hp）</div>`+
      `<div>📈 完美驾驶预估：0-100 <b>${est.t100==null?'—':est.t100.toFixed(2)+'s'}</b>${t100d!=null&&Math.abs(t100d)>0.01?` <span class="${t100d<0?'delta-up':'delta-down'}">(${t100d>0?'+':''}${t100d.toFixed(2)}s)</span>`:''} · `+
      `402m <b>${est.quarter==null?'—':est.quarter.toFixed(2)+'s'}</b>${qd!=null&&Math.abs(qd)>0.01?` <span class="${qd<0?'delta-up':'delta-down'}">(${qd>0?'+':''}${qd.toFixed(2)}s)</span>`:''} · `+
      `402m尾速 <b>${est.top}</b> km/h${td!=null&&td!==0?` <span class="${td>0?'delta-up':'delta-down'}">(${td>0?'+':''}${td})</span>`:''}</div>`+
      `<div style="color:#5f6982;font-size:12px">改装后即时模拟，绿色代表提升、红色代表退步</div>`;
  },
  renderParts(){
    const grid=document.getElementById('partGrid');
    grid.innerHTML='';
    PART_KEYS.forEach(k=>{
      const p=PARTS[k], lv=this.save.up[k], maxed=lv>=5;
      const cur=statsFromUpgrades(this.save.up);
      const nextUp=Object.assign({},this.save.up,{[k]:lv+1});
      const nxt=statsFromUpgrades(nextUp);
      let stat;
      if(k==='engine') stat=`马力 ${hpOf(cur).base} hp ${maxed?'':`→ <b>${hpOf(nxt).base} hp</b>`}`;
      else if(k==='turbo') stat=`增压扭矩 +${Math.round(cur.boostMax*100)}% ${maxed?'':`→ <b>+${Math.round(nxt.boostMax*100)}%</b>`} ｜ 起压 ${Math.round(cur.boostRpm)} 转`;
      else if(k==='gearbox') stat=`换挡时间 ${cur.shiftTime.toFixed(2)}s ${maxed?'':`→ <b>${nxt.shiftTime.toFixed(2)}s</b>`}`;
      else stat=`抓地力 ${cur.grip.toFixed(2)} ${maxed?'':`→ <b>${nxt.grip.toFixed(2)}</b>`}`;
      const pips='●'.repeat(lv)+'○'.repeat(5-lv);
      const card=document.createElement('div');
      card.className='part-card';
      card.innerHTML=`
        <div class="part-head"><span>${p.icon}</span><b>${p.name}</b><span class="pips">${pips}</span></div>
        <div class="part-desc">${p.desc}<br><span style="color:#5f6982">${p.effect}</span></div>
        <div class="part-stat">${stat}</div>
        <button class="btn ${maxed?'ghost':''}" ${maxed||this.save.coins<p.costs[lv]?'disabled':''}>
          ${maxed?'已满级 LV5':`🪙 ${this.fmt(p.costs[lv])} 升级 LV${lv+1}`}
        </button>`;
      const btn=card.querySelector('button');
      if(!maxed) btn.onclick=()=>{
        const cost=p.costs[lv];
        if(this.save.coins<cost){ this.toast('金币不足，先去赢几场比赛吧！'); return; }
        this.save.coins-=cost; this.save.up[k]++;
        persistSave(this.save);
        AudioSys.coin(); AudioSys.click();
        this.toast(`${p.name} 升级到 LV${this.save.up[k]}！`);
        this.renderGarage();
      };
      grid.appendChild(card);
    });
  },
  renderVis(){
    const s=this.save, pane=document.getElementById('visPane');
    const sw=COLORS.map((c,i)=>`<div class="swatch ${(!s.vis.custom&&s.vis.color===i)?'sel':''}" data-k="color" data-v="${i}" title="${c.name}" style="background:${c.c}"></div>`).join('');
    const dc=DECALS.map(d=>`<div class="chip ${s.vis.decal===d.id?'sel':''}" data-k="decal" data-v="${d.id}">${d.name}</div>`).join('');
    const wh=WHEELS.map(w=>`<div class="chip ${s.vis.wheel===w.id?'sel':''}" data-k="wheel" data-v="${w.id}">${w.name}</div>`).join('');
    const pch=PATTERN_OPTIONS.map(p=>`<div class="chip ${s.vis.pattern===p.id?'sel':''}" data-k="pattern" data-v="${p.id}">${p.name}</div>`).join('');
    const kits=KIT_KEYS.map(k=>{
      const g=KIT_OPTIONS[k];
      const chips=g.items.map(d=>`<div class="chip ${s.vis[k]===d.id?'sel':''}" data-k="${k}" data-v="${d.id}">${d.name}</div>`).join('');
      return `<div class="vis-group"><h3>${g.label}</h3><div class="chips">${chips}</div></div>`;
    }).join('');
    /* 整车套件方案卡片 */
    const presets=PRESETS.map((p,i)=>`
      <div class="preset-card ${s.vis.preset===p.id?'sel':''}" data-p="${i}" title="${p.name}">
        <canvas class="pv" id="pv-${i}" width="150" height="64"></canvas>
        <span>${p.name}</span>
      </div>`).join('');
    /* 自定义贴花编辑器 */
    const d=this.stkDraft;
    const shapeName=id=>STICKER_SHAPES.find(x=>x.id===id).name;
    const posName=id=>STICKER_POS.find(x=>x.id===id).name;
    const stkList=(s.vis.stickers||[]).map((st,i)=>`
      <div class="stk-row">
        <span class="stk-dot" style="background:${st.color}"></span>
        <span>${shapeName(st.shape)}${st.shape==='badge'?`「${String(st.text||'07').slice(0,3)}」`:''} · 初始${posName(st.pos)} · ${STICKER_SIZES[st.size||0].name}</span>
        <button class="btn ghost small stk-reset" data-i="${i}" title="重置到初始位置">↺</button>
        <button class="btn ghost small stk-del" data-i="${i}" title="删除">✕</button>
      </div>`).join('') || '<div class="vis-note">还没有自定义贴花，用下面的表单添加一枚吧。</div>';
    const shapeChips=STICKER_SHAPES.map(x=>`<div class="chip ${d.shape===x.id?'sel':''}" data-d="shape" data-v="${x.id}">${x.name}</div>`).join('');
    const posChips=STICKER_POS.map(x=>`<div class="chip ${d.pos===x.id?'sel':''}" data-d="pos" data-v="${x.id}">${x.name}</div>`).join('');
    const sizeChips=STICKER_SIZES.map((x,i)=>`<div class="chip ${d.size===i?'sel':''}" data-d="size" data-v="${i}">${x.name}</div>`).join('');
    const stkColors=STICKER_COLORS.map(c=>`<div class="swatch stk-sw ${d.color===c?'sel':''}" data-d="color" data-v="${c}" style="background:${c};width:26px;height:26px"></div>`).join('');
    const stickerCount=(s.vis.stickers||[]).length;
    /* 车体套件（经典程序化 / CC0 贴图车体） */
    const curBody = s.vis.body || 'classic';
    const locked = curBody !== 'classic';
    const bodyChips = BODY_OPTIONS.map(b=>`<div class="chip ${curBody===b.id?'sel':''}" data-b="${b.id}" title="${b.note}">${b.name}</div>`).join('');
    /* APEX 式改装件 */
    const finChips=FINISH_OPTIONS.map(f=>`<div class="chip ${(s.vis.finish||0)===f.id?'sel':''}" data-k="finish" data-v="${f.id}">${f.name}</div>`).join('');
    const hlChips=HEADLIGHT_OPTIONS.map(h=>`<div class="chip ${(s.vis.headlight||0)===h.id?'sel':''}" data-k="headlight" data-v="${h.id}">${h.name}</div>`).join('');
    const glowChips=GLOW_OPTIONS.map(g=>`<div class="chip ${(s.vis.underglow||0)===g.id?'sel':''}" data-k="underglow" data-v="${g.id}">${g.name}</div>`).join('');
    pane.innerHTML=`
      <div class="vis-group"><h3>🚗 车体套件 <span style="font-weight:400;color:#5f6982;font-size:12px">（切换整车车体；贴图车体为 CC0 素材原厂涂装）</span></h3>
        <div class="chips">${bodyChips}</div>
        ${locked?'<div class="vis-note" style="color:#ffb066">当前为贴图车体：涂装 / 贴花 / 包围套件仅对「经典街车」生效，切换回去即可恢复原有自定义。</div>':''}
      </div>
      <div class="vis-group"><h3>💡 灯光改装 <span style="font-weight:400;color:#5f6982;font-size:12px">（底盘霓虹对全部车体生效；大灯颜色仅经典车体）</span></h3>
        <div class="chips">${hlChips}</div>
        <div class="chips" style="margin-top:6px">${glowChips}</div>
      </div>
      <div class="${locked?'vis-locked':''}">
      <div class="vis-group"><h3>🏁 整车套件方案 <span style="font-weight:400;color:#5f6982;font-size:12px">（一键应用 包围+尾翼+机盖+排气+轮毂+拉花）</span></h3>
        <div class="preset-row">${presets}</div></div>
      <div class="vis-group"><h3>🎨 涂装编辑器 · 车身颜色</h3>
        <div class="swatches">${sw}</div>
        <div class="color-picker-row">自定义颜色 <input type="color" id="paintPicker" value="${s.vis.custom || COLORS[s.vis.color].c}">
          <span class="vis-note" style="margin:0">${s.vis.custom?'当前使用自定义颜色':'当前使用预设色板'}</span></div></div>
      <div class="vis-group"><h3>✨ 车漆质感</h3>
        <div class="chips">${finChips}</div></div>
      <div class="vis-group"><h3>🌈 车身图案</h3>
        <div class="chips">${pch}</div>
        <div class="color-picker-row">图案颜色 <input type="color" id="patternPicker" value="${s.vis.patternColor||'#111318'}"></div></div>
      <div class="vis-group"><h3>✨ 自定义贴花 <span style="font-weight:400;color:#5f6982;font-size:12px">（最多 3 枚，当前 ${stickerCount}/3 · 在上方预览图中<b style="color:#ff8a2a">拖动贴花</b>自由摆放）</span></h3>
        <div class="stk-list">${stkList}</div>
        ${stickerCount<3?`
        <div class="stk-form">
          <div class="chips">${shapeChips}</div>
          ${d.shape==='badge'?`<input id="stkText" class="stk-text" maxlength="3" value="${String(d.text||'07').slice(0,3)}" placeholder="号牌文字">`:''}
          <div class="swatches">${stkColors}</div>
          <div class="chips">${posChips}</div>
          <div class="chips">${sizeChips}</div>
          <button class="btn small" id="stkAdd">➕ 添加贴花</button>
        </div>`:'<div class="vis-note">贴花已满 3 枚，删除一枚后可继续添加。</div>'}
      </div>
      <div class="vis-group"><h3>🖌️ 预设贴纸拉花</h3><div class="chips">${dc}</div></div>
      <div class="vis-group"><h3>⚙️ 轮毂样式</h3><div class="chips">${wh}</div></div>
      ${kits}
      <div class="vis-note">所有改动即时预览并自动保存；套件方案只决定包围/轮毂/拉花组合，可与自定义涂装自由叠加。</div>
      </div>`;
    /* 车体切换 */
    pane.querySelectorAll('[data-b]').forEach(el=>{
      el.onclick=()=>{
        s.vis.body = el.dataset.b;
        persistSave(s);
        AudioSys.click();
        this.renderGarage();
      };
    });
    /* 套件方案卡片点击 */
    pane.querySelectorAll('.preset-card').forEach(el=>{
      el.onclick=()=>{
        const p=PRESETS[+el.dataset.p];
        Object.assign(s.vis, p.vis, {preset:p.id});
        persistSave(s);
        AudioSys.click();
        Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
        this.renderVis();
      };
    });
    /* 方案缩略图（用当前涂装渲染，体现叠加效果） */
    this.drawPresetMinis();
    /* 离散选项（色板/图案/拉花/轮毂/套件） */
    pane.querySelectorAll('[data-k]').forEach(el=>{
      el.onclick=()=>{
        const k=el.dataset.k, v=+el.dataset.v;
        s.vis[k]=v;
        if(k==='color') s.vis.custom=null;
        if(k==='decal'||k==='wheel'||KIT_KEYS.includes(k)) s.vis.preset='custom';
        persistSave(s);
        AudioSys.click();
        Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
        this.renderVis();
      };
    });
    /* 自定义颜色（实时预览，不打断取色器拖动） */
    const pp=document.getElementById('paintPicker');
    if(pp) pp.addEventListener('input', ()=>{
      s.vis.custom=pp.value;
      persistSave(s);
      Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
      this.drawPresetMinis();
    });
    const pl=document.getElementById('patternPicker');
    if(pl) pl.addEventListener('input', ()=>{
      s.vis.patternColor=pl.value;
      persistSave(s);
      Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
    });
    /* 贴花草稿选项 */
    pane.querySelectorAll('[data-d]').forEach(el=>{
      el.onclick=()=>{
        const k=el.dataset.d, v=el.dataset.v;
        if(k==='size') this.stkDraft.size=+v; else this.stkDraft[k]=v;
        AudioSys.click();
        this.renderVis();
      };
    });
    const st=document.getElementById('stkText');
    if(st) st.addEventListener('input', ()=>{ this.stkDraft.text=st.value; });
    const add=document.getElementById('stkAdd');
    if(add) add.onclick=()=>{
      const dr=this.stkDraft;
      const slot=STICKER_SLOT[dr.pos]||STICKER_SLOT.door;
      s.vis.stickers.push({shape:dr.shape, text:String(dr.text||'07').slice(0,3), color:dr.color, pos:dr.pos, size:dr.size, x:slot[0], y:slot[1]});
      persistSave(s);
      AudioSys.coin();
      Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
      this.renderVis();
    };
    pane.querySelectorAll('.stk-del').forEach(el=>{
      el.onclick=()=>{
        s.vis.stickers.splice(+el.dataset.i,1);
        persistSave(s);
        AudioSys.click();
        this.hoverStk=null; this.dragStk=null;
        Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
        this.renderVis();
      };
    });
    pane.querySelectorAll('.stk-reset').forEach(el=>{
      el.onclick=()=>{
        const st=s.vis.stickers[+el.dataset.i];
        if(!st) return;
        const slot=STICKER_SLOT[st.pos]||STICKER_SLOT.door;
        st.x=slot[0]; st.y=slot[1];
        persistSave(s);
        AudioSys.click();
        Render.drawPreview(document.getElementById('previewCanvas'), playerVisual(s), this.previewOpts());
      };
    });
  },
  /* 涂装编辑态参数（贴花指示圈；车间环境由车库调用启用） */
  previewOpts(){
    const classic = !this.save.vis.body || this.save.vis.body==='classic';
    return {
      workshop: true,
      stickersActive: this.garageTab==='vis' && classic,
      hoverSticker: classic ? this.hoverStk : null,
      activeSticker: classic ? this.dragStk : null,
    };
  },
  /* 预览图贴花拖拽：按下命中 → 跟随移动（边界钳制）→ 松开保存 */
  bindPaintDrag(){
    const cv=document.getElementById('previewCanvas');
    if(!cv) return;
    const toLocal=e=>{
      const rect=cv.getBoundingClientRect();
      const sx = rect.width ? cv.width/rect.width : 1;
      const sy = rect.height ? cv.height/rect.height : 1;
      const px=(e.clientX-rect.left)*sx, py=(e.clientY-rect.top)*sy;
      const sc=Math.min(cv.width/6.6, cv.height/3.4);
      return {lx:(px-cv.width/2)/sc, ly:(cv.height*0.84-py)/sc};
    };
    const stickerAt=(lx,ly)=>{
      const list=this.save.vis.stickers||[];
      for(let i=list.length-1;i>=0;i--){ // 后添加的贴花优先命中
        const st=list[i];
        const slot=STICKER_SLOT[st.pos]||STICKER_SLOT.door;
        const x=typeof st.x==='number'?st.x:slot[0];
        const y=typeof st.y==='number'?st.y:slot[1];
        const r=[0.13,0.19,0.26][st.size||0]+0.14;
        if((lx-x)*(lx-x)+(ly-y)*(ly-y) < r*r) return i;
      }
      return -1;
    };
    const redraw=()=>Render.drawPreview(cv, playerVisual(this.save), this.previewOpts());
    const classicBody=()=>!this.save.vis.body || this.save.vis.body==='classic';
    cv.addEventListener('pointerdown', e=>{
      if(this.garageTab!=='vis' || Game.state!=='garage' || !classicBody()) return;
      const {lx,ly}=toLocal(e);
      const i=stickerAt(lx,ly);
      if(i<0) return;
      const st=this.save.vis.stickers[i];
      const slot=STICKER_SLOT[st.pos]||STICKER_SLOT.door;
      const sx0=typeof st.x==='number'?st.x:slot[0];
      const sy0=typeof st.y==='number'?st.y:slot[1];
      this.dragStk=i;
      this.dragOff={dx:sx0-lx, dy:sy0-ly};
      try{ cv.setPointerCapture(e.pointerId); }catch(err){}
      cv.style.cursor='grabbing';
      e.preventDefault();
      redraw();
    });
    cv.addEventListener('pointermove', e=>{
      if(this.garageTab!=='vis' || Game.state!=='garage' || !classicBody()) return;
      const {lx,ly}=toLocal(e);
      if(this.dragStk!=null){
        const st=this.save.vis.stickers[this.dragStk];
        if(st){
          st.x=clamp(lx+this.dragOff.dx, -1.9, 1.9);
          st.y=clamp(ly+this.dragOff.dy, -0.86, -0.32);
          redraw();
        }
        return;
      }
      const i=stickerAt(lx,ly);
      if((i>=0?i:null)!==this.hoverStk){
        this.hoverStk = i>=0 ? i : null;
        cv.style.cursor = i>=0 ? 'grab' : 'default';
        redraw();
      }
    });
    const endDrag=()=>{
      if(this.dragStk!=null){
        persistSave(this.save);
        this.dragStk=null;
        this.dragOff=null;
        cv.style.cursor='grab';
        redraw();
      }
    };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', ()=>{
      if(this.dragStk==null && this.hoverStk!=null){
        this.hoverStk=null;
        cv.style.cursor='default';
        redraw();
      }
    });
  },
  drawPresetMinis(){
    const s=this.save;
    PRESETS.forEach((p,i)=>{
      const cv=document.getElementById('pv-'+i);
      if(!cv) return;
      const c=cv.getContext('2d');
      c.clearRect(0,0,cv.width,cv.height);
      c.fillStyle='#10141d'; c.fillRect(0,0,cv.width,cv.height);
      c.strokeStyle='rgba(255,255,255,0.07)'; c.strokeRect(0.5,0.5,cv.width-1,cv.height-1);
      const vis=playerVisual(s);
      Object.assign(vis, p.vis);
      drawCar(c, cv.width/2, cv.height*0.85, cv.width/6.4, vis, -0.35, {lights:true, noFlame:true});
    });
  },

  /* ---------- 结算 ---------- */
  showResult(res){
    const race=Game.race, opp=race.opp, s=this.save;
    const pt=res.pt, ot=res.ot;
    const timeLine = pt==null
      ? `你 <b>未完赛</b> · ${opp.name} <b>${this.fmtT(ot)}</b>`
      : `${res.win?'你':'你'} <b>${pt.toFixed(2)}s</b> · ${opp.name} <b>${this.fmtT(ot)}</b> — ${res.win?'领先':'落后'} ${res.margin!=null?res.margin.toFixed(2)+'s':'—'}`;
    const lines=res.lines.map(l=>`<div class="line"><span>${l[0]}</span><span>🪙 ${this.fmt(l[1])}</span></div>`).join('');
    const hasNext = res.win && race.oppIdx+1<OPPONENTS.length;
    const unlockHint = hasNext && res.first
      ? `<div style="text-align:center;color:#4ade80;font-size:13px">🔓 已解锁下一对手：${OPPONENTS[race.oppIdx+1].name}</div>` : '';
    document.getElementById('resultPanel').innerHTML=`
      <div class="res-title ${res.win?'win':'lose'}">${res.win?'胜利!':'惜败…'}</div>
      <div class="res-times">${timeLine}</div>
      <div class="res-stats">
        <div>起步反应 <span>${res.reaction==null?'未起步':res.reaction.toFixed(2)+'s'}</span></div>
        <div>起步评价 <span>${res.launch||'—'}</span></div>
        <div>完美换挡 <span>×${res.perfectShifts}</span></div>
        <div>烧胎时间 <span>${res.spin.toFixed(1)}s</span></div>
        <div>最高时速 <span>${res.top} km/h</span></div>
        <div>你的成绩 <span>${pt==null?'DNF':pt.toFixed(2)+'s'}</span></div>
      </div>
      <div class="res-rating">
        <div class="res-badge ${res.rating}">${res.rating}</div>
        <div style="color:#8a93a6;font-size:13px">本场评价<br><span style="font-size:11px;color:#5f6982">反应 × 弹射 × 换挡 × 打滑</span></div>
      </div>
      <div class="res-coins">${lines}<div class="total"><span>合计获得</span><span>🪙 ${this.fmt(res.coins)}</span></div></div>
      ${unlockHint}
      <div class="res-btns">
        <button class="btn" id="btnResAgain">🔁 再来一次</button>
        ${hasNext?'<button class="btn" id="btnResNext">➡️ 下一场</button>':''}
        <button class="btn ghost" id="btnResBack">赛事列表</button>
      </div>`;
    document.getElementById('screenResult').classList.remove('hidden');
    document.getElementById('btnResAgain').onclick=()=>{ AudioSys.click(); Game.startRace(race.oppIdx); };
    const nx=document.getElementById('btnResNext');
    if(nx) nx.onclick=()=>{ AudioSys.click(); Game.startRace(race.oppIdx+1); };
    document.getElementById('btnResBack').onclick=()=>{ AudioSys.click(); Game.exitRace(); };
    if(res.win) AudioSys.win(); else AudioSys.lose();
    if(res.coins>0) setTimeout(()=>AudioSys.coin(), 550);
  },
  hideResult(){ document.getElementById('screenResult').classList.add('hidden'); },

  /* ---------- 提示 ---------- */
  popup(text, cls){
    const layer=document.getElementById('popupLayer');
    const el=document.createElement('div');
    el.className='pop '+(cls||'info');
    el.textContent=text;
    layer.appendChild(el);
    setTimeout(()=>el.remove(), 1100);
  },
  toast(msg){
    const t=document.getElementById('toast');
    t.textContent=msg;
    t.classList.remove('hidden');
    const next=t.cloneNode(true);
    t.parentNode.replaceChild(next,t);
    next.id='toast';
    setTimeout(()=>next.classList.add('hidden'), 2200);
  },
};
