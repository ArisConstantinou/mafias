
/* Same dependency-free WebGL renderer and portrait PNGs as 4 Mafias Scooter.
   New worksite environment and articulated fighters; scooter source is never loaded. */
'use strict';
const BRAWL_COLORS=['#f4dc45','#43d6b3','#ff6477','#59c8ff'];
class BrawlScene{
 constructor(canvas,assets){this.R=new Renderer(canvas);this.assets=assets;this.mesh={};this.texture={};this.heads=[];this.camera=null;this.center=[0,0];this.effects=[];this.pops=[];this.time=0;this.quality='auto';this.shake=0;this.reduced=false;this.random=randSeed(98121);this.build();}
 async load(){for(let i=1;i<=4;i++){let image=await this.loadImage(this.assets('head-'+i+'.png'));let stages=[];for(let stage=0;stage<5;stage++){let c=document.createElement('canvas');c.width=256;c.height=304;let x=c.getContext('2d');x.drawImage(image,0,0,256,304);if(stage){x.globalCompositeOperation='source-atop';let pts=[[[105,150],[166,150]],[[100,149],[166,149]],[[103,143],[165,143]],[[100,158],[160,158]]][i-1];for(let eye=0;eye<(stage>=2?2:1);eye++){let [ex,ey]=pts[eye];let g=x.createRadialGradient(ex,ey+6,4,ex,ey+6,31);g.addColorStop(0,'rgba(47,24,61,.62)');g.addColorStop(.5,'rgba(87,41,94,.55)');g.addColorStop(1,'rgba(122,77,66,0)');x.fillStyle=g;x.beginPath();x.ellipse(ex,ey+6,33,24,.12,0,Math.PI*2);x.fill();}if(stage>=3){x.fillStyle='rgba(156,113,73,.34)';x.beginPath();x.ellipse(52,195,21,12,-.6,0,7);x.ellipse(177,235,25,13,.5,0,7);x.fill();x.strokeStyle='rgba(125,64,53,.65)';x.lineWidth=3;x.beginPath();x.moveTo(193,178);x.lineTo(187,188);x.moveTo(202,181);x.lineTo(195,192);x.stroke();}if(stage>=4){x.fillStyle='rgba(89,73,85,.25)';x.fillRect(0,0,256,304);}x.globalCompositeOperation='source-over';}stages.push(this.R.texture(c));}this.heads.push(stages);}await this.loadBoss();return this;}
 loadImage(src){return new Promise((resolve,reject)=>{let i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Could not load character head. Keep assets/ beside index.html.'));i.src=src;});}
 async loadBoss(){
  this.bossRig=await (await fetch(this.assets('boss-scarat.rig.json'))).json();
  this.bossFace=this.R.texture(await this.loadImage(this.assets('boss-face.webp')));
  if(typeof DecompressionStream!=='function')throw Error('This browser cannot unpack the SCARAT mesh.');
  let packed=await (await fetch(this.assets('boss-scarat.mesh.gz'))).arrayBuffer();
  let raw=await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  let view=new DataView(raw),cursor=0;
  if(String.fromCharCode(...new Uint8Array(raw,0,4))!=='SCB1')throw Error('Invalid SCARAT mesh.');
  cursor=4;let groups=view.getUint16(cursor,true);cursor+=2;this.bossMeshes={};this.bossTriangles=0;
  for(let group=0;group<groups;group++){
   let length=view.getUint8(cursor++),name=new TextDecoder().decode(new Uint8Array(raw,cursor,length));cursor+=length;
   let count=view.getUint32(cursor,true);cursor+=4;let vertices=new Float32Array(count*12);
   for(let i=0;i<count;i++){
    let p=i*12;vertices[p]=view.getFloat32(cursor,true);vertices[p+1]=view.getFloat32(cursor+4,true);vertices[p+2]=view.getFloat32(cursor+8,true);cursor+=12;
    vertices[p+3]=view.getInt8(cursor++)/127;vertices[p+4]=view.getInt8(cursor++)/127;vertices[p+5]=view.getInt8(cursor++)/127;
    vertices[p+6]=view.getUint8(cursor++)/255;vertices[p+7]=view.getUint8(cursor++)/255;vertices[p+8]=view.getUint8(cursor++)/255;
    vertices[p+9]=0;vertices[p+10]=0;vertices[p+11]=view.getUint8(cursor++);
   }
   this.bossMeshes[name]=this.R.mesh(vertices);this.bossTriangles+=count/3;
  }
  if(cursor!==raw.byteLength)throw Error('SCARAT mesh length mismatch.');
 }
 tex(w,h,fn,repeat=false){return canvasTex(this.R,w,h,fn,repeat);}
 sign(text,sub='',bg='#153640',fg='#fff1cf',w=1024,h=256){return this.tex(w,h,(c)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle='#ffffff28';c.lineWidth=8;c.strokeRect(10,10,w-20,h-20);c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.font=`900 ${sub?h*.38:h*.55}px system-ui`;c.fillText(text,w/2,sub?h*.39:h*.50,w*.93);if(sub){c.fillStyle='#f0ddbe';c.font=`700 ${h*.115}px system-ui`;c.fillText(sub,w/2,h*.78,w*.91);}});}
 build(){let R=this.R,M=this.mesh,T=this.texture;
  M.plane=R.mesh(new MeshBuilder().add('plane'));M.box=R.mesh(new MeshBuilder().box([0,0,0],[1,1,1],'#ffffff'));M.ball=R.mesh(new MeshBuilder().ball([0,0,0],1,'#ffffff'));M.rod=R.mesh(new MeshBuilder().add('cylinder'));M.ring=R.mesh(new MeshBuilder().add('torus'));M.halo=R.mesh(new MeshBuilder().add(torusGeo(24,5,.032)));
  T.shadow=this.tex(128,128,c=>{let g=c.createRadialGradient(64,64,9,64,64,64);g.addColorStop(0,'rgba(20,30,30,.42)');g.addColorStop(.6,'rgba(20,30,30,.22)');g.addColorStop(1,'rgba(20,30,30,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
  T.concrete=this.tex(512,512,c=>{c.fillStyle='#c3b9a1';c.fillRect(0,0,512,512);let r=randSeed(884);for(let i=0;i<35000;i++){let v=110+r()*90;c.fillStyle=`rgba(${v},${v-5},${v-15},${.12+r()*.18})`;let x=r()*512,y=r()*512,s=r()*2.1+.4;c.fillRect(x,y,s,s);}c.strokeStyle='#948d7d';c.lineWidth=1;for(let i=0;i<=512;i+=128){c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.moveTo(0,i);c.lineTo(512,i);c.stroke();}for(let i=0;i<10;i++){let x=r()*512,y=r()*512;c.strokeStyle='#8d88794b';c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=(r()-.5)*25;y+=r()*17;c.lineTo(x,y);}c.stroke();}},true);
  T.nk=this.sign('NK ELECTRICAL','NICOSIA / CREW YARD / AFTER HOURS','#20353b','#f3d762');T.good=this.sign('GOOD TOOLS.','BETTER PEOPLE.','#e6d9bd','#24404b');T.work=this.sign('WORK HARD. PLAY ROUGH.','4 MAFIAS / AFTER-HOURS CLUB','#e7ba47','#1b343e');T.cafe=this.sign('KAFENEIO','COFFEE / FRIENDS / ONE MORE ROUND','#346a6d');T.logo=this.sign('NK','ELECTRICAL','#202c36','#ed6a57',256,256);T.cement=this.sign('CEMENT','25 KG / KEEP DRY','#c8b28a','#493f34',256,128);T.dust=this.makeDust();T.impact=this.makeImpact();T.decal=this.tex(512,512,c=>{c.clearRect(0,0,512,512);c.strokeStyle='#f6ecd063';c.lineWidth=6;c.beginPath();c.arc(256,256,214,0,7);c.stroke();c.setLineDash([18,12]);c.lineWidth=2;c.beginPath();c.arc(256,256,200,0,7);c.stroke();c.setLineDash([]);c.fillStyle='#f6ecd058';c.textAlign='center';c.font='900 italic 146px system-ui';c.fillText('NK',256,277);c.font='800 25px system-ui';c.fillText('AFTER HOURS',256,323);});
  M.ground=R.mesh(new MeshBuilder().add('plane',[0,-.020,0],[90,90,1],[-Math.PI/2,0,0],'#ffffff',0,[24,24]));
  let b=new MeshBuilder(),labels=[];this.labels=labels;
  const sign=(tex,p,s,rot=[0,0,0])=>labels.push({tex,p,s,rot});
  // Playable courtyard: open centre, visible boundaries, and four solid workstations.
  b.box([0,-.24,0],[26,.40,19],'#a79e8a');
  for(let side of[-1,1]){b.box([side*12.2,.33,0],[.38,.66,18],'#b9b09c');b.box([side*12.2,.72,0],[.53,.15,18.2],'#e1d4bb');for(let z=-8;z<=8;z+=2){b.box([side*11.9,.011,z],[.18,.016,.9],'#dfb640');b.box([side*11.63,.013,z],[.13,.017,.9],'#34424b');}}
  b.box([0,.36,-8.7],[24.7,.72,.36],'#c3b79c');b.box([0,.76,-8.7],[25,.15,.55],'#e5d8b9');
  for(let x=-11;x<12;x+=1.25){b.box([x,.006,7.85],[.55,.018,.20],'#e4bd46',[0,.6,0]);}
  // Mediterranean neighbours and shopfronts, modelled as complete facade assemblies.
  const house=(x,z,w,h,dep,col,balcony=true)=>{b.box([x,h/2,z],[w,h,dep],col);b.box([x,h+.1,z],[w+.35,.25,dep+.3],'#ddd1b8');b.box([x,h+.30,z-dep/2],[w,.38,.15],'#e9dcc2');let front=z+dep/2+.045;
   for(let y=1.65;y<h-1;y+=2.9)for(let xx=x-w/2+1;xx<x+w/2-.5;xx+=2.2){b.box([xx,y,front],[1.35,1.8,.15],'#e4dac4');b.box([xx,y,front+.09],[1.12,1.56,.10],'#304851');b.box([xx,y,front+.16],[.075,1.58,.06],'#a1b3af');b.box([xx,y,front+.16],[1.1,.06,.06],'#a1b3af');b.box([xx-.77,y,front+.10],[.25,1.85,.13],'#467477');b.box([xx+.77,y,front+.10],[.25,1.85,.13],'#467477');
    if(balcony&&y>3){b.box([xx,y-.85,front+.53],[1.8,.13,1.0],'#cfc9b9');for(let k=-.8;k<=.81;k+=.26)b.rod([xx+k,y-.78,front+1],[xx+k,y-.03,front+1],.025,'#3d5157');b.rod([xx-.86,y-.02,front+1],[xx+.86,y-.02,front+1],.035,'#3d5157');}}
   b.box([x,h+.72,z],[1.7,1.1,.9],'#edeae0');b.add('cylinder',[x+1.7,h+.55,z],[.44,1.1,.44],[0,0,Math.PI/2],'#e6ded0');b.box([x-1.5,h+.5,z],[1.1,.09,1.4],'#344f59',[.35,0,0]);};
  house(-7.8,-15.2,7,8.5,7,'#d8c19b');house(.7,-16.6,8.5,10.8,7,'#bd8670');house(9,-17.8,7.8,9.2,8,'#d3ccac');house(-17.1,-4.4,7,10.5,13,'#d1b991',false);
  for(let x=-10.5;x<-4.2;x+=1.9){b.box([x,1.55,-11.62],[1.6,2.8,.13],'#2f555b');b.box([x,1.5,-11.50],[.06,2.5,.03],'#c8cfb9');}
  sign(T.cafe,[-7.8,3.3,-11.5],[6.0,.72,1]);
  for(let j=0;j<12;j++){let x=-11.1+j*.56;b.box([x,2.85,-10.98],[.56,.08,1.28],j%2?'#dcc8a4':'#347b76',[.16,0,0]);}
  // Construction skeleton to the right, with brick infill, rebar and cross-braced scaffolding.
  for(let y=0;y<=9.5;y+=3.15){b.box([17,y,-1.8],[7,.25,16],'#aaa99b');for(let xx of[13.7,20.3])for(let zz=-9;zz<=5.5;zz+=4.8){b.box([xx,y+1.52,zz],[.40,2.85,.40],'#bfbca9');if(y>6)for(let k=0;k<3;k++)b.rod([xx+(k-1)*.10,y+2.7,zz],[xx+(k-1)*.1,y+3.8,zz],.018,'#6f5f48');}}
  for(let row=0;row<8;row++)for(let j=0;j<11;j++){let zz=-8+j*.80+(row%2)*.4;if(zz<-4.5||zz>-2.7)b.box([13.71,.33+row*.27,zz],[.20,.245,.76],row%3?'#be7859':'#d6946b');}
  for(let zz=-9;zz<7;zz+=2.5){b.rod([12.9,0,zz],[12.9,10.4,zz],.035,'#62706b');b.rod([12.2,0,zz],[12.2,10.4,zz],.032,'#778077');for(let yy=1.1;yy<10;yy+=2.6){b.rod([12.2,yy,zz],[12.2,yy,zz+2.5],.028,'#7c8373');b.rod([12.2,yy,zz],[12.2,yy+2.6,zz+2.5],.020,'#949682');b.box([12.6,yy-.3,zz+1.2],[1,.07,2.7],'#a79168');}}
  // Crane skyline, railings and believable peripheral equipment.
  for(let y=0;y<19;y+=1.8){b.rod([18,y,-15],[18,y+1.8,-15],.09,'#dbac43');b.rod([19,y,-15],[19,y+1.8,-15],.09,'#dbac43');b.rod([18,y,-15],[19,y+1.8,-15],.045,'#d0a13d');b.rod([19,y,-15],[18,y+1.8,-15],.045,'#d0a13d');}
  for(let x=0;x<23;x+=1.7){b.rod([x,18.4,-15],[x+1.7,18.4,-15],.08,'#c9a449');b.rod([x,19.35,-15],[x+1.7,19.35,-15],.075,'#d3b14a');b.rod([x,18.4,-15],[x+1.7,19.35,-15],.035,'#d3b14a');}b.rod([3.3,18.4,-15],[3.3,11,-15],.016,'#3b4445');b.add('torus',[3.3,10.7,-15],[.17,.24,.12],[0,0,0],'#53554b');
  // NK banner is on a board, not an untextured backdrop.
  b.box([0,2.25,-8.85],[7.5,2.25,.18],'#e4d1a8');sign(T.nk,[0,2.28,-8.72],[7.4,2.12,1]);for(let xx of[-3.2,3.2])b.rod([xx,0,-8.9],[xx,3.55,-8.9],.055,'#5f6760');sign(T.work,[-11.94,2.5,-3.5],[5.1,1.0,1],[0,Math.PI/2,0]);sign(T.good,[12.05,2.6,2.2],[3.6,1.4,1],[0,-Math.PI/2,0]);
  const pallet=(x,z)=>{for(let k=-2;k<=2;k++)b.box([x+k*.27,.12,z],[.22,.10,1.45],'#968467');for(let zz of[-.55,0,.55])b.box([x,.04,z+zz],[1.35,.12,.18],'#726752');};
  for(let stack=0;stack<3;stack++){let xx=-8.7+stack*.05,zz=-5.4;for(let j=0;j<6;j++){let x=xx+(j%2-.5)*.58,z=zz+(Math.floor(j/2)-1)*.45;b.add('sphere',[x,.38+stack*.28,z],[.34,.18,.29],[0,0,.02],'#c3af89');}if(stack===2)sign(T.cement,[-8.7,1.06,-4.68],[1.1,.30,1]);}pallet(-8.7,-5.3);
  for(let row=0;row<5;row++)for(let j=0;j<12;j++)b.box([8.9+(j%3-1)*.40,.25+row*.24,-4.8+(Math.floor(j/3)-1.5)*.30],[.37,.21,.27],j%4?'#c9805d':'#b5694f');pallet(8.9,-4.8);
  // Cable reels occupy the other two collision workstations.
  for(let [x,z]of[[-8.8,5.7],[9.1,5.4]]){b.add('cylinder',[x,.8,z],[.78,.20,.78],[Math.PI/2,0,0],'#c7ac78');b.add('cylinder',[x,.8,z-.85],[.78,.20,.78],[Math.PI/2,0,0],'#c7ac78');b.add('cylinder',[x,.8,z-.43],[.52,.7,.52],[Math.PI/2,0,0],'#354654');for(let a=0;a<7;a++){let yy=.8+Math.cos(a)*.63,xx=x+Math.sin(a)*.63;b.add('cylinder',[xx,yy,z+.11],[.025,.025,.025],[Math.PI/2,0,0],'#5a5f52');}}
  // Service van with body panels, windows, lamps, mirrors and four tyres.
  let van=new MeshBuilder();van.box([0,1.25,0],[2.1,1.9,4.6],'#e2e0d4');van.box([0,1.36,1.7],[2.15,1.52,1.6],'#eae7d9');van.box([0,1.88,2.38],[1.8,.80,.045],'#355966',[-.12,0,0]);van.box([0,.7,2.52],[2.13,.23,.15],'#3d4849');van.box([0,.98,2.48],[1.0,.3,.06],'#3b4140');for(let side of[-1,1]){van.box([side*.78,1.08,2.5],[.40,.30,.04],'#ede2ad');van.box([side*1.065,1.91,1.57],[.04,.65,1.10],'#375863');van.box([side*1.22,1.63,1.92],[.25,.22,.20],'#334850');van.box([side*1.071,1.2,.7],[.035,.09,.25],'#4d5a5b');for(let zz of[-1.42,1.4]){van.add('cylinder',[side*1.06,.53,zz],[.49,.22,.49],[0,0,Math.PI/2],'#253440');van.add('cylinder',[side*1.2,.53,zz],[.26,.23,.26],[0,0,Math.PI/2],'#929a94');}}b.merge(van,M4.trs([16,.03,9],[0,-.6,0]));
  // Street furniture, palms, bunting and construction debris outside the fight lane.
  for(let [x,z]of[[-11,-8],[10,-10],[-18,8],[5,-24]]){b.rod([x,0,z],[x+.25,7.3,z],.16,'#8b7655',.10);for(let j=0;j<9;j++){let a=j/9*Math.PI*2,p=[x+.25,7.3,z],q=[x+Math.sin(a)*2.4,6.7,z+Math.cos(a)*2.4];b.rod(p,q,.045,'#6e7951',.006);let r=[x+Math.sin(a+.24)*1.35,7.10,z+Math.cos(a+.24)*1.35];b.tri(p,q,r,j%2?'#667f57':'#8b995f',[0,1,0]);}}
  for(let j=0;j<19;j++){let x=-12+j*1.32,y=6.7-Math.sin(j/18*Math.PI)*1.2;b.rod([x,y,-7.7],[x+1.32,6.7-Math.sin((j+1)/18*Math.PI)*1.2,-7.7],.009,'#566459');b.tri([x,y,-7.7],[x+.65,y-.14,-7.7],[x+.33,y-.82,-7.7],['#c66f51','#d4bb65','#548884'][j%3],[0,0,1]);}
  for(let k=0;k<65;k++){let x=this.random()*24-12,z=this.random()*18-9;if(Math.abs(x)<7&&Math.abs(z)<6)continue;b.box([x,.04,z],[.08+this.random()*.23,.045,.11+this.random()*.17],k%2?'#be8a63':'#aaac9c',[0,this.random()*6,0]);}
  M.world=R.mesh(b);this.buildFighters();this.buildProps();this.buildLaserGun();
 }
 makeDust(){return this.tex(256,256,c=>{c.clearRect(0,0,256,256);let r=randSeed(36);for(let i=0;i<30;i++){let a=r()*Math.PI*2,dd=r()*67,x=128+Math.cos(a)*dd,y=128+Math.sin(a)*dd,rr=36+r()*27;let g=c.createRadialGradient(x-rr*.25,y-rr*.3,rr*.15,x,y,rr);g.addColorStop(0,'rgba(255,250,229,.9)');g.addColorStop(.60,'rgba(240,231,209,.83)');g.addColorStop(.87,'rgba(202,196,182,.35)');g.addColorStop(1,'rgba(218,213,197,0)');c.fillStyle=g;c.fillRect(x-rr,y-rr,rr*2,rr*2);}c.globalCompositeOperation='destination-in';let mask=c.createRadialGradient(128,128,88,128,128,124);mask.addColorStop(0,'rgba(255,255,255,1)');mask.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=mask;c.fillRect(0,0,256,256);c.globalCompositeOperation='source-over';});}
 makeImpact(){return this.tex(128,128,c=>{c.translate(64,64);c.fillStyle='#fbd455';c.strokeStyle='#273c42';c.lineWidth=4;c.beginPath();for(let i=0;i<20;i++){let a=i/20*Math.PI*2,r=i%2?24:59;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();});}
 buildFighters(){let R=this.R,M=this.mesh;M.fighters=[];
  for(let i=0;i<4;i++){let skin=['#a57754','#ac805e','#ad7958','#a37354'][i],jacket=['#24363e','#2b424b','#353b49','#304553'][i],pants=['#69736d','#777366','#656e7a','#63777d'][i],b=new MeshBuilder();
   b.ball([0,1.36,0],[.40,.56,.26],jacket);b.ball([0,1.62,0],[.51,.29,.27],jacket);b.box([0,.94,.015],[.64,.10,.46],'#283940');b.box([0,.945,.26],[.10,.07,.05],'#bdac6c');b.box([0,1.48,.25],[.018,.72,.016],'#4a5a5a');for(let s of[-1,1]){b.box([s*.28,1.26,.24],[.19,.18,.06],jacket);b.box([s*.27,1.37,.278],[.22,.018,.02],'#62716d');b.box([s*.42,1.68,.07],[.11,.14,.34],BRAWL_COLORS[i]);}b.add('cylinder',[0,1.94,0],[.13,.25,.13],[0,0,0],skin);let body=R.mesh(b);
   let upper=new MeshBuilder().add('sphere',[0,-.24,0],[.17,.29,.175],[0,0,0],jacket);upper.box([0,-.43,.016],[.30,.07,.29],'#4a5d60');let fore=new MeshBuilder().add('sphere',[0,-.22,0],[.125,.25,.13],[0,0,0],skin);fore.add('torus',[0,-.39,0],[.126,.126,.08],[Math.PI/2,0,0],i%2?'#26353a':'#645844');let fist=new MeshBuilder().ball([0,0,0],[.14,.155,.13],skin);for(let k=0;k<4;k++){fist.ball([-.09+k*.059,.085,.07],[.031,.064,.07],skin);fist.box([-.09+k*.059,.085,.129],[.017,.025,.004],'#866045');}fist.ball([.13,-.035,.06],[.055,.09,.055],skin);
   let thigh=new MeshBuilder().add('sphere',[0,-.26,0],[.215,.32,.24],[0,0,0],pants);thigh.box([.12,-.18,.05],[.21,.22,.26],pants);let shin=new MeshBuilder().add('sphere',[0,-.26,0],[.17,.29,.18],[0,0,0],pants);shin.ball([0,-.015,.12],[.175,.19,.11],'#35484f');shin.box([0,-.46,.01],[.30,.055,.32],'#9d997d');let shoe=new MeshBuilder().ball([0,.06,.12],[.205,.14,.34],'#374147');shoe.box([0,-.035,.11],[.37,.055,.55],'#202e36');for(let z=-.07;z<.19;z+=.09)shoe.box([0,.182,z],[.18,.014,.022],'#9e9c87');
   M.fighters.push({body,upper:R.mesh(upper),fore:R.mesh(fore),fist:R.mesh(fist),thigh:R.mesh(thigh),shin:R.mesh(shin),shoe:R.mesh(shoe),skin});
  }
  let crown=new MeshBuilder();crown.add('cylinder',[0,0,0],[.33,.18,.33],[0,0,0],'#eebf38');for(let i=0;i<6;i++){let a=i/6*Math.PI*2;crown.add('cone',[Math.sin(a)*.31,.21,Math.cos(a)*.31],[.12,.30,.10],[0,a,0],'#ffe26b');crown.ball([Math.sin(a)*.31,.38,Math.cos(a)*.31],.055,'#ffeda2');}M.crown=R.mesh(crown);
 }
 buildProps(){let R=this.R,M=this.mesh;M.props={};for(let type of Object.keys(BrawlSim.ITEMS)){let b=new MeshBuilder();
   if(type==='chair'){b.box([0,.55,0],[.66,.10,.64],'#dedbd0');b.box([0,.99,-.28],[.66,.85,.09],'#eae5d7');for(let x of[-.26,.26])for(let z of[-.26,.26])b.rod([x,.04,z],[x,.54,z],.035,'#b0b5ad');for(let x of[-.22,-.08,.08,.22])b.box([x,1.03,-.22],[.045,.51,.07],'#b7c0b5');}
   if(type==='toolbox'){b.box([0,.26,0],[.72,.48,.46],'#c14e3c');b.box([0,.51,0],[.77,.09,.50],'#de6750');b.box([0,.05,0],[.74,.06,.48],'#3a4546');for(let x of[-.25,.25])b.box([x,.35,.24],[.10,.17,.03],'#a5b1a8');b.rod([-.16,.54,0],[-.16,.7,0],.035,'#263c44');b.rod([.16,.54,0],[.16,.7,0],.035,'#263c44');b.rod([-.16,.7,0],[.16,.7,0],.035,'#263c44');}
   if(type==='bucket'){b.add('cylinder',[0,.27,0],[.27,.51,.27],[0,0,0],'#628b9b');b.add('torus',[0,.535,0],[.276,.276,.036],[Math.PI/2,0,0],'#c6c8b7');b.add('cylinder',[0,.54,0],[.232,.01,.232],[0,0,0],'#344f59');b.add('torus',[0,.63,0],[.28,.31,.020],[0,0,0],'#c1c5b6');}
   if(type==='shoe'){b.ball([0,.16,.07],[.22,.16,.42],'#44515a');b.box([0,.035,.07],[.39,.05,.64],'#222e35');for(let z=-.08;z<.19;z+=.08)b.box([0,.31,z],[.19,.012,.018],'#cdc5ac');}
   if(type==='box'){b.box([0,.34,0],[.72,.65,.67],'#a47b4e');for(let x of[-.29,.29])b.box([x,.34,.344],[.095,.67,.025],'#c69d64');for(let y of[.1,.32,.56])b.box([0,y,.34],[.7,.16,.025],'#bc945e');b.box([0,.35,.36],[.26,.12,.01],'#4a544a');}
   if(type==='banana'){for(let i=0;i<5;i++){let a=-1.1+i*.39;b.ball([Math.sin(a)*.30,.16+Math.cos(a)*.13,0],[.14,.08,.07],i%2?'#f5d75a':'#e5bf40');}b.rod([-.31,.23,0],[-.39,.32,0],.035,'#787746');}
   if(type==='ball'){b.ball([0,.30,0],.30,'#e9e5ce');for(let i=0;i<8;i++){let a=i*Math.PI/4;b.ball([Math.sin(a)*.275,.3+Math.cos(a)*.275,0],[.095,.10,.12],'#334e5d');}}
   if(type==='bottle'){b.add('cylinder',[0,.24,0],[.115,.42,.115],[0,0,0],'#71b8cf');b.add('cylinder',[0,.49,0],[.057,.13,.057],[0,0,0],'#8bc9d4');b.add('cylinder',[0,.57,0],[.066,.055,.066],[0,0,0],'#376f91');b.add('cylinder',[0,.25,0],[.119,.15,.119],[0,0,0],'#e3e1c8');}
   if(type==='cone'){b.box([0,.055,0],[.63,.10,.63],'#34444b');b.add('cone',[0,.46,0],[.255,.85,.255],[0,0,0],'#e78c44');b.add(cylinderGeo(12,.65),[0,.42,0],[.16,.13,.16],[0,0,0],'#eae4d0');}
   if(type==='mop'){b.rod([0,.14,0],[0,1.7,0],.036,'#b89967');b.box([0,.10,0],[.67,.12,.21],'#427e8b');for(let i=-4;i<=4;i++)b.rod([i*.068,.08,-.05],[i*.075,0,.11],.025,'#d9cfab');}M.props[type]=R.mesh(b);
  }
 }
 buildLaserGun(){
  let b=new MeshBuilder();
  // Layered carbine shell, recessed rail, cooling slots and exposed emitter.
  b.box([0,0,.24],[.27,.25,.62],'#334958');
  b.box([0,.10,.18],[.30,.08,.54],'#5b7074');
  b.box([0,-.08,-.07],[.22,.13,.32],'#24323c');
  b.box([0,-.24,-.13],[.12,.30,.16],'#26343b',[.18,0,0]);
  b.box([0,.19,.24],[.08,.11,.34],'#c9af62');
  b.box([0,.145,-.25],[.25,.07,.28],'#8d9b8e');
  for(let side of [-1,1]){
   b.box([side*.15,.015,.16],[.025,.18,.42],'#e1cc7a');
   for(let j=0;j<4;j++)b.box([side*.167,.02,.025+j*.092],[.016,.085,.041],'#202d35');
   b.box([side*.09,-.16,-.18],[.033,.21,.075],'#65787b');
  }
  for(let j=0;j<3;j++)b.add('torus',[0,0,.39+j*.09],[.115,.115,.06],[0,0,0],j===1?'#73edff':'#30434e',j===1?1:0);
  b.add('cylinder',[0,0,.66],[.08,.24,.08],[Math.PI/2,0,0],'#25343c');
  b.add('torus',[0,0,.79],[.094,.094,.055],[0,0,0],'#6eeaff',1);
  b.add('cylinder',[0,0,.78],[.047,.03,.047],[Math.PI/2,0,0],'#0b2534');
  this.mesh.laserGun=this.R.mesh(b);
 }
 resize(w,h,quality='auto'){this.quality=quality;let d=devicePixelRatio||1,r=quality==='low'?.8:quality==='high'?Math.min(d,1.75):Math.min(d,1.2);this.R.resize(w,h,r);this.camera=null;}
 matrix(pos,rot=[0,0,0],scale=[1,1,1]){return M4.trs(pos,rot,scale);}
 drawPart(mesh,parent,p,r=[0,0,0],s=[1,1,1],opt={}){let m=M4.mul(parent,M4.trs(p,r,s));this.R.draw(mesh,m,opt);return m;}
  drawFighter(f,sim){let R=this.R,M=this.mesh,c=M.fighters[f.id],color=BRAWL_COLORS[f.id];let prone=['down','ko','groundGrabbed'].includes(f.state),getup=f.state==='getup',duck=f.state==='dodge',strike=BrawlSim.ATTACKS[f.state],p=strike?f.age/(strike.wind+strike.active+strike.recovery):0;
  let sway=f.state==='dizzy'?f.age*3.1+Math.sin(this.time*7+f.id)*.42:f.state==='spin'?f.age*12:0;
  let root=M4.trs([f.x,f.y,f.z],[0,f.yaw+sway,0]);let dim=f.ko?.56:1;
  this.shadow(f.x,f.z,1.55,f.ko?.15:.65);
  if(f.cloud)return;
  let bob=f.speed>.2?Math.abs(Math.sin(f.walk))*.075:Math.sin(this.time*3.4+f.id)*.022;
   let tilt=0,h=-.02+bob;if(prone){tilt=-Math.PI/2;h=.3;}else if(getup){let q=smooth(0,f.duration||.5,f.age);tilt=-Math.PI/2*(1-q);h=.3*(1-q);}else if(duck){tilt=.50;h=-.4;}else if(f.state==='hit'){tilt=-.22*Math.sin(f.age/.24*Math.PI);}else if(f.state==='dizzy'){tilt=Math.sin(this.time*6+f.id)*.24;h=Math.sin(this.time*9+f.id)*.07;}else if(f.state==='shoved'){tilt=-.38*Math.sin(Math.min(1,f.age/.48)*Math.PI);h=-.10;}else if(f.state==='push'){tilt=.16*Math.sin(Math.min(1,f.age/.42)*Math.PI);}else if(f.state==='heavy'){tilt=-.16*Math.sin(p*Math.PI*2);}else if(f.state==='grabbed'){tilt=-.13;h=.1;}
  root=M4.mul(root,M4.trs([0,h,0],[tilt,0,0]));let opts={tint:[dim,dim,dim]};R.draw(c.body,root,opts);this.drawPart(M.plane,root,[-.20,1.62,.274],[0,0,0],[.23,.23,1],{texture:this.texture.logo,unlit:true});
  // Hierarchical shoulders / elbows / wrists. No camera rotation is applied to hands.
  let walk=Math.sin(f.walk)*Math.min(1,f.speed/2.3),still=f.speed<.25;
  for(let side of[-1,1]){let shoulderX=-.36+walk*.22*side,elbowX=-1.20,shoulderZ=-side*.13,wrist=0;
   if(f.held!==null||f.state==='pickup'||f.state==='throw'){shoulderX=f.state==='throw'?-.6-Math.sin(Math.min(1,f.age/.30)*Math.PI)*1.3:-1.1;elbowX=-.72;shoulderZ=-side*.25;}
    if(f.state==='grabbing'||f.state==='groundGrabbing'||f.state==='grabbed'||f.state==='slam'){shoulderX=f.state==='groundGrabbing'?-1.65:-1.25;elbowX=-.48;shoulderZ=-side*.14;}
    if(f.state==='push'){shoulderX=-1.75;elbowX=-.24;shoulderZ=-side*.09;}
   if(f.state==='dizzy'){shoulderX=-.8+Math.sin(this.time*8+side)*.25;elbowX=-.35;shoulderZ=side*.58;}
   if(f.blocking){shoulderX=-1.25;elbowX=-1.45;shoulderZ=side*.18;}
   if(f.state==='spin'){shoulderX=-1.25;elbowX=-.35;shoulderZ=side*.55;}
   if(f.state==='counter'){shoulderX=-1.12;elbowX=-1.22;shoulderZ=side*.21;}
   if(strike&&!['kick','heavyKick'].includes(f.state)&&side===f.attackSide){let t=clamp((f.age-strike.wind*.45)/(strike.wind*.55+strike.active*.3),0,1),recover=smooth(strike.wind+strike.active,strike.wind+strike.active+strike.recovery,f.age);let reach=Math.sin(t*Math.PI/2)*(1-recover);shoulderX=lerp(.35,-1.63,reach);elbowX=lerp(-1.45,-.10,reach);shoulderZ=side*(f.state==='heavy'?-.35:-.05);wrist=-.3*reach;}
   if(prone){shoulderX=.3;elbowX=-.5;shoulderZ=-side*.5;}
   if(sim.boss&&!f.ko&&!getup){shoulderX=side===1?-1.32:-1.07;elbowX=side===1?-.60:-.95;shoulderZ=-side*.12;}
   let s=M4.mul(root,M4.trs([side*.46,1.72,0],[shoulderX,0,shoulderZ]));R.draw(c.upper,s,opts);let e=M4.mul(s,M4.trs([0,-.47,0],[elbowX,0,0]));R.draw(c.fore,e,opts);this.drawPart(c.fist,e,[0,-.49,0],[wrist,0,0],[1,1,1],opts);
   let hip=-walk*side*.65,knee=Math.max(0,walk*side)*.65+.08;if(f.leg>=30&&side===-1){hip*=.6;knee+=.20;}if(['kick','heavyKick'].includes(f.state)&&side===1){let a=BrawlSim.ATTACKS[f.state],reach=Math.sin(clamp(f.age/(a.wind+a.active),0,1)*Math.PI/2)*(1-smooth(a.wind+a.active,a.wind+a.active+a.recovery,f.age));hip=-reach*(f.state==='heavyKick'?1.95:1.50);knee=.10+Math.sin(f.age/a.wind*Math.PI)*.35*(1-reach);}if(duck){hip=-.7;knee=1.05;}if(prone){hip=-.1+side*.10;knee=.16;}
   let hm=M4.mul(root,M4.trs([side*.22,.97,0],[hip,0,-side*.04]));R.draw(c.thigh,hm,opts);let km=M4.mul(hm,M4.trs([0,-.48,0],[knee,0,0]));R.draw(c.shin,km,opts);this.drawPart(c.shoe,km,[0,-.47,.02],[0,0,0],[1,1,1],opts);
  }
  if(sim.boss&&!f.ko&&!getup)this.drawPart(M.laserGun,root,[.53,1.28,.64],[-.12,0,0],[1.35,1.35,1.35]);
  if(f.hp<=50){this.drawPart(M.box,root,[.25,1.28,.285],[0,0,.3],[.07,.14,.007],{tint:rgb('#97775a')});}
  let head=M4.point(root,[0,2.36,0]);this.drawHead(f,head,1.02,sim,prone?-.5:0);f.renderHead=head;
  if(this.renderState==='tutorial'&&f.dizzyUntil>sim.time&&!f.ko){for(let j=0;j<3;j++){let a=this.time*5+j*Math.PI*2/3,p=[head[0]+Math.sin(a)*.70,head[1]+.62+Math.sin(a*2)*.07,head[2]+Math.cos(a)*.24];R.draw(M.plane,R.billboard(p,[.42,.42,1]),{texture:this.texture.impact,unlit:true,blend:true,depthWrite:false});}}
  if(sim.crown.holder===f.id)R.draw(M.crown,M4.trs([head[0],head[1]+.77,head[2]],[0,this.time*.6,0]));
  if(f.inv>.3&&!f.ko){R.draw(M.ring,M4.trs([f.x,.04,f.z],[Math.PI/2,0,0],[.66,.66,.025]),{tint:rgb(color),alpha:.35+.25*Math.sin(this.time*18),unlit:true,blend:true,depthWrite:false});}
 }
 injuryStage(f){return f.ko?4:Math.max(f.head>=35?2:f.head>=18?1:0,f.hp<=25?3:0);}
 drawHead(f,p,size,sim,rot=0){let R=this.R,M=this.mesh,s=this.injuryStage(f),mat=R.billboard(p,[size*1.34,size*1.58,1]);if(rot)mat=M4.mul(mat,M4.trs([0,0,0],[0,0,rot]));R.draw(M.plane,mat,{texture:this.heads[f.id]?.[s],unlit:true,blend:true,tint:f.ko?[.68,.68,.68]:[1,1,1]});
  if(f.id===sim.selected){R.draw(M.halo,M4.mul(R.billboard(p),M4.trs([0,0,-.03],[0,0,0],[size*.70,size*.70,.018])),{tint:rgb(BRAWL_COLORS[f.id]),unlit:true,alpha:.9,blend:true,depthWrite:false});}
 }
 shadow(x,z,size,alpha=.55){this.R.draw(this.mesh.plane,M4.trs([x,.005,z],[Math.PI/2,0,0],[size,size,1]),{texture:this.texture.shadow,blend:true,unlit:true,alpha,depthWrite:false});}
 drawBeam(a,b,width,color,alpha=1){
  let y=V3.sub(b,a),length=V3.len(y);if(length<.001)return;
  y=V3.mul(y,1/length);
  let x=V3.norm(V3.cross(Math.abs(y[2])<.96?[0,0,1]:[1,0,0],y)),z=V3.cross(x,y),mid=V3.mix(a,b,.5);
  let matrix=new Float32Array([x[0]*width,x[1]*width,x[2]*width,0,
   y[0]*length,y[1]*length,y[2]*length,0,z[0]*width,z[1]*width,z[2]*width,0,...mid,1]);
  this.R.draw(this.mesh.rod,matrix,{tint:rgb(color),unlit:true,blend:true,alpha,depthWrite:false});
 }
 drawBoss(boss){
  if(!boss||!this.bossMeshes)return;
  let R=this.R,t=boss.age||0,landing=boss.phase==='arrival';
  let drop=landing?1-smooth(0,1.55,t):0,brace=landing?Math.sin(smooth(1.1,2.45,t)*Math.PI):0;
  let revival=boss.phase==='resurrect',defeated=boss.phase==='dead',laugh=boss.phase==='laugh';
  let collapse=revival?(t<.58?smooth(0,.58,t):1-smooth(1.45,3.15,t)):defeated?smooth(0,1.8,t):0;
  let hover=revival?Math.sin(smooth(1.0,3.3,t)*Math.PI)*(.65+boss.tier*.12):0;
  let rise=defeated?-.43*collapse:0;
  let attackAge=boss.attackAge||0,charge=boss.attack==='charge'?smooth(0,.95,attackAge):0;
  let recoil=boss.attack==='beam'?Math.sin(Math.min(1,attackAge/1.15)*Math.PI*3)*.10:0;
  let claw=boss.attack==='claw'?Math.sin(smooth(0,1.22,attackAge)*Math.PI)*.85:0;
  let yaw=boss.yaw??Math.PI,scale=boss.scale||.98,gait=boss.moving?1:0;
  let root=M4.trs([boss.x||0,(boss.y||0)+drop*8+hover+rise+Math.abs(Math.sin(boss.stride||0))*.045*gait,boss.z||0],
   [collapse*.27+recoil*.45,yaw,collapse*.66+(laugh?Math.sin(t*11)*.12:0)],[scale,scale,scale]);
  let pose={};
  for(let side of ['LEFT','RIGHT']){
   let sign=side==='LEFT'?-1:1;
   for(let station of ['FORE','HIND']){
    let fore=station==='FORE';
    let step=(boss.stride||0)+(fore===(side==='LEFT')?0:Math.PI),swing=Math.sin(step)*gait,lift=Math.max(0,Math.sin(step))*gait;
    pose[`SCARAT_${side}_${station}_HIP`]=[sign*(.08+brace*.35+drop*.45+collapse*.30)*(fore?1:-1)+swing*.31,0,sign*drop*.18];
    pose[`SCARAT_${side}_${station}_KNEE`]=[(fore?-1:1)*(brace*.42+drop*.48+collapse*.28)+lift*.39,0,0];
    pose[`SCARAT_${side}_${station}_ANKLE`]=[-(fore?-1:1)*(brace*.12+drop*.20)-lift*.16,0,0];
   }
   pose[`SCARAT_${side}_CLAW_SHOULDER`]=[-.08-brace*.22-drop*.50-collapse*.55+(side==='LEFT'?-claw*.8:charge*.28-recoil*.7)+(laugh?Math.sin(t*11+sign)*.3:0),0,sign*(.08+(side==='LEFT'?claw*.16:0))];
   pose[`SCARAT_${side}_CLAW_WRIST`]=[.07+brace*.14+collapse*.4+(side==='LEFT'?claw*.55:charge*.12+recoil*.9),0,0];
  }
  let jawOpen=boss.clawOpen??(.25+.07*Math.sin(this.time*2.3));
  pose.SCARAT_LEFT_CLAW_INNER_JAW=[0,jawOpen,0];
  pose.SCARAT_LEFT_CLAW_OUTER_JAW=[0,-jawOpen,0];
  pose.SCARAT_PRESSURE_SPINE=[brace*.08,0,0];
  pose.SCARAT_SENSOR_BROW=[collapse*.23+(boss.attack==='charge'?-.12:0),0,claw*.06];
  let matrices={};
  const matrix=name=>{
   if(matrices[name])return matrices[name];
   let joint=this.bossRig[name],parent=joint.parent?matrix(joint.parent):root;
   let p=joint.pivot,r=pose[name]||[0,0,0],magnify=name==='SCARAT_LEFT_CLAW_WRIST'?1.22:name==='SCARAT_RIGHT_CLAW_WRIST'?1.13:1;
   matrices[name]=M4.mul(M4.mul(parent,M4.trs(p,r,[magnify,magnify,magnify])),M4.trs(p.map(v=>-v)));
   return matrices[name];
  };
  this.shadow(boss.x||0,boss.z||0,6.8,.65);
  for(let name of Object.keys(this.bossMeshes))R.draw(this.bossMeshes[name],matrix(name),{tint:defeated?[.65,.66,.68]:[1,1,1]});
  // The supplied transparent portrait is the boss head. Follow the original
  // SCARAT sensor joint so every attack, fall and resurrection moves it with
  // the machine, while the camera-facing cutout stays readable in gameplay.
  let faceCenter=M4.point(matrix('SCARAT_SENSOR_BROW'),[0,3.05,-2.18]);
  R.draw(this.mesh.plane,R.billboard(faceCenter,[2.75,2.75,1]),
   {texture:this.bossFace,unlit:true,blend:true,depthWrite:false,
    tint:defeated?[.72,.76,.8]:[1,1,1]});
  this.bossMuzzle=M4.point(matrix('SCARAT_RIGHT_CLAW_WRIST'),[1,1.18,-3.81]);
  if(charge>0){let radius=.35+charge*.55;
   R.draw(this.mesh.ring,M4.trs(this.bossMuzzle,[Math.PI/2,0,0],[radius,radius,.045]),
    {tint:rgb('#ff8b31'),unlit:true,blend:true,alpha:charge*.85,depthWrite:false});}
  if(landing&&t>=1.45&&t<2.55){
   let q=smooth(1.45,2.55,t),radius=1+q*5;
   R.draw(this.mesh.ring,M4.trs([boss.x,.08,boss.z],[Math.PI/2,0,0],[radius,radius,.09]),{tint:rgb('#f6d597'),unlit:true,blend:true,alpha:(1-q)*.75,depthWrite:false});
   for(let i=0;i<7;i++){let a=i*6.283/7+this.time*.16,p=[boss.x+Math.cos(a)*(1.1+q*3.2),.7+Math.sin(a*2)*.18,boss.z+Math.sin(a)*(1.1+q*3.2)];
    R.draw(this.mesh.plane,R.billboard(p,[2.2+q,1.55+q*.6,1]),{texture:this.texture.dust,unlit:true,blend:true,alpha:(1-q)*.67,depthWrite:false});
   }
  }
  if(revival&&t>.65&&t<3.4){
   let q=smooth(.65,3.4,t),pulse=.5+.5*Math.sin(t*18),radius=2.4+q*2.7;
   R.draw(this.mesh.ring,M4.trs([boss.x,.09,boss.z],[Math.PI/2,0,0],[radius,radius,.09]),
    {tint:rgb('#75e9ff'),unlit:true,blend:true,alpha:(1-q)*(.35+pulse*.35),depthWrite:false});
   for(let i=0;i<4;i++){let a=t*2+i*1.57,p=[boss.x+Math.sin(a)*2.1,.8+q*1.4,boss.z+Math.cos(a)*2.1];
    this.drawBeam(p,[p[0]+Math.sin(a*2)*.45,p[1]+.8,p[2]+Math.cos(a*2)*.45],.025,'#a8f3ff',(1-q)*.75);
   }
  }
 }
 onEvent(e,sim){if(e.type==='hit'){this.shake=Math.max(this.shake,e.heavy?.12:.045);for(let j=0;j<(this.quality==='low'?5:10);j++)this.effects.push({kind:'chip',x:e.x,y:1.4,z:e.z,vx:(this.random()-.5)*5,vy:2+this.random()*3,vz:(this.random()-.5)*5,life:.40+this.random()*.3,max:.7,color:BRAWL_COLORS[e.id],size:.035+this.random()*.04});if(e.cloud){let angle=this.random()*Math.PI*2;this.pops.push({id:e.id,angle,life:.88,max:.88,rotate:(this.random()-.5)*.6});}this.effects.push({kind:'impact',x:e.x,y:1.8,z:e.z,life:.15,max:.15});}
   if(e.type==='autoPush'){this.shake=Math.max(this.shake,e.strong?.10:.055);this.effects.push({kind:'impact',x:e.x,y:1.35,z:e.z,life:.2,max:.2});}
  if(e.type==='bossLand'){this.shake=Math.max(this.shake,.40);this.effects.push({kind:'impact',x:e.x,y:.8,z:e.z,life:.45,max:.45});}
  if(e.type==='bossCollapse'||e.type==='bossFinalFall'){this.shake=Math.max(this.shake,.28);for(let i=0;i<18;i++)this.effects.push({kind:'chip',x:sim.boss.x,y:1.7,z:sim.boss.z,vx:(this.random()-.5)*7,vy:1+this.random()*6,vz:(this.random()-.5)*7,life:.6+this.random()*.5,max:1,color:i%2?'#e2b963':'#76eaff',size:.035+this.random()*.04});}
  if(e.type==='laserShot'){let f=sim.fighters[e.id],muzzle=M4.point(M4.trs([f.x,f.y,f.z],[0,f.yaw,0]),[.53,1.28,1.65]);this.effects.push({kind:'beam',a:muzzle,b:[e.toX,2.0,e.toZ+1.1],color:e.heavy?'#d4faff':'#6feaff',width:e.heavy?.085:.045,life:.22,max:.22});}
  if(e.type==='bossLaser')this.effects.push({kind:'beam',a:this.bossMuzzle||[e.x,1.7,e.z+1.8],b:[e.toX,1.35,e.toZ],color:'#ff9d43',width:.13,life:.31,max:.31});
  if(e.type==='ko'){let f=sim.fighters[e.id];if(sim.cloud.active)this.pops.push({id:e.id,angle:this.random()*Math.PI*2,life:1.15,max:1.15,rotate:.50});}
  if(e.type==='break')for(let i=0;i<15;i++)this.effects.push({kind:'chip',x:e.x,y:.7,z:e.z,vx:(this.random()-.5)*5,vy:2+this.random()*4,vz:(this.random()-.5)*5,life:1,max:1,color:'#bd9260',size:.08});
 }
 updateVisual(dt){this.time+=dt;this.shake*=Math.exp(-12*dt);for(let e of this.effects){e.life-=dt;if(e.kind==='chip'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt;e.vy-=12*dt;if(e.y<.04){e.y=.04;e.vy*=-.25;e.vx*=.8;e.vz*=.8;}}}this.effects=this.effects.filter(e=>e.life>0).slice(-100);for(let p of this.pops)p.life-=dt;this.pops=this.pops.filter(p=>p.life>0).slice(-6);}
 drawCloud(sim){let c=sim.cloud;if(!c.active&&c.fade<=0)return;let R=this.R,M=this.mesh,n=c.active?1:c.fade,t=this.time;
  this.shadow(c.x,c.z,6.7,.75*n);
  // Soft billboard volumes overlap around a fully 3D, lit, moving cloud core.
  let cloudparts=[];for(let i=0;i<(this.quality==='low'?8:13);i++){let a=i/13*Math.PI*2+t*.4,rr=c.r*(.55+.12*Math.sin(i*2.3)),p=[c.x+Math.sin(a)*rr,1.60+Math.sin(i*2.1+t*4)*.20,c.z+Math.cos(a)*rr*.67];cloudparts.push({p,size:2.05+Math.sin(i*1.9)*.3});}
  cloudparts.sort((a,b)=>V3.len(V3.sub(b.p,R.eye))-V3.len(V3.sub(a.p,R.eye)));for(let a of cloudparts)R.draw(M.plane,R.billboard(a.p,[a.size*1.55,a.size*1.15,1]),{texture:this.texture.dust,unlit:true,blend:true,alpha:.96*n,depthWrite:false});
  if(!c.active)return;
  for(let i=0;i<4;i++){let a=t*2.7+i*Math.PI/2,r=c.r+.13,p=[c.x+Math.sin(a)*r,1.15+Math.sin(t*3+i)*.45,c.z+Math.cos(a)*r*.65];let id=c.members[i%c.members.length],model=M.fighters[id];if(i%2)R.draw(model.shoe,M4.trs(p,[Math.sin(t*5+i),a,.6],[1.15,1.15,1.15]));else R.draw(model.fist,M4.trs(p,[a,a,Math.sin(t*5)],[1.65,1.65,1.65]));}
  let displayed=new Set();for(let p of this.pops){let f=sim.fighters[p.id];if(!f)continue;displayed.add(f.id);let progress=1-p.life/p.max,lift=Math.sin(progress*Math.PI),r=c.r*(.66+.27*lift),pos=[c.x+Math.sin(p.angle)*r,2.40+lift*.95,c.z+Math.cos(p.angle)*r*.58];this.drawHead(f,pos,1.04,sim,p.rotate*Math.sin(progress*Math.PI));f.renderHead=pos;}
  // Periodic peeks only alter rendering; they never add damage or select random victims.
  if(this.pops.length<2){let id=c.members[Math.floor(t*1.4)%c.members.length],f=sim.fighters[id],a=t*.63,peek=Math.sin((t*1.4%1)*Math.PI);if(f&&!displayed.has(id)){let pos=[c.x+Math.sin(a)*1.9,2.10+peek*.95,c.z+Math.cos(a)*1.1];this.drawHead(f,pos,.96,sim,Math.sin(t*4)*.15);f.renderHead=pos;}}
 }
  render(sim,dt,state='playing'){this.renderState=state;this.updateVisual(dt);let R=this.R,M=this.mesh,T=this.texture,player=sim.fighters[sim.selected],portrait=R.w/R.h<.9;let focus=sim.boss?[(sim.boss.x+player.x)*.5,(sim.boss.z+player.z)*.5]:sim.cloud.active&&player.cloud?[sim.cloud.x,sim.cloud.z]:[player.x,player.z];if(state==='menu')focus=[0,0];let sidePanel=state==='tutorial'&&!portrait;let tx=sidePanel?3.6:sim.boss?focus[0]:focus[0]*.46,tz=sim.boss?focus[1]:focus[1]*.36;let k=this.camera?1-Math.exp(-dt*4):1;this.center[0]+= (tx-this.center[0])*k;this.center[1]+=(tz-this.center[1])*k;
   let base=portrait?[0,14.8,17.8]:sidePanel?[0,8.2,10.8]:[0,10.5,14.5];if(sim.boss){let separation=Math.hypot(sim.boss.x-player.x,sim.boss.z-player.z),zoom=Math.min(1.3,1+Math.max(0,separation-(portrait?6:8))*.045);base=base.map(v=>v*zoom);}let target=[this.center[0],.3,this.center[1]-.7],eye=[this.center[0]+base[0],base[1],this.center[1]+base[2]];if(!this.reduced&&state==='playing'){eye[0]+=Math.sin(this.time*74)*this.shake;eye[1]+=Math.cos(this.time*65)*this.shake;}
  this.camera=eye;R.begin(eye,target,portrait?53:54);R.draw(M.ground,M4.id(),{texture:T.concrete});R.draw(M.world);for(let l of this.labels)R.draw(M.plane,M4.trs(l.p,l.rot,l.s),{texture:l.tex});R.draw(M.plane,M4.trs([0,.013,0],[-Math.PI/2,0,0],[9,9,1]),{texture:T.decal,blend:true,unlit:true,depthWrite:false});
  if(state!=='menu'){let col=BRAWL_COLORS[player.id];R.draw(M.ring,M4.trs([player.x,.027,player.z],[Math.PI/2,0,0],[.73,.73,.025]),{tint:rgb(col),unlit:true});let nearest=sim.nearestItem(player);if(nearest&&Math.hypot(nearest.x-player.x,nearest.z-player.z)<1.9&&player.held===null&&!player.ko)R.draw(M.ring,M4.trs([nearest.x,.055,nearest.z],[Math.PI/2,0,this.time],[.51,.51,.022]),{tint:rgb('#f5df88'),unlit:true});}
  // Props have their own physical positions and rotations, not emoji billboards.
  for(let o of sim.items){if(o.broken)continue;let scale=o.type==='mop'?.80:1;this.shadow(o.x,o.z,.8,.45);let rot=[o.flying?o.spin:0,o.flying?o.spin*.7:o.yaw,0];let p=[o.x,o.y,o.z];if(o.held!==null){let f=sim.fighters[o.held];p=[f.x+Math.sin(f.yaw)*.8,f.y+1.55,f.z+Math.cos(f.yaw)*.8];rot=[-.24,f.yaw,0];}R.draw(M.props[o.type],M4.trs(p,rot,[scale,scale,scale]));}
  if(sim.mode==='crown'&&sim.crown.holder===null){this.shadow(sim.crown.x,sim.crown.z,1,.6);R.draw(M.crown,M4.trs([sim.crown.x,.45+Math.sin(this.time*3)*.13,sim.crown.z],[0,this.time,0],[1.35,1.35,1.35]));}
  for(let f of sim.fighters)if(state!=='tutorial'||f.id<2){
   this.drawFighter(f,sim);
   if(sim.boss&&sim.boss.phase==='arrival'&&f.state==='getup')R.draw(M.ring,M4.trs([f.x,.05,f.z],[Math.PI/2,0,0],[.84,.84,.04]),{tint:rgb('#80ecff'),unlit:true,blend:true,alpha:.65,depthWrite:false});
  }
  if(state!=='tutorial')this.drawCloud(sim);
  if(sim.boss)this.drawBoss(sim.boss);
  if(sim.boss?.attack==='charge')for(let i=0;i<sim.boss.targetPoints.length;i++){
   let p=sim.boss.targetPoints[i],a=this.bossMuzzle||[sim.boss.x,1.65,sim.boss.z+1.8],b=[p.x,.5,p.z];
   this.drawBeam(a,b,.012,'#ff884c',.38+.24*Math.sin(this.time*19));
   R.draw(M.ring,M4.trs([p.x,.07,p.z],[Math.PI/2,0,0],[.78,.78,.04]),{tint:rgb('#ff9f58'),unlit:true,blend:true,alpha:.7,depthWrite:false});
  }
  for(let e of this.effects){
   if(e.kind==='chip')R.draw(M.box,M4.trs([e.x,e.y,e.z],[e.life*7,e.life*9,0],[e.size,e.size,e.size]),{tint:rgb(e.color),alpha:Math.min(1,e.life*3)});
   else if(e.kind==='beam')this.drawBeam(e.a,e.b,e.width,e.color,e.life/e.max);
   else R.draw(M.plane,R.billboard([e.x,e.y,e.z],[1.12,1.12,1]),{texture:T.impact,unlit:true,blend:true,depthWrite:false,alpha:e.life/e.max});
  }
 }
}
