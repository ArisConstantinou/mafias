/* The original city circuit, scooter models and props. */
class CityTrack{
 constructor(){this.control=[[0,110],[86,110],[136,66],[136,-68],[85,-117],[-73,-117],[-136,-67],[-136,60],[-85,110]];let raw=[],cum=[0];for(let i=0;i<=2500;i++){raw.push(this.catmull(i/2500));if(i)cum.push(cum.at(-1)+V3.len(V3.sub(raw[i],raw[i-1])));}this.length=cum.at(-1);this.samples=[];let j=0;for(let i=0;i<=2048;i++){let d=i/2048*this.length;while(j<cum.length-2&&cum[j+1]<d)j++;this.samples.push(V3.mix(raw[j],raw[j+1],(d-cum[j])/(cum[j+1]-cum[j]||1)));}}
 catmull(t){let n=this.control.length,u=t*n,i=Math.floor(u),f=u-i,p0=this.control[wrap(i-1,n)],p1=this.control[wrap(i,n)],p2=this.control[wrap(i+1,n)],p3=this.control[wrap(i+2,n)],out=[];for(let a=0;a<2;a++)out.push(.5*((2*p1[a])+(-p0[a]+p2[a])*f+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*f*f+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*f*f*f));return[out[0],0,out[1]];}
 point(s){let q=wrap(s,this.length)/this.length*2048,i=Math.floor(q);return V3.mix(this.samples[i],this.samples[i+1],q-i);}
 frame(s,lane=0){let p=this.point(s),t=V3.norm(V3.sub(this.point(s+.4),this.point(s-.4))),right=[-t[2],0,t[0]];return{p:V3.add(p,V3.mul(right,lane)),t,right,yaw:Math.atan2(-t[0],-t[2])};}
 delta(a,b){return wrap(a-b+this.length/2,this.length)-this.length/2;}
}
const PALETTE={yellow:'#ffe341',green:'#64efac',red:'#ff646f',blue:'#68c9ff',ink:'#1d2837',road:'#56636c'};
function makeSigns(R){
 const names=['NK ELECTRICAL','4 MAFIAS GARAGE','COFFEE / ΚΑΦΕΣ','ঢাকা বাজার','SCOOTER REPAIR','THE SHORT CIRCUIT','ফুচকা','OPEN LATE','MARKET DISTRICT','FINISH','CHARGE & GO','মিষ্টির দোকান','DANGER / ΚΙΝΔΥΝΟΣ','RACE. ROAST. REPEAT.','KEEP IT ELECTRIC','ROAST CLUB','NO BRAKES • BIG EGOS','CYCLE CITY','NEON NOODLES','FRIENDS / RIVALS','STREET CLASH','ELECTRIC AVENUE','LOW BATTERY','CITY ROASTERS','গরম চা','POWER DISTRICT','ΕΠΙΣΚΕΥΕΣ','SERVICE 24/7','THE LAST SCOOTER','ঘরে যাও','CHARGING STATION','NK CREW'];
 const colors=['#18394c','#ec7855','#205d64','#dbad59','#2a2f46','#834b54','#f2d989','#394e65'];
 return{names,texture:canvasTex(R,2048,1024,(c)=>{for(let i=0;i<32;i++){let x=i%8*256,y=Math.floor(i/8)*256;c.fillStyle=colors[i%8];c.fillRect(x,y,256,256);c.strokeStyle=i%3?'#eadfc0':'#77efbd';c.lineWidth=7;c.strokeRect(x+8,y+8,240,240);c.fillStyle='#fff4d9';c.textAlign='center';c.textBaseline='middle';let text=names[i],parts=text.length>18?text.split(' '):[text];let lines=parts.length>2?[parts.slice(0,Math.ceil(parts.length/2)).join(' '),parts.slice(Math.ceil(parts.length/2)).join(' ')]:parts;c.font='900 '+(text.length>16?61:69)+'px system-ui, "Noto Sans Bengali", sans-serif';if(lines.length===1)c.fillText(lines[0],x+128,y+128,225);else{c.fillText(lines[0],x+128,y+91,225);c.fillText(lines[1],x+128,y+163,225);}c.font='bold 11px system-ui';c.globalAlpha=.7;c.fillText(i===9?'RACE • ROAST • REPEAT':'ELECTRIC CITY  /  EST. 2026',x+128,y+213,223);c.globalAlpha=1;}})};
}
function signPlane(b,index,p,s,rot){let a=b.a.length;b.add('plane',p,s,rot,'#ffffff',.35);let col=index%8,row=Math.floor(index/8);for(let i=a;i<b.a.length;i+=12){b.a[i+9]=(col+b.a[i+9])/8;b.a[i+10]=1-(row+1-b.a[i+10])/4;}}
function makeWheel(){let b=new MeshBuilder();b.add('torus',[0,0,0],[.32,.32,.29],[0,Math.PI/2,0],'#111c28');b.add('cylinder',[0,0,0],[.263,.19,.263],[0,0,Math.PI/2],'#3b4856');b.add('cylinder',[0,0,0],[.16,.205,.16],[0,0,Math.PI/2],'#d3d8d1');for(let a=0;a<Math.PI*2;a+=Math.PI/5)b.rod([-.11,Math.cos(a)*.05,Math.sin(a)*.05],[-.11,Math.cos(a)*.24,Math.sin(a)*.24],.014,'#1c2e3c');return b;}
function makeScooter(color){let b=new MeshBuilder(),metal='#606d78',black='#162332',rubber='#222b36';
 // Twin-wheeled electric kick scooter with fenders, battery deck and a front stem.
 b.box([0,.43,.05],[.49,.17,1.38],black).box([0,.52,.02],[.44,.05,1.20],'#333f49');
 b.box([-.249,.435,.05],[.022,.10,1.24],color).box([.249,.435,.05],[.022,.10,1.24],color);
 for(let z=-.45;z<.61;z+=.1)b.box([0,.554,z],[.34,.008,.025],'#62707b');
 b.rod([0,.4,-.61],[0,.76,-.81],.075,metal).rod([0,.43,.61],[0,.39,.85],.065,metal);
 b.rod([-.16,.42,-.83],[-.16,.84,-.72],.034,color).rod([.16,.42,-.83],[.16,.84,-.72],.034,color);
 b.rod([0,.64,-.75],[0,1.93,-.61],.057,black).rod([0,.76,-.74],[0,1.45,-.67],.069,color);
 b.rod([-.50,1.93,-.61],[.50,1.93,-.61],.042,metal);
 b.rod([-.56,1.93,-.61],[-.34,1.93,-.61],.064,rubber).rod([.34,1.93,-.61],[.56,1.93,-.61],.064,rubber);
 b.box([0,1.91,-.65],[.21,.11,.16],black,[.3,0,0]);b.box([0,1.975,-.646],[.15,.008,.105],'#89e5b4',[.3,0,0],1);
 b.box([0,1.73,-.71],[.17,.105,.055],'#fff2b3',[0,0,0],1);
 b.box([0,.66,.84],[.38,.055,.37],black,[-.2,0,0]);b.box([0,.65,1.035],[.21,.07,.035],'#ff5857',[0,0,0],1);
 // Small side-mounted electric blasters (fictional, non-realistic projectiles).
 for(let side of[-1,1]){b.rod([side*.32,.73,-.35],[side*.32,.75,-.68],.063,black);b.ball([side*.32,.75,-.70],.063,color);}
 return b;
}
function makeRider(color,index){let b=new MeshBuilder(),jacket=index===3?'#354459':'#202b37',pants=index===1?'#596170':'#72736d',skin=['#825a41','#a47752','#986c4f','#92684c'][index];
 // Feet remain on the deck, knees soft, shoulders down, both hands on the grips.
 b.ball([0,1.49,.22],[.285,.25,.21],pants);
 let legs=[{hip:[-.17,1.52,.18],knee:[-.21,1.04,-.12],ankle:[-.17,.66,-.12]},{hip:[.17,1.52,.22],knee:[.23,1.03,.31],ankle:[.16,.65,.48]}];
 for(let l of legs){b.rod(l.hip,l.knee,.124,pants,.112);b.ball(l.knee,.111,pants);b.rod(l.knee,l.ankle,.10,pants,.08);b.ball(l.ankle,.083,pants);b.box([l.ankle[0],.595,l.ankle[2]-.055],[.22,.13,.36],'#202b36',[0,.02,0]);b.box([l.ankle[0],.55,l.ankle[2]-.055],[.23,.028,.37],'#d5d6cc');for(let z=0;z<3;z++)b.box([l.ankle[0],.67,l.ankle[2]-.10-z*.04],[.14,.013,.012],'#aeb6b6');}
 b.ball([0,1.88,.14],[.37,.49,.245],jacket);b.box([0,1.51,.15],[.54,.12,.38],'#17232e');
 // Collar, zip, shoulder panels and cuffs are part of the model, not floating props.
 b.rod([-.14,2.17,.1],[-.14,2.33,.075],.095,jacket);b.rod([.14,2.17,.1],[.14,2.33,.075],.095,jacket);
 b.rod([0,1.62,-.106],[0,2.22,-.096],.013,'#b3b6ae');b.box([0,2.12,-.124],[.044,.077,.019],'#dadfd2');
 b.rod([0,2.26,.10],[0,2.49,.065],.12,skin);
 for(let side of[-1,1]){let sh=[side*.29,2.18,.10],el=[side*.48,1.94,-.20],wr=[side*.45,1.96,-.55];b.ball(sh,.15,jacket);b.rod(sh,el,.13,jacket,.105);b.ball(el,.109,jacket);b.rod(el,wr,.097,jacket,.081);b.rod(V3.mix(el,wr,.84),wr,.087,'#131f2a');b.ball([side*.455,1.975,-.598],[.084,.070,.102],skin);
  // Four curled fingers plus the thumb, aligned around the handlebar rather than twisted inward.
  for(let f=0;f<4;f++)b.rod([side*(.405+f*.032),1.986,-.625],[side*(.405+f*.032),1.938,-.65],.017,skin);
  b.rod([side*.40,1.973,-.54],[side*.395,1.924,-.577],.025,skin);
  b.box([side*.266,2.245,.08],[.11,.025,.17],color,[0,0,-side*.2]);
 }
 b.box([-.16,2.02,-.12],[.13,.07,.02],color);return b;
}
function makeTree(){let b=new MeshBuilder();b.rod([0,0,0],[.1,4.8,0],.18,'#846343',.105);for(let i=0;i<4;i++){let a=i*2.1;b.rod([0,3.6,0],[Math.cos(a)*1.1,5,Math.sin(a)*1.1],.095,'#846343',.03);b.ball([Math.cos(a)*.78,4.95+(i%2)*.7,Math.sin(a)*.78],[1.28,1.12,1.2],['#548e68','#7aaa70','#94b677','#669b67'][i]);}b.ball([0,5.85,0],[1.15,1.12,1.1],'#91b67e');b.box([0,.18,0],[1.65,.35,1.65],'#c2bbac');b.box([0,.36,0],[1.37,.06,1.37],'#5e6f59');return b;}
function makeLamp(side){let b=new MeshBuilder();b.rod([0,.1,0],[0,6.3,0],.08,'#374e5a');b.rod([0,6.3,0],[-side*1.35,6.3,0],.065,'#374e5a');b.box([-side*1.4,6.3,0],[.74,.12,.3],'#283946');b.box([-side*1.4,6.225,0],[.66,.02,.23],'#fff0b5',[0,0,0],1);b.add('cylinder',[0,.3,0],[.17,.6,.17],[0,0,0],'#344652');return b;}
function obstacleModel(type){let b=new MeshBuilder();
 if(type==='cone'){b.box([0,.06,0],[.7,.12,.7],'#25313b');b.add('cone',[0,.52,0],[.26,.92,.26],[0,0,0],'#f18a46');b.add(cylinderGeo(12,.62),[0,.55,0],[.175,.17,.175],[0,0,0],'#fff0d4');}
 if(type==='barrier'){for(let x of[-1.15,1.15]){b.box([x,.08,0],[.38,.16,.65],'#33424b');b.box([x,.58,0],[.11,1.12,.1],'#64747a');}b.box([0,.84,0],[2.8,.58,.24],'#eee4c8');for(let x=-1.1;x<1.25;x+=.55)b.box([x,.84,-.131],[.32,.51,.02],'#e87e58',[0,0,-.22]);b.box([0,1.165,0],[2.9,.07,.30],'#353e43');}
 if(type==='crate'){b.box([0,.63,0],[1.2,1.2,1.2],'#ac8456');for(let x of[-.5,.5]){b.box([x,.63,-.62],[.1,1.26,.08],'#765838');b.box([x,.63,.62],[.1,1.26,.08],'#765838');}for(let y of[.12,.62,1.15]){b.box([0,y,-.62],[1.25,.09,.07],'#dfb782');b.box([0,y,.62],[1.25,.09,.07],'#dfb782');}b.box([0,.64,-.67],[1.38,.13,.055],'#dfb782',[0,0,.73]);}
 if(type==='barrel'){b.add('cylinder',[0,.61,0],[.45,1.2,.45],[0,0,0],'#488d96');for(let y of[.13,.62,1.09])b.add('cylinder',[0,y,0],[.47,.07,.47],[0,0,0],'#c3bfab');b.add('cylinder',[0,1.23,0],[.41,.018,.41],[0,0,0],'#455b65');}
 if(type==='van'){b.box([0,1.05,.2],[2.25,1.85,3.25],'#dbaa5f');b.box([0,1.15,-1.7],[2.20,1.64,1.18],'#eac482');b.box([0,1.61,-2.305],[1.86,.70,.02],'#466876');for(let x of[-1,1]){b.box([x*1.105,1.55,-1.75],[.018,.68,.69],'#557889');for(let z of[-1.63,1.26])b.add('cylinder',[x*1.10,.38,z],[.36,.18,.36],[0,0,Math.PI/2],'#1d2c37');b.box([x*.78,.77,-2.318],[.31,.19,.035],'#fff4c2',[0,0,0],.9);}b.box([0,.49,-2.34],[2.27,.2,.14],'#60717a');b.box([0,2.02,.4],[2.04,.08,2.9],'#c99b59');b.box([0,1.37,1.84],[1.9,.09,.018],'#857258');}
 if(type==='ramp'){let a=[-1.3,.02,1.85],c=[1.3,.02,1.85],d=[1.3,.95,-1.85],e=[-1.3,.95,-1.85];b.tri(a,c,d,'#8c7360',[0,.97,.25]);b.tri(a,d,e,'#8c7360',[0,.97,.25]);b.tri(a,e,[-1.3,.02,-1.85],'#514f47',[-1,0,0]);b.tri(c,[1.3,.02,-1.85],d,'#514f47',[1,0,0]);for(let z=-1.55;z<1.7;z+=.5)b.box([0,(1.85-z)/3.7*.93+.05,z],[2.42,.025,.06],'#d4c29b',[.245,0,0]);for(let side of[-1,1])b.rod([side*1.26,.12,1.85],[side*1.26,1.04,-1.85],.055,'#ffe17a');}
 if(type==='pothole'){b.add('cylinder',[0,.014,0],[1.23,.015,.91],[0,0,0],'#a0937e');b.add('cylinder',[0,.025,0],[1.04,.016,.70],[0,0,0],'#263d49');b.add('cylinder',[.12,.038,.06],[.69,.012,.46],[0,0,0],'#456878');for(let i=0;i<7;i++){let a=i*.94;b.ball([Math.cos(a)*1.05,.05,Math.sin(a)*.78],[.2,.08,.12],'#687174');}}
 return b;
}
class CityWorld{
 constructor(R,track){this.R=R;this.track=track;this.chunks=[];this.obstacles=[];this.pickups=[];this.signs=makeSigns(R);this.build();}
 build(){let R=this.R,track=this.track,L=track.length,rng=randSeed(931),span=38,n=Math.ceil(L/span);span=L/n;let tree=makeTree(),lampA=makeLamp(1),lampB=makeLamp(-1),props={};for(let t of['cone','barrier','crate','barrel','van','ramp','pothole'])props[t]=obstacleModel(t);
 this.roadTexture=canvasTex(R,256,256,c=>{c.fillStyle='#505b64';c.fillRect(0,0,256,256);let r=randSeed(713);for(let j=0;j<16000;j++){let a=r()*.1+.018;c.fillStyle=r()>.5?`rgba(238,233,211,${a})`:`rgba(4,23,36,${a})`;c.fillRect(r()*256,r()*256,1+r()*2,1+r()*2);}c.strokeStyle='rgba(13,30,40,.22)';c.lineWidth=.7;for(let i=0;i<6;i++){let x=r()*256,y=r()*256;c.beginPath();c.moveTo(x,y);for(let j=0;j<5;j++){x+=r()*20-10;y+=r()*22;c.lineTo(x,y);}c.stroke();}},true);
 for(let k=0;k<n;k++){
  let start=k*span,end=(k+1)*span,b=new MeshBuilder(),signs=new MeshBuilder(),road=new MeshBuilder(),shadow=new MeshBuilder();
  const at=(local,s,lane=0,extraRot=0)=>{let f=track.frame(s,lane);b.merge(local,M4.trs(f.p,[0,f.yaw+extraRot,0]));};
  // Continuous curved asphalt ribbon. UVs follow the course so there are no tile seams at corners.
  for(let s=start;s<end;s+=1.3){let e=Math.min(end,s+1.3),verts=[track.frame(s,-9).p,track.frame(s,9).p,track.frame(e,9).p,track.frame(e,-9).p];for(let ids of[[0,1,2],[0,2,3]])for(let id of ids){let p=verts[id];road.a.push(...[p[0],.006,p[2]],0,1,0,1,1,1,(id===0||id===3?0:3.6),(id<2?s:e)*.14,0);}}
  for(let s=start+1;s<end;s+=3){let f=track.frame(s);let m=M4.trs(f.p,[0,f.yaw,0]),p=new MeshBuilder();for(let side of[-1,1]){p.box([side*11.05,.14,0],[4.1,.28,3.2],'#c8bda6');p.box([side*9.13,.12,0],[.28,.26,3.2],Math.floor(s/3)%2?'#f2e6ca':'#d98f75');p.box([side*8.56,.021,0],[.09,.023,3.12],'#ebd695');for(let x of[10,11,12])p.box([side*x,.284,0],[.018,.008,3.13],'#b0aa99');}b.merge(p,m);}
  for(let s=Math.ceil(start/8)*8;s<end;s+=8){let f=track.frame(s),p=new MeshBuilder();for(let lane of[-4.5,0,4.5])p.box([lane,.02,0],[.085,.012,3.1],'#c5c6b6');b.merge(p,M4.trs(f.p,[0,f.yaw,0]));}
  for(let s=Math.ceil(start/180)*180;s<end;s+=180){let f=track.frame(s+8),p=new MeshBuilder();for(let x=-7.8;x<8;x+=1.15)p.box([x,.026,0],[.68,.016,3.1],'#dbddcc');b.merge(p,M4.trs(f.p,[0,f.yaw,0]));}
  for(let s=start+7;s<end;s+=13.5){for(let side of[-1,1]){
   let d=7+rng()*6,w=10.3+rng()*2.2,h=7+rng()*17,f=track.frame(s),local=new MeshBuilder(),front=13.65,cx=side*(front+d/2);let base=['#d7b17d','#9eb7aa','#e0c9a7','#bca697','#a2bfc3','#d9977c','#b6baa8'][Math.floor(rng()*7)];
   local.box([cx,h/2,0],[d,h,w],base).box([cx,h+.2,0],[d+.35,.4,w+.35],'#dfd3b7');local.box([cx,h+.47,0],[d-.8,.14,w-.8],'#7a8d8c');
   local.box([side*(front-.08),1.45,0],[.16,2.9,w],'#727c79');
   for(let z=-w/2+.9;z<w/2-.5;z+=2.5){local.box([side*(front-.20),1.36,z],[.10,2.38,1.88],'#385666');local.box([side*(front-.27),1.4,z-.6],[.035,2.26,.04],'#90aaa7');local.box([side*(front-.27),.47,z],[.035,.03,1.8],'#b3c1b3');}
   for(let y=4.65;y<h-1.0;y+=3.15){local.box([side*(front-.10),y-1.15,0],[.25,.16,w],'#e3d3b7');for(let z=-w/2+1.2;z<w/2-.6;z+=2.65){local.box([side*(front-.11),y,z],[.15,1.83,1.64],'#e5d9bb');local.box([side*(front-.20),y,z],[.08,1.5,1.36],rng()>.28?'#476672':'#dfc385');local.box([side*(front-.26),y+.43,z],[.045,.032,1.35],'#91a6a5');local.box([side*(front-.26),y,z],[.042,1.5,.032],'#96aaa3');
    if(y<11&&rng()>.55){local.box([side*(front-.48),y-.96,z],[.86,.13,2.0],'#b8b5a4');local.rod([side*(front-.85),y-.83,z-.92],[side*(front-.85),y-.24,z-.92],.025,'#3f5961');local.rod([side*(front-.85),y-.83,z+.92],[side*(front-.85),y-.24,z+.92],.025,'#3f5961');local.rod([side*(front-.85),y-.24,z-.92],[side*(front-.85),y-.24,z+.92],.025,'#3f5961');}
   }}
   // Side walls get windows too, preventing blank-box architecture at bends.
   for(let y=4.5;y<h-1;y+=3.4)for(let xx=-d/2+1.4;xx<d/2;xx+=2.8)for(let zz of[-1,1])local.box([cx+xx,y,zz*(w/2+.03)],[1.3,1.65,.06],'#53737a');
   // Striped shop awnings; AC units, roof water tanks and a sign specific to each shop.
   let awcol=['#d77560','#376b71','#c39a53'][Math.floor(rng()*3)];for(let z=-w/2+.3;z<w/2;z+=.65)local.box([side*(front-.77),2.78,z],[1.7,.11,.64],Math.floor(z*2)%2?'#e6dcc2':awcol,[0,0,side*.14]);
   local.box([side*(front-.35),3.6,w*.33],[.59,.48,.82],'#c1c8bb');for(let zz=0;zz<5;zz++)local.box([side*(front-.66),3.46+zz*.06,w*.33],[.028,.017,.63],'#677879');
   local.add('cylinder',[cx,h+1.05,0],[.73,1.12,.73],[0,0,0],'#53636c');local.box([cx,h+.69,w*.29],[1.4,.65,1.3],'#b3bbae');
   b.merge(local,M4.trs(f.p,[0,f.yaw,0]));let sign=new MeshBuilder();signPlane(sign,((v)=>v>=9?v+1:v)(Math.floor(rng()*31)),[side*(front-.9),3.62,-w*.12],[Math.min(5,w-.5),1.25,1],[0,-side*Math.PI/2,0]);signs.merge(sign,M4.trs(f.p,[0,f.yaw,0]));
   // Stylized ground shadows keep the street grounded without costly shadow-map passes.
   let sh=new MeshBuilder();sh.box([side*10.0,.015,1.0],[2.4,.004,w*.96],'#253f48');shadow.merge(sh,M4.trs(f.p,[0,f.yaw,0]));
  }}
  for(let s=Math.ceil(start/32)*32;s<end;s+=32){at(tree,s,11.7);at(lampB,s+9,-11.8);at(lampA,s+15,11.9);let bench=new MeshBuilder();for(let y of[.50,.67,.84])bench.box([0,y,0],[1.55,.09,.11],'#ae8259');for(let x of[-.56,.56])bench.rod([x,0,0],[x,.86,0],.032,'#445a62');at(bench,s+14,-11.25,Math.PI/2);}
  for(let s=Math.ceil(start/105)*105;s<end;s+=105){let f=track.frame(s),flags=new MeshBuilder();flags.rod([-9.5,7.6,0],[9.5,7.6,0],.013,'#3d5a61');for(let x=-8.7,i=0;x<9;x+=1.06,i++){let y=7.6-Math.sin((x+9.5)/19*Math.PI)*.43;flags.tri([x,y,0],[x+.62,y,0],[x+.31,y-.92,0],['#dc7357','#e8c65f','#81bcb0','#6a99b0'][i%4],[0,0,1]);}b.merge(flags,M4.trs(f.p,[0,f.yaw,0]));}
  for(let s=Math.ceil((start+1)/24)*24;s<end;s+=24){if(s<33||s>L-30)continue;let order=Math.floor(s/24),type=['cone','crate','barrier','ramp','pothole','barrel','van','cone'][order%8],lane=[-5.6,1.2,4.1,-3.2,3.0,-.8,5.8,-4.5][order%8];if(order%3===0)lane*= -1;let size={cone:[.5,.5,4],crate:[.95,.85,10],barrier:[1.66,.56,12],ramp:[1.43,1.7,0],pothole:[1.2,.8,5],barrel:[.72,.65,8],van:[1.45,2.5,17]}[type];let o={id:this.obstacles.length,s,lane,type,w:size[0],d:size[1],damage:size[2]};this.obstacles.push(o);at(props[type],s,lane);if(type==='barrier')for(let offset of[-2.2,2.2]){this.obstacles.push({id:this.obstacles.length,s:s+2,lane:clamp(lane+offset,-7,7),type:'cone',w:.5,d:.5,damage:4});at(props.cone,s+2,clamp(lane+offset,-7,7));}}
  this.chunks.push({center:track.frame((start+end)/2).p,mesh:R.mesh(b),signs:R.mesh(signs),road:R.mesh(road),shadow:R.mesh(shadow)});
 }
 let gate=new MeshBuilder(),gs=new MeshBuilder(),f=track.frame(0);for(let side of[-1,1]){gate.box([side*9.1,4.65,0],[.45,9.3,.58],'#314953');gate.box([side*9.1,4.55,.32],[.24,8.8,.03],PALETTE.yellow,[0,0,0],.8);}gate.box([0,8.7,0],[18.4,1.55,.5],'#1c3445');signPlane(gs,9,[0,8.69,.27],[6.6,1.45,1],[0,0,0]);signPlane(gs,9,[0,8.69,-.27],[6.6,1.45,1],[0,Math.PI,0]);for(let side of[-1,1])for(let x=0;x<6;x++)for(let y=0;y<3;y++)gate.box([side*(4.15+x*.65),8.22+y*.4,.263],[.65,.40,.014],(x+y)%2?'#eff0d4':'#29414b');for(let x=-8.5,i=0;x<9;x+=.7,i++)for(let z=0;z<2;z++)gate.box([x,.031,z*.7],[.7,.014,.7],(i+z)%2?'#e7e5cb':'#253f4b');let gm=M4.trs(f.p,[0,f.yaw,0]);this.gate=R.mesh(new MeshBuilder().merge(gate,gm));this.gateSigns=R.mesh(new MeshBuilder().merge(gs,gm));
 // A varied skyline beyond the playable streets.
 let skyline=new MeshBuilder(),sr=randSeed(541);for(let i=0;i<24;i++){let x=(sr()-.5)*125,z=(sr()-.5)*110,h=25+sr()*39,w=10+sr()*13,d=9+sr()*13;skyline.box([x,h/2,z],[w,h,d],['#9eb5b4','#b6b7a6','#acc4c3','#d3c2a2'][i%4]);skyline.box([x,h+.25,z],[w+.3,.5,d+.3],'#b9c7bc');for(let y=5;y<h-1;y+=3.2){skyline.box([x,y,z+d/2+.02],[w-.7,1.65,.05],'#729297');skyline.box([x+w/2+.02,y,z],[.05,1.65,d-.7],'#839f9e');}}
 this.skyline=R.mesh(skyline);
 for(let s=42,i=0;s<L;s+=48,i++)this.pickups.push({id:i,s,lane:[-3.3,5.6,.8,-5.6,3.8][i%5],type:i%3===1?'boost':'repair',ready:0});
 let pk=new MeshBuilder();pk.box([0,0,0],[.55,.75,.38],'#2b5755').box([0,.43,0],[.24,.10,.20],'#c5eace');pk.box([0,0,.20],[.12,.44,.027],'#bbf9c1',[0,0,0],1);pk.box([0,0,.205],[.37,.12,.025],'#bbf9c1',[0,0,0],1);this.repair=R.mesh(pk);
 let boost=new MeshBuilder();boost.box([0,0,0],[.45,.7,.32],'#2b5f75').box([0,.41,0],[.22,.11,.18],'#d2f5e1');boost.box([-.07,.09,.17],[.25,.12,.025],'#95eaff',[0,0,.8],1).box([.07,-.1,.17],[.25,.12,.025],'#95eaff',[0,0,.8],1);this.boost=R.mesh(boost);
 let disk=new MeshBuilder();disk.add('cylinder',[0,.02,0],[.8,.012,.8],[0,0,0],'#66cd9b',1);this.pickupDisk=R.mesh(disk);
 }
 draw(eye,time){let R=this.R;R.draw(this.skyline);for(let c of this.chunks){let v=V3.sub(c.center,eye),f=V3.norm([R.target[0]-eye[0],0,R.target[2]-eye[2]]),depth=V3.dot(v,f),side=Math.abs(v[0]*f[2]-v[2]*f[0]),cone=Math.tan(R.fov*Math.PI/360)*(R.w/R.h);if(V3.len(v)>158||depth < -34||side>Math.max(0,depth)*cone+36)continue;R.draw(c.road,M4.id(),{texture:this.roadTexture});R.draw(c.mesh);R.draw(c.signs,M4.id(),{texture:this.signs.texture});R.draw(c.shadow,M4.id(),{alpha:.15,depthWrite:false});}R.draw(this.gate);R.draw(this.gateSigns,M4.id(),{texture:this.signs.texture});for(let p of this.pickups){if(p.ready>time)continue;let f=this.track.frame(p.s,p.lane);if(V3.len(V3.sub(f.p,eye))>90)continue;R.draw(this.pickupDisk,M4.trs(f.p),{alpha:.22,unlit:true,depthWrite:false});f.p[1]=1.03+Math.sin(time*2.7+p.id)*.17;if(p.type!=='supply')R.draw(p.type==='boost'?this.boost:this.repair,M4.trs(f.p,[0,time*1.3,0]));}}
}
