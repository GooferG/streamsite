import React, { useEffect, useRef, useState } from 'react';
import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  PlaneGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
  Color,
} from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  GlitchEffect,
  ChromaticAberrationEffect,
  NoiseEffect,
  ScanlineEffect,
  VignetteEffect,
  BloomEffect,
  BlendFunction,
} from 'postprocessing';

const DURATION_MS = 1400;

// Phase-driven envelope for the CRT boot sequence.
// t in [0,1]. Returns intensity multipliers for each effect.
function envelope(t) {
  const dotFlash = t < 0.08 ? 1 - t / 0.08 : 0;
  const lineStretch = t < 0.18 ? Math.min(1, t / 0.12) : Math.max(0, 1 - (t - 0.18) / 0.1);
  const staticBurst =
    t < 0.32 ? 0 : t < 0.78 ? 1 : Math.max(0, 1 - (t - 0.78) / 0.18);
  const settle = t > 0.85 ? Math.min(1, (t - 0.85) / 0.15) : 0;
  const opacity = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.1) : 1;

  return { dotFlash, lineStretch, staticBurst, settle, opacity };
}

export default function TVStaticIntro({ onComplete }) {
  const mountRef = useRef(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
  }, []);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onComplete?.(), 250);
      return () => clearTimeout(t);
    }

    const mount = mountRef.current;
    if (!mount) return;

    let raf = 0;
    let disposed = false;
    const start = performance.now();

    // --- Renderer + scene ---
    const renderer = new WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new Color(0x000000), 1);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;';

    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Fullscreen quad with a custom "CRT boot" shader: pinch dot -> horizontal line -> noisy field.
    const bootMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Vector2(window.innerWidth, window.innerHeight),
        },
        uDotFlash: { value: 0 },
        uLineStretch: { value: 0 },
        uStaticBurst: { value: 0 },
        uSettle: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uDotFlash;
        uniform float uLineStretch;
        uniform float uStaticBurst;
        uniform float uSettle;

        // Hash noise
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 uv = vUv;
          vec2 centered = uv - 0.5;
          float aspect = uResolution.x / uResolution.y;
          centered.x *= aspect;

          float dist = length(centered);

          // 1) Pinch dot: tight bright circle that bleeds out
          float dot = uDotFlash * smoothstep(0.06, 0.0, dist) * 4.0;

          // 2) Horizontal line stretch (degauss line)
          float lineY = abs(centered.y);
          float lineX = abs(centered.x);
          float lineMask = smoothstep(0.004, 0.0, lineY) * smoothstep(0.6, 0.0, lineX);
          float line = uLineStretch * lineMask * 3.0;

          // 3) Static noise field
          float n = hash(uv * uResolution.xy * 0.5 + uTime * 60.0);
          // Add horizontal roll bar
          float roll = sin(uv.y * 30.0 + uTime * 4.0) * 0.5 + 0.5;
          roll = pow(roll, 8.0) * 0.4;
          float staticField = (n * 0.85 + roll) * uStaticBurst;

          // 4) Settled image: dark with faint signal
          float settled = uSettle * (0.02 + n * 0.04);

          float lum = dot + line + staticField + settled;

          // Tint static slightly cool, settled signal warm-neutral
          vec3 staticTint = vec3(0.92, 0.95, 1.0);
          vec3 lineTint = vec3(1.0, 0.98, 0.9);
          vec3 col = mix(staticTint, lineTint, uLineStretch) * lum;

          // RGB phosphor cell stripe (subtle)
          float stripe = mod(gl_FragCoord.x, 3.0);
          if (stripe < 1.0) col *= vec3(1.05, 0.95, 0.95);
          else if (stripe < 2.0) col *= vec3(0.95, 1.05, 0.95);
          else col *= vec3(0.95, 0.95, 1.05);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const quad = new Mesh(new PlaneGeometry(2, 2), bootMaterial);
    scene.add(quad);

    // --- Effect composer ---
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const chromatic = new ChromaticAberrationEffect({
      offset: new Vector2(0.006, 0.0),
      radialModulation: true,
      modulationOffset: 0.3,
    });

    const noise = new NoiseEffect({
      blendFunction: BlendFunction.SCREEN,
      premultiply: true,
    });
    noise.blendMode.opacity.value = 0.35;

    const scanline = new ScanlineEffect({
      density: 1.5,
      blendFunction: BlendFunction.OVERLAY,
    });
    scanline.blendMode.opacity.value = 0.5;

    const glitch = new GlitchEffect({
      delay: new Vector2(0.15, 0.4),
      duration: new Vector2(0.1, 0.25),
      strength: new Vector2(0.4, 0.8),
      ratio: 0.5,
      columns: 0.02,
    });

    const bloom = new BloomEffect({
      intensity: 1.4,
      luminanceThreshold: 0.4,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
    });

    const vignette = new VignetteEffect({
      offset: 0.25,
      darkness: 0.85,
    });

    composer.addPass(new EffectPass(camera, chromatic, noise, scanline, bloom));
    composer.addPass(new EffectPass(camera, glitch, vignette));

    // --- Resize ---
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bootMaterial.uniforms.uResolution.value.set(w, h);
    };
    window.addEventListener('resize', onResize);

    // E: Warm-up render. Forces shader compile + GPU upload now so phase 1
    // doesn't stall. Render with zeroed uniforms (invisible black frame).
    bootMaterial.uniforms.uDotFlash.value = 0;
    bootMaterial.uniforms.uLineStretch.value = 0;
    bootMaterial.uniforms.uStaticBurst.value = 0;
    bootMaterial.uniforms.uSettle.value = 0;
    composer.render();

    // --- Animate ---
    const tick = (now) => {
      if (disposed) return;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION_MS);
      const env = envelope(t);

      bootMaterial.uniforms.uTime.value = elapsed / 1000;
      bootMaterial.uniforms.uDotFlash.value = env.dotFlash;
      bootMaterial.uniforms.uLineStretch.value = env.lineStretch;
      bootMaterial.uniforms.uStaticBurst.value = env.staticBurst;
      bootMaterial.uniforms.uSettle.value = env.settle;

      // Drive effect intensities by phase
      const chromaAmount = 0.012 * env.staticBurst + 0.003;
      chromatic.offset.set(chromaAmount, chromaAmount * 0.3);

      noise.blendMode.opacity.value = 0.55 * env.staticBurst + 0.05;
      scanline.blendMode.opacity.value = 0.2 + 0.4 * (1 - env.settle);
      bloom.intensity = 1.2 + env.dotFlash * 3.0 + env.lineStretch * 1.5;
      glitch.minStrength = 0.0;
      glitch.maxStrength = env.staticBurst * 0.9;

      // Mount-level fade at the very end
      mount.style.opacity = String(env.opacity);

      composer.render();

      if (t >= 1) {
        onComplete?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      composer.dispose();
      bootMaterial.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reduced, onComplete]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-[9999] bg-black pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* D: instant CSS first-frame so user sees something <16ms.
          WebGL canvas mounts on top once shader compiles. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#000',
          backgroundImage: `repeating-linear-gradient(
            0deg,
            rgba(255,255,255,0.04) 0px,
            rgba(255,255,255,0.04) 1px,
            transparent 1px,
            transparent 3px
          )`,
        }}
      />
    </div>
  );
}
