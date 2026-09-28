"""Derive a compact Brawl SCARAT from the native rig and export rigid mesh groups.

Run in Blender 5.1 background mode. The .blend is the editable source; the .gz is
the small, vertex-coloured WebGL runtime representation. Nothing is written to
the Trials source.
"""
import bpy
import gzip
import json
import math
import struct
import sys
from collections import defaultdict
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source' / 'scarat-boss.blend'
RUNTIME = ROOT / 'assets' / 'boss-scarat.mesh.gz'
RIG = ROOT / 'assets' / 'boss-scarat.rig.json'
KEEP = {'HULL', 'LEFT', 'RIGHT', 'SUPPORT', 'NACELLE', 'AERIAL', 'SPINE',
        'CHASSIS', 'SENSOR', 'MAIN', 'SIDE', 'FORWARD', 'REAR'}
MAT_COLORS = {
    'steel': (0.28, 0.32, 0.31), 'dark': (0.075, 0.085, 0.09),
    'ochre': (0.44, 0.30, 0.085), 'ivory': (0.58, 0.52, 0.42),
    'rubber': (0.035, 0.04, 0.045), 'chrome': (0.58, 0.62, 0.60),
    'light': (1.0, 0.65, 0.17), 'glass': (0.23, 0.39, 0.42),
    'cyan': (0.12, 0.78, 0.91),
}


def mat(name):
    existing = bpy.data.materials.get('SCARAT_PBR_' + name)
    if existing:
        return existing
    material = bpy.data.materials.new('BOSS_' + name)
    material.diffuse_color = (*MAT_COLORS[name], 1)
    return material


def lathe(name, profile, material, bone, origin, radial=18):
    """Machined Y-axis housing with real inner and outer contour surfaces."""
    verts, faces = [], []
    for y, radius in profile:
        for k in range(radial):
            a = 2 * math.pi * k / radial
            verts.append((origin[0] + radius * math.cos(a), origin[1] + y,
                          origin[2] + radius * math.sin(a)))
    for row in range(len(profile) - 1):
        for k in range(radial):
            a = row * radial + k
            b = row * radial + (k + 1) % radial
            faces.append((a, b, b + radial, a + radial))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(verts))), 1, 'REPLACE')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def add_cannon():
    anchor = (1.0, 2.23, 1.18)
    wrist = 'SCARAT_RIGHT_CLAW_WRIST'
    steel, dark, ochre, chrome, light = [mat(x) for x in
                                           ('steel', 'dark', 'ochre', 'chrome', 'light')]
    lathe('BOSS_CANNON_BREECH', [(-.35, .25), (-.32, .42), (-.17, .46),
          (.10, .46), (.22, .39), (.25, .32)], ochre, wrist, anchor, 20)
    lathe('BOSS_CANNON_CORE', [(.20, .31), (.30, .30), (.36, .27),
          (1.36, .27), (1.43, .34), (1.52, .34)], dark, wrist, anchor, 24)
    lathe('BOSS_CANNON_MUZZLE', [(1.34, .34), (1.39, .43), (1.51, .43),
          (1.58, .38), (1.58, .20), (1.51, .20), (1.39, .24)], chrome,
          wrist, anchor, 24)
    for i in range(7):
        y = .37 + i * .145
        lathe('BOSS_CANNON_COOLING_RING_%02d' % i,
              [(y, .28), (y + .022, .365), (y + .058, .365),
               (y + .080, .28)], steel if i % 2 else ochre, wrist, anchor, 20)
    lathe('BOSS_CANNON_CHARGE_COIL', [(.24, .34), (.27, .38),
          (.32, .38), (.35, .34)], light, wrist, anchor, 24)
    for i in range(8):
        a = i * math.pi / 4
        x = anchor[0] + .33 * math.cos(a)
        z = anchor[2] + .33 * math.sin(a)
        lathe('BOSS_CANNON_RAIL_%02d' % i,
              [(.31, .023), (1.29, .023)], steel, wrist, (x, anchor[1], z), 8)


def bone_group(obj, bones):
    groups = [g.name for g in obj.vertex_groups if g.name in bones]
    if not groups:
        return 'SCARAT_ROOT'
    bone = bones[groups[0]]
    while bone and bone.name not in ACTIVE_BONES:
        bone = bone.parent
    return bone.name if bone else 'SCARAT_ROOT'


ACTIVE_BONES = {'SCARAT_ROOT', 'SCARAT_PRESSURE_SPINE', 'SCARAT_SENSOR_BROW'}
for side in ('LEFT', 'RIGHT'):
    for station in ('FORE', 'HIND'):
        for joint in ('HIP', 'KNEE', 'ANKLE'):
            ACTIVE_BONES.add(f'SCARAT_{side}_{station}_{joint}')
    for joint in ('SHOULDER', 'WRIST', 'INNER_JAW', 'OUTER_JAW'):
        ACTIVE_BONES.add(f'SCARAT_{side}_CLAW_{joint}')


def palette(material):
    if material is None:
        return MAT_COLORS['steel'], 0
    key = next((x for x in MAT_COLORS if material.name.endswith('_' + x)),
               'steel')
    return MAT_COLORS[key], 1 if key in ('light', 'cyan') else 0


def export_mesh(arm):
    # Blender X/Y/Z -> game X/Y/Z = X/Z/-Y (both are right handed).
    def game(v):
        return (v.x, v.z, -v.y)

    groups = defaultdict(bytearray)
    counts = defaultdict(int)
    # The source keeps two-segment bevels for close Blender renders. At the
    # fixed Brawl camera distance, their extra subdivisions dominate cost but
    # contribute less than the original panel and mechanical contours.
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for modifier in obj.modifiers:
                if modifier.type == 'BEVEL':
                    modifier.show_viewport = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.data.objects:
        if obj.type != 'MESH':
            continue
        name = obj.name
        if not (name.startswith('BOSS_') or name.startswith('SCARAT_')):
            continue
        group = bone_group(obj, arm.data.bones)
        evaluated = obj.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        if not mesh:
            continue
        mesh.calc_loop_triangles()
        world = obj.matrix_world
        normal_matrix = world.to_3x3().inverted().transposed()
        for tri in mesh.loop_triangles:
            material = mesh.materials[tri.material_index] if tri.material_index < len(mesh.materials) else None
            color, glow = palette(material)
            rgb = tuple(max(0, min(255, round(c * 255))) for c in color)
            normal = Vector(game((normal_matrix @ tri.normal).normalized())).normalized()
            normal_bytes = tuple(max(-127, min(127, round(x * 127))) for x in normal)
            for vertex_id in tri.vertices:
                position = game(world @ mesh.vertices[vertex_id].co)
                groups[group] += struct.pack('<3f3b3BB', *position,
                                              *normal_bytes, *rgb, glow)
                counts[group] += 1
        evaluated.to_mesh_clear()
    out = bytearray(b'SCB1') + struct.pack('<H', len(groups))
    for name in sorted(groups):
        encoded = name.encode('ascii')
        out += struct.pack('<B', len(encoded)) + encoded
        out += struct.pack('<I', counts[name]) + groups[name]
    RUNTIME.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(RUNTIME, 'wb', compresslevel=9) as f:
        f.write(out)
    rig = {}
    for name in sorted(groups):
        bone = arm.data.bones[name]
        parent = bone.parent
        while parent and parent.name not in groups:
            parent = parent.parent
        rig[name] = {'parent': parent.name if parent else None,
                     'pivot': [round(x, 5) for x in game(bone.head_local)]}
    RIG.write_text(json.dumps(rig, separators=(',', ':')), encoding='utf-8')
    print('BOSS_RUNTIME', len(out), RUNTIME.stat().st_size,
          sum(counts.values()) // 3, sorted(counts.items()))


def main():
    derive = '--derive' in sys.argv
    if derive:
        original = [x for x in bpy.data.objects if x.type == 'MESH']
        for obj in original:
            category = obj.name.split('_')[1] if '_' in obj.name else ''
            keep = category in KEEP or obj.name.startswith('SCARAT_CABIN_LOWER_RIM') or obj.name.startswith('SCARAT_CABIN_ROOF_RIM')
            if obj.name.startswith('SCARAT_RIGHT_CLAW_') and any(s in obj.name for s in ('JAW', 'GRIP', 'PALM')):
                keep = False
            if not keep:
                bpy.data.objects.remove(obj, do_unlink=True)
        add_cannon()
        # Keep the original armature and its action library as editable provenance.
        bpy.ops.outliner.orphans_purge(do_recursive=True)
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
        print('BOSS_SOURCE', SOURCE, SOURCE.stat().st_size)
    arm = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    export_mesh(arm)


main()
