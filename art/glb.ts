// A small reader for .glb files, enough to check a model against its contract (spec #5 §7).
// It reads the header and the JSON chunk; the bounds come from the POSITION accessors' min and max,
// which glTF requires, so no vertex is read.

type Vec3 = [number, number, number];

export interface GlbSummary {
  /** The bounds of every mesh (glTF: Y up, +Z forward). */
  min: Vec3;
  max: Vec3;
  triangles: number;
  materials: string[];
  /** Each material's bounds, over the primitives drawn with it. */
  byMaterial: Record<string, { min: Vec3; max: Vec3 }>;
  /** Nodes with a transform. The build applies transforms, so this should be empty. */
  transformedNodes: string[];
}

interface Accessor {
  count: number;
  min?: number[];
  max?: number[];
}

interface Node {
  name?: string;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
}

interface Gltf {
  accessors?: Accessor[];
  materials?: Array<{ name?: string }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; material?: number; mode?: number }> }>;
  nodes?: Node[];
}

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

const empty = (): { min: Vec3; max: Vec3 } => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });

function grow(box: { min: Vec3; max: Vec3 }, min: number[], max: number[]): void {
  for (let k = 0; k < 3; k++) {
    box.min[k] = Math.min(box.min[k]!, min[k]!);
    box.max[k] = Math.max(box.max[k]!, max[k]!);
  }
}

const isIdentity = (n: Node): boolean =>
  !n.matrix &&
  (!n.translation || n.translation.every((v) => v === 0)) &&
  (!n.rotation || (n.rotation[0] === 0 && n.rotation[1] === 0 && n.rotation[2] === 0 && n.rotation[3] === 1)) &&
  (!n.scale || n.scale.every((v) => v === 1));

export function readGlb(bytes: Uint8Array): GlbSummary {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== MAGIC) throw new Error('not a .glb file');
  if (view.getUint32(4, true) !== 2) throw new Error('not glTF 2.0');
  if (view.getUint32(16, true) !== JSON_CHUNK) throw new Error('the first chunk is not JSON');
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + view.getUint32(12, true)))) as Gltf;
  const accessors = gltf.accessors ?? [];
  const materials = (gltf.materials ?? []).map((m, i) => m.name ?? `material ${i}`);
  const all = empty();
  const byMaterial: GlbSummary['byMaterial'] = {};
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error('only triangle meshes are supported');
      const position = accessors[primitive.attributes.POSITION ?? -1];
      if (!position?.min || !position.max) throw new Error('a primitive has no POSITION bounds');
      triangles += (primitive.indices === undefined ? position.count : accessors[primitive.indices]!.count) / 3;
      const name = primitive.material === undefined ? '(none)' : materials[primitive.material]!;
      grow(all, position.min, position.max);
      grow((byMaterial[name] ??= empty()), position.min, position.max);
    }
  }
  const transformedNodes = (gltf.nodes ?? []).flatMap((n, i) => (isIdentity(n) ? [] : [n.name ?? `node ${i}`]));
  return { ...all, triangles, materials, byMaterial, transformedNodes };
}
