// Raw WebGL renderer for the TV intro: one fullscreen triangle, one fragment
// shader doing dot, line, static, tearing, fringe, roll bar, scanlines and
// vignette in a single pass. Replaces three.js + postprocessing (~145KB gzip).

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform float uDot;
uniform float uLine;
uniform float uStatic;
uniform float uBacking;
uniform float uRoll;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Dot + line brightness, with a soft halo standing in for bloom.
float beam(vec2 c) {
  float d = length(c);
  float dotL = uDot * (smoothstep(0.05, 0.0, d) * 3.0 + exp(-d * d * 60.0) * 1.2);
  float lx = abs(c.x);
  float ly = abs(c.y);
  float lineL = uLine * (smoothstep(0.004, 0.0, ly) * smoothstep(0.7, 0.0, lx) * 2.5
    + exp(-ly * ly * 3000.0) * smoothstep(0.9, 0.0, lx) * 0.6);
  return dotL + lineL;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float frame = floor(uTime * 60.0);
  vec2 jitter = floor(fract(frame * vec2(0.1234, 0.5678)) * 997.0);

  // Tearing: random bands jump sideways while the static is up.
  float band = floor(uv.y * 28.0);
  float slow = floor(uTime * 12.0);
  float tear = step(0.88, hash(vec2(band, slow))) * (hash(vec2(band + 7.0, slow)) - 0.5) * 0.12 * uStatic;

  vec2 c = vec2(uv.x + tear - 0.5, uv.y - 0.5);
  c.x *= uRes.x / uRes.y;

  // Chromatic fringe: red and blue beams sampled a little apart.
  float fringe = 0.004 + 0.01 * uStatic;
  vec3 col = vec3(beam(c + vec2(fringe, 0.0)), beam(c), beam(c - vec2(fringe, 0.0)))
    * vec3(1.0, 0.98, 0.9);

  // Static: 2px cells, mostly grey with a little color noise and hum bars.
  vec2 cell = floor(gl_FragCoord.xy * 0.5) + vec2(floor(tear * uRes.x * 0.5), 0.0) + jitter;
  float n = smoothstep(0.12, 0.92, hash(cell)); // push toward black/white
  vec3 tint = vec3(hash(cell + 3.1), hash(cell + 5.3), hash(cell + 7.7)) - 0.5;
  float hum = pow(sin(uv.y * 9.0 + uTime * 5.0) * 0.5 + 0.5, 6.0) * 0.25;
  col += (vec3(0.92, 0.95, 1.0) * n * 0.85 + tint * 0.12 + hum) * uStatic;

  // Roll bar sweeping down while the signal locks. uRoll 0 = top edge.
  if (uRoll > -0.5) {
    float y = (1.0 - uv.y) - uRoll;
    col += exp(-y * y * 80.0) * 0.3 * vec3(0.9, 0.95, 1.0);
  }

  // Scanlines (3px) and RGB phosphor stripes.
  col *= 0.78 + 0.22 * sin(gl_FragCoord.y * 2.0944);
  float stripe = mod(gl_FragCoord.x, 3.0);
  col *= stripe < 1.0 ? vec3(1.06, 0.95, 0.95)
    : (stripe < 2.0 ? vec3(0.95, 1.06, 0.95) : vec3(0.95, 0.95, 1.06));

  vec2 v = uv - 0.5;
  col *= clamp(1.0 - dot(v, v) * 1.6, 0.0, 1.0);

  col = clamp(col, 0.0, 1.0);
  // Premultiplied alpha: the black tube (uBacking) plus whatever light is on it.
  gl_FragColor = vec4(col, clamp(uBacking + max(max(col.r, col.g), col.b), 0.0, 1.0));
}
`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Creates its own canvas inside `mount` (so StrictMode's remount never reuses
// a lost context). Returns null when WebGL is unavailable; the caller falls
// back to CSS static.
export function createCrt(mount) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';

  let gl = null;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  const lose = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (!vs || !fs) {
    lose();
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    lose();
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['uRes', 'uTime', 'uDot', 'uLine', 'uStatic', 'uBacking', 'uRoll'].forEach((name) => {
    u[name] = gl.getUniformLocation(program, name);
  });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  // `f` is a gateFrame() result.
  const render = (timeMs, f) => {
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, timeMs / 1000);
    gl.uniform1f(u.uDot, f.dot);
    gl.uniform1f(u.uLine, f.line);
    gl.uniform1f(u.uStatic, f.stat);
    gl.uniform1f(u.uBacking, f.backing);
    gl.uniform1f(u.uRoll, f.roll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    lose();
    canvas.remove();
  };

  mount.appendChild(canvas);
  resize();
  // Warm-up: compile and upload now (an all-black frame, same as the standby
  // screen) so the first frame after the press doesn't stall.
  render(0, { dot: 0, line: 0, stat: 0, backing: 1, roll: -1 });

  return { render, resize, dispose };
}
