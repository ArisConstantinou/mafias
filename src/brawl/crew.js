/* Four-weight skeletal crew. The authored Blender source and standard glTF
 * use the same 52-joint rig. Geometry/material buffers are shared by all four
 * actors; only the pose palettes differ. Small palettes support WebGL1 phones. */
class CrewSkin {
 constructor(renderer,asset){
  this.R=renderer;this.asset=asset;this.batches=[];this.textures=new Map();
  const gl=renderer.gl;this.limit=Math.min(24,Math.floor((gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)-32)/4));
  if(this.limit<12)throw Error('This GPU does not support the crew skeleton.');
  const vertex=VS.replace('attribute vec3 aPosition;',`varying vec3 vWorld;attribute vec4 aJoints;attribute vec4 aWeights;uniform mat4 uBones[${this.limit}];attribute vec3 aPosition;`)
   .replace('vec4 p=uModel*vec4(aPosition,1.0);','mat4 bone=uBones[int(aJoints.x)]*aWeights.x+uBones[int(aJoints.y)]*aWeights.y+uBones[int(aJoints.z)]*aWeights.z+uBones[int(aJoints.w)]*aWeights.w;vec4 p=uModel*bone*vec4(aPosition,1.0);')
   .replace('mat3(uModel)*aNormal','mat3(uModel)*mat3(bone)*aNormal').replace('gl_Position=uVP*p;','gl_Position=uVP*p;vWorld=p.xyz;');
  const fragment=`precision mediump float;varying vec3 vWorld,vNormal,vColor;varying vec2 vUV;varying float vFog,vGlow;
  uniform sampler2D uTex;uniform float uUseTex,uAlpha,uUnlit,uMetal,uRough;uniform vec3 uTint,uFogColor;uniform highp vec3 uEye;
  void main(){vec4 tx=uUseTex>.5?texture2D(uTex,vUV):vec4(1.);vec3 base=vColor*pow(tx.rgb,vec3(2.2))*uTint;
   vec3 n=normalize(vNormal),v=normalize(uEye-vWorld),l=normalize(vec3(-.5,.83,.35)),h=normalize(v+l);
   float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
   float a=max(.05,uRough*uRough),a2=a*a,d=a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));
   float k=pow(uRough+1.,2.)/8.;float g=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
   vec3 f0=mix(vec3(.04),base,uMetal),f=f0+(1.-f0)*pow(1.-vh,5.);
   vec3 hemi=mix(vec3(.18,.16,.14),vec3(.42,.52,.65),n.y*.5+.5);
   vec3 color=base*(1.-uMetal*.65)*(hemi+vec3(1.15,1.02,.85)*nl)+d*g*f/max(.004,4.*nv)*1.5;
   color+=f0*pow(1.-nv,3.)*.18;color=mix(color,base*1.8,max(vGlow,uUnlit));
   color=pow(max(color,vec3(0.)),vec3(1./2.2));color=mix(color,uFogColor,smoothstep(70.,210.,vFog));gl_FragColor=vec4(color,tx.a*uAlpha);}`;
  this.program=renderer.makeProgram(vertex,fragment);this.attr={};this.uniform={};
  for(const n of ['Position','Normal','Color','UV','Glow','Joints','Weights'])this.attr[n]=gl.getAttribLocation(this.program,'a'+n);
  for(const n of ['Model','VP','Eye','Tex','UseTex','Alpha','Unlit','Tint','FogColor','Bones','Metal','Rough'])this.uniform[n]=gl.getUniformLocation(this.program,'u'+n);
  const groups=new Map();
  for(const mesh of asset.json.meshes)for(const p of mesh.primitives){
   const a=p.attributes,positions=asset.accessor(a.POSITION),normals=asset.accessor(a.NORMAL),uv=a.TEXCOORD_0===undefined?null:asset.accessor(a.TEXCOORD_0),joints=asset.accessor(a.JOINTS_0),weights=asset.accessor(a.WEIGHTS_0),indices=asset.accessor(p.indices),mat=asset.json.materials[p.material],factor=mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
   if(!groups.has(p.material))groups.set(p.material,[]);const list=groups.get(p.material);
   for(let i=0;i<indices.length;i+=3){
    const required=new Set();for(let c=0;c<3;c++)for(let w=0;w<4;w++)if(weights[indices[i+c]*4+w]>.00001)required.add(joints[indices[i+c]*4+w]);
    let group=list.find(g=>new Set([...g.joints,...required]).size<=this.limit);
    if(!group){group={joints:[],data:[],material:mat};list.push(group);}
    for(const j of required)if(!group.joints.includes(j))group.joints.push(j);
    for(let c=0;c<3;c++){const n=indices[i+c],js=[],ws=[];for(let w=0;w<4;w++){ws.push(weights[n*4+w]);js.push(Math.max(0,group.joints.indexOf(joints[n*4+w])));}
     group.data.push(...positions.subarray(n*3,n*3+3),...normals.subarray(n*3,n*3+3),...factor.slice(0,3),uv?.[n*2]||0,1-(uv?.[n*2+1]||0),mat.emissiveFactor?1:0,...js,...ws);
    }
   }
  }
  for(const list of groups.values())for(const g of list){
   const textureIndex=g.material.pbrMetallicRoughness?.baseColorTexture?.index;
   if(textureIndex!==undefined&&!this.textures.has(textureIndex)){
    const texture=renderer.texture(asset.images[asset.json.textures[textureIndex].source],true);gl.bindTexture(gl.TEXTURE_2D,texture);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);this.textures.set(textureIndex,texture);
   }
   g.texture=this.textures.get(textureIndex);g.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.data),gl.STATIC_DRAW);g.count=g.data.length/20;g.bones=new Float32Array(g.joints.length*16);delete g.data;this.batches.push(g);
  }
 }
 draw(rig,actor,id,dim=1){
  const R=this.R,gl=R.gl,u=this.uniform;gl.useProgram(this.program);
  gl.uniformMatrix4fv(u.Model,false,actor);gl.uniformMatrix4fv(u.VP,false,R.vp);gl.uniform3fv(u.Eye,R.eye);gl.uniform3fv(u.FogColor,R.fog);gl.uniform1i(u.Tex,0);gl.uniform1f(u.Alpha,1);gl.uniform1f(u.Unlit,0);gl.disable(gl.BLEND);
  for(const b of this.batches){
   gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);let offset=0;
   for(const [n,size] of [['Position',3],['Normal',3],['Color',3],['UV',2],['Glow',1],['Joints',4],['Weights',4]]){const a=this.attr[n];if(a>=0){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,80,offset*4);}offset+=size;}
   for(let i=0;i<b.joints.length;i++)b.bones.set(rig.palette.subarray(b.joints[i]*16,b.joints[i]*16+16),i*16);
   gl.uniformMatrix4fv(u.Bones,false,b.bones);gl.uniform1f(u.UseTex,b.texture?1:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,b.texture||R.white);
   const name=b.material.name;let tint=[1,1,1];
   gl.uniform1f(u.Metal,b.material.pbrMetallicRoughness?.metallicFactor??0);gl.uniform1f(u.Rough,b.material.pbrMetallicRoughness?.roughnessFactor??.8);
   if(name.includes('identity')){const team=rgb(BRAWL_COLORS[id]);tint=team.map((x,i)=>x/[.91,.64,.12][i]);}
   else if(name.includes('jacket'))tint=[[1.02,1.02,.90],[.88,1.12,1.02],[1.2,.86,.91],[.91,1.02,1.18]][id];
   gl.uniform3fv(u.Tint,tint.map(x=>x*dim));gl.drawArrays(gl.TRIANGLES,0,b.count);R.draws++;R.tris+=b.count/3;
  }
  // Attribute locations belong to each linked program. Disable the additional
  // arrays before drawing props with the old five-attribute renderer.
  for(const a of Object.values(this.attr))if(a>=0)gl.disableVertexAttribArray(a);
 }
}

class BrawlCrew {
 static async load(scene){
  const crew=new BrawlCrew(scene);for(const style of ['tactical','stylized']){
   const res=await fetch(scene.assets('crew-'+style+'.glb.gz'));if(!res.ok)throw Error('Could not load the new crew bodies.');
   const raw=await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
   const asset=await GLBAsset.fromArrayBuffer(raw);crew.styles[style]={skin:new CrewSkin(scene.R,asset),rigs:Array.from({length:4},()=>new RigPlayer(asset)),asset};
  }return crew;
 }
 constructor(scene){this.scene=scene;this.styles={};this.style='tactical';this.contacts={};this.shots={};this.grabRoots={};}
 setStyle(style){if(!this.styles[style])return;this.style=style;try{localStorage.setItem('brawl-crew-style',style);}catch{}}
 draw(f,sim){
  const S=this.scene,R=S.R,M=S.mesh,entry=this.styles[this.style],rig=entry.rigs[f.id],laser=sim.boss&&!f.ko&&!['getup','down','bossGrabbed','bossThrown','ko','groundGrabbed'].includes(f.state);
  if(f.cloud)return;const moving=f.speed>.2;let name='Idle',time=f.age||0;
  const actions={punch:'Punch',heavy:'Heavy',kick:'Kick',heavyKick:'HeavyKick',dodge:'Dodge',grabbing:'Grab',groundGrabbing:'Grab',slam:'Grab',spin:'Spin',pickup:'Pickup',throw:'Throw',hit:'Hit',shoved:'Hit',down:'Down',ko:'Down',groundGrabbed:'Down',getup:'GetUp',bossThrown:'Thrown',bossGrabbed:'Thrown',grabbed:'Thrown'};
  if(actions[f.state])name=actions[f.state];else if(f.blocking)name='Block';else if(moving){name=f.speed>3?'Run':'Walk';time=f.walk/Math.PI/2*(name==='Run'?.72:1.1);}
  if(f.held!==null&&f.held!==undefined&&!actions[f.state]){name='Grab';time=.7;}
  if(laser){name=moving?'LaserRun':'LaserIdle';time=moving?f.walk/Math.PI/2*.85:S.time;const fired=S.time-(this.shots[f.id]??-100);if(fired<.36&&!moving){name='LaserFire';time=fired;}}
  if(f.viewerAnimation){name=f.viewerAnimation;time=f.viewerTime;}
  else if(f.state==='bossGrabbed')time=0;
  if(rig.clip.name!==name)rig.setClip(name,{fade:S.renderState==='viewer'?0:.12});
  const duration=rig.clip.extras.duration;rig.time=rig.clip.extras.loop?time%duration:Math.min(time,duration);rig.fade+=S.visualDt||0;rig.evaluate();
  const dizzy=f.state==='dizzy',spin=f.state==='spin',yaw=f.yaw+(spin?f.age*12:dizzy?Math.sin(S.time*5)*.2:0);
  let floor=0;
  if(!['Down','GetUp','Thrown','Dodge'].includes(name)){
   floor=Infinity;
   for(const side of ['L','R']){const sign=side==='L'?1:-1,j=rig.skin.joints.indexOf(entry.asset.byName.get('Foot_'+side)),skin=rig.palette.subarray(j*16,j*16+16);
    for(const z of [-.081,.186]){const p=[sign*.170,.012,z];if(this.style==='stylized'){p[0]*=1.15;p[1]*=.91;p[2]*=1.13;}floor=Math.min(floor,M4.point(skin,p)[1]);}
   }
  }
  let actor=M4.trs([f.x,f.y-floor*1.6,f.z],[0,yaw,dizzy?Math.sin(S.time*8)*.11:0],[1.6,1.6,1.6]);
  if(f.state==='bossThrown'){const blend=smooth(0,.24,f.age);actor=M4.mul(actor,M4.trs([0,.35*blend,0],[(-.85+Math.sin(f.age*9)*.22)*blend,0,0]));}
  if(f.state==='bossGrabbed'&&S.bossGrabSocket){
   const shoulder=rig.socket('UpperArm_R',actor).position;
   for(let i=0;i<3;i++)actor[12+i]+=S.bossGrabSocket[i]-shoulder[i];
   this.grabRoots[f.id]=Array.from(actor.slice(12,15));
  }else if(f.state==='bossThrown'&&this.grabRoots[f.id]){
   const blend=smooth(0,.24,f.age),start=this.grabRoots[f.id];
   for(let i=0;i<3;i++)actor[12+i]=lerp(start[i],actor[12+i],blend);
   if(blend>=1)delete this.grabRoots[f.id];
  }else delete this.grabRoots[f.id];
  if(f.state==='bossGrabbed')f.renderGrabShoulder=rig.socket('UpperArm_R',actor).position;
  S.shadow(f.x,f.z,1.25,f.ko?.15:.6);entry.skin.draw(rig,actor,f.id,f.ko?.6:1);
  const hand=side=>{const socket=entry.asset.json.extras.sockets['palm'+side],matrix=rig.socket(socket.bone,actor).matrix;return M4.point(matrix,socket.position);};
  const right=hand('R'),left=hand('L');this.contacts[f.id]={right,left,clip:name,style:this.style};
  if(laser){
   // The pistol grip is fixed to the actual skinned palm. A world-up aim
   // constraint keeps the carbine level; recoil comes from the baked arm rig.
   const scale=.75,dimensions=this.style==='stylized'?[scale*1.15,scale*1.03,scale*1.13]:[scale,scale,scale],rotation=M4.trs([0,0,0],[0,yaw,0],dimensions),grip=[0,-.24,-.13],delta=M4.vector(rotation,grip);
   const gun=M4.trs(V3.sub(right,delta),[0,yaw,0],dimensions);R.draw(M.laserGun,gun);
   this.contacts[f.id].grip=M4.point(gun,grip);this.contacts[f.id].support=M4.point(gun,[0,-.24,.23]);
   this.contacts[f.id].muzzle=M4.point(gun,[0,0,.79]);this.contacts[f.id].gun=gun;
  }
  const headMatrix=rig.socket('Head',actor).matrix,head=M4.point(headMatrix,[0,.04,0]);
  S.drawHead(f,head,this.style==='stylized'?.43:.37,sim,['Down','Thrown'].includes(name)?-.3:0);f.renderHead=head;
  if(sim.crown?.holder===f.id)R.draw(M.crown,M4.trs([head[0],head[1]+.40,head[2]],[0,S.time*.6,0],[.65,.65,.65]));
  if(f.inv>.3&&!f.ko)R.draw(M.ring,M4.trs([f.x,.04,f.z],[Math.PI/2,0,0],[.66,.66,.025]),{tint:rgb(BRAWL_COLORS[f.id]),alpha:.35+.25*Math.sin(S.time*18),unlit:true,blend:true,depthWrite:false});
 }
}
