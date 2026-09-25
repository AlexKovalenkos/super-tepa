// Terrain materials (Minecraft light-level brightness curve, day/night sky darkening, fog)
// and the chunk manager that generates, meshes and unloads chunks around the player.
import * as THREE from 'three';
import { buildChunk } from './mesher.js';
import { ckey } from './world.js';

const VS = /* glsl */`
attribute vec3 lt;
varying vec2 vUv;
varying vec3 vLt;
varying float vDist;
void main() {
  vUv = uv;
  vLt = lt;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDist = length(wp.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FS = /* glsl */`
uniform sampler2D uAtlas;
uniform float uSkyDarken;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uGamma;
uniform float uAlphaTest;
varying vec2 vUv;
varying vec3 vLt;
varying float vDist;
// Minecraft's light level -> brightness table, with the "brightness" (gamma) slider applied
float br(float lvl) {
  float f = 1.0 - lvl / 15.0;
  float b = (1.0 - f) / (f * 3.0 + 1.0);
  return mix(b, 1.0 - pow(1.0 - b, 4.0), uGamma);
}
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < uAlphaTest) discard;
  float skyL = max(vLt.x * 15.0 - uSkyDarken, 0.0);
  vec3 sky = vec3(br(skyL)) * mix(vec3(1.0), vec3(0.72, 0.78, 1.0), uSkyDarken / 11.0);
  vec3 blk = vec3(br(vLt.y * 15.0)) * vec3(1.0, 0.9, 0.76);
  vec3 light = max(max(sky, blk), vec3(0.03));
  vec3 col = c.rgb * light * vLt.z;
  float fog = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(col, uFogColor, fog), c.a);
}`;

export function makeTerrainMaterials(atlas) {
  const shared = {
    uAtlas: { value: atlas },
    uSkyDarken: { value: 0 },
    uFogColor: { value: new THREE.Color(0.75, 0.85, 1) },
    uFogNear: { value: 80 },
    uFogFar: { value: 120 },
    uGamma: { value: 0.5 },
  };
  const mk = (alphaTest, extra = {}) => new THREE.ShaderMaterial({
    uniforms: { ...shared, uAlphaTest: { value: alphaTest } },
    vertexShader: VS, fragmentShader: FS, ...extra,
  });
  return {
    shared,
    list: [
      mk(-1),
      mk(0.5),
      mk(0.01, { transparent: true, side: THREE.DoubleSide }),
    ],
  };
}

export class ChunkManager {
  constructor(scene, world, materials) {
    this.scene = scene; this.world = world; this.mats = materials;
    this.frame = 0;
    this.setRadius(8);
  }

  setRadius(R) {
    this.R = R;
    const G = R + 1, offs = [];
    for (let dz = -G; dz <= G; dz++) for (let dx = -G; dx <= G; dx++) {
      const d = dx * dx + dz * dz;
      if (d <= G * G + 1) offs.push([dx, dz, d]);
    }
    offs.sort((a, b) => a[2] - b[2]);
    this.offsets = offs;
  }

  ready(c) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!this.world.getChunk(c.cx + dx, c.cz + dz)) return false;
    }
    return true;
  }

  update(px, pz, budgetMs) {
    const cx = Math.floor(px / 16), cz = Math.floor(pz / 16), R2 = this.R * this.R + 1;
    const t0 = performance.now();
    let work = 0;
    for (const [dx, dz] of this.offsets) {
      if (work > 0 && performance.now() - t0 > budgetMs) break;
      if (!this.world.getChunk(cx + dx, cz + dz)) { this.world.generate(cx + dx, cz + dz); work++; }
    }
    for (const [dx, dz, d] of this.offsets) {
      if (d > R2) break;
      if (work > 0 && performance.now() - t0 > budgetMs * 1.5) break;
      const c = this.world.getChunk(cx + dx, cz + dz);
      if (!c || !c.dirty || !this.ready(c)) continue;
      this.mesh(c);
      work++;
    }
    if (++this.frame % 30 === 0) this.unloadFar(cx, cz);
    return work;
  }

  // Re-mesh dirty chunks around an edit immediately, so block changes appear in the same frame
  flushAround(x, z) {
    const cx = x >> 4, cz = z >> 4;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = this.world.getChunk(cx + dx, cz + dz);
      if (c && c.dirty && this.ready(c)) this.mesh(c);
    }
  }

  mesh(c) {
    const geos = buildChunk(this.world, c);
    this.disposeMeshes(c);
    c.meshes = [];
    geos.forEach((g, i) => {
      if (!g) return;
      const m = new THREE.Mesh(g, this.mats[i]);
      m.position.set(c.cx * 16, 0, c.cz * 16);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      if (i === 2) m.renderOrder = 1;
      this.scene.add(m);
      c.meshes.push(m);
    });
    c.dirty = false;
  }

  disposeMeshes(c) {
    if (!c.meshes) return;
    for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    c.meshes = null;
  }

  unloadFar(cx, cz) {
    const R = this.R;
    for (const c of this.world.chunks.values()) {
      const dx = c.cx - cx, dz = c.cz - cz, d = dx * dx + dz * dz;
      if (d > (R + 3) * (R + 3)) {
        this.disposeMeshes(c);
        this.world.chunks.delete(ckey(c.cx, c.cz));
      } else if (d > (R + 1) * (R + 1) && c.meshes) {
        this.disposeMeshes(c);
        c.dirty = true;
      }
    }
  }

  clear() {
    for (const c of this.world.chunks.values()) this.disposeMeshes(c);
  }

  stats() {
    let meshed = 0;
    for (const c of this.world.chunks.values()) if (c.meshes) meshed++;
    return { loaded: this.world.chunks.size, meshed };
  }
}
