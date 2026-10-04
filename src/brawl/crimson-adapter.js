/* Adapter for the recovered VOLT BRAWL custom WebGL renderer.
 * Does not modify engine.js, sim.js, scooter mode or any existing character.
 * Renderer must expose mesh(), texture(), draw(). Animation is already baked.
 * Unlike the PBR preview, the old engine uses its own simpler lighting shader.
 */

/* Brawl-only GPU rigid-skin path; Scooter keeps its original Renderer. */
Renderer.prototype.initSkinning=function(){
  if(this.skinProgram)return true;
  const gl=this.gl,max=gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)||128;
  this.maxSkinBones=Math.min(20,Math.floor((max-32)/4));
  if(this.maxSkinBones<8)return false;
  const vertex=VS.replace('attribute vec3 aPosition;',`attribute float aBone; uniform mat4 uBones[${this.maxSkinBones}]; attribute vec3 aPosition;`)
   .replace('vec4 p=uModel*vec4(aPosition,1.0);','mat4 bone=uBones[int(aBone)];vec4 p=uModel*bone*vec4(aPosition,1.0);')
   .replace('mat3(uModel)*aNormal','mat3(uModel)*mat3(bone)*aNormal');
  try{this.skinProgram=this.makeProgram(vertex,FS);}catch(e){this.skinError=String(e);return false;}
  this.skinAttr={};for(const n of['Position','Normal','Color','UV','Glow','Bone'])this.skinAttr[n]=gl.getAttribLocation(this.skinProgram,'a'+n);
  this.skinUniform={};for(const n of['Model','VP','Eye','Tex','UseTex','Alpha','Unlit','Tint','FogColor','Bones'])this.skinUniform[n]=gl.getUniformLocation(this.skinProgram,'u'+n);
  return true;
 };
Renderer.prototype.skinnedMesh=function(data){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data instanceof Float32Array?data:new Float32Array(data),gl.STATIC_DRAW);return{buffer:b,count:data.length/13};};
Renderer.prototype.drawSkinned=function(mesh,actor,palette,joints,opt={}){
  if(!mesh||!mesh.count)return;
  const gl=this.gl,u=this.skinUniform;
  gl.useProgram(this.skinProgram);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
  let off=0;for(const[n,size]of[['Position',3],['Normal',3],['Color',3],['UV',2],['Glow',1],['Bone',1]]){
   const a=this.skinAttr[n];gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,52,off*4);off+=size;
  }
  const bones=new Float32Array(joints.length*16);for(let i=0;i<joints.length;i++)bones.set(palette.subarray(joints[i]*16,joints[i]*16+16),i*16);
  gl.uniformMatrix4fv(u.Bones,false,bones);gl.uniformMatrix4fv(u.Model,false,actor);gl.uniformMatrix4fv(u.VP,false,this.vp);
  gl.uniform3fv(u.Eye,this.eye);gl.uniform3fv(u.FogColor,this.fog);gl.uniform1i(u.Tex,0);
  gl.uniform1f(u.UseTex,opt.texture?1:0);gl.uniform1f(u.Alpha,opt.alpha??1);gl.uniform1f(u.Unlit,opt.unlit?1:0);
  gl.uniform3fv(u.Tint,opt.tint||[1,1,1]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,opt.texture||this.white);
  if(opt.blend||opt.alpha<1)gl.enable(gl.BLEND);else gl.disable(gl.BLEND);
  gl.depthMask(opt.depthWrite!==false);gl.drawArrays(gl.TRIANGLES,0,mesh.count);gl.depthMask(true);
  this.draws++;this.tris+=mesh.count/3;
 };

class VoltBossAdapter {
 static async load(renderer,url,options={}) {return this.fromAsset(renderer,await GLBAsset.load(url),options);}
 static fromAsset(renderer,asset,{onEvent=()=>{}}={}){
  if(!renderer?.mesh||!renderer?.draw||!renderer?.texture)throw new TypeError('Expected the existing VOLT Renderer instance.');
  const result=new VoltBossAdapter();result.renderer=renderer;result.asset=asset;result.rig=new RigPlayer(asset);result.onEvent=onEvent;result.batches=[];result.textures=new Map();result.disposed=false;
  result.gpuSkin=renderer.initSkinning();
  // Count first, then fill typed GPU buffers directly. Expanded JavaScript
  // number arrays otherwise multiply the memory cost of the detailed v401 mesh.
  const grouped=new Map(),primitives=[];
  asset.json.meshes.forEach(mesh=>mesh.primitives.forEach(p=>{
   const a=p.attributes,indices=asset.accessor(p.indices),joints=asset.accessor(a.JOINTS_0),weights=asset.accessor(a.WEIGHTS_0);
   const mat=asset.json.materials[p.material],factor=mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
   const color=a.COLOR_0===undefined?null:asset.accessor(a.COLOR_0),description=color?asset.json.accessors[a.COLOR_0]:null;
   if(description&&!description.normalized&&description.componentType!==5126)throw Error('Unsupported unnormalized vertex color.');
   const info={material:p.material,mat,factor,indices,joints,pos:asset.accessor(a.POSITION),norm:asset.accessor(a.NORMAL),uv:asset.accessor(a.TEXCOORD_0),color,
    colorStride:description?.type==='VEC3'?3:4,colorScale:description?.componentType===5121?255:description?.componentType===5123?65535:1,
    glow:(mat.emissiveFactor||[0,0,0]).some(x=>x>0)||mat.extensions?.KHR_materials_unlit!==undefined?1:0};
   primitives.push(info);
   for(let n=0;n<indices.length;n+=3){const joint=joints[indices[n]*4],key=joint+':'+p.material;let batch=grouped.get(key);
    if(!batch){batch={joint,material:mat,count:0};grouped.set(key,batch);}
    for(let k=0;k<3;k++){const i=indices[n+k];if(joints[i*4]!==joint||Math.abs(weights[i*4]-1)>1e-5)throw Error('VOLT adapter expects rigid one-joint triangles.');}
    batch.count+=3;
   }
  }));
  const packed=[];
  for(const batch of grouped.values()){
   const tex=batch.material.pbrMetallicRoughness?.baseColorTexture?.index;
   if(tex!==undefined&&!result.textures.has(tex)){const source=asset.json.textures[tex].source;result.textures.set(tex,renderer.texture(asset.images[source]));}
   const texture=tex===undefined?null:result.textures.get(tex),face=batch.material.name==='Pilot / reference-projected face';
   let group=result.gpuSkin?packed.find(b=>b.material===batch.material&&b.joints.length<renderer.maxSkinBones):null;
   if(!group){group={material:batch.material,texture,face,joints:[],count:0,cursor:0,stride:result.gpuSkin?13:12};packed.push(group);}
   batch.localBone=group.joints.length;group.joints.push(batch.joint);group.count+=batch.count;batch.group=group;
  }
  for(const group of packed)group.data=new Float32Array(group.count*group.stride);
  for(const p of primitives){const {indices,joints,pos,norm,uv,factor,color,colorStride,colorScale,glow}=p;
   for(let n=0;n<indices.length;n+=3){const batch=grouped.get(joints[indices[n]*4]+':'+p.material),group=batch.group,data=group.data;
    for(let k=0;k<3;k++){const i=indices[n+k];let o=group.cursor;
     for(let c=0;c<3;c++)data[o++]=pos[i*3+c];
     for(let c=0;c<3;c++)data[o++]=norm[i*3+c];
     for(let c=0;c<3;c++){const linear=color?Math.max(0,Math.min(1,color[i*colorStride+c]*factor[c]/colorScale)):null;
      data[o++]=linear===null?factor[c]:linear<=.0031308?12.92*linear:1.055*Math.pow(linear,1/2.4)-.055;}
     data[o++]=uv[i*2];data[o++]=1-uv[i*2+1];data[o++]=glow;
     if(result.gpuSkin)data[o++]=batch.localBone;group.cursor=o;
    }
   }
  }
  for(const batch of packed)result.batches.push(result.gpuSkin
   ?{mesh:renderer.skinnedMesh(batch.data),joints:batch.joints,texture:batch.texture,face:batch.face}
   :{mesh:renderer.mesh(batch.data),joint:batch.joints[0],texture:batch.texture,face:batch.face});
  return result;
 }
 play(clip,{fade=.12,loop}={}){this.rig.setClip(clip,{fade,loop});this.rig.playing=true;return this;}
 update(dt){if(this.disposed)return;this.rig.update(dt);for(const event of this.rig.consumeEvents())this.onEvent(event,this);}
 draw(actorMatrix=Math3D.identity(),options={}){if(this.disposed)return;for(const batch of this.batches){
  if(this.gpuSkin)this.renderer.drawSkinned(batch.mesh,actorMatrix,this.rig.palette,batch.joints,{...options,texture:batch.texture,unlit:batch.face||options.unlit});
  else{const skin=this.rig.palette.subarray(batch.joint*16,batch.joint*16+16),model=Math3D.mul(actorMatrix,skin);this.renderer.draw(batch.mesh,model,{...options,texture:batch.texture,unlit:batch.face||options.unlit});}
 }}
 socket(name,actorMatrix=Math3D.identity()){return this.rig.socket(name,actorMatrix);}
 dispose(){if(this.disposed)return;this.disposed=true;const gl=this.renderer.gl;for(const b of this.batches)gl.deleteBuffer(b.mesh.buffer);for(const t of this.textures.values())gl.deleteTexture(t);this.batches=[];this.textures.clear();}
}
