"""Author the Brawl crew from Blender Studio's CC0 anatomical mesh.

Run with Blender 5.1 --background --factory-startup --disable-autoexec
--python tools/build_crew_assets.py. The downloaded library stays in .qa-run.
The deliverable art/crew-characters.blend contains editable meshes, skin weights,
an armature and all in-place action clips. No embedded source scripts are run.
"""
import bpy, math, json, gzip, hashlib, random, sys, struct
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/'.qa-run/crew-source/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend'
ART=ROOT/'art';ART.mkdir(exist_ok=True)
OUT=ROOT/'.qa-run/crew-source';OUT.mkdir(exist_ok=True,parents=True)
STYLE='stylized' if '--stylized' in sys.argv else 'tactical'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
with bpy.data.libraries.load(str(LIB),link=False) as (src,dst):dst.objects=['GEO-body_male_realistic']
base=dst.objects[0];bpy.context.collection.objects.link(base);base.location=(0,0,0)
for mod in list(base.modifiers):base.modifiers.remove(mod)
base.name='SOURCE_CC0_anatomy';base.data.materials.clear()

def material(name,color,metal=0,rough=.65):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 m['surface_role']=name
 return m

cloth=material('Crew / woven work jacket',(.085,.135,.16),0,.86)
pants=material('Crew / ripstop cargo trousers',(.19,.23,.23),0,.9)
armor=material('Crew / padded ballistic textile',(.045,.064,.072),0,.74)
rubber=material('Crew / boot rubber and gloves',(.025,.033,.037),0,.84)
leather=material('Crew / boot leather',(.065,.082,.088),0,.55)
seam=material('Crew / sewn reinforced edges',(.30,.34,.31),0,.75)
metal=material('Crew / brushed hardware',(.36,.41,.42),.72,.3)
accent=material('Crew / identity panels',(.91,.64,.12),.12,.44)
skin=material('Crew / skin',(.38,.22,.14),0,.67)
glass=material('Crew / status light',(.025,.68,.82),.25,.24)
p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(.04,.7,.95,1);p.inputs['Emission Strength'].default_value=1.5

# One small repeating fabric map, packed in both the .blend and GLB.
random.seed(81);N=512
for m in (cloth,pants,armor):
 ns=m.node_tree.nodes;ls=m.node_tree.links;p=ns.get('Principled BSDF')
 img=bpy.data.images.new(m.name+' / fine weave',width=N,height=N);pixels=[]
 color=m.diffuse_color[:3]
 for y in range(N):
  for x in range(N):
   f=.94+(.023 if (x+y)%2 else -.023)+random.uniform(-.015,.015)
   pixels.extend((*[min(1,c*f)**(1/2.2) for c in color],1))
 img.pixels=pixels;img.pack()
 tex=ns.new('ShaderNodeTexImage');tex.image=img;tex.extension='REPEAT'
 ls.new(tex.outputs['Color'],p.inputs['Base Color'])

# Anatomical joints are fitted to the licensed base. Source points use Z up.
armdata=bpy.data.armatures.new('Crew deform skeleton');rig=bpy.data.objects.new('CREW_RIG',armdata);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);base.select_set(False);bpy.ops.object.mode_set(mode='EDIT')
B={}
def bone(name,a,b,parent=None):
 e=armdata.edit_bones.new(name);e.head=a;e.tail=b
 if parent:e.parent=B[parent]
 e.use_deform=True;B[name]=e;return e
bone('Root',(0,0,0),(0,0,.16))
bone('Pelvis',(0,0,.89),(0,0,1.02),'Root')
bone('Spine',(0,0,1.02),(0,0,1.22),'Pelvis')
bone('Chest',(0,0,1.22),(0,0,1.40),'Spine')
bone('Neck',(0,0,1.40),(0,0,1.51),'Chest')
bone('Head',(0,0,1.51),(0,0,1.67),'Neck')
for side,s in [('L',1),('R',-1)]:
 def P(x,y,z):return (s*x,y,z)
 bone('Clavicle_'+side,P(.025,0,1.38),P(.18,-.008,1.375),'Chest')
 bone('UpperArm_'+side,P(.18,-.008,1.375),P(.295,-.023,1.145),'Clavicle_'+side)
 bone('Forearm_'+side,P(.295,-.023,1.145),P(.371,-.060,.888),'UpperArm_'+side)
 bone('Hand_'+side,P(.371,-.060,.888),P(.415,-.101,.799),'Forearm_'+side)
 fingers=[('Index',(.404,-.146,.810),(.421,-.158,.748)),('Middle',(.418,-.120,.798),(.432,-.123,.718)),('Ring',(.421,-.090,.801),(.432,-.088,.726)),('Pinky',(.414,-.062,.811),(.428,-.061,.752))]
 for name,a,b in fingers:
  a,b=Vector(a),Vector(b);chain=[a,a.lerp(b,.40),a.lerp(b,.76),b]
  for k in range(3):bone(f'{name}{k+1}_{side}',P(*chain[k]),P(*chain[k+1]),'Hand_'+side if k==0 else f'{name}{k}_{side}')
 pts=[(.365,-.111,.846),(.361,-.144,.823),(.367,-.163,.804),(.379,-.166,.791)]
 for k in range(3):bone(f'Thumb{k+1}_{side}',P(*pts[k]),P(*pts[k+1]),'Hand_'+side if k==0 else f'Thumb{k}_{side}')
 bone('Thigh_'+side,P(.083,0,.90),P(.130,.013,.492),'Pelvis')
 bone('Shin_'+side,P(.130,.013,.492),P(.170,.057,.117),'Thigh_'+side)
 bone('Foot_'+side,P(.170,.057,.117),P(.172,-.105,.049),'Shin_'+side)
 bone('Toe_'+side,P(.172,-.105,.049),P(.18,-.171,.039),'Foot_'+side)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');base.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
if not base.vertex_groups:raise RuntimeError('No skin weights were generated')
print('RIG',len(rig.data.bones),'bones',len(base.vertex_groups),'weight groups')

meshes=[]
def attach(o,mat,group=None):
 o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 if group:
  g=o.vertex_groups.new(name=group);g.add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Crew skin','ARMATURE');mod.object=rig;o.parent=rig;meshes.append(o);return o

def slice_body(name,test,mat,displace):
 faces=[p for p in base.data.polygons if test(p.center)]
 used=sorted({i for p in faces for i in p.vertices});remap={old:new for new,old in enumerate(used)}
 coords=[displace(base.data.vertices[i].co.copy(),base.data.vertices[i].normal.copy()) for i in used]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(coords,[],[[remap[i]for i in p.vertices]for p in faces]);mesh.update()
 # The cut follows a clean garment hem instead of the donor's face centres.
 edge_count={}
 for f in mesh.polygons:
  for edge in f.edge_keys:edge_count[edge]=edge_count.get(edge,0)+1
 boundary={i for e,n in edge_count.items() if n==1 for i in e}
 for i in boundary:
  v=mesh.vertices[i].co
  if name.startswith('Neck'):v.z=1.443 if v.z>1.425 else 1.405
  if name.startswith('Trousers') and v.z<.27:v.z=.225
  if name.startswith('Jacket'):
   if v.z>1.40:v.z=1.445
   elif abs(v.x)<.25:v.z=.909
   else:v.z=.935
 mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for vg in base.vertex_groups:o.vertex_groups.new(name=vg.name)
 for new,old in enumerate(used):
  weights=sorted(base.data.vertices[old].groups,key=lambda g:g.weight,reverse=True)[:4];total=sum(g.weight for g in weights)
  for g in weights:o.vertex_groups[g.group].add([new],g.weight/total,'REPLACE')
 attach(o,mat)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.018);bpy.ops.object.mode_set(mode='OBJECT')
 return o

def shirt_offset(v,n):
 arm=abs(v.x)>.22;wrinkle=math.sin(v.z*95+v.x*27)*math.sin(v.y*38)*(.0017 if arm else .0012)
 v+=n*(.014+wrinkle)
 if abs(v.x)<.22 and v.z<1.10:v.x*=1.035;v.y*=1.14
 return v
slice_body('Jacket / tailored sleeves and torso',lambda p:p.z>.89 and p.z<1.451 and not(abs(p.x)>.345 and p.z<.926),cloth,shirt_offset)
def pants_offset(v,n):
 v+=n*(.012+math.sin(v.z*94+abs(v.x)*55)*math.sin(v.y*42)*.0028)
 if abs(v.x)<.077 and .73<v.z<.96:v.y=max(v.y,-.094)
 return v
slice_body('Trousers / articulated cargo cut',lambda p:.225<p.z<.955 and not(abs(p.x)>.29 and p.z>.68),pants,pants_offset)
slice_body('Neck / anatomical collar transition',lambda p:1.405<p.z<1.443 and abs(p.x)<.095,skin,lambda v,n:v)
slice_body('Gloves / anatomical palms and five fingers',lambda p:abs(p.x)>.351 and p.z<.930,rubber,lambda v,n:v+n*.0022)

def bevelbox(name,loc,scale,mat,group,bevel=.008,rotation=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rotation);o=bpy.context.object;o.name=name;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mod=o.modifiers.new('Manufactured edge radii','BEVEL');mod.width=bevel;mod.segments=3
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Bake world placement into mesh, then skin in the armature coordinate system.
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 return attach(o,mat,group)
def tube(name,points,r,mat,group):
 curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=r;curve.bevel_resolution=2
 sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH');return attach(bpy.context.object,mat,group)
def shell(name,rings,mat,group,segments=24):
 vs=[];fs=[]
 for z,rx,front,back in rings:
  for i in range(segments):
   a=i/segments*math.tau;vs.append((math.cos(a)*rx,math.sin(a)*(front if math.sin(a)<0 else back),z))
 for j in range(len(rings)-1):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;fs.append((a,b,b+segments,a+segments))
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return attach(o,mat,group)

# Curved sewn armor and straps. These are fitted clothing surfaces, not body blocks.
vest=shell('Vest / contoured padded shell',[(1.035,.155,.123,.102),(1.11,.175,.149,.118),(1.23,.192,.161,.132),(1.34,.178,.146,.131)],armor,'Chest')
for side in [-1,1]:
 s='L' if side>0 else 'R'
 tube('Vest / shoulder binding '+s,[(side*.122,-.135,1.31),(side*.133,-.10,1.39),(side*.135,-.014,1.419),(side*.132,.09,1.37),(side*.126,.125,1.27)],.020,armor,'Chest')
 tube('Vest / shoulder stitch '+s,[(side*.103,-.136,1.31),(side*.114,-.10,1.394),(side*.116,-.014,1.423),(side*.113,.09,1.374)],.0022,seam,'Chest')
 for row in range(3):
  z=1.10+row*.046
  tube('Vest / MOLLE webbing',[(side*.014,-.165,z),(side*.085,-.164,z),(side*.154,-.135,z)],.006,cloth,'Chest')
 bevelbox('Vest / utility pouch '+s,(side*.101,-.161,1.158),(.125,.055,.136),cloth,'Chest',.012)
 bevelbox('Vest / pouch flap '+s,(side*.101,-.193,1.197),(.127,.012,.052),armor,'Chest',.006)
 bevelbox('Vest / clasp '+s,(side*.101,-.204,1.167),(.024,.012,.027),metal,'Chest',.004)
 bevelbox('Crew / shoulder insignia '+s,(side*.226,-.033,1.351),(.048,.085,.075),accent,'UpperArm_'+s,.009,(0,side*.43,0))
 # Cargo pockets, knee pads and panel seams follow real thigh/shin bones.
 bevelbox('Cargo / side pocket '+s,(side*.184,-.001,.749),(.065,.133,.154),pants,'Thigh_'+s,.012,(0,side*.045,0))
 bevelbox('Cargo / pocket flap '+s,(side*.216,-.001,.794),(.012,.137,.061),cloth,'Thigh_'+s,.005)
 bevelbox('Knee / fitted pad '+s,(side*.126,-.092,.498),(.109,.039,.130),armor,'Shin_'+s,.020,(.08,0,0))
 bevelbox('Knee / abrasion face '+s,(side*.126,-.115,.50),(.075,.012,.072),leather,'Shin_'+s,.015)
 for z in [.462,.545]:tube('Knee / securing strap '+s,[(side*.126+math.cos(i/32*math.tau)*.068,math.sin(i/32*math.tau)*.084,z)for i in range(33)],.009,armor,'Shin_'+s)
 # Boots use a continuous last, wide toe box, heel, layered outsole and laces.
 cx=side*.170;vs=[];fs=[];seg=32
 boot_rings=[(.012,.067,.182,.078,0),(.030,.070,.186,.081,0),(.050,.069,.182,.078,0),(.078,.067,.175,.075,0),(.105,.062,.150,.077,.006),(.135,.058,.105,.072,.020),(.180,.055,.065,.066,.045),(.225,.058,.066,.070,.055),(.258,.062,.069,.073,.055)]
 for z,wx,front,back,cy in boot_rings:
  for i in range(seg):
   a=i/seg*math.tau;c=math.cos(a);sn=math.sin(a);exponent=.62 if z<.11 else .87
   vs.append((cx+math.copysign(abs(c)**exponent,c)*wx,cy+math.copysign(abs(sn)**exponent,sn)*(front if sn<0 else back),z))
 for j in range(len(boot_rings)-1):
  for i in range(seg):a=j*seg+i;bb=j*seg+(i+1)%seg;fs.append((a,bb,bb+seg,a+seg))
 fs+=[tuple(range(seg-1,-1,-1))]
 me=bpy.data.meshes.new('Boot last');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Boot / sculpted last '+s,me);bpy.context.collection.objects.link(o);attach(o,leather,'Foot_'+s)
 o.data.materials.append(rubber)
 for f in o.data.polygons:
  if f.center.z<.05:f.material_index=1
 foot_group=o.vertex_groups['Foot_'+s];shin_group=o.vertex_groups.new(name='Shin_'+s)
 for v in o.data.vertices:
  amount=max(0,min(1,(v.co.z-.105)/.115))*.95
  foot_group.add([v.index],1-amount,'REPLACE');shin_group.add([v.index],amount,'REPLACE')
 boot_surface=BVHTree.FromPolygons([v.co for v in me.vertices],[list(p.vertices)for p in me.polygons])
 for row in range(5):
  z=.115+row*.025;y=-.122+row*.020
  for direction in [-1,1]:
   points=[]
   for step in range(5):
    u=step/4;point=Vector((cx+direction*(u-.5)*.061,y,z+u*.016));near,normal,_,_=boot_surface.find_nearest(point);points.append(near+normal*.003)
   tube('Boot / crossed lace '+s,points,.0018,seam,'Foot_'+s)
 for j in range(6):bevelbox('Boot / outsole tread '+s,(cx,-.155+j*.038,.021),(.139,.022,.020),rubber,'Foot_'+s,.003)
 tube('Boot / padded collar '+s,[(cx+math.cos(i/32*math.tau)*.062,.055+math.sin(i/32*math.tau)*.071,.254)for i in range(33)],.008,leather,'Shin_'+s)
 # A layered cuff covers the glove seam, with a single visible fastening tab.
 bevelbox('Glove / wrist tab '+s,(side*.375,-.088,.906),(.045,.045,.043),leather,'Hand_'+s,.012)

shell('Belt / webbing',[(.941,.151,.12,.093),(.978,.15,.116,.094)],armor,'Pelvis')
bevelbox('Belt / machined buckle',(0,-.126,.958),(.065,.017,.036),metal,'Pelvis',.004)
bevelbox('Vest / crew identity plate',(0,-.156,1.286),(.131,.015,.050),accent,'Chest',.006)
bevelbox('Vest / radio',( .132,-.148,1.312),(.053,.034,.074),rubber,'Chest',.006)
tube('Vest / radio aerial',[(.143,-.149,1.345),(.148,-.146,1.416)],.003,leather,'Chest')
bevelbox('Vest / radio status',( .137,-.168,1.327),(.025,.004,.012),glass,'Chest',.002)
shell('Jacket / raised collar',[(1.416,.068,.067,.063),(1.447,.062,.063,.059)],cloth,'Neck')
tube('Jacket / collar binding',[(math.cos(i/48*math.tau)*.063,math.sin(i/48*math.tau)*.063,1.447)for i in range(49)],.0032,seam,'Neck')
for side,s in [('L',1),('R',-1)]:
 tube('Jacket / tailored sleeve seam '+side,[(s*.224,-.075,1.32),(s*.290,-.083,1.18)],.0018,seam,'UpperArm_'+side)
 tube('Jacket / forearm seam '+side,[(s*.320,-.109,1.115),(s*.372,-.108,.950)],.0018,seam,'Forearm_'+side)
 tube('Cargo / front stitch '+side,[(s*.091,-.089,.90),(s*.113,-.098,.70),(s*.124,-.089,.59)],.0018,seam,'Thigh_'+side)
 # A circular elastic cuff overlaps both sleeve and glove.
 centre=Vector((s*.361,-.055,.932));axis=Vector((s*.076,-.037,-.257)).normalized();a=axis.cross(Vector((0,1,0))).normalized();bb=axis.cross(a)
 for dz in [-.007,0,.007]:tube('Jacket / wrist cuff '+side,[centre+axis*dz+(a*math.cos(i/24*math.tau)+bb*math.sin(i/24*math.tau))*.034 for i in range(25)],.006,armor,'Forearm_'+side)

# Remove the naked donor from the delivered scene; its licensed topology is
# retained in the garments, glove mesh and neck with the transferred weights.
for side in ['L','R']:
 for o in meshes:
  if not o.name.startswith('Boot / crossed lace '+side):continue
  foot=o.vertex_groups['Foot_'+side];shin=o.vertex_groups.new(name='Shin_'+side)
  for v in o.data.vertices:
   amount=max(0,min(1,(v.co.z-.105)/.115))*.95;foot.add([v.index],1-amount,'REPLACE');shin.add([v.index],amount,'REPLACE')
for prefix,donor_name in [('Jacket /','Jacket / tailored sleeves and torso'),('Knee /','Trousers / articulated cargo cut'),('Cargo /','Trousers / articulated cargo cut')]:
 donor=bpy.data.objects[donor_name];kd=KDTree(len(donor.data.vertices))
 for v in donor.data.vertices:kd.insert(v.co,v.index)
 kd.balance();surface=BVHTree.FromPolygons([v.co for v in donor.data.vertices],[list(p.vertices)for p in donor.data.polygons])
 for o in meshes:
  if not o.name.startswith(prefix) or o==donor or 'collar' in o.name or 'cuff' in o.name:continue
  # Sewn details deform with the cloth underneath, including joint blends.
  o.vertex_groups.clear()
  for g in donor.vertex_groups:o.vertex_groups.new(name=g.name)
  for v in o.data.vertices:
   if 'seam' in o.name or 'stitch' in o.name:
    near,normal,_,_=surface.find_nearest(v.co)
    if near is not None:v.co=near+normal*.0025
   _,i,_=kd.find(v.co)
   for g in donor.data.vertices[i].groups:o.vertex_groups[g.group].add([v.index],g.weight,'REPLACE')
bpy.data.objects.remove(base,do_unlink=True)
for o in meshes:
 for p in o.data.polygons:p.use_smooth=True

def style_point(v):
 if STYLE=='tactical':return Vector(v)
 x,y,z=v;return Vector((x*1.15,y*1.13,z*.91 if z<.9 else .819+(z-.9)*1.03))
if STYLE=='stylized':
 for o in meshes:
  for v in o.data.vertices:v.co=style_point(v.co)
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 for b in rig.data.edit_bones:b.head=style_point(b.head);b.tail=style_point(b.tail)
 bpy.ops.object.mode_set(mode='OBJECT')

def set_world_delta(name,axis,angle):
 pb=rig.pose.bones[name];rest=pb.bone.matrix_local.to_quaternion()
 pb.rotation_mode='QUATERNION';pb.rotation_quaternion=rest.inverted() @ Quaternion(Vector(axis),angle) @ rest
def pose_zero():
 for p in rig.pose.bones:p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
def flex(name,ang):set_world_delta(name,(1,0,0),ang)
def curl(side,amount):
 # Fingers close toward the palm across the body's X direction.
 s=1 if side=='L' else -1
 for name in ['Index','Middle','Ring','Pinky']:
  for k in range(1,4):set_world_delta(f'{name}{k}_{side}',(0,s,0),amount*(.70 if k==1 else .86))
 for k in range(1,4):set_world_delta(f'Thumb{k}_{side}',(0,s,0),amount*.36)

def aim_bone(name,target):
 p=rig.pose.bones[name];bpy.context.view_layer.update()
 rest=p.bone.matrix_local;direction=(Vector(target)-p.head).normalized()
 desired=rest.to_quaternion() @ Vector((0,1,0))
 world_q=desired.rotation_difference(direction) @ rest.to_quaternion()
 parent=rig.pose.bones[p.parent.name].matrix @ p.parent.bone.matrix_local.inverted() @ rest if p.parent else rest
 p.rotation_quaternion=parent.to_quaternion().inverted() @ world_q;bpy.context.view_layer.update()

def grip_rotation(side):
 hand=rig.data.bones['Hand_'+side];along=(hand.tail_local-hand.head_local).normalized()
 width=rig.data.bones['Index1_'+side].head_local-rig.data.bones['Pinky1_'+side].head_local
 width=(width-along*width.dot(along)).normalized();normal=along.cross(width).normalized()
 source=Matrix((normal,along,width)).transposed()
 target=Matrix(((-1,0,0),(0,-1,0),(0,0,1))).transposed()
 return (target @ source.inverted()).to_quaternion() @ hand.matrix_local.to_quaternion()

def arm_ik(side,wrist,pole):
 upper=rig.pose.bones['UpperArm_'+side];fore=rig.pose.bones['Forearm_'+side]
 bpy.context.view_layer.update();start=upper.head.copy();wrist=style_point(wrist);pole=style_point(pole)
 delta=wrist-start;distance=min(delta.length,upper.length+fore.length-.005);direction=delta.normalized()
 along=(upper.length**2-fore.length**2+distance**2)/(2*distance)
 height=math.sqrt(max(.00001,upper.length**2-along**2));perp=pole-start;perp=(perp-direction*perp.dot(direction)).normalized()
 elbow=start+direction*along+perp*height
 aim_bone('UpperArm_'+side,elbow);aim_bone('Forearm_'+side,wrist)
 # Grip fingers descend around the pistol grip; forearm twist stays anatomical.
 hand=rig.pose.bones['Hand_'+side];rest=hand.bone.matrix_local
 parent=hand.parent.matrix @ hand.parent.bone.matrix_local.inverted() @ rest
 hand.rotation_quaternion=parent.to_quaternion().inverted() @ grip_rotation(side);bpy.context.view_layer.update()

def grip_ik(side,palm,pole):
 s=1 if side=='L' else -1;hand=rig.data.bones['Hand_'+side];rest=hand.matrix_local.to_quaternion()
 rotation=grip_rotation(side)
 local=hand.matrix_local.inverted() @ style_point((s*.390,-.104,.801))
 target=style_point(palm)-(rotation@local)
 # arm_ik applies the style deformation to authored targets once.
 if STYLE=='stylized':target=Vector((target.x/1.15,target.y/1.13,target.z/.91 if target.z<.819 else .9+(target.z-.819)/1.03))
 arm_ik(side,target,pole)

def action_pose(name,t,d):
 pose_zero();u=t/d;wave=math.sin(math.tau*u);step=math.sin(math.tau*u*2)
 flex('Spine',.025*math.sin(t*3));flex('Chest',-.018*math.sin(t*3));rig.pose.bones['Pelvis'].location.z=.002*math.sin(t*3)
 # The resting A-pose becomes a relaxed fighting guard through shoulder adduction.
 for side,s in [('L',1),('R',-1)]:
  set_world_delta('UpperArm_'+side,(0,1,0),s*.20)
  pb=rig.pose.bones['UpperArm_'+side];rest=pb.bone.matrix_local.to_quaternion()
  pb.rotation_quaternion=rest.inverted() @ Quaternion((1,0,0),-.50) @ Quaternion((0,1,0),s*.28) @ rest
  flex('Forearm_'+side,-1.45);curl(side,1.48)
 if name in ('Walk','Run','LaserRun'):
  run=name!='Walk';a=math.sin(math.tau*u);amp=.62 if run else .36
  for side,s in [('L',1),('R',-1)]:
   flex('Thigh_'+side,amp*a*s);flex('Shin_'+side,max(0,-a*s)*(1.08 if run else .61)+.10)
   flex('Foot_'+side,-.14-max(0,a*s)*.20)
   set_world_delta('UpperArm_'+side,(1,0,0),-a*s*(.65 if run else .37));flex('Forearm_'+side,-.86 if run else -.42)
  rig.pose.bones['Pelvis'].location.z=(.024 if run else .012)*abs(a);flex('Chest',.11 if run else .035)
 if name in ('LaserIdle','LaserFire','LaserRun'):
  recoil=(math.sin(math.pi*min(1,t/.20)) if name=='LaserFire' else 0)*.10
  for side,s in [('L',1),('R',-1)]:
   set_world_delta('UpperArm_'+side,(1,0,0),-1.03-recoil);flex('Forearm_'+side,-.61)
   set_world_delta('Hand_'+side,(0,0,1),s*.18);curl(side,1.3)
  flex('Chest',.045+recoil*.15)
  grip_ik('R',(-.09,-.23+recoil*.2,1.19),(-.32,-.02,1.08))
  grip_ik('L',(-.09,-.39875+recoil*.2,1.19),(.22,-.14,1.06))
 if name in ('Punch','Heavy','Throw'):
  hit=math.sin(math.pi*min(1,u*1.55)) if u<.645 else max(0,1-(u-.645)/.355)*.18
  wind=math.sin(math.pi*min(1,u*4)) if u<.25 else 0
  set_world_delta('UpperArm_R',(1,0,0),-.65-hit*.95+wind*.24);flex('Forearm_R',-.9+hit*.83)
  set_world_delta('Chest',(0,0,1),hit*.18);flex('Spine',hit*.08)
 if name in ('Kick','HeavyKick'):
  hit=math.sin(math.pi*u);flex('Thigh_R',-1.34*hit);flex('Shin_R',.90*max(0,math.sin(math.tau*u)));flex('Chest',-.16*hit);flex('Forearm_L',-.95)
 if name=='Block':
  for side,s in [('L',1),('R',-1)]:flex('UpperArm_'+side,-.66);flex('Forearm_'+side,-1.40);set_world_delta('Hand_'+side,(0,0,1),s*.20)
  flex('Chest',.1);flex('Thigh_L',-.12);flex('Shin_L',.22)
 if name in ('Grab','Pickup','Spin'):
  reach=math.sin(math.pi*u) if name=='Pickup' else .85
  for side in ('L','R'):flex('UpperArm_'+side,-1.13*reach);flex('Forearm_'+side,-.42);curl(side,.3 if name=='Grab' else .85)
  flex('Spine',(.45 if name=='Pickup' else .12)*reach);flex('Thigh_L',-.28*reach);flex('Shin_L',.5*reach)
 if name=='Dodge':
  a=math.sin(math.pi*u);flex('Thigh_L',-.75*a);flex('Thigh_R',-.65*a);flex('Shin_L',1.18*a);flex('Shin_R',1.08*a);flex('Chest',.35*a);rig.pose.bones['Pelvis'].location.z=-.17*a
 if name=='Hit':flex('Chest',-.23*math.sin(math.pi*u));set_world_delta('Spine',(0,0,1),.13*math.sin(math.pi*u))
 if name in ('Down','GetUp'):
  a=1 if name=='Down' else 1-(u*u*(3-2*u));flex('Root',-math.pi/2*a);rig.pose.bones['Root'].location.y=-.1*a;rig.pose.bones['Root'].location.z=.18*a
  flex('Shin_L',.32*a);flex('UpperArm_L',.25*a);flex('UpperArm_R',.35*a)
 if name=='Thrown':
  flex('Chest',-.18);flex('UpperArm_L',-.8);flex('UpperArm_R',-.6);flex('Forearm_L',-.2);flex('Forearm_R',-.4);flex('Shin_L',.65);flex('Shin_R',.42);curl('L',.1);curl('R',.1)

clips=[('Idle',2.4,True),('Walk',1.1,True),('Run',.72,True),('LaserIdle',2.4,True),('LaserFire',.36,False),('LaserRun',.85,True),('Punch',.43,False),('Heavy',.92,False),('Kick',.67,False),('HeavyKick',.93,False),('Block',1.5,True),('Dodge',.55,False),('Grab',1.0,False),('Spin',1.6,True),('Pickup',.8,False),('Throw',.8,False),('Hit',.45,False),('Down',1,True),('GetUp',.85,False),('Thrown',1,True)]
rig.animation_data_create();sc=bpy.context.scene;sc.render.fps=30
for name,duration,loop in clips:
 a=bpy.data.actions.new(name);rig.animation_data.action=a;a['loop']=loop;a['duration']=duration
 frames=max(2,round(duration*30))
 for frame in range(frames+1):
  action_pose(name,frame/frames*duration,duration)
  for p in rig.pose.bones:p.keyframe_insert('rotation_quaternion',frame=frame+1,group=p.name);p.keyframe_insert('location',frame=frame+1,group=p.name)
 a.use_fake_user=True
rig.animation_data.action=bpy.data.actions['Idle'];sc.frame_set(1)
rig['asset_source']='Blender Studio Human Base Meshes 1.4.1, CC0; authored clothing and rig for 4 Mafias'
rig['body_height_metres']=1.69

# Save a clean editable source and export only the deforming character.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=rig
sc.world.color=(.09,.12,.14)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ART/f'crew-{STYLE}.blend'))
export_path=OUT/f'crew-{STYLE}.glb'
bpy.ops.export_scene.gltf(filepath=str(export_path),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_def_bones=True,export_yup=True,export_extras=True,export_materials='EXPORT',export_skins=True,export_all_influences=False)
# Contact markers are expressed in bone local space, independent of the export axes.
raw=export_path.read_bytes();jn=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jn]);binary=raw[28+jn:]
sockets={}
for side,s in [('R',-1),('L',1)]:
 local=rig.data.bones['Hand_'+side].matrix_local.inverted() @ style_point((s*.390,-.104,.801))
 sockets['palm'+side]={'bone':'Hand_'+side,'position':list(local)}
doc['extras']={'crewStyle':STYLE,'sockets':sockets,'stats':{'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in meshes)}}
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
raw=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
export_path.write_bytes(raw);(ROOT/f'assets/crew-{STYLE}.glb.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
report={'source':'https://www.blender.org/download/demo-files/#assets','license':'CC0','library_sha256':'811F43ACCBB31A88266D932F8F5563B2D13586FCA0BA2693AAD1F5FE582B3515','bones':len(rig.data.bones),'meshes':len(meshes),'vertices':sum(len(o.data.vertices)for o in meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in meshes),'clips':[{'name':n,'duration':d,'loop':l}for n,d,l in clips],'glb_bytes':len(raw),'gzip_bytes':(ROOT/f'assets/crew-{STYLE}.glb.gz').stat().st_size}
(ART/f'crew-{STYLE}-manifest.json').write_text(json.dumps(report,indent=2));print('CREW_REPORT',json.dumps(report))

# Neutral studio reference of the actual delivered body, without photographic head.
for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.location=(0,0,0)
rig.animation_data.action=None
sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=900;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(2.5,-5,2.0));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.84))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.88;sc.camera=cam
for loc,power,size in [((1,-3,4),550,3),((-3,-1,2),350,3),((0,2,3),650,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=str(OUT/f'crew-{STYLE}-render.png');bpy.ops.render.render(write_still=True)
