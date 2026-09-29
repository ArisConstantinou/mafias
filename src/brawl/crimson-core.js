/* Minimal, offline glTF 2.0 rigid-skin loader and animation sampler.
 * This is not a universal glTF loader: the bundled asset uses one rigid influence.
 * The exported GLBs themselves remain standard glTF, usable in other engines. */
const Math3D={
 identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;},
 trs(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){const[x,y,z,w]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;return new Float32Array([(1-2*(yy+zz))*s[0],2*(xy+wz)*s[0],2*(xz-wy)*s[0],0,2*(xy-wz)*s[1],(1-2*(xx+zz))*s[1],2*(yz+wx)*s[1],0,2*(xz+wy)*s[2],2*(yz-wx)*s[2],(1-2*(xx+yy))*s[2],0,...t,1]);},
 point(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];},
 vector(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]];},
 norm(a){const l=Math.hypot(...a)||1;return a.map(v=>v/l);},cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];},sub(a,b){return a.map((v,i)=>v-b[i]);},dot(a,b){return a.reduce((s,v,i)=>s+v*b[i],0);},
 lookAt(eye,target){const z=this.norm(this.sub(eye,target)),x=this.norm(this.cross([0,1,0],z)),y=this.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-this.dot(x,eye),-this.dot(y,eye),-this.dot(z,eye),1]);},
 perspective(fov,aspect,n=.05,f=100){const d=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([d/aspect,0,0,0,0,d,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0]);},
 ortho(l,r,b,t,n,f){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);},
 slerp(a,b,t){let dot=this.dot(a,b),sgn=dot<0?-1:1;dot=Math.abs(dot);let u=1-t,v=t;if(dot<.9995){const angle=Math.acos(Math.min(1,dot)),s=Math.sin(angle);u=Math.sin((1-t)*angle)/s;v=Math.sin(t*angle)/s;}const q=a.map((x,i)=>x*u+b[i]*v*sgn),len=Math.hypot(...q)||1;return q.map(x=>x/len);}
};
class GLBAsset{
 static async load(url){const response=await fetch(url);if(!response.ok)throw new Error(`Αδυναμία φόρτωσης μοντέλου (${response.status}).`);return this.fromArrayBuffer(await response.arrayBuffer());}
 static async fromArrayBuffer(buffer){
  const d=new DataView(buffer);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2)throw new Error('Το αρχείο δεν είναι GLB 2.0.');
  let json=null,bin=null;for(let p=12;p<buffer.byteLength;){const n=d.getUint32(p,true),type=d.getUint32(p+4,true);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p+8,n)));if(type===0x004e4942)bin=new Uint8Array(buffer,p+8,n);p+=8+n;}
  if(!json||!bin)throw new Error('Λείπει το JSON ή το binary chunk του GLB.');const a=new GLBAsset(json,bin);await a.loadImages();return a;
 }
 constructor(json,bin){this.json=json;this.bin=bin;this.cache=new Map();this.nodes=json.nodes;this.parents=Array(this.nodes.length).fill(-1);this.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>this.parents[c]=i));this.byName=new Map(this.nodes.map((n,i)=>[n.name,i]));this.clips=json.animations.map(a=>({...a,tracks:a.channels.map(c=>{const s=a.samplers[c.sampler];return{node:c.target.node,path:c.target.path,times:this.accessor(s.input),values:this.accessor(s.output),interpolation:s.interpolation||'LINEAR'};})}));this.parts=json.extras.parts;this.stats=json.extras.stats;this.bounds=[[-1.55,0,-.8],[1.5,3.5,.8]];}
 accessor(index){if(this.cache.has(index))return this.cache.get(index);const a=this.json.accessors[index],b=this.json.bufferViews[a.bufferView],num={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array}[a.componentType];if(!C)throw Error('Unsupported accessor component type.');const offset=this.bin.byteOffset+(b.byteOffset||0)+(a.byteOffset||0);if(b.byteStride&&b.byteStride!==num*C.BYTES_PER_ELEMENT)throw Error('Interleaved external buffers are not supported in this delivery viewer.');const arr=new C(this.bin.buffer,offset,a.count*num);this.cache.set(index,arr);return arr;}
 async loadImages(){this.images=await Promise.all(this.json.images.map(async im=>{const b=this.json.bufferViews[im.bufferView],data=this.bin.slice(b.byteOffset||0,(b.byteOffset||0)+b.byteLength),url=URL.createObjectURL(new Blob([data],{type:im.mimeType}));try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Texture decode failed: '+im.name));image.src=url;});}finally{URL.revokeObjectURL(url);}}));}
}
class RigPlayer{
 constructor(asset){this.asset=asset;this.time=0;this.speed=1;this.playing=true;this.loop=true;this.eventQueue=[];this.clip=null;this.previous=null;this.fade=0;this.fadeDuration=.12;this.translations=asset.nodes.map(n=>[...(n.translation||[0,0,0])]);this.rotations=asset.nodes.map(n=>[...(n.rotation||[0,0,0,1])]);this.world=asset.nodes.map(()=>Math3D.identity());this.skin=asset.json.skins[0];this.inverse=asset.accessor(this.skin.inverseBindMatrices);this.palette=new Float32Array(this.skin.joints.length*16);this.setClip('Idle',{fade:0});}
 setClip(name,{fade=.12,loop}={}){const clip=this.asset.clips.find(c=>c.name===name);if(!clip)throw new Error('Unknown animation: '+name);this.previous=fade>0?{T:this.translations.map(x=>x.slice()),Q:this.rotations.map(x=>x.slice())}:null;if(this.previous&&this.poseBase)for(const p of this.poseBase){this.previous.T[p.index]=p.translation;this.previous.Q[p.index]=p.rotation;}this.fade=0;this.fadeDuration=fade;this.clip=clip;this.time=0;this.loop=loop??clip.extras?.loop??false;this.eventQueue=[];this.evaluate();return this;}
 seek(time){this.time=Math.max(0,Math.min(this.clip.extras.duration,time));this.previous=null;this.evaluate();return this;}
 update(dt){dt=Math.max(0,Math.min(.1,dt));if(this.playing){const d=this.clip.extras.duration,old=this.time;this.time+=dt*this.speed;this.fade+=dt;const ev=this.clip.extras.events||[];if(this.time>d&&this.loop){for(const e of ev)if(e.time>old)this.eventQueue.push({...e,clip:this.clip.name});this.time%=d;for(const e of ev)if(e.time<=this.time)this.eventQueue.push({...e,clip:this.clip.name});}else{this.time=Math.min(this.time,d);for(const e of ev)if(e.time>old&&e.time<=this.time)this.eventQueue.push({...e,clip:this.clip.name});}this.evaluate();}}
 consumeEvents(){const e=this.eventQueue;this.eventQueue=[];return e;}
 evaluate(){
  // Reset to bind transforms before evaluating a clip. No stale shoulder or finger pose.
  this.asset.nodes.forEach((n,i)=>{this.translations[i]=[...(n.translation||[0,0,0])];this.rotations[i]=[...(n.rotation||[0,0,0,1])];});
  for(const track of this.clip.tracks){const ts=track.times,vals=track.values,dim=track.path==='rotation'?4:3;let lo=0,hi=ts.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(ts[m]<=this.time)lo=m;else hi=m;}let u=Math.max(0,Math.min(1,(this.time-ts[lo])/(ts[hi]-ts[lo]||1)));if(track.interpolation==='STEP')u=0;const a=Array.from(vals.subarray(lo*dim,lo*dim+dim)),b=Array.from(vals.subarray(hi*dim,hi*dim+dim));if(track.path==='rotation')this.rotations[track.node]=Math3D.slerp(a,b,u);else if(track.path==='translation')this.translations[track.node]=a.map((x,i)=>x+(b[i]-x)*u);}
  if(this.previous){const u=Math.min(1,this.fade/(this.fadeDuration||1));for(let i=0;i<this.translations.length;i++){this.translations[i]=this.previous.T[i].map((v,k)=>v+(this.translations[i][k]-v)*u);this.rotations[i]=Math3D.slerp(this.previous.Q[i],this.rotations[i],u);}if(u>=1)this.previous=null;}
  if(this.poseModifier)this.poseModifier(this);
  const done=new Uint8Array(this.world.length);const visit=i=>{if(done[i])return;const p=this.asset.parents[i];if(p>=0)visit(p);const n=this.asset.nodes[i],local=n.matrix?new Float32Array(n.matrix):Math3D.trs(this.translations[i],this.rotations[i],n.scale);this.world[i]=p<0?local:Math3D.mul(this.world[p],local);done[i]=1;};
  this.asset.nodes.forEach((_,i)=>visit(i));this.skin.joints.forEach((node,i)=>this.palette.set(Math3D.mul(this.world[node],this.inverse.subarray(i*16,i*16+16)),i*16));
 }
 socket(name,actorMatrix=Math3D.identity()){const i=this.asset.byName.get(name);if(i===undefined)throw new Error('Missing socket: '+name);const m=Math3D.mul(actorMatrix,this.world[i]);return{matrix:m,position:Array.from(m.subarray(12,15)),forward:Math3D.norm([m[8],m[9],m[10]])};}
}
