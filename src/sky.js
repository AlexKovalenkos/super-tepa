// Sky dome, square sun and moon, stars, flat blocky clouds and the day/night cycle (24000-tick day).
import * as THREE from 'three';
import { Simplex } from './noise.js';
import { DAY_TICKS } from './consts.js';

function pixelTexture(size, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  paint((x, y, r, g, b, a = 255) => {
    const o = (y * size + x) * 4;
    img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = a;
  });
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector4() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec4 uGlow; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.35, h));
          if (h < 0.0) col = mix(uHorizon, uHorizon * 0.55, smoothstep(0.0, -0.4, h));
          vec2 sd = normalize(uSunDir.xz + vec2(1e-5));
          float g = pow(max(dot(normalize(vDir.xz + vec2(1e-5)), sd), 0.0), 3.0) * uGlow.a * (1.0 - smoothstep(0.0, 0.45, abs(h - 0.05)));
          col = mix(col, uGlow.rgb, g);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // Stars
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      sp.push(Math.cos(a) * s * 380, u * 380, Math.sin(a) * s * 380);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // Sun: bright square with a soft halo
    const sunTex = pixelTexture(32, px => {
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
        if (d < 8) px(x, y, 255, 255, d < 6 ? 235 : 190);
        else if (d < 16) { const a = (1 - (d - 8) / 8) * 110; px(x, y, 255, 230, 140, a); }
        else px(x, y, 0, 0, 0, 0);
      }
    });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    this.sun.scale.setScalar(90);
    this.sun.renderOrder = -8;
    this.group.add(this.sun);

    const moonTex = pixelTexture(16, px => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (x < 4 || x > 11 || y < 4 || y > 11) { px(x, y, 0, 0, 0, 0); continue; }
        const crater = (x === 6 && y === 6) || (x === 9 && y === 8) || (x === 7 && y === 10) || (x === 10 && y === 5);
        const c = crater ? 150 : 222 + ((x * 7 + y * 3) % 3) * 8;
        px(x, y, c, c, c + 12);
      }
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: moonTex, transparent: true, depthWrite: false, fog: false,
    }));
    this.moon.scale.setScalar(70);
    this.moon.renderOrder = -8;
    this.group.add(this.moon);

    // Clouds: 12x12-block cells from a 1-bit map, drifting slowly, like Minecraft "fast" clouds
    const cn = new Simplex(1234);
    const cloudTex = pixelTexture(128, px => {
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const v = cn.noise2D(x / 7, y / 7) * 0.7 + cn.noise2D(x / 2.5, y / 2.5) * 0.3;
        px(x, y, 255, 255, 255, v > 0.28 ? 255 : 0);
      }
    });
    cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uMap: { value: cloudTex }, uOffset: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(1, 1, 1) }, uFar: { value: 150 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D uMap; uniform vec2 uOffset; uniform vec3 uColor; uniform float uFar; varying vec3 vW;
        void main(){
          vec2 cell = floor((vW.xz + uOffset) / 12.0);
          float a = texture2D(uMap, (cell + 0.5) / 128.0).a;
          float d = length(vW.xz - cameraPosition.xz);
          a *= 0.8 * (1.0 - smoothstep(uFar * 0.7, uFar * 1.6, d));
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 2;
    scene.add(this.clouds);

    this.fogColor = new THREE.Color();
    this.skyDarken = 0;
    this.daylight = 1;
  }

  update(cam, time, ticksTotal, renderDistBlocks) {
    const angle = (time / DAY_TICKS) - 0.25;           // Minecraft celestial angle, noon = 0
    const a = angle * Math.PI * 2;
    const d = Math.min(1, Math.max(0, Math.cos(a) * 2 + 0.5)); // daylight factor
    this.daylight = d;
    this.skyDarken = (1 - d) * 11;

    const sunDir = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0.15).normalize();
    const top = lerpC([0.01, 0.01, 0.04], [0.47, 0.65, 1.0], d);
    const hor = lerpC([0.03, 0.03, 0.07], [0.75, 0.85, 1.0], d);
    const sunset = Math.exp(-Math.pow(sunDir.y / 0.22, 2));

    this.domeMat.uniforms.uTop.value.setRGB(...top);
    this.domeMat.uniforms.uHorizon.value.setRGB(...hor);
    this.domeMat.uniforms.uSunDir.value.copy(sunDir);
    this.domeMat.uniforms.uGlow.value.set(1.0, 0.55, 0.25, 0.85 * sunset);
    this.fogColor.setRGB(...hor);

    this.group.position.copy(cam.position);
    this.sun.position.copy(sunDir).multiplyScalar(350);
    this.group.updateMatrixWorld(true);
    this.sun.lookAt(cam.position);
    this.moon.position.copy(sunDir).multiplyScalar(-350);
    this.moon.lookAt(cam.position);
    this.starMat.opacity = Math.max(0, 1 - d * 2) * 0.9;
    this.stars.rotation.z = a;

    this.clouds.position.set(cam.position.x, 192.3, cam.position.z);
    this.cloudMat.uniforms.uOffset.value.set(ticksTotal * 0.03, 0);
    this.cloudMat.uniforms.uFar.value = Math.max(120, renderDistBlocks * 1.3);
    const cb = 0.12 + 0.88 * d;
    this.cloudMat.uniforms.uColor.value.setRGB(cb, cb, cb * 1.02);
  }
}
