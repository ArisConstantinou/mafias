/* 4 Mafias — complete local game. No libraries, services, or tracking.
   Track-space arcade physics uses a fixed timestep; rendering interpolates camera motion.
   Scooter health, pickups, collision damage, items and opponents share the same rules. */
const $=id=>document.getElementById(id);
const CREW=[
 {name:'Mahmud',tag:'THE ORIGINAL',color:'#ffe341'},
 {name:'Mushu',tag:'SMALL. LOUD.',color:'#64efac'},
 {name:'Billy',tag:'SMILE & STRIKE',color:'#ff646f'},
 {name:'Kay',tag:'ZERO CHILL',color:'#68c9ff'}
];
const ITEM_TYPES=['banana','pins','oil','box'];
const ITEM_KEY_CODE=/^(?:Digit|Numpad)[1-4]$/;
const ITEMS={
 banana:{name:'BANANA',damage:8,stock:3,max:5,radius:.86,life:20,skid:1.5,slow:.30,color:'#ffe15b',desc:'8 damage + a 1.5-second skid'},
 pins:{name:'PINS',damage:16,stock:2,max:4,radius:1.05,life:24,puncture:3.2,color:'#b3d4e9',desc:'16 damage + 3.2 seconds of punctured tyres'},
 oil:{name:'OIL',damage:5,stock:2,max:4,radius:1.45,life:18,skid:2.2,slow:.16,color:'#84b6e5',desc:'5 damage + a 2.2-second slide'},
 box:{name:'TOOLBOX',damage:23,stock:1,max:3,radius:.87,life:24,slow:.50,color:'#ff926d',desc:'23 damage + a hard slowdown'}
};
const HEAT_NAMES=['KEEP IT FRIENDLY','GETTING PERSONAL','ABSOLUTELY FURIOUS','NO FILTER'];
function heatFor(hits){return Math.min(4,1+Math.floor(Math.max(0,hits-1)/2));}
function safeGet(k,def){try{let x=JSON.parse(localStorage.getItem(k));return x??def;}catch(e){return def;}}
function safeSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
class GameAudio{
 constructor(game){this.game=game;this.ctx=null;this.buffers={};this.busyUntil=0;this.voice=null;this.queue=[];this.muted=false;}
 unlock(){try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=.38;this.master.connect(this.ctx.destination);this.engine=this.ctx.createOscillator();this.engine.type='triangle';this.engineGain=this.ctx.createGain();this.engineGain.gain.value=0;this.engine.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();this.decodeAll();}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch(e){console.warn('Audio unavailable:',e.message);}}
 async decodeAll(){await Promise.all(ASSETS.lines.map(async l=>{try{let raw=atob(ASSETS.voices[l.id].split(',')[1]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);this.buffers[l.id]=await this.ctx.decodeAudioData(bytes.buffer);}catch(e){console.warn('Voice could not be decoded',l.id);}}));}
 tone(freq,duration=.1,type='sine',vol=.18,slide=0){let c=this.ctx;if(!c||this.muted||!this.game.settings.fx||c.state!=='running')return;let o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),c.currentTime+duration);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);o.connect(g);g.connect(this.master);o.start();o.stop(c.currentTime+duration+.02);}
 effect(type){if(type==='hit'){this.tone(110,.15,'sawtooth',.30,-65);this.tone(45,.19,'triangle',.6,20);}if(type==='fire')this.tone(630,.12,'triangle',.13,-420);if(type==='pickup'){this.tone(630,.12,'sine',.2,120);setTimeout(()=>this.tone(920,.16,'sine',.17,210),70);}if(type==='throw')this.tone(240,.2,'triangle',.21,490);if(type==='skid')this.tone(800,.3,'sawtooth',.06,-470);if(type==='go'){this.tone(700,.14,'sine',.25);setTimeout(()=>this.tone(1050,.28,'sine',.2),140);}if(type==='tick')this.tone(550,.11,'sine',.21);if(type==='wreck'){this.tone(95,.45,'sawtooth',.28,-70);this.tone(44,.6,'triangle',.4,-20);}}
 speak(line,index,priority=false){if(!this.ctx||!this.game.settings.voice||this.muted)return;let entry={line,index};if(priority)this.queue.unshift(entry);else this.queue.push(entry);this.queue=this.queue.slice(0,2);}
 update(speed,active){if(!this.ctx)return;let c=this.ctx;this.master.gain.setTargetAtTime(this.muted?0:.38,c.currentTime,.1);this.engineGain.gain.setTargetAtTime(active&&this.game.settings.fx?.014+speed*.0005:0,c.currentTime,.15);this.engine.frequency.setTargetAtTime(40+speed*8,c.currentTime,.1);if(active&&this.game.settings.voice&&!this.muted&&this.queue.length&&c.currentTime>=this.busyUntil){let e=this.queue.shift(),b=this.buffers[e.line.id];if(!b)return;let s=c.createBufferSource(),g=c.createGain();s.buffer=b;s.playbackRate.value=[.97,1.08,1.01,.90][e.index];g.gain.value=1.6;s.connect(g);g.connect(this.master);s.start();this.voice=s;this.busyUntil=c.currentTime+b.duration/s.playbackRate.value+.15;}}
 stop(){this.queue=[];if(this.voice){try{this.voice.stop();}catch(e){}this.voice=null;}this.busyUntil=0;if(this.ctx)this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.03);}
}
class ThumbStick{
 constructor(el){this.el=el;this.knob=el.querySelector('.knob');this.x=0;this.y=0;this.pointer=null;el.addEventListener('pointerdown',e=>{if(this.pointer!==null)return;e.preventDefault();this.pointer=e.pointerId;el.setPointerCapture(e.pointerId);el.classList.add('active');this.move(e);});el.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer){e.preventDefault();this.move(e);}});for(let event of['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,e=>{if(e.pointerId===this.pointer)this.reset();});}
 move(e){let b=this.el.getBoundingClientRect(),radius=b.width*.31,dx=(e.clientX-b.x-b.width/2)/radius,dy=(e.clientY-b.y-b.height/2)/radius,len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}this.x=Math.abs(dx)<.10?0:dx;this.y=Math.abs(dy)<.10?0:dy;this.knob.style.transform=`translate(${dx*radius}px,${dy*radius}px)`;}
 reset(){this.x=this.y=0;this.pointer=null;this.knob.style.transform='';this.el.classList.remove('active');}
}
function makeItemModels(R){let out={};
 let b=new MeshBuilder();for(let j=0;j<3;j++){let a=j*2.094,prev=[0,.32,0];for(let i=1;i<=5;i++){let t=i/5,p=[Math.cos(a)*t*.70,.05+(1-t)*(1-t)*.29,Math.sin(a)*t*.70];b.rod(prev,p,.085*(1-t*.55),'#ffe25a');prev=p;}b.ball(prev,.052,'#81572a');}b.rod([0,.25,0],[.03,.52,0],.055,'#9e9d38');out.banana=R.mesh(b);
 b=new MeshBuilder();for(let i=0;i<11;i++){let a=i*2.4,r=.15+(i%3)*.23,x=Math.cos(a)*r,z=Math.sin(a)*r;b.rod([x,.05,z],[x+.04,.32+(i%2)*.1,z-.02],.026,'#d8e6e5',.002);b.ball([x,.045,z],[.065,.025,.065],'#899ca8');}out.pins=R.mesh(b);
 b=new MeshBuilder();b.add('cylinder',[0,.026,0],[1.2,.018,.82],[0,0,0],'#1a3548');b.add('cylinder',[.45,.029,.31],[.74,.018,.73],[0,0,0],'#263e56');b.add('torus',[0,.052,0],[.68,.45,.03],[Math.PI/2,0,.3],'#436d85');out.oil=R.mesh(b);
 b=new MeshBuilder();b.box([0,.26,0],[.85,.48,.51],'#e08060').box([0,.33,0],[.88,.07,.54],'#374755');for(let x of[-.19,.19])b.rod([x,.5,0],[x,.67,0],.034,'#273b49');b.rod([-.19,.67,0],[.19,.67,0],.04,'#273b49');b.box([0,.32,.28],[.12,.18,.025],'#e2d6b8');out.box=R.mesh(b);
 b=new MeshBuilder();b.box([0,.45,0],[.72,.84,.64],'#865c95').box([0,.45,.335],[.12,.51,.02],'#f9d58e',[0,0,0],.7).box([0,.45,.339],[.40,.12,.02],'#f9d58e',[0,0,0],.7);b.box([0,.45,0],[.75,.12,.67],'#e6c67d');out.supply=R.mesh(b);out.hazardRing=R.mesh(new MeshBuilder().add(torusGeo(28,4,.025),[0,.045,0],[1,1,.6],[Math.PI/2,0,0],'#ffffff',.9));return out;
}
const PLAYER_KEY='volt-roast-player';
function chosenPlayer(){let query=new URLSearchParams(location.search).get('fighter'),value=Number(query===null?safeGet(PLAYER_KEY,0):query);return Number.isInteger(value)&&value>=0&&value<CREW.length?value:0;}
class ScooterGame{
 constructor(){
  let stored=safeGet('volt-roast-settings',{});this.settings={fx:stored.fx!==false,voice:stored.voice!==false,dialogue:stored.dialogue!==false,strong:stored.strong!==false,quality:['low','high'].includes(stored.quality)?stored.quality:'auto',perf:stored.perf===true};
  this.selected=chosenPlayer();this.gameMode='scooter';this.mode='clash';this.state='loading';this.time=0;this.raceTime=0;this.phaseTime=0;this.riders=[];this.bullets=[];this.traps=[];this.particles=[];this.damagePops=[];this.pairTimes={};this.keys=new Set();this.acc=0;this.frameCount=0;this.lastClock=0;this.fps=60;this.toastUntil=0;this.nextDialogueAt=0;this.captionUntil=0;this.shake=0;this.hitFlash=0;this.nextHazard=0;this.trapId=0;this.cameraEye=null;this.cameraTarget=null;this.speedEffect=0;this.audio=new GameAudio(this);this.sticks={left:new ThumbStick($('leftStick')),right:new ThumbStick($('rightStick'))};this.bindUI();this.buildMenu();
 }
 async init(){try{
  this.R=new Renderer($('game'));this.resize();$('loadStatus').textContent='Cutout heads ready. Assembling the city…';
  await new Promise(resolve=>setTimeout(resolve,35));
  this.track=new CityTrack();this.world=new CityWorld(this.R,this.track);this.models={scooters:CREW.map(c=>this.R.mesh(makeScooter(c.color))),riders:CREW.map((c,i)=>this.R.mesh(makeRider(c.color,i))),wheel:this.R.mesh(makeWheel()),heads:[],halos:[]};
  for(let i=0;i<4;i++){let img=new Image();img.src=ASSETS.heads[i];await img.decode();this.models.heads.push(this.R.texture(img));let b=new MeshBuilder();b.add(torusGeo(40,7,.027),[0,0,0],[.70,.70,.65],[0,0,0],CREW[i].color,.9);this.models.halos.push(this.R.mesh(b));}
  this.models.plane=this.R.mesh(new MeshBuilder().add('plane'));this.models.particle=this.R.mesh(new MeshBuilder().add('sphere',[0,0,0],[1,1,1],[0,0,0],'#ffffff',.9));
  this.models.boltGlow=this.R.mesh(new MeshBuilder().ball([0,0,0],[.38,.36,1.05],'#ffffff'));
  this.models.bolt=this.R.mesh(new MeshBuilder().ball([0,0,0],[.22,.20,.72],'#ffffff'));
  this.models.boltCore=this.R.mesh(new MeshBuilder().ball([0,0,0],[.12,.12,.49],'#ffffff'));
  this.models.shadow=this.R.mesh(new MeshBuilder().add('cylinder',[0,.022,0],[.76,.012,1.48],[0,0,0],'#102c39'));
  this.models.ground=this.R.mesh(new MeshBuilder().box([0,-.13,0],[750,.20,750],'#8fa088'));
  this.models.items=makeItemModels(this.R);
  this.models.logo=canvasTex(this.R,256,128,c=>{c.clearRect(0,0,256,128);c.textAlign='center';c.fillStyle='#ed6765';c.font='1000 italic 83px system-ui';c.fillText('NK',128,84);c.fillStyle='#dedbc9';c.font='bold 18px system-ui';c.fillText('ELECTRICAL',128,112);});
  this.world.pickups.forEach((p,i)=>{if(i%3===2)p.type='supply';});
  $('routeLength').textContent=`${Math.round(this.track.length)} M / MARKET / OLD QUARTER / POWER DISTRICT`;
  $('startBtn').disabled=false;this.selectGameMode(this.gameMode);$('loadStatus').textContent='READY · LOCAL SINGLE PLAYER + 3 AI RIVALS';
  this.resetRiders(true);this.state='menu';this.lastClock=performance.now();this.lastFpsTime=this.lastClock;requestAnimationFrame(t=>this.frame(t));window.addEventListener('resize',()=>this.resize());
  $('game').addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause();this.fatal('The graphics context was interrupted. Reload the game to restore the street.');});
  if(location.protocol.startsWith('http')){let manifest=document.createElement('link');manifest.rel='manifest';manifest.href='./manifest.webmanifest';document.head.appendChild(manifest);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});}
 }catch(e){this.state='error';this.fatal(e.message);console.error(e);}}
 fatal(text){$('fatal').style.display='flex';$('fatalText').textContent=text;}
 buildMenu(){let heroes=$('heroes');heroes.innerHTML='';CREW.forEach((c,i)=>{let el=document.createElement('button');el.className='hero'+(i===this.selected?' selected':'');el.style.setProperty('--c',c.color);el.setAttribute('aria-label',`Select ${c.name}, photo character ${i+1}`);el.setAttribute('aria-pressed',String(i===this.selected));el.innerHTML=`<span class="tick">✓</span><div class="portrait"><img src="${ASSETS.heads[i]}" alt="Photo head ${i+1}"></div><strong>${c.name}</strong><small>${c.tag}</small>`;el.onclick=()=>{this.selected=i;safeSet(PLAYER_KEY,i);if(this.riders.length)this.player=this.riders[i];this.buildMenu();this.audio.tone(370+i*70,.1);};heroes.appendChild(el);});$('bestTime').textContent=safeGet('volt-roast-best',0)?`BEST ${this.formatTime(safeGet('volt-roast-best',0))}`:'OFFLINE READY';}
 selectGameMode(mode){
  this.gameMode=mode;let brawl=mode==='brawl';
  for(let [id,value]of[['chooseScooter','scooter'],['chooseBrawl','brawl']]){let button=$(id),active=value===mode;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));}
  $('brawlBackdrop').classList.toggle('active',brawl);
  $('menu').classList.toggle('brawl-mode',brawl);
  $('scooterSetup').hidden=brawl;
  $('startBtn').querySelector('span').textContent=brawl?'OPEN BRAWL SETUP':'LET IT RIP';
  $('menuKeyboardHint').textContent=brawl?'KEYBOARD · WASD move · J punch · K kick · L grab · Q spin · E prop · Space dodge · stand still to block':'KEYBOARD · WASD drive · IJKL / arrows aim · Space fire · 1–4 throw · Esc pause';
  $('routeEyebrow').textContent=brawl?'AFTER HOURS':'THE CIRCUIT';
  $('routeName').textContent=brawl?'NK CREW YARD':'ELECTRIC AVENUE';
  $('routeLength').textContent=brawl?'FOUR FIGHTERS / ONE YARD':`${Math.round(this.track.length)} M / MARKET / OLD QUARTER / POWER DISTRICT`;
 }
 openBrawl(){safeSet(PLAYER_KEY,this.selected);location.href='./brawl.html?fighter='+this.selected;}
 bindUI(){
  $('startBtn').onclick=()=>this.gameMode==='brawl'?this.openBrawl():this.start();$('chooseScooter').onclick=()=>this.selectGameMode('scooter');$('chooseBrawl').onclick=()=>this.selectGameMode('brawl');document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{this.mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('selected',x===b));});
  $('helpBtn').onclick=()=>this.show('helpScreen');$('settingsBtn').onclick=()=>this.openSettings();$('pauseSettingsBtn').onclick=()=>this.openSettings();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>this.hide(b.dataset.close));
  $('pauseBtn').onclick=()=>this.pause();$('resumeBtn').onclick=()=>this.resume();$('restartBtn').onclick=()=>this.start();$('againBtn').onclick=()=>this.start();for(let id of['garageBtn','resultGarageBtn'])$(id).onclick=()=>this.garage();
  $('muteBtn').onclick=()=>{this.audio.muted=!this.audio.muted;$('muteBtn').style.opacity=this.audio.muted?.45:1;$('muteBtn').setAttribute('aria-label',this.audio.muted?'Unmute audio':'Mute audio');if(this.audio.muted)this.audio.stop();};
  for(let[k,id]of[['fx','fxSetting'],['voice','voiceSetting'],['dialogue','dialogueSetting'],['strong','strongSetting'],['perf','perfSetting']]){$(id).checked=this.settings[k];$(id).onchange=()=>{this.settings[k]=$(id).checked;safeSet('volt-roast-settings',this.settings);if(k==='voice'&&!this.settings.voice)this.audio.stop();};}
  $('qualitySetting').value=this.settings.quality;$('qualitySetting').onchange=()=>{this.settings.quality=$('qualitySetting').value;safeSet('volt-roast-settings',this.settings);this.resize();};
  ITEM_TYPES.forEach((type,i)=>{let b=document.createElement('button');b.className='item-btn';b.id='item-'+type;b.style.setProperty('--item',ITEMS[type].color);b.setAttribute('aria-label',`Throw ${ITEMS[type].name.toLowerCase()} behind: ${ITEMS[type].desc}`);b.title=`${i+1} or Numpad ${i+1}: ${ITEMS[type].desc}. Throws behind your scooter.`;b.innerHTML=`<img src="${ASSETS.items[type]}" alt="${ITEMS[type].name}"><span class="item-count">${ITEMS[type].stock}</span><span class="item-name">${ITEMS[type].name}</span><span class="item-timer"></span>`;b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();this.audio.unlock();if(this.state==='racing')this.throwItem(this.player,type);});b.addEventListener('click',e=>{if(e.detail===0&&this.state==='racing')this.throwItem(this.player,type);});$('itemButtons').appendChild(b);});
  window.addEventListener('keydown',e=>{if(['KeyA','KeyD','KeyW','KeyS','KeyI','KeyJ','KeyK','KeyL','ShiftLeft','ShiftRight','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.code)||ITEM_KEY_CODE.test(e.code)){if(['INPUT','SELECT'].includes(document.activeElement.tagName))return;e.preventDefault();if(e.code==='Escape'&&!e.repeat){if(this.state==='paused')this.resume();else if(['racing','countdown'].includes(this.state))this.pause();}if(ITEM_KEY_CODE.test(e.code)&&!e.repeat&&this.state==='racing')this.throwItem(this.player,ITEM_TYPES[Number(e.code.at(-1))-1]);this.keys.add(e.code);}});
  window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>{this.resetInput();if(['racing','countdown'].includes(this.state))this.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&['racing','countdown'].includes(this.state))this.pause();});
 }
 show(id){$(id).classList.add('visible');}hide(id){$(id).classList.remove('visible');}openSettings(){this.show('settingsScreen');}
 resize(){if(!this.R)return;let ratio=this.settings.quality==='low'?.85:this.settings.quality==='high'?Math.min(2,devicePixelRatio):Math.min(1.35,devicePixelRatio);this.R.resize(innerWidth,innerHeight,ratio);this.portrait=innerWidth/innerHeight<.9;this.compactDialogue=innerWidth<900||innerHeight<550;document.documentElement.classList.toggle('compact-dialogue',this.compactDialogue);this.cameraEye=null;}
 resetInput(){this.keys.clear();this.sticks.left.reset();this.sticks.right.reset();this.stickFeedback('left','LEFT · DRIVE',false);this.stickFeedback('right','RIGHT · AIM/FIRE',false);}
 stickFeedback(side,label,active){let wrap=this.sticks[side].el.parentElement,title=wrap.querySelector('.stick-title');if(title.textContent!==label)title.textContent=label;wrap.classList.toggle('engaged',active);}
 resetRiders(menu=false){$('worldUI').innerHTML='';$('rivals').innerHTML='';this.riders=CREW.map((c,i)=>{
  let r={id:i,hero:c,s:menu?10:(i===this.selected?2:9+wrap(i-this.selected-1,4)*4.5),lane:menu?0:(i===this.selected?0:[-3.3,2.8,-.6][wrap(i-this.selected-1,4)]),speed:0,laneV:0,steer:0,hp:100,energy:100,hits:0,maxHeat:1,topSpeed:0,damageDealt:0,itemHits:0,items:0,inventory:Object.fromEntries(ITEM_TYPES.map(t=>[t,ITEMS[t].stock])),throwReady:0,y:0,vy:0,roll:0,skidUntil:0,punctureUntil:0,boosting:false,hitUntil:0,fireReady:0,obstacleTimes:{},deadAt:0,aiLane:i===this.selected?0:[-3.3,2.8,-.6][wrap(i-this.selected-1,4)],aiNext:0,aiFire:1.8+i*.7,aiThrow:4+i*1.4,speechUntil:0,speechSeq:0,modelMatrix:M4.id(),pos:[0,0,0],headPos:[0,0,0]};
  let n=document.createElement('div');n.className='nameplate';n.style.setProperty('--c',c.color);n.innerHTML=`<b>${c.name}</b><div class="hp"><span></span></div>`;$('worldUI').appendChild(n);r.nameEl=n;
  let bubble=document.createElement('div');bubble.className='bubble';bubble.innerHTML='<span class="speaker"></span><span class="bangla" lang="bn"></span><span class="greek" lang="el"></span>';$('worldUI').appendChild(bubble);r.bubbleEl=bubble;
  let h=document.createElement('div');h.className='rival'+(i===this.selected?' me':'');h.style.setProperty('--c',c.color);h.innerHTML=`<img src="${ASSETS.heads[i]}" alt="${c.name}"><b>${c.name}</b><small>100</small><div class="mini-bar"><span></span></div>`;$('rivals').appendChild(h);r.hudEl=h;return r;
 });this.player=this.riders[this.selected];document.documentElement.style.setProperty('--hero',CREW[this.selected].color);this.updatePositions();}
 start(){if(!this.R)return;this.audio.unlock();this.audio.stop();this.resetInput();document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));this.resetRiders();this.bullets=[];this.traps=[];this.particles=[];this.damagePops=[];this.pairTimes={};this.time=0;this.raceTime=0;this.phaseTime=3.2;this.countBeep=-1;this.state='countdown';this.cameraEye=null;this.cameraTarget=null;this.speedEffect=0;this.acc=0;this.shake=0;this.hitFlash=0;this.nextDialogueAt=0;this.captionUntil=0;$('dialogueCaption').style.opacity=0;this.winner=null;this.nextHazard=120;this.world.pickups.forEach(p=>p.ready=0);$('hud').style.display='block';$('worldUI').style.display='block';$('countdown').style.display='block';$('toast').style.opacity=0;$('lapTitle').textContent=this.mode==='clash'?'LAP':'ALIVE';this.toastUntil=0;$('itemStatus').textContent='TAP AN ITEM · THROW IT BEHIND';this.updateHUD();}
 pause(){if(!['racing','countdown'].includes(this.state))return;this.resumeState=this.state;this.state='paused';this.audio.stop();this.resetInput();this.show('pauseScreen');}
 resume(){if(this.state!=='paused')return;this.hide('pauseScreen');this.hide('settingsScreen');this.state=this.resumeState||'racing';this.audio.unlock();this.lastClock=performance.now();this.acc=0;}
 garage(){this.audio.stop();this.resetInput();document.querySelectorAll('.screen').forEach(s=>s.classList.remove('visible'));this.show('menu');this.state='menu';$('hud').style.display='none';$('worldUI').style.display='none';this.bullets=[];this.traps=[];this.particles=[];this.resetRiders(true);this.cameraEye=null;this.buildMenu();}
 formatTime(t){return `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;}
 toast(text,duration=2.7){$('toast').textContent=text;$('toast').style.opacity=1;this.toastUntil=this.time+duration;}
 addParticles(p,color,count=10,force=2){for(let i=0;i<count;i++)this.particles.push({p:[...p],v:[(Math.random()-.5)*force*2,Math.random()*force+1,(Math.random()-.5)*force*2],life:.35+Math.random()*.5,max:.85,size:.025+Math.random()*.07,color});if(this.particles.length>150)this.particles.splice(0,this.particles.length-150);}
 damage(r,amount,source,kind='hit'){
  if(r.hp<=0)return;let actual=Math.min(r.hp,Math.max(0,amount));r.hp=Math.max(0,r.hp-actual);r.hitUntil=this.time+.18;if(source&&source!==r)source.damageDealt+=actual;
  if(V3.len(V3.sub(r.pos,this.player.pos))<30){this.addParticles([r.pos[0],.8+r.y,r.pos[2]],r.hero.color,Math.ceil(actual*.7)+4,2.2);this.audio.effect('hit');let el=document.createElement('div');el.className='damage-pop';el.textContent='−'+Math.round(actual);$('worldUI').appendChild(el);this.damagePops.push({el,p:[r.pos[0],2.5+r.y,r.pos[2]],life:.9});}
  if(r===this.player){this.shake=Math.min(.25,this.shake+.05+amount*.002);this.hitFlash=.7;if(navigator.vibrate)navigator.vibrate(22);}
  if(r.hp<=0){r.deadAt=this.raceTime;r.speed*=.3;this.addParticles([r.pos[0],1,r.pos[2]],'#ffd473',28,3.3);this.audio.effect('wreck');this.toast(r===this.player?'YOUR SCOOTER IS OUT · WATCHING THE SURVIVORS':r.hero.name+' IS OUT!',r===this.player?6:3);r.bubbleEl.style.opacity=0;r.nameEl.querySelector('b').textContent=r.hero.name+' · OUT';}
 }
 registerHit(a,b,kind='collision'){
  if(!a||!b||a===b)return;for(let r of[a,b]){r.hits++;r.maxHeat=Math.max(r.maxHeat,heatFor(r.hits));}
  let near=V3.len(V3.sub(a.pos,this.player.pos))<32||a===this.player||b===this.player;
  if(near&&this.time>=this.nextDialogueAt){this.nextDialogueAt=this.time+7;let speaker=a===this.player?b:b===this.player?a:V3.len(V3.sub(a.pos,this.player.pos))<V3.len(V3.sub(b.pos,this.player.pos))?a:b;this.say(speaker);}
 }
 say(r){let level=Math.min(heatFor(r.hits),this.settings.strong?4:3),pool=ASSETS.lines.filter(l=>l.level===level),line=pool[(r.id+r.speechSeq++)%pool.length];r.speechUntil=this.time+3.1;r.speechLine=line;r.bubbleEl.querySelector('.speaker').textContent=`${r.hero.name} · HEAT ${level}/4`;r.bubbleEl.querySelector('.bangla').textContent=line.bn;r.bubbleEl.querySelector('.greek').textContent=line.el;r.bubbleEl.classList.toggle('hot',level>=3);$('dialogueCaption').querySelector('.caption-speaker').textContent=r.hero.name+' · ';$('dialogueCaption').querySelector('.caption-greek').textContent=line.el;this.captionUntil=r.speechUntil;this.audio.speak(line,r.id,r===this.player);}
 collide(a,b){
  let key=[a.id,b.id].sort().join('-');if((this.pairTimes[key]??-9)+1.3>this.time)return false;this.pairTimes[key]=this.time;
  let amount=7+Math.min(6,Math.abs(a.speed-b.speed)*.7+Math.abs(a.laneV-b.laneV)*.45);this.registerHit(a,b);this.damage(a,amount,b,'collision');this.damage(b,amount,a,'collision');
  let side=a.lane>=b.lane?1:-1;a.lane=clamp(a.lane+side*.47,-7.8,7.8);b.lane=clamp(b.lane-side*.47,-7.8,7.8);a.laneV=side*3.4;b.laneV=-side*3.4;a.speed*=.82;b.speed*=.82;
  if(a.hp>0&&b.hp>0){this.fire(a,0,-1,b,true);this.fire(b,0,-1,a,true);}if(a===this.player||b===this.player)this.toast('CONTACT! RETURN FIRE · HEAT '+heatFor(this.player.hits),1.6);return true;
 }
 fire(r,x=0,y=-1,target=null,automatic=false){
  if(r.hp<=0||(!automatic&&this.time<r.fireReady))return false;let len=Math.hypot(x,y)||1,vs=-y/len*38,vl=x/len*38;
  if(target){let ds=this.track.delta(target.s,r.s),dl=target.lane-r.lane,l=Math.hypot(ds,dl)||1;vs=ds/l*40;vl=dl/l*40;}
  if(!automatic)r.fireReady=this.time+.5;
  r.shotFlashUntil=this.time+.13;r.shotVs=vs;r.shotVl=vl;
  this.bullets.push({s:r.s+vs/40*.9,lane:r.lane+vl/40*.9,y:r.y+1.04,vs,vl,owner:r.id,life:1.5,damage:automatic?3:4,target:target?.id??null,auto:automatic});
  if(V3.len(V3.sub(r.pos,this.player.pos))<28)this.audio.effect('fire');return true;
 }
 throwItem(r,type){
  if(!r||r.hp<=0||!ITEMS[type]||this.state!=='racing')return false;
  if(this.time<r.throwReady){if(r===this.player)this.itemMessage('WAIT FOR THE THROW COOLDOWN');return false;}
  if(r.inventory[type]<=0){if(r===this.player)this.itemMessage('EMPTY · COLLECT A PURPLE SUPPLY BOX');return false;}
  r.inventory[type]--;r.items++;r.throwReady=this.time+1.1;
  this.traps.push({id:++this.trapId,type,owner:r.id,s:r.s-1.35,startS:r.s-1.35,lane:r.lane,startLane:r.lane,age:0,flight:.50,life:ITEMS[type].life,y:.90,landed:false,armed:false,hit:new Set(),distance:3.4+Math.min(1.2,r.speed*.06)});
  if(r===this.player){this.itemMessage(`${ITEMS[type].name} THROWN BEHIND · ${ITEMS[type].damage} DAMAGE`);this.audio.effect('throw');this.addParticles([r.pos[0],.9,r.pos[2]],ITEMS[type].color,5,1.3);}
  return true;
 }
 itemMessage(text){$('itemStatus').textContent=text;this.itemMessageUntil=this.time+2.7;}
 applyTrap(trap,r){let item=ITEMS[trap.type],source=this.riders[trap.owner];this.registerHit(source,r,'item');this.damage(r,item.damage,source,'item');source.itemHits++;if(item.skid)r.skidUntil=Math.max(r.skidUntil,this.time+item.skid);if(item.puncture)r.punctureUntil=Math.max(r.punctureUntil,this.time+item.puncture);if(item.slow)r.speed*=1-item.slow;
  if(trap.type==='box'){r.vy=3;r.y=.08;}if(r===this.player){this.audio.effect('skid');this.toast(`${item.name}! −${item.damage} SCOOTER HEALTH`,2);}else if(source===this.player){this.toast(`${r.hero.name} HIT YOUR ${item.name} · −${item.damage} HP`,2);}
  trap.hit.add(r.id);if(trap.type!=='oil')trap.life=0;
 }
 controlPlayer(r,dt){let l=this.sticks.left,k=this.keys,steer=clamp(l.x+(k.has('KeyD')?1:0)-(k.has('KeyA')?1:0),-1,1);let boost=l.y<-.18||k.has('KeyW')||k.has('ShiftLeft')||k.has('ShiftRight'),brake=l.y>.36||k.has('KeyS');
  r.steer=steer;r.boosting=boost&&r.energy>1&&!brake;let target=brake?4.3:r.boosting?26:18;
  if(r.punctureUntil>this.time)target*=.61;if(r.skidUntil>this.time)target*=.78;
  r.speed=lerp(r.speed,target,1-Math.exp(-dt*(brake?3.7:2.2)));r.laneV=lerp(r.laneV,steer*(r.boosting?8.4:7.4),1-Math.exp(-dt*(r.skidUntil>this.time?1.7:7)));
  let turn=steer>.18?'RIGHT':steer<-.18?'LEFT':'',boostHeld=boost&&!brake;this.stickFeedback('left',boostHeld?`BOOST${turn?' + '+turn:''}`:brake?`BRAKE${turn?' + '+turn:''}`:turn?`STEER ${turn}`:'LEFT · DRIVE',!!(turn||boostHeld||brake));
  let rs=this.sticks.right,ax=rs.x+(k.has('ArrowRight')||k.has('KeyL')?1:0)-(k.has('ArrowLeft')||k.has('KeyJ')?1:0),ay=rs.y+(k.has('ArrowDown')||k.has('KeyK')?1:0)-(k.has('ArrowUp')||k.has('KeyI')?1:0),firing=Math.hypot(ax,ay)>.24||k.has('Space');if(firing){if(Math.hypot(ax,ay)<.2){ax=0;ay=-1;}this.fire(r,ax,ay);$('reticle').style.opacity=.75;}else $('reticle').style.opacity=0;
  let arrow=ay<-.25?(ax>.25?'↗':ax<-.25?'↖':'↑'):ay>.25?(ax>.25?'↘':ax<-.25?'↙':'↓'):ax>.25?'→':ax<-.25?'←':'↑';this.stickFeedback('right',firing?'FIRE '+arrow:'RIGHT · AIM/FIRE',firing);
 }
 controlAI(r,dt){
  let seed=r.id*2.3,leader=Math.max(...this.riders.filter(a=>a.hp>0).map(a=>a.s));
  if(this.time>r.aiNext){r.aiNext=this.time+1.0+Math.random()*1.5;let near=this.riders.filter(a=>a!==r&&a.hp>0&&Math.abs(this.track.delta(a.s,r.s))<13);let target=near.sort((a,b)=>Math.abs(a.s-r.s)-Math.abs(b.s-r.s))[0];r.aiLane=target&&Math.random()<.48?target.lane+(Math.random()-.5)*1.4:Math.sin(this.time*.18+seed)*5.6;}
  let targetLane=r.aiLane;
  for(let o of this.world.obstacles){let ds=this.track.delta(o.s,r.s);if(ds>0&&ds<14&&Math.abs(o.lane-r.lane)<o.w+1&&o.type!=='ramp'){let dir=r.lane-o.lane;if(Math.abs(dir)<.25)dir=r.id%2?1:-1;targetLane=clamp(o.lane+Math.sign(dir)*(o.w+1.3),-7.3,7.3);}}
  for(let trap of this.traps){let ds=this.track.delta(trap.s,r.s);if(trap.landed&&ds>2&&ds<11&&Math.abs(trap.lane-r.lane)<1.2&&Math.random()>.45)targetLane=clamp(trap.lane+(r.lane>=trap.lane?2.2:-2.2),-7.3,7.3);}
  r.steer=clamp((targetLane-r.lane)*.55,-1,1);r.laneV=lerp(r.laneV,r.steer*4.0,1-Math.exp(-dt*4));
  r.boosting=r.energy>28&&leader-r.s>13&&Math.sin(this.time*.4+seed)>.1;
  let target=17.1+Math.sin(this.time*.33+seed)*.7+clamp((leader-r.s)*.055,0,2.3)+(r.boosting?4.1:0);if(r.punctureUntil>this.time)target*=.61;if(r.skidUntil>this.time)target*=.77;r.speed=lerp(r.speed,target,1-Math.exp(-dt*1.3));
  if(this.time>r.aiFire){r.aiFire=this.time+1.45+Math.random()*1.8;let close=this.riders.filter(a=>a!==r&&a.hp>0&&Math.hypot(this.track.delta(a.s,r.s),a.lane-r.lane)<18).sort((a,b)=>Math.abs(a.s-r.s)-Math.abs(b.s-r.s))[0];if(close)this.fire(r,0,-1,close);}
  if(this.time>r.aiThrow){r.aiThrow=this.time+3.5+Math.random()*3.5;let behind=this.riders.some(a=>a!==r&&a.hp>0&&this.track.delta(r.s,a.s)>3&&this.track.delta(r.s,a.s)<22&&Math.abs(a.lane-r.lane)<3);let choices=ITEM_TYPES.filter(t=>r.inventory[t]>0);if(behind&&choices.length)this.throwItem(r,choices[Math.floor(Math.random()*choices.length)]);}
 }
 update(dt){
  if(this.state==='menu'){this.time+=dt;return;}
  if(!['racing','countdown'].includes(this.state))return;
  this.time+=dt;
  if(this.state==='countdown'){this.phaseTime-=dt;let n=Math.ceil(this.phaseTime);$('countdown').innerHTML=n>0?`${n}<small>HOLD YOUR LINE</small>`:'GO!';if(n!==this.countBeep){this.countBeep=n;this.audio.effect(n>0?'tick':'go');}if(this.phaseTime<-.55){this.state='racing';$('countdown').style.display='none';this.toast('DODGE. THROW BEHIND. OUTLAST.',2.7);}return;}
  for(let r of this.riders)r.previous={s:r.s,lane:r.lane,y:r.y,roll:r.roll,laneV:r.laneV};
  this.raceTime+=dt;
  for(let r of this.riders){
   if(r.hp<=0){r.speed=Math.max(0,r.speed-dt*6);r.s+=r.speed*dt;r.roll=lerp(r.roll,r.id%2?.8:-.8,dt*2);continue;}
   if(r===this.player)this.controlPlayer(r,dt);else this.controlAI(r,dt);
   r.energy=clamp(r.energy+(r.boosting?-24:8)*dt,0,100);
   if(r.skidUntil>this.time)r.laneV+=Math.sin(this.time*12+r.id)*dt*11;
   r.lane+=r.laneV*dt;r.s+=r.speed*dt;r.topSpeed=Math.max(r.topSpeed,r.speed*3.6);
   if(Math.abs(r.lane)>7.9){r.lane=clamp(r.lane,-7.9,7.9);r.laneV*=-.30;r.speed*=.992;if((r.obstacleTimes.curb??-10)+1.4<this.time){r.obstacleTimes.curb=this.time;this.damage(r,4,null,'curb');}}
   if(r.y>0||r.vy>0){r.vy-=12*dt;r.y=Math.max(0,r.y+r.vy*dt);if(r.y===0)r.vy=0;}
   r.roll=lerp(r.roll,-r.laneV*.048+(r.skidUntil>this.time?Math.sin(this.time*11)*.11:0),1-Math.exp(-dt*8));
   for(let o of this.world.obstacles){let ds=this.track.delta(r.s,o.s);if(Math.abs(ds)<o.d+.68&&Math.abs(r.lane-o.lane)<o.w+.29&&r.y<.7&&(r.obstacleTimes[o.id]??-10)+2.3<this.time){r.obstacleTimes[o.id]=this.time;if(o.type==='ramp'){r.vy=6.8;r.y=.05;if(r===this.player)this.toast('CATCH SOME AIR!',1.6);}else{this.damage(r,o.damage,null,'obstacle');r.speed*=o.type==='van'?.4:.73;if(o.type==='pothole')r.skidUntil=this.time+.6;}}}
   if(r.hp<=0)continue;for(let p of this.world.pickups){if(p.ready>this.time)continue;if(Math.abs(this.track.delta(r.s,p.s))<1.6&&Math.abs(r.lane-p.lane)<1.1){p.ready=this.time+8;if(p.type==='repair')r.hp=Math.min(100,r.hp+22);else if(p.type==='boost')r.energy=Math.min(100,r.energy+45);else{let lowest=ITEM_TYPES.slice().sort((a,b)=>r.inventory[a]/ITEMS[a].max-r.inventory[b]/ITEMS[b].max);for(let t of lowest.slice(0,2))r.inventory[t]=Math.min(ITEMS[t].max,r.inventory[t]+1);}
    if(r===this.player){this.audio.effect('pickup');this.toast(p.type==='repair'?'+22 SCOOTER REPAIR':p.type==='boost'?'+45 BOOST ENERGY':'+2 ITEMS · THROW THEM BEHIND',1.8);}}}
  }
  this.updatePositions();
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){let a=this.riders[i],b=this.riders[j];if(a.hp<=0||b.hp<=0||Math.abs(a.y-b.y)>.85)continue;if(Math.abs(this.track.delta(a.s,b.s))<1.72&&Math.abs(a.lane-b.lane)<.87)this.collide(a,b);}
  for(let b of this.bullets){b.life-=dt;b.s+=b.vs*dt;b.lane+=b.vl*dt;if(Math.abs(b.lane)>9){b.life=0;continue;}for(let r of this.riders){if(r.id===b.owner||r.hp<=0)continue;if(Math.abs(this.track.delta(b.s,r.s))<1.1&&Math.abs(b.lane-r.lane)<.65&&Math.abs(b.y-(r.y+1))<1){this.damage(r,b.damage,this.riders[b.owner],'bolt');if(!b.auto)this.registerHit(this.riders[b.owner],r,'bolt');b.life=0;break;}}}this.bullets=this.bullets.filter(b=>b.life>0);
  for(let t of this.traps){t.age+=dt;t.life-=dt;let item=ITEMS[t.type];if(t.age<t.flight){let f=t.age/t.flight;t.s=t.startS-t.distance*f;t.y=.90*(1-f)+Math.sin(f*Math.PI)*1.05;}else{if(!t.landed){t.landed=true;t.y=0;t.s=t.startS-t.distance;let p=this.track.frame(t.s,t.lane).p;this.addParticles([p[0],.12,p[2]],item.color,5,1);}}t.armed=t.landed||t.y<1.8;for(let r of this.riders){if(!t.armed||r.hp<=0||r.y>.65||t.hit.has(r.id)||(r.id===t.owner&&t.age<2.5))continue;if(Math.abs(this.track.delta(t.s,r.s))<item.radius+.68&&Math.abs(t.lane-r.lane)<item.radius+.23){this.applyTrap(t,r);if(t.life<=0)break;}}}this.traps=this.traps.filter(t=>t.life>0);
  for(let p of this.particles){p.life-=dt;p.v[1]-=7*dt;p.p=V3.add(p.p,V3.mul(p.v,dt));if(p.p[1]<.03){p.p[1]=.03;p.v[1]*=-.25;}}this.particles=this.particles.filter(p=>p.life>0);
  for(let d of this.damagePops){d.life-=dt;d.p[1]+=dt*1.3;if(d.life<=0)d.el.remove();}this.damagePops=this.damagePops.filter(d=>d.life>0);
  this.shake=Math.max(0,this.shake-dt*.3);this.hitFlash=Math.max(0,this.hitFlash-dt*2.1);
  if(this.toastUntil<this.time)$('toast').style.opacity=0;if(this.itemMessageUntil<this.time)$('itemStatus').textContent=this.player.hp<=0?'SCOOTER WRECKED · WATCHING THE RACE':'TAP AN ITEM · THROW IT BEHIND';
  if(this.raceTime>120&&this.mode==='survival'){if(this.nextHazard===120){this.toast('SUDDEN DEATH · BATTERIES ARE FAILING',5);this.nextHazard=999999;}for(let r of this.riders)if(r.hp>0)r.hp=Math.max(.001,r.hp-dt*1.7);let weak=this.riders.filter(r=>r.hp>0&&r.hp<=.002);for(let r of weak)this.damage(r,1,null,'battery');}
  let alive=this.riders.filter(r=>r.hp>0);if(alive.length<=1){this.finish(alive[0]||null,'survival');return;}
  if(this.mode==='clash'){let done=alive.filter(r=>r.s>=this.track.length*2).sort((a,b)=>b.s-a.s);if(done.length){this.finish(done[0],'finish');return;}}
 }
 updatePositions(){for(let r of this.riders){let f=this.track.frame(r.s,r.lane);r.pos=[f.p[0],r.y,f.p[2]];r.yaw=f.yaw-r.laneV*.025;r.modelMatrix=M4.trs(r.pos,[r.vy>0?-.09:0,r.yaw,r.roll]);r.headPos=M4.point(r.modelMatrix,[0,2.99,.06]);}}
 camera(dt){let r=this.player;if(this.state==='menu'){this.speedEffect=0;r=this.riders[this.selected];let f=this.track.frame(r.s,r.lane),angle=.55+Math.sin(this.time*.12)*.05;let eye=V3.add(f.p,V3.add(V3.mul(f.t,-6.3),V3.mul(f.right,6.3)));eye[1]=4.25;let target=V3.add(f.p,V3.mul(f.right,this.portrait?0:-3.4));target[1]=2.05;return{eye,target,fov:this.portrait?64:54};}
  if(r.hp<=0){let a=this.riders.filter(x=>x.hp>0).sort((a,b)=>b.s-a.s);if(a.length)r=a[0];}
  let f=this.track.frame(r.s,r.lane),speed=r.speed,b=this.portrait?9.4:8.5,look=this.track.frame(r.s+6,r.lane*.76).p,eye=V3.add(f.p,V3.add(V3.mul(f.t,-b-speed*.025),V3.mul(f.right,this.portrait?.45:.65)));eye[1]=5.0+r.y*.38;look[1]=1.15;
  // Drive visual speed feedback continuously; low-energy boost switches every few ticks.
  let factor=1-Math.exp(-dt*8);if(!this.cameraEye){this.cameraEye=eye;this.cameraTarget=look;}else{this.cameraEye=V3.mix(this.cameraEye,eye,factor);this.cameraTarget=V3.mix(this.cameraTarget,look,factor);}this.speedEffect=lerp(this.speedEffect??0,clamp((speed-18)/8,0,1),1-Math.exp(-dt*6));let e=[...this.cameraEye];if(this.shake>0)for(let i=0;i<2;i++)e[i]+=(Math.random()-.5)*this.shake;return{eye:e,target:this.cameraTarget,fov:this.portrait?65:63+this.speedEffect*3};
 }
 render(dt,alpha=1){let saved=null;
  if(this.state==='racing'&&alpha<1){saved=this.riders.map(r=>({r,s:r.s,lane:r.lane,y:r.y,roll:r.roll,laneV:r.laneV}));for(let p of saved){let r=p.r,prev=r.previous;if(!prev)continue;r.s=lerp(prev.s,p.s,alpha);r.lane=lerp(prev.lane,p.lane,alpha);r.y=lerp(prev.y,p.y,alpha);r.roll=lerp(prev.roll,p.roll,alpha);r.laneV=lerp(prev.laneV,p.laneV,alpha);}}
  let R=this.R;this.updatePositions();let cam=this.camera(dt);R.begin(cam.eye,cam.target,cam.fov);R.draw(this.models.ground);this.world.draw(cam.eye,this.time);
  for(let p of this.world.pickups){if(p.type!=='supply'||p.ready>this.time)continue;let f=this.track.frame(p.s,p.lane);if(V3.len(V3.sub(f.p,cam.eye))>90)continue;f.p[1]=.9+Math.sin(this.time*2.7+p.id)*.17;R.draw(this.models.items.supply,M4.trs(f.p,[0,this.time*1.3,0]));}
  for(let t of this.traps){let p=this.track.frame(t.s,t.lane).p;p[1]=t.y+.025;if(V3.len(V3.sub(p,cam.eye))>95)continue;if(t.landed){let radius=ITEMS[t.type].radius+Math.sin(this.time*4)*.025;R.draw(this.models.items.hazardRing,M4.trs([p[0],0,p[2]],[0,0,0],[radius,1,radius]),{tint:rgb(ITEMS[t.type].color),alpha:.65,unlit:true,depthWrite:false});}R.draw(this.models.items[t.type],M4.trs(p,[t.landed?0:t.age*8,t.landed?t.id:t.age*4,0],t.landed?[1,1,1]:[.9,.9,.9]),{alpha:t.life<2?clamp(t.life/2,.15,1):1});}
  for(let r of this.riders){let cameraDistance=V3.len(V3.sub(r.pos,cam.eye));if(cameraDistance>145||(this.state==='menu'&&r!==this.player))continue;let opacity=r!==this.player&&cameraDistance<7?clamp((cameraDistance-2)/5,.10,1):1;
   R.draw(this.models.shadow,M4.trs([r.pos[0],0,r.pos[2]],[0,r.yaw,0]),{alpha:.30,depthWrite:false});let tint=r.hitUntil>this.time?[1.6,1.25,1.05]:r.hp<=0?[.6,.6,.63]:[1,1,1];R.draw(this.models.scooters[r.id],r.modelMatrix,{tint,alpha:opacity});R.draw(this.models.riders[r.id],r.modelMatrix,{tint,alpha:opacity});
   for(let z of[-.84,.84])R.draw(this.models.wheel,M4.mul(r.modelMatrix,M4.trs([0,.34,z],[r.s/.34,0,0])),{tint,alpha:opacity});
   R.draw(this.models.plane,M4.mul(r.modelMatrix,M4.trs([0,1.97,.379],[0,0,0],[.50,.25,1])),{texture:this.models.logo,blend:true,depthWrite:false});
   if(r.shotFlashUntil>this.time){let f=this.track.frame(r.s+r.shotVs/40*2.2,r.lane+r.shotVl/40*2.2),p=f.p;p[1]=r.y+1.35;let fade=(r.shotFlashUntil-this.time)/.13;R.draw(this.models.boltGlow,M4.trs(p,[0,0,0],[.58,.58,.5]),{unlit:true,tint:rgb(r.hero.color),alpha:.5*fade,depthWrite:false});R.draw(this.models.boltCore,M4.trs(p,[0,0,0],[1,1,.8]),{unlit:true});}
   let h=r.headPos,m=R.billboard(h);R.draw(this.models.halos[r.id],m,{unlit:true,alpha:(r.hp<=0?.3:.96)*opacity,depthWrite:false});R.draw(this.models.plane,R.billboard([h[0],h[1],h[2]],[1.30,1.54,1]),{texture:this.models.heads[r.id],blend:true,unlit:true,alpha:opacity,tint:r.hp<=0?[.55,.55,.55]:[1,1,1]});
   if(r.boosting&&r.hp>0){let p=M4.point(r.modelMatrix,[0,.42,1.10]);R.draw(this.models.particle,M4.trs(p,[0,0,0],[.12,.10,.25+Math.random()*.4]),{tint:rgb(r.hero.color),unlit:true});}
   if(r.hp<28&&Math.random()<.13&&this.state==='racing'){let p=[r.pos[0],.65+r.y,r.pos[2]];this.addParticles(p,'#4d5f68',1,.5);}
  }
  for(let b of this.bullets){let f=this.track.frame(b.s,b.lane),p=f.p;p[1]=b.y;let angle=[0,f.yaw+Math.atan2(-b.vl,-b.vs),0],distance=V3.len(V3.sub(p,cam.eye)),scale=clamp(distance/17,1,2);R.draw(this.models.boltGlow,M4.trs(p,angle,[scale,scale,scale]),{unlit:true,tint:rgb(CREW[b.owner].color),alpha:.38,depthWrite:false});R.draw(this.models.bolt,M4.trs(p,angle,[scale,scale,scale]),{unlit:true,tint:rgb(CREW[b.owner].color)});R.draw(this.models.boltCore,M4.trs(p,angle,[scale,scale,scale]),{unlit:true});}
  for(let p of this.particles)R.draw(this.models.particle,M4.trs(p.p,[0,0,0],[p.size,p.size,p.size]),{tint:rgb(p.color),alpha:Math.min(1,p.life*3),unlit:true});
  if(['racing','countdown','paused'].includes(this.state)){this.projectUI();this.updateHUD();}
  $('hitFlash').style.opacity=this.hitFlash;$('speedLines').style.opacity=this.state==='racing'?this.speedEffect*.22:0;
  this.audio.update(this.player.speed,this.state==='racing'||this.state==='countdown');
  if(saved){for(let p of saved){let r=p.r;r.s=p.s;r.lane=p.lane;r.y=p.y;r.roll=p.roll;r.laneV=p.laneV;}this.updatePositions();}
 }
 projectUI(){let bounds=[],w=this.R.w,h=this.R.h;
  $('dialogueCaption').style.opacity=this.compactDialogue&&this.settings.dialogue&&this.captionUntil>this.time?1:0;
  // Near riders get priority. Dialogue stays tied to the speaker and avoids other clouds.
  let visible=this.riders.slice().sort((a,b)=>V3.len(V3.sub(a.pos,this.R.eye))-V3.len(V3.sub(b.pos,this.R.eye)));
  for(let r of visible){let np=this.R.project([r.headPos[0],r.headPos[1]+.98,r.headPos[2]]);r.nameEl.style.display=np.visible?'block':'none';if(np.visible){r.nameEl.style.left=np.x+'px';r.nameEl.style.top=np.y+'px';r.nameEl.querySelector('.hp span').style.width=r.hp+'%';r.nameEl.title=`${r.hero.name}: ${Math.ceil(r.hp)} / 100 scooter health`;}
   let p=this.R.project(r.headPos),active=!this.compactDialogue&&this.settings.dialogue&&r.speechUntil>this.time&&p.visible&&r.hp>0;if(!active){r.bubbleEl.style.opacity=0;continue;}
   let b=r.bubbleEl,bw=Math.min(w<700?196:280,w*.66);b.style.width=bw+'px';let bh=b.offsetHeight||110;
   if(bounds.length>=2){b.style.opacity=0;continue;}
   let topLimit=h<550?112:158,bottomLimit=h-(this.portrait?265:155)-bh;
   bottomLimit=Math.max(topLimit,bottomLimit);let candidates=[];
   for(let dy of[-bh-50,-bh-88,-bh*.78,24,-bh*1.8])for(let side of[1,-1]){
    let x=clamp(side>0?p.x+21:p.x-bw-21,8,w-bw-8),y=clamp(p.y+dy,topLimit,bottomLimit),overlap=0;
    for(let q of bounds){let ix=Math.max(0,Math.min(x+bw,q.x+q.w+10)-Math.max(x,q.x-10)),iy=Math.max(0,Math.min(y+bh,q.y+q.h+10)-Math.max(y,q.y-10));overlap+=ix*iy;}
    let faceOverlap=0;for(let rider of this.riders){let hp=this.R.project(rider.headPos);if(!hp.visible)continue;let ix=Math.max(0,Math.min(x+bw,hp.x+30)-Math.max(x,hp.x-30)),iy=Math.max(0,Math.min(y+bh,hp.y+34)-Math.max(y,hp.y-42));faceOverlap+=ix*iy;}let dist=Math.hypot(x+bw/2-p.x,y+bh/2-p.y);candidates.push({x,y,right:side<0,score:overlap*100+faceOverlap*3+dist});
   }
   candidates.sort((a,b)=>a.score-b.score);let chosen=candidates[0];
   if(chosen.score>100000&&bounds.length){b.style.opacity=0;continue;}
   b.classList.toggle('right-tail',chosen.right);b.classList.toggle('below-mouth',chosen.y>p.y);b.style.left=chosen.x+'px';b.style.top=chosen.y+'px';b.style.opacity=1;bounds.push({x:chosen.x,y:chosen.y,w:bw,h:bh});
  }
  for(let d of this.damagePops){let p=this.R.project(d.p);d.el.style.display=p.visible?'block':'none';d.el.style.left=p.x+'px';d.el.style.top=p.y+'px';d.el.style.opacity=Math.min(1,d.life*2);}
 }
 updateHUD(){let p=this.player;if(!p)return;let ranked=this.riders.slice().sort((a,b)=>(b.hp>0)-(a.hp>0)||b.s-a.s),pos=ranked.indexOf(p)+1;
  $('positionStat').innerHTML=pos+'<small>/4</small>';$('lapStat').innerHTML=(this.mode==='clash'?Math.min(2,Math.floor(Math.max(0,p.s)/this.track.length)+1):this.riders.filter(r=>r.hp>0).length)+`<small>/${this.mode==='clash'?2:4}</small>`;$('timeStat').textContent=this.formatTime(this.raceTime);$('speedStat').textContent=Math.round(p.speed*3.6);$('hpText').textContent=Math.ceil(p.hp)+'%';$('hpFill').style.width=p.hp+'%';$('hpFill').style.background=p.hp<30?'#ff646f':p.hp<60?'#ffe341':'#64efac';$('energyFill').style.width=p.energy+'%';
  let heat=heatFor(p.hits);$('heatPips').querySelectorAll('i').forEach((x,i)=>{x.classList.toggle('on',i<heat);x.classList.toggle('hot',heat===4);});$('heatLabel').textContent=p.hp<=0?'SCOOTER OUT':p.punctureUntil>this.time?'PUNCTURED TYRES':p.skidUntil>this.time?'SKIDDING!':heat===4&&!this.settings.strong?'FILTERED FURY':HEAT_NAMES[heat-1];
  for(let r of this.riders){r.hudEl.querySelector('.mini-bar span').style.width=r.hp+'%';r.hudEl.querySelector('small').textContent=r.hp>0?Math.ceil(r.hp):'OUT';r.hudEl.classList.toggle('out',r.hp<=0);}
  let section=Math.floor(wrap(p.s,this.track.length)/this.track.length*4);$('sector').textContent=['MARKET DISTRICT','OLD QUARTER','POWER DISTRICT','ELECTRIC AVENUE'][section];
  for(let t of ITEM_TYPES){let b=$('item-'+t),count=p.inventory[t],cd=Math.max(0,p.throwReady-this.time);b.querySelector('.item-count').textContent=count;b.classList.toggle('empty',count<=0||p.hp<=0);b.classList.toggle('cooling',cd>0);b.querySelector('.item-timer').style.height=cd/1.1*100+'%';b.setAttribute('aria-disabled',String(count<=0||cd>0||p.hp<=0));}
  this.drawMap();$('fps').style.display=this.settings.perf?'block':'none';if(this.settings.perf)$('fps').textContent=`${Math.round(this.fps)} FPS · ${Math.round(this.R.tris/1000)}K TRI · ${this.R.draws} DRAWS`;
 }
 drawMap(){let c=$('map').getContext('2d'),w=250,h=226;c.clearRect(0,0,w,h);let plot=p=>[w/2+p[0]*.66,h/2+p[2]*.63];c.strokeStyle='#597179';c.lineWidth=13;c.lineJoin='round';c.beginPath();for(let i=0;i<=160;i++){let p=plot(this.track.point(i/160*this.track.length));i?c.lineTo(...p):c.moveTo(...p);}c.stroke();c.strokeStyle='#bdc6b063';c.lineWidth=1.2;c.stroke();let start=plot(this.track.point(0));c.fillStyle='#f2edcf';c.fillRect(start[0]-3,start[1]-7,6,14);for(let r of this.riders){let p=plot(r.pos);c.beginPath();c.arc(...p,r===this.player?7:5.4,0,Math.PI*2);c.fillStyle=r.hp<=0?'#566570':r.hero.color;c.fill();if(r===this.player){c.strokeStyle='#fff9d8';c.lineWidth=2;c.stroke();}}}
 finish(winner,reason){this.winner=winner?.id??null;this.state='results';this.audio.stop();this.resetInput();$('worldUI').style.display='none';$('hud').style.display='none';this.show('resultScreen');let won=winner===this.player;document.documentElement.style.setProperty('--hero',winner?.hero.color||'#ffffff');$('winnerImage').src=ASSETS.heads[winner?.id??this.selected];$('resultEyebrow').textContent=won?'YOU OWN THE STREET':winner?'STREET CLASH COMPLETE':'DOUBLE WRECK';$('resultTitle').textContent=won?'THE STREET IS YOURS.':winner?winner.hero.name+' TAKES IT.':'NOBODY SURVIVED.';$('resultReason').textContent=winner?(reason==='finish'?`${winner.hero.name} crossed the finish line first after two laps in ${this.formatTime(this.raceTime)}.`:`${winner.hero.name} is the last scooter running after ${this.formatTime(this.raceTime)}.`):'All remaining scooters were wrecked in the same moment. Run it back.';
  $('resultHits').textContent=this.player.hits;$('resultHeat').textContent=this.player.maxHeat;$('resultSpeed').textContent=Math.round(this.player.topSpeed);let order=this.riders.slice().sort((a,b)=>(b===winner)-(a===winner)||(b.hp>0)-(a.hp>0)||b.s-a.s);$('resultStandings').innerHTML=order.map((r,i)=>`<div class="result-line" style="--c:${r.hero.color}"><span class="number">0${i+1}</span><img src="${ASSETS.heads[r.id]}" alt=""><b>${r.hero.name}${r===this.player?' · YOU':''}</b><span>${r.hp<=0?'WRECKED':Math.ceil(r.hp)+' HP'} · ${r.itemHits} ITEM HITS</span></div>`).join('');
  if(won&&reason==='finish'){let old=safeGet('volt-roast-best',0);if(!old||this.raceTime<old)safeSet('volt-roast-best',this.raceTime);}
 }
 frame(clock){let raw=Math.min(.10,Math.max(0,(clock-this.lastClock)/1000));this.lastClock=clock;this.frameCount++;if(clock-this.lastFpsTime>=900){this.fps=this.frameCount*1000/(clock-this.lastFpsTime);this.frameCount=0;this.lastFpsTime=clock;if(this.settings.quality==='auto'&&this.fps<38&&this.R.pixelRatio>.70){this.R.resize(innerWidth,innerHeight,Math.max(.70,this.R.pixelRatio-.15));}}
  this.acc+=raw;let n=0;while(this.acc>=1/60&&n++<6){this.update(1/60);this.acc-=1/60;}this.render(Math.max(1/240,raw),clamp(this.acc*60,0,1));requestAnimationFrame(t=>this.frame(t));
 }
 snapshot(){return{state:this.state,mode:this.mode,time:+this.raceTime.toFixed(2),trackLength:Math.round(this.track.length),fps:Math.round(this.fps),triangles:this.R?.tris,draws:this.R?.draws,winner:this.winner,riders:this.riders.map(r=>({id:r.id,name:r.hero.name,s:+r.s.toFixed(2),lane:+r.lane.toFixed(2),hp:+r.hp.toFixed(2),hits:r.hits,heat:heatFor(r.hits),inventory:{...r.inventory},itemHits:r.itemHits,skidUntil:r.skidUntil,punctureUntil:r.punctureUntil})),traps:this.traps.map(t=>({type:t.type,s:t.s,lane:t.lane,landed:t.landed,owner:t.owner})),bullets:this.bullets.length,voicesDecoded:Object.keys(this.audio.buffers).length};}
}
const app=new ScooterGame();window.voltRoast=app;app.init();
