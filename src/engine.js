/* VOLT / ROAST: a small, dependency-free WebGL renderer.
   All geometry, textures and audio are bundled; no remote requests or analytics. */
'use strict';
const V3={
 add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
 sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(...a), norm:a=>{let l=Math.hypot(...a)||1;return a.map(x=>x/l);},
 mix:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const wrap=(v,n)=>(v%n+n)%n;
const randSeed=(seed)=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const rgb=(hex)=>{if(Array.isArray(hex))return hex;let n=parseInt(hex.replace('#',''),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
const M4={
 id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
 mul:(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;},
 trs:(p=[0,0,0],r=[0,0,0],s=[1,1,1])=>{
  let[cx,sx,cy,sy,cz,sz]=[Math.cos(r[0]),Math.sin(r[0]),Math.cos(r[1]),Math.sin(r[1]),Math.cos(r[2]),Math.sin(r[2])];
  // Y * X * Z: yaw, pitch, lean. Column-major.
  return new Float32Array([(cy*cz+sy*sx*sz)*s[0],cx*sz*s[0],(-sy*cz+cy*sx*sz)*s[0],0,(-cy*sz+sy*sx*cz)*s[1],cx*cz*s[1],(sy*sz+cy*sx*cz)*s[1],0,sy*cx*s[2],-sx*s[2],cy*cx*s[2],0,...p,1]);
 },
 point:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],
 vector:(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2],m[1]*p[0]+m[5]*p[1]+m[9]*p[2],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]],
 perspective:(fov,aspect,near,far)=>{let f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);},
 lookAt:(eye,target)=>{let z=V3.norm(V3.sub(eye,target)),x=V3.norm(V3.cross([0,1,0],z)),y=V3.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V3.dot(x,eye),-V3.dot(y,eye),-V3.dot(z,eye),1]);}
};
const GEO={};
function triangle(out,a,b,c,na,nb,nc,ua=[0,0],ub=[1,0],uc=[1,1]){for(let[v,n,u]of[[a,na,ua],[b,nb,ub],[c,nc,uc]])out.push(...v,...n,...u);}
function quad(out,a,b,c,d,n){triangle(out,a,b,c,n,n,n,[0,0],[1,0],[1,1]);triangle(out,a,c,d,n,n,n,[0,0],[1,1],[0,1]);}
GEO.box=(()=>{let o=[],f=[
 [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[0,0,1]],
 [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[0,0,-1]],
 [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[1,0,0]],
 [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-1,0,0]],
 [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5],[0,1,0]],
 [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[0,-1,0]]
 ];for(let f1 of f)quad(o,...f1);return o;})();
GEO.plane=(()=>{let o=[];quad(o,[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0],[0,0,1]);return o;})();
function sphereGeo(n=10,m=7){let o=[];const v=(a,b)=>[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];for(let j=0;j<m;j++)for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,c=j/m*Math.PI,d=(j+1)/m*Math.PI;let v1=v(a,c),v2=v(a,d),v3=v(b,d),v4=v(b,c);triangle(o,v1,v2,v3,v1,v2,v3);triangle(o,v1,v3,v4,v1,v3,v4);}return o;}
function cylinderGeo(n=12,r2=1){let o=[];for(let i=0;i<n;i++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);let p=[ca,-.5,sa],q=[cb,-.5,sb],r=[cb*r2,.5,sb*r2],s=[ca*r2,.5,sa],na=V3.norm([ca,1-r2,sa]),nb=V3.norm([cb,1-r2,sb]);triangle(o,p,q,r,na,nb,nb);triangle(o,p,r,s,na,nb,na);triangle(o,[0,-.5,0],q,p,[0,-1,0],[0,-1,0],[0,-1,0]);if(r2>0)triangle(o,[0,.5,0],s,r,[0,1,0],[0,1,0],[0,1,0]);}return o;}
function torusGeo(n=18,m=6,tube=.15){let o=[],v=(a,b)=>[(1+tube*Math.cos(b))*Math.cos(a),(1+tube*Math.cos(b))*Math.sin(a),tube*Math.sin(b)],nn=(a,b)=>[Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a),Math.sin(b)];for(let i=0;i<n;i++)for(let j=0;j<m;j++){let a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,c=j/m*Math.PI*2,d=(j+1)/m*Math.PI*2;triangle(o,v(a,c),v(b,c),v(b,d),nn(a,c),nn(b,c),nn(b,d));triangle(o,v(a,c),v(b,d),v(a,d),nn(a,c),nn(b,d),nn(a,d));}return o;}
GEO.sphere=sphereGeo();GEO.cylinder=cylinderGeo();GEO.cone=cylinderGeo(12,0);GEO.torus=torusGeo();
class MeshBuilder{
 constructor(){this.a=[];}
 add(geo,pos=[0,0,0],scale=[1,1,1],rotation=[0,0,0],color='#ffffff',em=0,uvScale=[1,1]){
  let g=typeof geo==='string'?GEO[geo]:geo,m=M4.trs(pos,rotation,scale),r=M4.trs([0,0,0],rotation),col=rgb(color);
  for(let i=0;i<g.length;i+=8){let p=M4.point(m,g.slice(i,i+3)),n=V3.norm(M4.vector(r,[g[i+3]/scale[0],g[i+4]/scale[1],g[i+5]/scale[2]]));this.a.push(...p,...n,...col,g[i+6]*uvScale[0],g[i+7]*uvScale[1],em);}
  return this;
 }
 box(p,s,c,r=[0,0,0],em=0){return this.add('box',p,s,r,c,em);}
 ball(p,s,c){return this.add('sphere',p,typeof s==='number'?[s,s,s]:s,[0,0,0],c);}
 rod(a,b,r,c,r2=r){let dir=V3.sub(b,a),len=V3.len(dir),y=V3.norm(dir),x=V3.norm(V3.cross(Math.abs(y[2])<.95?[0,0,1]:[1,0,0],y)),z=V3.cross(x,y),mid=V3.mix(a,b,.5),g=r2===r?GEO.cylinder:cylinderGeo(10,r2/r),col=rgb(c);for(let i=0;i<g.length;i+=8){let p=V3.add(mid,V3.add(V3.mul(x,g[i]*r),V3.add(V3.mul(y,g[i+1]*len),V3.mul(z,g[i+2]*r)))),n=V3.norm(V3.add(V3.mul(x,g[i+3]),V3.add(V3.mul(y,g[i+4]),V3.mul(z,g[i+5]))));this.a.push(...p,...n,...col,g[i+6],g[i+7],0);}return this;}
 merge(other,m=M4.id()){for(let i=0;i<other.a.length;i+=12){let v=other.a.slice(i,i+12);this.a.push(...M4.point(m,v.slice(0,3)),...V3.norm(M4.vector(m,v.slice(3,6))),...v.slice(6));}return this;}
 tri(a,b,c,color='#ffffff',normal=[0,1,0],em=0){let col=rgb(color);for(let p of[a,b,c])this.a.push(...p,...normal,...col,0,0,em);return this;}
}
const VS=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; attribute vec2 aUV; attribute float aGlow;
uniform mat4 uModel; uniform mat4 uVP; uniform vec3 uEye;
varying vec3 vColor; varying vec2 vUV; varying float vFog; varying vec3 vNormal; varying float vGlow;
void main(){vec4 p=uModel*vec4(aPosition,1.0);gl_Position=uVP*p;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;vUV=aUV;vFog=length(p.xyz-uEye);vGlow=aGlow;}`;
const FS=`precision mediump float; varying vec3 vColor; varying vec2 vUV; varying float vFog; varying vec3 vNormal; varying float vGlow;
uniform sampler2D uTex; uniform float uUseTex; uniform float uAlpha; uniform float uUnlit; uniform vec3 uTint; uniform vec3 uFogColor;
void main(){vec4 tx=vec4(1.0);if(uUseTex>0.5)tx=texture2D(uTex,vUV);float alpha=tx.a*uAlpha;if(alpha<0.025)discard;
vec3 n=normalize(vNormal);float sun=max(0.0,dot(n,normalize(vec3(-0.5,0.83,0.35))));vec3 light=vec3(0.48,0.52,0.59)+vec3(0.61,0.51,0.39)*sun;light+=max(0.0,n.y)*0.09;
vec3 c=vColor*tx.rgb*uTint*mix(light,vec3(1.13),max(vGlow,uUnlit));float fog=smoothstep(70.0,210.0,vFog);c=mix(c,uFogColor,fog);gl_FragColor=vec4(c,alpha);}`;
class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});if(!this.gl)throw new Error('WebGL is unavailable. Open this game in a full browser with hardware acceleration enabled.');
  const gl=this.gl;this.program=this.makeProgram(VS,FS);this.attr={};for(let n of['Position','Normal','Color','UV','Glow'])this.attr[n]=gl.getAttribLocation(this.program,'a'+n);
  this.uniform={};for(let n of['Model','VP','Eye','Tex','UseTex','Alpha','Unlit','Tint','FogColor'])this.uniform[n]=gl.getUniformLocation(this.program,'u'+n);
  this.fog=[.84,.83,.76];this.eye=[0,5,10];this.target=[0,1,0];this.vp=M4.id();this.draws=0;this.tris=0;this.pixelRatio=1;this.white=this.texture(new Uint8Array([255,255,255,255]));
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.skyProgram=this.makeProgram(`attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.9999,1.0);}`,`precision mediump float;varying vec2 vP;uniform float uAspect;void main(){float t=clamp((vP.y+0.2)*0.9,0.0,1.0);vec3 c=mix(vec3(.91,.88,.77),vec3(.27,.62,.77),t);vec2 p=vec2((vP.x-.55)*uAspect,vP.y-.53);float d=length(p);c+=vec3(1.0,.75,.32)*.10*exp(-d*4.0);c=mix(c,vec3(1.,.98,.80),1.-smoothstep(.085,.093,d));gl_FragColor=vec4(c,1.0);}`);
  this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 }
 makeProgram(v,f){let gl=this.gl,p=gl.createProgram();for(let[type,src]of[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 mesh(builder){let gl=this.gl,a=builder instanceof MeshBuilder?builder.a:builder,b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);return{buffer:b,count:a.length/12};}
 texture(source,repeat=false){let gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);if(source instanceof Uint8Array)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,source);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,repeat?gl.REPEAT:gl.CLAMP_TO_EDGE);return t;}
 resize(w,h,ratio=1){this.pixelRatio=ratio;this.w=w;this.h=h;this.canvas.width=Math.floor(w*ratio);this.canvas.height=Math.floor(h*ratio);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.gl.viewport(0,0,this.canvas.width,this.canvas.height);}
 begin(eye,target,fov=65){let gl=this.gl;this.eye=eye;this.target=target;this.fov=fov;this.view=M4.lookAt(eye,target);this.vp=M4.mul(M4.perspective(fov*Math.PI/180,this.w/this.h,.12,270),this.view);this.draws=0;this.tris=0;gl.clearColor(...this.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(this.skyProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);let at=gl.getAttribLocation(this.skyProgram,'aP');for(let i=0;i<6;i++)gl.disableVertexAttribArray(i);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);gl.uniform1f(gl.getUniformLocation(this.skyProgram,'uAspect'),this.w/this.h);gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniform.VP,false,this.vp);gl.uniform3fv(this.uniform.Eye,eye);gl.uniform3fv(this.uniform.FogColor,this.fog);gl.uniform1i(this.uniform.Tex,0);
 }
 draw(mesh,m=M4.id(),opt={}){if(!mesh||mesh.count===0)return;let gl=this.gl;gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);let off=0;for(let[n,size]of[['Position',3],['Normal',3],['Color',3],['UV',2],['Glow',1]]){let a=this.attr[n];gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,48,off*4);off+=size;}gl.uniformMatrix4fv(this.uniform.Model,false,m);gl.uniform1f(this.uniform.UseTex,opt.texture?1:0);gl.uniform1f(this.uniform.Alpha,opt.alpha??1);gl.uniform1f(this.uniform.Unlit,opt.unlit?1:0);gl.uniform3fv(this.uniform.Tint,opt.tint||[1,1,1]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,opt.texture||this.white);if(opt.blend||opt.alpha<1)gl.enable(gl.BLEND);else gl.disable(gl.BLEND);gl.depthMask(opt.depthWrite!==false);gl.drawArrays(gl.TRIANGLES,0,mesh.count);gl.depthMask(true);this.draws++;this.tris+=mesh.count/3;}
 billboard(p,scale=[1,1,1]){let f=V3.norm(V3.sub(this.eye,p)),r=V3.norm(V3.cross([0,1,0],f)),u=V3.cross(f,r);return new Float32Array([...V3.mul(r,scale[0]),0,...V3.mul(u,scale[1]),0,...V3.mul(f,scale[2]),0,...p,1]);}
 project(p){let m=this.vp,x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];return{x:(x/w*.5+.5)*this.w,y:(-.5*y/w+.5)*this.h,visible:w>0&&z/w<1&&Math.abs(x/w)<1.3&&Math.abs(y/w)<1.3,depth:w};}
}
function canvasTex(renderer,w,h,draw,repeat=false){let c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return renderer.texture(c,repeat);}
