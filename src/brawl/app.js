
/* UI, input, audio, persistence and fixed-step orchestration. No remote dependencies. */
'use strict';
const $=id=>document.getElementById(id);
const asset=name=>(window.BRAWL_ASSETS&&window.BRAWL_ASSETS[name])||('assets/'+name);
const saved=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d;}catch{return d;}};
const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};
const PLAYER_KEY='volt-roast-player';
const sharedPlayer=()=>{let query=new URLSearchParams(location.search).get('fighter'),value=Number(query===null?saved(PLAYER_KEY,0):query);return Number.isInteger(value)&&value>=0&&value<BrawlSim.NAMES.length?value:0;};
const DEFAULT_SETTINGS={quality:'auto',sfx:true,voice:true,captions:true,reduced:false,showPerf:false};
const MODE_TITLES={last:'LAST ONE STANDING',score:'90-SECOND SCORE BRAWL',crown:'THE CROWN'};
const SHOWCASES=[
 {title:'MOVE',description:'Move around an idle rival to set your distance. Movement and actions work together.',mobile:'DRAG LEFT STICK',desktop:'WASD / ARROW KEYS'},
 {title:'PUNCH',description:'A quick close-range strike. Only a successful hit advances a combo.',mobile:'TAP PUNCH',desktop:'J'},
 {title:'KICK',description:'A longer-reaching strike that damages the partner’s legs. Hits also drain their stamina.',mobile:'TAP KICK',desktop:'K'},
 {title:'HEAVY PUNCH',description:'Land three hits on the same rival, mostly punches. Punch becomes Heavy Punch for 3.5 seconds and knocks down on contact.',mobile:'THREE HITS → TAP HEAVY PUNCH',desktop:'THREE HITS → J'},
 {title:'HEAVY KICK',description:'Land three hits on the same rival, mostly kicks. Kick becomes Heavy Kick for 3.5 seconds.',mobile:'THREE HITS → TAP HEAVY KICK',desktop:'THREE HITS → K'},
 {title:'DODGE',description:'Move out of reach and gain a brief protected moment. Hold a direction to choose where to dodge.',mobile:'TAP DODGE + LEFT STICK',desktop:'SPACE + MOVE'},
 {title:'AUTO BLOCK',description:'Stop moving for a moment and your fighter guards automatically. Blocking reduces melee damage but uses stamina.',mobile:'RELEASE LEFT STICK',desktop:'RELEASE MOVEMENT KEYS'},
 {title:'DIZZY GRAB',description:'When a rival runs out of stamina, stars circle their head. Move close and press L to grab them, then L again to slam.',mobile:'GRAB CHANGES TO SPIN NEAR DIZZY RIVAL',desktop:'L, THEN L'},
 {title:'SPIN THROW',description:'Near a dizzy rival, the fixed Grab button becomes Spin. One tap grabs, winds up and spins them away. Q also performs the move.',mobile:'TAP SPIN NEAR DIZZY RIVAL',desktop:'Q NEAR DIZZY RIVAL'},
 {title:'PICK / THROW',description:'Move beside a prop and tap Pick Up over the object. The same world action becomes Throw while you hold it.',mobile:'TAP PICK UP OVER OBJECT',desktop:'E, THEN E'},
 {title:'AUTO PUSH / GROUND GRAB',description:'Three close hits from one rival trigger an automatic push. With more than double their HP, you knock them down and briefly open a ground grab.',mobile:'AUTOMATIC PUSH → TAP GROUND GRAB',desktop:'AUTOMATIC PUSH → L'}
];
const TAUNTS=[
 {bn:'এই নে!',el:'Πάρε αυτό!'},
 {bn:'আমাকে ছেড়ে দে!',el:'Άσε με!'},
 {bn:'এটা ধর!',el:'Πιάσε αυτό!'},
 {bn:'এখন আমার পালা!',el:'Τώρα είναι η σειρά μου!'},
 {bn:'ভাই, একটু দূরত্ব রাখ!',el:'Φίλε, κράτα λίγη απόσταση!',audio:'1-6.mp3'},
 {bn:'তোর মাথায় কি শর্ট সার্কিট হয়েছে?',el:'Έπαθε βραχυκύκλωμα το κεφάλι σου;',audio:'3-4.mp3'}
];
class BrawlAudio{
 constructor(settings){this.settings=settings;this.ctx=null;this.muted=false;this.clip=null;this.lastVoice=-10;this.lastStep=0;}
 unlock(){try{if(!this.ctx){let C=window.AudioContext||window.webkitAudioContext;if(C)this.ctx=new C();}if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
 stop(){if(this.clip){this.clip.pause();this.clip.currentTime=0;this.clip=null;}}
 tone(frequency=180,duration=.1,volume=.09,type='sine'){let c=this.ctx;if(!c||this.muted||!this.settings.sfx||c.state!=='running')return;let o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*.32),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+.02);}
 laugh(){let c=this.ctx;if(!c||this.muted||!this.settings.sfx||c.state!=='running')return;for(let i=0;i<5;i++){let t=c.currentTime+i*.27,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(112-i*7,t);o.frequency.exponentialRampToValueAtTime(72-i*4,t+.21);f.type='lowpass';f.frequency.value=430+i*36;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.065,t+.035);g.gain.exponentialRampToValueAtTime(.001,t+.23);o.connect(f);f.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.25);}}
 noise(duration=.13,volume=.12,filter=950){let c=this.ctx;if(!c||this.muted||!this.settings.sfx||c.state!=='running')return;let n=Math.max(1,Math.floor(c.sampleRate*duration)),b=c.createBuffer(1,n,c.sampleRate),data=b.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*(1-i/n);let s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=filter;g.gain.value=volume;s.buffer=b;s.connect(f);f.connect(g);g.connect(c.destination);s.start();}
 event(e){if(e.type==='hit'){this.tone(e.heavy?91:160,e.heavy?.19:.1,e.heavy?.16:.11,'triangle');this.noise(e.heavy?.17:.10,e.heavy?.19:.13,e.heavy?750:1500);}if(e.type==='autoPush'){this.tone(e.strong?105:190,.22,.15,'triangle');this.noise(.18,.14,750);}if(e.type==='swing')this.noise(.10,.045,2200);if(e.type==='pickup')this.tone(530,.08,.035);if(e.type==='throw')this.noise(.16,.09,2800);if(e.type==='dodge')this.noise(.17,.06,1700);if(e.type==='perfectCounter'){this.tone(690,.16,.07);this.tone(1050,.12,.04);}if(e.type==='ko'){this.tone(240,.38,.12,'triangle');this.noise(.25,.08,650);}if(e.type==='laserShot')this.tone(e.heavy?390:670,e.heavy?.27:.12,e.heavy?.08:.035,'sawtooth');if(e.type==='bossLaser'){this.tone(88,.47,.16,'sawtooth');this.noise(.32,.10,1000);}if(e.type==='bossLand'||e.type==='bossCollapse'||e.type==='bossSlam'){this.tone(62,.60,.23,'triangle');this.noise(.60,.25,430);}if(e.type==='bossSlamWind')this.tone(132,.66,.11,'sawtooth');if(e.type==='bossResurrected')this.tone(260,.5,.12,'sawtooth');if(e.type==='bossLaugh')this.laugh();}
 voice(line){if(this.muted||!this.settings.voice||!line.audio||performance.now()-this.lastVoice<3200)return;this.lastVoice=performance.now();this.stop();let a=new Audio(asset(line.audio));a.volume=.66;this.clip=a;a.play().catch(()=>{});}
}
class BrawlApp{
 constructor(){this.settings={...DEFAULT_SETTINGS,...saved('volt-brawl-3d-settings',{})};if(matchMedia('(prefers-reduced-motion: reduce)').matches)this.settings.reduced=true;this.mobileControls=matchMedia('(pointer:coarse)').matches;document.body.classList.toggle('mobile-controls',this.mobileControls);this.selected=sharedPlayer();this.mode='last';this.state='loading';this.sim=new BrawlSim.Sim({selected:this.selected,ai:false});this.scene=null;this.audio=new BrawlAudio(this.settings);this.keys=new Set();this.heldActions=new Map();this.joy={id:null,x:0,z:0};this.acc=0;this.last=0;this.count=0;this.toastUntil=0;this.pops=[];this.speeches=[];this.feed=[];this.speechNext=0;this.uiClock=0;this.frames=[];this.fps=0;this.frameMs=0;this.lastHud=0;this.resultDue=0;this.testFrozen=false;this.demoSim=null;this.demoIndex=0;this.demoAcc=0;this.demoSteps=[];this.demoStep=0;this.bind();this.buildHeroes();this.applySettings();this.boot();}
 async boot(){try{this.scene=new BrawlScene($('game'),asset);await this.scene.load();this.resize();this.scene.reduced=this.settings.reduced;this.state='menu';$('startButton').disabled=false;$('startButton').querySelector('span').textContent='ENTER THE YARD';$('loadStatus').textContent='READY / local single player + 3 AI rivals / no account required';this.last=performance.now();requestAnimationFrame(t=>this.frame(t));if(location.protocol.startsWith('http')&&'serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(()=>{$('loadStatus').textContent='READY / offline cache installs on first complete load';}).catch(()=>{});}}catch(e){this.fatal(e);}}
 fatal(e){console.error(e);this.state='error';$('fatalText').textContent=e.message||String(e);$('fatal').classList.add('visible');}
 buildHeroes(){let names=BrawlSim.NAMES;$('heroes').innerHTML=names.map((n,i)=>`<button class="hero ${i===this.selected?'selected':''}" style="--color:${BRAWL_COLORS[i]}" data-hero="${i}" aria-label="Select ${n}" aria-pressed="${i===this.selected}"><img src="${asset('head-'+(i+1)+'.png')}" alt="${n}"><b>${n}</b></button>`).join('');document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>{this.selected=Number(b.dataset.hero);this.sim.selected=this.selected;save(PLAYER_KEY,this.selected);this.buildHeroes();this.audio.unlock();this.audio.tone(330+this.selected*80,.1,.03);});let best=saved('volt-brawl-3d-best',0);$('bestScore').textContent=best?'BEST '+Math.round(best)+' PTS':'LOCAL / OFFLINE';}
 buildHUD(){$('crew').innerHTML=this.sim.fighters.map(f=>`<div class="fightercard ${f.id===this.selected?'me':''}" id="card${f.id}" style="--color:${BRAWL_COLORS[f.id]}"><img src="${asset('head-'+(f.id+1)+'.png')}" alt="${f.name}"><b>${f.name}</b><span class="health" id="hp${f.id}">100</span><div class="hp"><i id="bar${f.id}"></i></div><small id="inj${f.id}">CLEAN</small></div>`).join('');$('worldUI').innerHTML='';this.nameplates=this.sim.fighters.map(f=>{let n=document.createElement('div');n.className='nameplate';n.style.setProperty('--color',BRAWL_COLORS[f.id]);n.innerHTML=`${f.name}${f.id===this.selected?' / YOU':''}<div class="hp"><i></i></div>`;$('worldUI').appendChild(n);return n;});this.buildWorldActions();$('modeTitle').textContent=MODE_TITLES[this.mode];document.documentElement.style.setProperty('--hero',BRAWL_COLORS[this.selected]);$('bossHud').hidden=true;document.body.classList.remove('boss-mode');}
 buildWorldActions(){let ui=$('worldUI');this.dizzyMarks=this.sim.fighters.map(()=>{let n=document.createElement('div');n.className='dizzy-stars';n.setAttribute('aria-hidden','true');n.innerHTML='<span>★</span><span>★</span><span>★</span>';ui.appendChild(n);return n;});let b=document.createElement('button');b.className='world-action';b.type='button';b.dataset.worldAction='spin';b.innerHTML='<svg><use href="#i-spin"/></svg><b>SPIN</b>';b.onclick=e=>{e.preventDefault();this.audio.unlock();this.act('spin');};ui.appendChild(b);this.worldActions={spin:b};}
 bind(){
   if(this.mobileControls){for(let [action,label] of [['punch','Punch; becomes Heavy Punch after a punch combo'],['kick','Kick; becomes Heavy Kick after a kick combo'],['dodge','Dodge'],['grab','Grab a dizzy rival or slam a held rival'],['pick','Pick up a nearby item or throw the held item']])$('actions').querySelector(`[data-action="${action}"]`).setAttribute('aria-label',label);}
   $('startButton').onclick=()=>this.start();$('againButton').onclick=()=>this.start();$('restartButton').onclick=()=>this.start();$('quickRestart').onclick=()=>this.start();$('pauseButton').onclick=()=>this.pause();$('homeButton').onclick=e=>{e.preventDefault();this.pause();};$('resumeButton').onclick=()=>this.resume();$('menuButton').onclick=()=>this.menu();$('resultMenuButton').onclick=()=>this.menu();$('settingsButton').onclick=()=>this.openSettings();$('pauseSettings').onclick=()=>this.openSettings();$('closeSettings').onclick=()=>{$('settingsScreen').classList.remove('visible');};$('helpButton').onclick=()=>this.openShowcase();$('pauseHelp').onclick=()=>this.openShowcase();$('closeHelp').onclick=()=>this.closeShowcase();$('showcasePrev').onclick=()=>this.showDemo(this.demoIndex-1);$('showcaseNext').onclick=()=>this.showDemo(this.demoIndex+1);$('showcaseReplay').onclick=()=>this.showDemo(this.demoIndex);$('showcaseSelect').onchange=e=>this.showDemo(Number(e.target.value));$('showcaseSelect').innerHTML=SHOWCASES.map((d,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${d.title}</option>`).join('');for(let id of ['switchModeButton','pauseSwitchMode','resultSwitchMode'])$(id).onclick=()=>this.switchToScooter();
  $('soundButton').onclick=()=>{this.audio.unlock();this.audio.muted=!this.audio.muted;this.audio.stop();$('soundButton').style.opacity=this.audio.muted?.45:1;$('soundButton').setAttribute('aria-label',this.audio.muted?'Unmute sound':'Mute sound');};
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{this.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));});
  for(let key of Object.keys(DEFAULT_SETTINGS)){$(key).onchange=()=>{this.settings[key]=key==='quality'?$(key).value:$(key).checked;save('volt-brawl-3d-settings',this.settings);this.applySettings();if(key==='quality')this.resize();if(key==='voice'&&!this.settings.voice)this.audio.stop();};}
  let joystick=$('joystick');joystick.addEventListener('pointerdown',e=>{if(this.joy.id!==null||this.state!=='playing')return;e.preventDefault();this.audio.unlock();this.joy.id=e.pointerId;joystick.setPointerCapture(e.pointerId);this.joyMove(e);});joystick.addEventListener('pointermove',e=>{if(e.pointerId===this.joy.id)this.joyMove(e);});for(let event of['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(event,e=>{if(this.joy.id===e.pointerId)this.resetJoy();});
   document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(this.state!=='playing')return;e.preventDefault();this.audio.unlock();b.setPointerCapture(e.pointerId);b.classList.add('held');this.heldActions.set(e.pointerId,{a:b.dataset.action,b});this.act(b.dataset.action);});for(let event of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{let press=this.heldActions.get(e.pointerId);if(!press)return;this.heldActions.delete(e.pointerId);if(![...this.heldActions.values()].some(v=>v.b===b))b.classList.remove('held');});b.addEventListener('click',e=>{if(e.detail===0)this.act(b.dataset.action);});});
   window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.code==='Escape'&&!e.repeat){e.preventDefault();if($('settingsScreen').classList.contains('visible'))$('settingsScreen').classList.remove('visible');else if(this.state==='tutorial')this.closeShowcase();else if(this.state==='paused')this.resume();else this.pause();return;}let actions={KeyJ:'punch',KeyK:'kick',KeyL:'grab',KeyQ:'spin',Space:'dodge',KeyE:'pick'},movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'];if(actions[e.code]||movement.includes(e.code)){if(this.state!=='playing')return;e.preventDefault();this.keys.add(e.code);if(actions[e.code]&&!e.repeat){this.audio.unlock();this.act(actions[e.code]);}}});
  window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>{this.resetInput();this.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){this.resetInput();this.pause();}});window.addEventListener('resize',()=>this.resize());window.addEventListener('contextmenu',e=>e.preventDefault());$('game').addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause();this.fatal(Error('The browser interrupted 3D graphics. Reload to restore the yard.'));});
 }
 applySettings(){for(let k of Object.keys(DEFAULT_SETTINGS)){if(k==='quality')$(k).value=this.settings[k];else $(k).checked=this.settings[k];}if(this.scene)this.scene.reduced=this.settings.reduced;$('perf').hidden=!this.settings.showPerf;}
 openSettings(){if(this.state==='playing'||this.state==='countdown')this.pause();this.applySettings();$('settingsScreen').classList.add('visible');}
 resize(){this.scene?.resize(innerWidth,innerHeight,this.settings.quality);}
 resetJoy(){this.joy={id:null,x:0,z:0};$('knob').style.transform='translate(0,0)';}
  resetInput(){this.keys.clear();this.heldActions.clear();document.querySelectorAll('.combat.held').forEach(b=>b.classList.remove('held'));this.resetJoy();this.sim.moveInput(0,0);}
 joyMove(e){let r=$('joystick').getBoundingClientRect(),x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2,m=Math.hypot(x,z),max=r.width*.31;if(m>max){x*=max/m;z*=max/m;}this.joy.x=x/max;this.joy.z=z/max;$('knob').style.transform=`translate(${x}px,${z}px)`;}
 movement(){let x=this.joy.x+(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0),z=this.joy.z+(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0),m=Math.hypot(x,z);return{x:m>1?x/m:x,z:m>1?z/m:z};}
 act(type){if(this.state!=='playing')return false;let v=this.movement();let ok=this.sim.action(this.selected,type,v);if(!ok){let f=this.sim.fighters[this.selected],a=BrawlSim.ATTACKS[type];if(f.held!==null&&a)this.toast('Throw the prop first — your hands are full.',1.2);else if(a&&f.stamina<a.cost)this.toast('Catch your breath. Not enough stamina.',1.1);}return ok;}
  openShowcase(){if(!this.scene||!['menu','paused'].includes(this.state))return;this.tutorialReturn=this.state;this.resetInput();$('menu').classList.remove('visible');$('pauseScreen').classList.remove('visible');$('hud').hidden=true;$('worldUI').style.display='none';this.state='tutorial';$('helpScreen').classList.add('visible');this.showDemo(0);this.last=performance.now();}
  closeShowcase(){if(this.state!=='tutorial')return;$('helpScreen').classList.remove('visible');this.state=this.tutorialReturn||'menu';this.demoSim=null;this.scene.effects=[];this.scene.pops=[];this.scene.camera=null;this.scene.center=[0,0];$('hud').hidden=this.state==='menu';$('worldUI').style.display=this.state==='menu'?'none':'block';$(this.state==='menu'?'menu':'pauseScreen').classList.add('visible');this.last=performance.now();this.acc=0;}
  showDemo(index){if(this.state!=='tutorial')return;this.demoIndex=Math.max(0,Math.min(SHOWCASES.length-1,index));let d=SHOWCASES[this.demoIndex],s=new BrawlSim.Sim({selected:0,ai:false,mode:'score',seed:7391});this.demoSim=s;this.demoAcc=0;this.demoStep=0;this.scene.effects=[];this.scene.pops=[];this.scene.camera=null;this.scene.center=[0,0];let p=s.fighters[0],q=s.fighters[1];p.x=-.8;p.z=0;p.yaw=Math.PI/2;q.x=.8;q.z=0;q.yaw=-Math.PI/2;q.demoIdle=true;if([3,4].includes(this.demoIndex))q.pushCooldown=Infinity;for(let f of s.fighters.slice(2)){f.ko=true;f.hp=0;f.respawn=Infinity;}for(let o of s.items)o.broken=true;
   let hitBack=()=>{s.state(q,'punch',.43);q.attackHit=true;s.hit(p,q,3,'body',0,false,'melee');};
   let steps=[];
   switch(this.demoIndex){
    case 0:p.x=-2.8;steps=[[.2,()=>s.moveInput(1,0)],[1.0,()=>s.moveInput(0,0)]];break;
    case 1:steps=[[.5,()=>s.action(0,'punch')]];break;
    case 2:q.x=1.3;steps=[[.5,()=>s.action(0,'kick')]];break;
    case 3:steps=[[.25,()=>s.action(0,'punch')],[.8,()=>s.action(0,'punch')],[1.35,()=>s.action(0,'punch')],[1.95,()=>s.action(0,'punch')]];break;
    case 4:q.x=1.3;steps=[[.25,()=>s.action(0,'kick')],[1.02,()=>s.action(0,'kick')],[1.79,()=>s.action(0,'kick')],[2.56,()=>s.action(0,'kick')]];break;
    case 5:steps=[[.5,()=>s.action(0,'dodge',{x:-1,z:0})]];break;
    case 6:q.demoIdle=false;steps=[[.55,()=>s.action(1,'punch')]];break;
    case 7:s.dizzy(q,2.6);steps=[[.55,()=>s.action(0,'grab')],[1.18,()=>s.action(0,'grab')]];break;
    case 8:s.dizzy(q,2.6);steps=[[.55,()=>s.action(0,'grab')],[1.18,()=>s.action(0,'spin')]];break;
    case 9:{let o=s.items[0];o.broken=false;o.x=-.6;o.z=.1;q.x=3.8;steps=[[.4,()=>s.action(0,'pick')],[1.0,()=>s.action(0,'pick')]];break;}
    case 10:p.hp=95;q.hp=24;steps=[[.4,hitBack],[1.0,hitBack],[1.6,hitBack],[2.18,()=>s.action(0,'grab')],[2.72,()=>s.action(0,'grab')]];break;
   }
   this.demoSteps=steps;this.demoDuration=[2.8,2.8,2.8,3.3,4.1,2.8,2.8,3.1,3.1,3.5,4.2][this.demoIndex];$('showcaseCount').textContent=String(this.demoIndex+1).padStart(2,'0')+' / '+SHOWCASES.length;$('helpTitle').textContent=d.title;$('showcaseDescription').textContent=d.description;$('showcaseControl').textContent=this.mobileControls?d.mobile:d.desktop;$('showcaseSelect').value=String(this.demoIndex);$('showcasePrev').disabled=this.demoIndex===0;$('showcaseNext').disabled=this.demoIndex===SHOWCASES.length-1;
  }
  stepDemo(dt){this.demoAcc=Math.min(.15,this.demoAcc+dt);while(this.demoAcc>=1/60){let s=this.demoSim,next=s.time+1/60;while(this.demoStep<this.demoSteps.length&&this.demoSteps[this.demoStep][0]<=next){this.demoSteps[this.demoStep][1]();this.demoStep++;}s.step(1/60);for(let e of s.drainEvents())this.scene.onEvent(e,s);this.demoAcc-=1/60;if(s.time>=this.demoDuration){this.showDemo(this.demoIndex);break;}}}
 hideScreens(){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));}
 switchToScooter(){save(PLAYER_KEY,this.selected);location.href='./index.html?fighter='+this.selected;}
 start(options={}){if(!this.scene)return;this.audio.unlock();this.audio.stop();this.resetInput();this.hideScreens();this.selected=options.selected??this.selected;save(PLAYER_KEY,this.selected);this.mode=options.mode||this.mode;this.sim=new BrawlSim.Sim({selected:this.selected,mode:this.mode,difficulty:$('difficulty').value,ai:options.ai!==false,seed:options.seed||Math.floor(Math.random()*1e9)});this.buildHUD();this.pops=[];this.speeches=[];this.feed=[];this.scene.effects=[];this.scene.pops=[];this.scene.camera=null;this.scene.center=[0,0];this.acc=0;this.count=options.instant?0:2.4;this.state=options.instant?'playing':'countdown';this.countSound=-1;this.speechNext=2.5;this.testFrozen=false;this.resultDue=0;this.toastUntil=0;this.uiClock=0;$('toast').classList.remove('on');$('hud').hidden=false;$('worldUI').style.display='block';$('spectator').hidden=true;this.last=performance.now();this.updateHUD();}
 menu(){this.resetInput();this.audio.stop();this.hideScreens();this.state='menu';this.sim=new BrawlSim.Sim({selected:this.selected,ai:false});this.pops=[];this.speeches=[];this.scene.effects=[];this.scene.pops=[];this.scene.center=[0,0];this.scene.camera=null;$('hud').hidden=true;$('bossHud').hidden=true;document.body.classList.remove('boss-mode');$('worldUI').style.display='none';$('worldUI').innerHTML='';$('menu').classList.add('visible');this.buildHeroes();this.testFrozen=false;}
 pause(){if(!['playing','countdown','ending'].includes(this.state))return;this.resumeState=this.state;this.state='paused';this.audio.stop();this.resetInput();$('pauseScreen').classList.add('visible');}
 resume(){if(this.state!=='paused')return;$('pauseScreen').classList.remove('visible');this.state=this.resumeState||'playing';this.resetInput();this.last=performance.now();this.acc=0;}
 toast(text,seconds=2.0){$('toast').textContent=text;$('toast').classList.add('on');this.toastUntil=this.uiClock+seconds;}
 addFeed(text){this.feed.push({text,until:this.uiClock+3.5});if(this.feed.length>3)this.feed.shift();}
 makePop(text,id,color){let f=this.sim.fighters[id],n=document.createElement('div');n.className='damagepop';n.textContent=text;if(color)n.style.color=color;$('worldUI').appendChild(n);this.pops.push({n,x:f.x,y:2.7,z:f.z,age:0,max:.8});}
 speech(id,line){if(!this.settings.captions){this.audio.voice(line);return;}for(let s of this.speeches)s.n.remove();this.speeches=[];let n=document.createElement('div');n.className='speech';n.style.setProperty('--color',BRAWL_COLORS[id]);let speaker=document.createElement('b');speaker.textContent=BrawlSim.NAMES[id];let bn=document.createElement('span');bn.className='bn';bn.lang='bn';bn.textContent=line.bn;let el=document.createElement('span');el.className='el';el.lang='el';el.textContent=line.el;n.append(speaker,bn,el);$('worldUI').appendChild(n);this.speeches.push({n,id,until:this.uiClock+2.3});this.audio.voice(line);}
 events(){for(let e of this.sim.drainEvents()){this.scene.onEvent(e,this.sim);this.audio.event(e);
   if(e.type==='hit'){this.makePop('-'+Math.round(e.damage),e.id);if(e.cloud&&e.heavy)this.makePop(['BAM!','BONK!','POW!'][Math.floor(Math.random()*3)],e.id,'#ffdb54');if(!this.sim.boss&&this.uiClock>this.speechNext){let line=TAUNTS[Math.floor(Math.random()*TAUNTS.length)];this.speech(e.id,line);this.speechNext=this.uiClock+4.7;}}
   if(e.type==='comboReady'&&e.id===this.selected)this.toast(e.move==='heavyKick'?'HEAVY KICK READY':'HEAVY PUNCH READY',1.5);
   if(e.type==='dizzy'){this.makePop('DIZZY!',e.id,'#ffe17a');if(e.id===this.selected)this.toast('DIZZY · STAMINA EMPTY',1.5);}
   if(e.type==='autoBlock')this.makePop('BLOCK',e.id,'#a9e5e8');
   if(e.type==='ko'){let by=e.boss?'SCARAT':e.by===undefined?'THE YARD':BrawlSim.NAMES[e.by];this.addFeed(by+' knocked out '+BrawlSim.NAMES[e.id]);this.makePop('K.O.!',e.id,'#f9d568');if(e.id===this.selected&&(this.mode==='last'||this.sim.boss))this.toast("You're out. Watch the finish or start a new round.",3);}
   if(e.type==='cloudStart')this.toast('TOTAL CHAOS · THE CREW IS IN!',1.25);
   if(e.type==='perfectCounter'){this.makePop('COUNTER!',e.id,'#b4e2ef');if(e.id===this.selected)this.toast('PERFECT COUNTER',1.3);}
    if(e.type==='autoPush'){this.makePop(e.strong?'DOWN!':'PUSH!',e.target,'#f9db75');if(e.id===this.selected)this.toast(e.strong?'THEY ARE DOWN · GRAB THEM NOW':'AUTO PUSH · SPACE TO BREATHE',1.7);}
   if(e.type==='pickup'&&e.id===this.selected)this.toast(BrawlSim.ITEMS[e.item].label+' IN HAND · TAP THROW',1.1);
    if(e.type==='grab'&&e.id===this.selected)this.toast(this.sim.fighters[this.selected].spinGrabTarget!==null?'SPIN THROW WINDUP':'GRABBED · CHOOSE SLAM OR SPIN',1.2);
   if(e.type==='spin'&&e.id===this.selected)this.toast('SPIN THROW!',1.0);
   if(e.type==='escapeGrab'&&e.id===this.selected)this.toast('BROKE FREE!',1.2);
   if(e.type==='slip')this.makePop('SLIP!',e.id,'#d9e68a');
   if(e.type==='rage'){this.makePop('RAGE!',e.id,'#ffca61');if(e.id===this.selected)this.toast('RAGE HIT · EXTRA POWER',1.2);}
   if(e.type==='crownPickup')this.addFeed(BrawlSim.NAMES[e.id]+' took the crown');if(e.type==='crownDrop')this.addFeed(BrawlSim.NAMES[e.id]+' dropped the crown');if(e.type==='respawn')this.addFeed(BrawlSim.NAMES[e.id]+' is back in');if(e.type==='hint')this.toast(e.text,1.8);
   if(e.type==='bossStart'){document.body.classList.add('boss-mode');$('bossHud').hidden=false;this.toast('SCARAT IS DESCENDING · THE CREW RISES TOGETHER',2.2);this.addFeed('SCARAT enters the yard');}
   if(e.type==='bossLand')this.toast('IMPACT · SCARAT HAS LANDED',1.5);
   if(e.type==='bossRevive')this.makePop('REVIVED',e.id,'#8aeaff');
   if(e.type==='bossBattle')this.toast('USE COVER AND HIGH GROUND · FIRE TOGETHER',2.5);
   if(e.type==='bossCharge')this.toast('CANNON CHARGING · MOVE OR DODGE',1.1);
   if(e.type==='bossClawWind')this.toast('CLAW REACHING · DODGE AWAY',.9);
   if(e.type==='bossSlamWind')this.toast('GROUND SMASH · RETREAT OR TAKE HIGH GROUND',1.1);
   if(e.type==='bossSlam')this.toast('SHOCKWAVE · GET CLEAR',.9);
   if(e.type==='bossGrab')this.makePop('GRABBED!',e.id,'#ffc075');
   if(e.type==='bossCollapse')this.toast('SCARAT DOWN · WATCH THE REACTOR',2.0);
   if(e.type==='bossRebuild')this.toast('REACTOR REBUILD · SCARAT RISES AGAIN',2.0);
   if(e.type==='bossResurrected')this.toast('SCARAT RETURNS · STAGE '+(e.tier+1),2.0);
   if(e.type==='bossFinalFall')this.toast('SCARAT IS FINALLY FALLING',2.0);
   if(e.type==='bossLaugh')this.toast('HA · HA · HA · THE CREW IS GONE',3.1);
   if(e.type==='finish'){this.state='ending';this.resultDue=this.uiClock+1.1;this.resetInput();}
  }}
 updateHUD(){let s=this.sim,p=s.fighters[this.selected];if(!p)return;for(let f of s.fighters){let c=$('card'+f.id);if(!c)continue;c.classList.toggle('out',f.ko);$('hp'+f.id).textContent=Math.ceil(f.hp);$('bar'+f.id).style.width=f.hp+'%';let cond=s.condition(f);if(s.boss?.phase==='arrival')cond=f.state==='getup'?'REVIVING':'AWAITING REVIVAL';else if(f.ko&&s.boss)cond='OUT · FINAL BATTLE';else if(f.ko&&this.mode!=='last')cond='BACK IN '+Math.max(0,Math.ceil(f.respawn))+'s';else if(f.head>=35)cond+=' / 2 BLACK EYES';else if(f.head>=18)cond+=' / BLACK EYE';if(f.leg>=30)cond+=' / LIMP';$('inj'+f.id).textContent=cond;}
  if(s.boss){
   let b=s.boss,max=b.phase==='resurrect'?b.nextMaxHp:b.maxHp;
   let hp=b.phase==='resurrect'?max*smooth(1.35,3.5,b.age):b.hp;
   $('bossHud').hidden=false;document.body.classList.add('boss-mode');
   $('bossHealthFill').style.width=(max?Math.max(0,Math.min(100,hp/max*100)):0)+'%';
   let meter=$('bossHud').querySelector('.boss-health');meter.setAttribute('aria-valuemax',Math.ceil(max));meter.setAttribute('aria-valuenow',Math.ceil(hp));
   $('bossHealthValue').textContent=Math.ceil(hp)+' / '+Math.ceil(max);
   $('bossPhaseLabel').textContent=b.phase==='arrival'?'DESCENDING':b.phase==='resurrect'?'REASSEMBLING':b.phase==='dead'?'FINAL COLLAPSE':b.phase==='laugh'?'VICTORY LAUGH':'STAGE '+(b.tier+1)+' / 4';
   $('bossResurrections').textContent=b.phase==='resurrect'?'RESURRECTION '+(b.tier+1)+' / 3':(3-b.tier)+' RESURRECTIONS REMAIN';
   $('modeTitle').textContent='SCARAT · FINAL BATTLE';$('clock').textContent=this.format(s.time);
   $('condition').textContent=p.ko?'OUT':s.condition(p);$('staminaValue').textContent=Math.round(p.stamina);$('staminaBar').style.width=p.stamina+'%';
   $('rageBar').style.width='0%';$('rageLabel').textContent='LASER CREW';$('heldItem').textContent=p.ko?'WEAPON LOST':'LASER CARBINE READY';$('revenge').textContent='SCARAT TARGETS THE WHOLE CREW';
   $('objective').textContent=s.fighters.filter(f=>!f.ko).length+' CREW ALIVE · DEFEAT ALL 4 STAGES';$('cloudBadge').hidden=true;
   $('spectator').hidden=!(p.ko&&!s.finished);
   let laserFar=Math.hypot(p.x-b.x,p.z-b.z)>BrawlSim.BOSS_LASER_RANGE;
   document.body.classList.toggle('laser-out-of-range',laserFar);
   $('punchLabel').textContent='FIRE';$('kickLabel').textContent='POWER';$('actionGuide').textContent=laserFar?'MOVE WITHIN 7.5m TO HIT SCARAT':'J FIRE · K POWER SHOT · DODGE THE CANNON';
   document.querySelector('.keyboardhint').textContent='WASD MOVE · J FIRE · K POWER SHOT · SPACE DODGE · ESC PAUSE';
   document.querySelectorAll('[data-action]').forEach(button=>{let action=button.dataset.action,disabled=p.ko||b.phase!=='battle'||p.weaponCooldown>0||(action==='kick'&&p.stamina<25)||(action==='dodge'&&p.stamina<18);button.classList.toggle('unavailable',!!disabled);button.classList.remove('charged');button.setAttribute('aria-label',action==='punch'?'Fire laser':action==='kick'?'Power laser shot':'Dodge');});
   this.feed=this.feed.filter(f=>f.until>this.uiClock);$('combatfeed').innerHTML=this.feed.map(f=>'<div class="feedline">'+f.text+'</div>').join('');
   if(this.uiClock>this.toastUntil)$('toast').classList.remove('on');
   $('perf').textContent=`${Math.round(this.fps)} FPS / ${this.scene.R.draws} DRAWS / ${Math.round(this.scene.R.tris/1000)}k TRI / DPR ${this.scene.R.pixelRatio.toFixed(2)}`;
   return;
  }
  document.body.classList.remove('laser-out-of-range');$('clock').textContent=this.format(this.mode==='score'?Math.max(0,90-s.time):s.time);$('condition').textContent=p.dizzyUntil>s.time?'DIZZY':p.blocking?'AUTO BLOCK':s.condition(p);$('staminaValue').textContent=Math.round(p.stamina);$('staminaBar').style.width=p.stamina+'%';$('rageBar').style.width=p.rage+'%';$('rageLabel').textContent='RAGE '+Math.round(p.rage)+'%';$('heldItem').textContent=p.held!==null?BrawlSim.ITEMS[s.items[p.held].type].label+' IN HAND':'HANDS FREE';let r=Math.max(...p.revenge),ri=p.revenge.indexOf(r);$('revenge').textContent=r>0?'GRUDGE: '+BrawlSim.NAMES[ri]:'NO GRUDGES. YET.';
   let ready=p.comboUntil>s.time?p.comboReady:null,usable=ready&&p.stamina>=BrawlSim.ATTACKS[ready].cost;$('punchLabel').textContent=ready==='heavy'&&usable?'HEAVY PUNCH':'PUNCH';$('kickLabel').textContent=ready==='heavyKick'&&usable?'HEAVY KICK':'KICK';for(let [type,upgrade]of[['punch','heavy'],['kick','heavyKick']]){let b=$('actions').querySelector(`[data-action="${type}"]`),charged=ready===upgrade&&usable;b.classList.toggle('charged',charged);b.setAttribute('aria-label',charged?(type==='punch'?'Heavy Punch':'Heavy Kick')+' ready for '+Math.ceil(p.comboUntil-s.time)+' seconds':type.toUpperCase());}
   let near=s.grabCandidate(p),item=p.held===null?s.nearestItem(p):null,closeItem=item&&Math.hypot(item.x-p.x,item.z-p.z)<=1.9,hits=p.comboHits.filter(h=>s.time-h.time<=3.2).length;
   let dizzyTarget=s.fighters.some(q=>q!==p&&!q.ko&&q.grabbedBy===null&&q.dizzyUntil>s.time&&['dizzy','down'].includes(q.state));
   let spinReady=p.grabbedBy===null&&(p.spinGrabTarget!==null||p.grabTarget===null&&dizzyTarget),grabButton=$('actions').querySelector('.combat.grab');
   grabButton.dataset.action=spinReady?'spin':'grab';grabButton.classList.toggle('spin-ready',spinReady);
   grabButton.querySelector('use').setAttribute('href',spinReady?'#i-spin':'#i-grab');
   grabButton.querySelector('kbd').textContent=spinReady?'Q':'L';
   grabButton.setAttribute('aria-label',spinReady?'Spin dizzy rival, Q':p.grabTarget!==null?'Slam grabbed rival, L':p.grabbedBy!==null?'Escape grab, L':'Grab dizzy rival, L');
   $('grabLabel').textContent=spinReady?'SPIN':p.grabTarget!==null?'SLAM':p.grabbedBy!==null?'ESCAPE':'GRAB';
   $('pickLabel').textContent=p.held!==null?'THROW':'PICK UP';
   $('actionGuide').textContent=p.grabbedBy!==null?'TAP GRAB TO ESCAPE':p.spinGrabTarget!==null?'SPIN THROW WINDUP':p.grabTarget!==null?'TAP SLAM OR SPIN NEAR THE RIVAL':near?'TAP SPIN FOR THE DIZZY RIVAL':dizzyTarget?'MOVE CLOSER TO SPIN THE DIZZY RIVAL':p.held!==null?'TAP THROW':closeItem?'TAP PICK UP':ready?usable?(ready==='heavy'?'HEAVY PUNCH':'HEAVY KICK')+' READY · TAP '+(ready==='heavy'?'PUNCH':'KICK')+' · '+Math.ceil(p.comboUntil-s.time)+'s':'COMBO READY · REST FOR HEAVY':p.blocking?'AUTO BLOCKING · MOVE TO ATTACK':hits?`COMBO ${hits}/3 · LAND ${3-hits} MORE HIT${3-hits===1?'':'S'}`:'3 HITS → HEAVY · EMPTY STAMINA → SPIN · NEAR PROP → PICK UP';
   $('cloudBadge').hidden=!s.cloud.active;$('spectator').hidden=!(p.ko&&this.mode==='last'&&!s.finished);
  if(this.mode==='last')$('objective').textContent=s.fighters.filter(f=>!f.ko).length+' STILL STANDING / '+p.kos+' ELIMINATIONS';else if(this.mode==='score')$('objective').textContent='YOU: '+Math.round(p.score)+' PTS / LEADER: '+s.rank()[0].name;else $('objective').textContent='CROWN: '+Math.floor(s.crown.time[this.selected])+'/45s / '+(s.crown.holder===null?'ON THE GROUND':BrawlSim.NAMES[s.crown.holder]);
   document.querySelectorAll('[data-action]').forEach(b=>{let a=b.dataset.action,actual=usable&&a==='punch'&&ready==='heavy'?'heavy':usable&&a==='kick'&&ready==='heavyKick'?'heavyKick':a,c=BrawlSim.ATTACKS[actual];let disabled=a==='grab'||a==='spin'?p.ko||!(p.grabbedBy!==null||p.grabTarget!==null||near&&p.stamina>=13&&s.canAct(p)):a==='pick'?p.ko||!(p.held!==null||closeItem&&s.canAct(p)):p.ko||!s.canAct(p)||p.held!==null||(c&&p.stamina<c.cost);b.classList.toggle('unavailable',!!disabled);let progress=p.state===actual&&p.duration?100*(1-p.age/p.duration):0;b.style.setProperty('--progress',Math.max(0,progress)+'%');});
  this.feed=this.feed.filter(f=>f.until>this.uiClock);$('combatfeed').innerHTML=this.feed.map(f=>'<div class="feedline">'+f.text+'</div>').join('');if(this.uiClock>this.toastUntil)$('toast').classList.remove('on');$('perf').textContent=`${Math.round(this.fps)} FPS / ${this.scene.R.draws} DRAWS / ${Math.round(this.scene.R.tris/1000)}k TRI / DPR ${this.scene.R.pixelRatio.toFixed(2)}`;
 }
  worldHUD(dt){
   let R=this.scene.R,faces=this.sim.fighters.filter(f=>!f.ko&&!f.cloud).map(f=>{
    let h=f.renderHead||[f.x,2.36,f.z],m=R.billboard(h,[1.34,1.58,1]);
    let a=R.project(M4.point(m,[-.5,.5,0])),b=R.project(M4.point(m,[.5,-.5,0]));
    return{left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)};
   }),occupied=[];
   if(this.nameplates)for(let f of [...this.sim.fighters].sort((a,b)=>(b.id===this.selected)-(a.id===this.selected))){
    let n=this.nameplates[f.id];if(!n)continue;
    let hp=f.renderHead||[f.x,2.36,f.z],q=R.project([hp[0],hp[1]+.95,hp[2]]);
    let visible=q.visible&&!f.ko&&!f.cloud&&this.state!=='menu';
    let width=f.id===this.selected?86:58,height=18,top=q.y;
    for(let face of faces){
     if(q.x+width/2<face.left||q.x-width/2>face.right||top-height>face.bottom||top<face.top)continue;
     top=Math.min(top,face.top-5);
    }
    if(top<135&&innerWidth<651&&innerHeight>500)visible=false;
    let box={left:q.x-width/2,right:q.x+width/2,top:top-height,bottom:top};
    if(occupied.some(o=>box.left<o.right&&box.right>o.left&&box.top<o.bottom&&box.bottom>o.top))visible=false;
    n.style.display=visible?'block':'none';
    if(visible){occupied.push(box);n.style.left=q.x+'px';n.style.top=top+'px';n.querySelector('i').style.width=f.hp+'%';}
   }
   for(let f of this.sim.fighters){let mark=this.dizzyMarks?.[f.id];if(!mark)continue;let h=f.renderHead||[f.x,2.36,f.z],q=R.project([h[0],h[1]+.48,h[2]]);let visible=!this.sim.boss&&q.visible&&!f.ko&&!f.cloud&&f.dizzyUntil>this.sim.time&&['dizzy','down','grabbed','groundGrabbed'].includes(f.state);mark.style.display=visible?'block':'none';if(visible){mark.style.left=q.x+'px';mark.style.top=q.y+'px';}}
   let player=this.sim.fighters[this.selected],playing=this.state==='playing'&&!player.ko&&!this.sim.boss,held=player.grabTarget!==null?this.sim.fighters[player.grabTarget]:null,near=playing&&!held?this.sim.grabCandidate(player):null,target=held||near;
   let place=(button,point,label,dx=0,dy=-55)=>{let q=point&&R.project(point),visible=playing&&q?.visible;button.hidden=!visible;if(!visible)return;button.querySelector('b').textContent=label;button.setAttribute('aria-label',label);button.style.left=clamp(q.x+dx,40,innerWidth-40)+'px';button.style.top=clamp(q.y+dy,innerHeight<501?105:160,innerHeight-100)+'px';};
   let h=target?.renderHead||[target?.x||0,2.36,target?.z||0];
   place(this.worldActions.spin,held&&player.grabbedBy===null&&player.spinGrabTarget===null?[h[0],h[1],h[2]]:null,'SPIN',39);
   if(target&&this.nameplates?.[target.id])this.nameplates[target.id].style.display='none';
  for(let p of this.pops){p.age+=dt;let q=R.project([p.x,p.y+p.age*1.6,p.z]);p.n.style.display=q.visible?'block':'none';p.n.style.left=q.x+'px';p.n.style.top=q.y+'px';p.n.style.opacity=Math.min(1,(p.max-p.age)*4);if(p.age>=p.max)p.n.remove();}this.pops=this.pops.filter(p=>p.age<p.max);
  for(let s of this.speeches){let f=this.sim.fighters[s.id],hp=f.renderHead||[f.x,2.36,f.z],q=R.project([hp[0],hp[1]+.85,hp[2]]);let rect=s.n.getBoundingClientRect(),mw=rect.width||180,mh=rect.height||100;let side=f.id%2?1:-1,x=clamp(q.x+side*(mw*.65+16),mw/2+9,innerWidth-mw/2-9),y=clamp(q.y-28,innerHeight<500?155:245,innerHeight-210);s.n.style.left=x+'px';s.n.style.top=y+'px';s.n.style.display=q.visible&&this.settings.captions?'block':'none';if(this.uiClock>s.until)s.n.remove();}this.speeches=this.speeches.filter(s=>this.uiClock<=s.until);
 }
 format(t){t=Math.max(0,Math.floor(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');}
 showBossResult(){let s=this.sim,p=s.fighters[this.selected],crewWon=s.bossOutcome==='crew',alive=s.fighters.filter(f=>!f.ko).length;
  this.state='results';this.audio.stop();$('winnerHead').src=crewWon?asset('head-'+(this.selected+1)+'.png'):asset('boss-face.webp');
  $('winnerHead').alt=crewWon?'Your fighter':'SCARAT';$('resultTitle').textContent=crewWon?'CREW DEFEATS SCARAT.':'SCARAT WINS.';
  $('resultEyebrow').textContent=crewWon?'FINAL BOSS DEFEATED':'THE LAST LAUGH';
  $('resultSummary').textContent=crewWon?alive+' CREW SURVIVED · '+(p.ko?'YOU FELL IN THE FINAL BATTLE':'YOU MADE IT THROUGH'):'ALL FOUR PLAYERS WERE KNOCKED OUT · NO REVIVES';
  $('resultStats').innerHTML=[[p.bossShots||0,'YOUR LASER SHOTS'],[p.bossDamage||0,'BOSS DAMAGE'],[4,'BOSS STAGES'],[alive,'CREW ALIVE']].map(([v,k])=>`<div><strong>${v}</strong><small>${k}</small></div>`).join('');
  $('scoreTable').innerHTML='<div class="scorerow head"><span>FIGHTER</span><span>STATUS</span><span>SHOTS</span><span>BOSS DMG</span><span>HP</span></div>'+s.fighters.map(f=>`<div class="scorerow ${f.id===this.selected?'me':''}"><span style="color:${BRAWL_COLORS[f.id]}">${f.name}${f.id===this.selected?' / YOU':''}</span><span>${f.ko?'OUT':'ALIVE'}</span><span>${f.bossShots||0}</span><span>${f.bossDamage||0}</span><span>${Math.ceil(f.hp)}</span></div>`).join('');
  $('resultScreen').classList.add('visible');}
 showResult(){if(this.sim.bossOutcome)return this.showBossResult();this.state='results';this.audio.stop();let s=this.sim,w=s.winner===null?null:s.fighters[s.winner],p=s.fighters[this.selected];$('winnerHead').src=asset('head-'+((w?.id??this.selected)+1)+'.png');$('resultTitle').textContent=w?w.name+' WINS.':'DRAW.';$('resultEyebrow').textContent=w?.id===this.selected?'YOU OWN THE YARD':'THE DUST HAS SETTLED';$('resultSummary').textContent=MODE_TITLES[this.mode]+' / '+this.format(s.time)+' / '+(this.mode==='crown'&&w?Math.floor(s.crown.time[w.id])+' SECONDS WITH THE CROWN':(w?Math.ceil(w.hp)+' HP REMAINING':''));$('resultStats').innerHTML=[[p.kos,'YOUR KOs'],[p.hits,'HITS LANDED'],[Math.round(p.damage),'DAMAGE DEALT'],[p.throws,'PROPS THROWN']].map(([v,k])=>`<div><strong>${v}</strong><small>${k}</small></div>`).join('');let ranked=this.mode==='last'?s.fighters.slice().sort((a,b)=>Number(a.ko)-Number(b.ko)||b.score-a.score):this.mode==='crown'?s.fighters.slice().sort((a,b)=>s.crown.time[b.id]-s.crown.time[a.id]):s.rank();$('scoreTable').innerHTML='<div class="scorerow head"><span>FIGHTER</span><span>SCORE</span><span>KOs</span><span>DAMAGE</span><span>HP</span></div>'+ranked.map(f=>`<div class="scorerow ${f.id===this.selected?'me':''}"><span style="color:${BRAWL_COLORS[f.id]}">${f.name}${f.id===this.selected?' / YOU':''}</span><span>${Math.round(f.score)}</span><span>${f.kos}</span><span>${Math.round(f.damage)}</span><span>${Math.ceil(f.hp)}</span></div>`).join('');save('volt-brawl-3d-best',Math.max(saved('volt-brawl-3d-best',0),p.score));$('resultScreen').classList.add('visible');}
 frame(clock){if(this.state==='error')return;try{let rawDt=Math.max(0,(clock-this.last)/1000),realDt=Math.min(.10,rawDt);this.last=clock;let now=performance.now();this.frames.push(rawDt);if(this.frames.length>60)this.frames.shift();let avg=this.frames.reduce((a,b)=>a+b,0)/this.frames.length;this.fps=avg?1/avg:0;let active=['playing','countdown','ending'].includes(this.state);if(active&&!this.testFrozen)this.uiClock+=realDt;
   if(this.state==='countdown'&&!this.testFrozen){this.count-=realDt;let n=Math.ceil(this.count);if(n!==this.countSound){this.countSound=n;this.toast(n>0?String(n):'FIGHT!',.65);this.audio.tone(n?440:770,.15,.06);}if(this.count<=0){this.state='playing';this.toast('FIGHT!',.7);}}
    if(this.state==='playing'&&!this.testFrozen){this.acc=Math.min(.15,this.acc+realDt);while(this.acc>=1/60){let v=this.movement();this.sim.moveInput(v.x,v.z);let canRepeat=()=>this.sim.boss?!this.sim.fighters[this.selected].ko:this.sim.canAct(this.sim.fighters[this.selected]);if(!this.mobileControls||this.sim.boss)for(let a of this.heldActions.values())if(['punch','kick'].includes(a.a)&&canRepeat())this.act(a.a);for(let [key,a]of[['KeyJ','punch'],['KeyK','kick']])if(this.keys.has(key)&&canRepeat())this.act(a);this.sim.step(1/60);this.events();this.acc-=1/60;if(this.state!=='playing')break;}let p=this.sim.fighters[this.selected];if(p.speed>1.6&&!p.ko&&!p.cloud&&this.uiClock-this.audio.lastStep>.29){this.audio.lastStep=this.uiClock;this.audio.noise(.045,.023,380);}}
    if(this.state==='tutorial'&&this.demoSim&&!this.testFrozen)this.stepDemo(realDt);
   if(this.state==='ending'&&!this.testFrozen&&this.uiClock>=this.resultDue)this.showResult();
    let visualDt=(this.state==='paused'||this.state==='results'||this.testFrozen)?0:realDt;this.scene.render(this.state==='tutorial'?this.demoSim:this.sim,visualDt,this.state);if(!['menu','loading','tutorial'].includes(this.state)){this.worldHUD(visualDt);if(clock-this.lastHud>80){this.updateHUD();this.lastHud=clock;}}this.frameMs=performance.now()-now;requestAnimationFrame(t=>this.frame(t));
  }catch(e){this.fatal(e);}}
 // Reproducible setups for visual / mechanical verification, not gameplay shortcuts.
 scenario(name){this.start({instant:true,ai:false,seed:7391,selected:0,mode:'last'});let s=this.sim;for(let f of s.fighters){f.x=(f.id-1.5)*1.12;f.z=(f.id%2)*.45;f.yaw=f.id<2?Math.PI/2:-Math.PI/2;}
  if(name==='cloud'){for(let f of s.fighters)f.lastAttack=0;s.stepCloud(.016);s.fighters[1].head=21;s.fighters[1].hp=72;s.fighters[2].head=39;s.fighters[2].hp=44;this.scene.onEvent({type:'hit',id:1,x:s.fighters[1].x,z:s.fighters[1].z,cloud:true,heavy:true},s);this.scene.onEvent({type:'hit',id:2,x:s.fighters[2].x,z:s.fighters[2].z,cloud:true,heavy:false},s);this.scene.pops.forEach(p=>p.life=.53);this.scene.time=3.35;}
  if(name==='combat'){s.fighters[0].x=-1;s.fighters[1].x=.45;s.fighters[2].x=3.6;s.fighters[2].z=-1.3;s.fighters[3].x=-3.4;s.fighters[3].z=-2.7;s.action(0,'punch');s.fighters[0].age=.14;s.fighters[0].attackHit=true;s.fighters[1].hp=62;s.fighters[1].head=24;s.state(s.fighters[1],'hit',.24);s.fighters[1].age=.13;s.action(2,'kick');s.fighters[2].age=.27;}
  if(name==='injuries'){for(let f of s.fighters){f.x=(f.id-1.5)*2.2;f.z=2;f.yaw=0;f.hp=[100,74,45,22][f.id];f.head=[0,19,37,50][f.id];f.leg=f.id===3?37:0;f.state='walk';f.speed=2;f.walk=1.1;}}
  if(name==='boss'){s.beginBoss(0);for(let i=0;i<130;i++){s.step(1/60);this.events();}}
  this.sim.drainEvents();this.testFrozen=true;this.scene.camera=null;this.scene.render(s,0,'playing');this.updateHUD();this.worldHUD(0);return s.snapshot();
 }
}
window.brawl=new BrawlApp();
window.VOLT_BRAWL_TEST={
 ready:()=>!!window.brawl.scene?.heads.length&&window.brawl.state!=='loading',
 snapshot:()=>window.brawl.sim.snapshot(),
 start:opts=>window.brawl.start({...opts,instant:true}),
 scenario:name=>window.brawl.scenario(name),
 freeze:value=>{window.brawl.testFrozen=!!value;},
 step:(frames=1)=>{let a=window.brawl;for(let i=0;i<frames;i++){a.sim.step(1/60);a.events();}a.updateHUD();return a.sim.snapshot();},
 action:(id,type)=>window.brawl.sim.action(id,type),
 input:()=>({joy:{...window.brawl.joy},keys:[...window.brawl.keys],actions:[...window.brawl.heldActions.values()].map(v=>v.a)}),
 metrics:()=>({fps:window.brawl.fps,frameMs:window.brawl.frameMs,draws:window.brawl.scene.R.draws,triangles:window.brawl.scene.R.tris,renderWidth:window.brawl.scene.R.canvas.width,renderHeight:window.brawl.scene.R.canvas.height,renderer:window.brawl.scene.R.gl.getParameter(window.brawl.scene.R.gl.RENDERER)})
};
 window.render_game_to_text=()=>{let a=window.brawl,tutorial=a.state==='tutorial',s=tutorial?a.demoSim:a.sim,selected=tutorial?0:a.selected,p=s.fighters[selected];return JSON.stringify({coordinates:'yard metres: x right, z toward camera',game:'brawl',state:a.state,showcase:tutorial?SHOWCASES[a.demoIndex].title:null,round:tutorial?'demonstration':a.mode,selected,time:+s.time.toFixed(2),player:{x:+p.x.toFixed(2),z:+p.z.toFixed(2),hp:+p.hp.toFixed(1),stamina:+p.stamina.toFixed(1),held:p.held,score:+p.score.toFixed(1),combatState:p.state,grabTarget:p.grabTarget,weaponCooldown:+(p.weaponCooldown||0).toFixed(2)},rivals:s.fighters.filter(f=>f.id!==selected&&(!tutorial||f.id===1)).map(f=>({id:f.id,x:+f.x.toFixed(2),z:+f.z.toFixed(2),hp:+f.hp.toFixed(1),ko:f.ko,state:f.state})),items:s.items.filter(i=>!i.broken).map(i=>({type:i.type,x:+i.x.toFixed(2),z:+i.z.toFixed(2)})),boss:s.boss?{phase:s.boss.phase,tier:s.boss.tier,hp:+s.boss.hp.toFixed(1),maxHp:s.boss.maxHp,attack:s.boss.attack,targetIds:s.boss.targetIds,x:+s.boss.x.toFixed(2),z:+s.boss.z.toFixed(2),moving:!!s.boss.moving,chaseTargetId:s.boss.chaseTargetId}:null,bossOutcome:s.bossOutcome||null,winner:s.winner});};
 window.advanceTime=ms=>{let a=window.brawl;if(!a.scene)return;a.testFrozen=true;let steps=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<steps;i++){if(a.state==='tutorial')a.stepDemo(1/60);if(a.state==='countdown'){a.count-=1/60;if(a.count<=0)a.state='playing';}if(a.state==='playing'){a.uiClock+=1/60;let move=a.movement();a.sim.moveInput(move.x,move.z);a.sim.step(1/60);a.events();}if(a.state==='ending'){a.uiClock+=1/60;if(a.uiClock>=a.resultDue)a.showResult();}}a.scene.render(a.state==='tutorial'?a.demoSim:a.sim,0,a.state);if(!['menu','tutorial'].includes(a.state))a.updateHUD();};
