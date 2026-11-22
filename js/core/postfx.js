// Cinematic post pass: two-level bloom, colour grade, vignette, grain, chromatic pulse, desaturation.
// The game draws into a 2D canvas; this presents a processed WebGL copy on top of it.

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
const FS_BRIGHT = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform float thr; uniform vec2 px;
void main(){
  vec3 c = texture2D(t, uv + px*vec2(-.5,-.5)).rgb + texture2D(t, uv + px*vec2(.5,-.5)).rgb
         + texture2D(t, uv + px*vec2(-.5,.5)).rgb + texture2D(t, uv + px*vec2(.5,.5)).rgb;
  c *= .25;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(thr, thr + .25, l);
  gl_FragColor = vec4(c * k, 1.);
}`;
const FS_BLUR = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform vec2 dir;
void main(){
  vec3 c = texture2D(t, uv).rgb * .227;
  c += (texture2D(t, uv + dir*1.385).rgb + texture2D(t, uv - dir*1.385).rgb) * .316;
  c += (texture2D(t, uv + dir*3.231).rgb + texture2D(t, uv - dir*3.231).rgb) * .07;
  gl_FragColor = vec4(c, 1.);
}`;
const FS_FINAL = `precision mediump float; varying vec2 uv; uniform sampler2D t, b1, b2; uniform float time, bloom, vig, ab, grain, sat, con, expo, desat, flash;
uniform vec3 tint, lift, flashCol; uniform vec2 res;
float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)) + time*7.13) * 43758.5453); }
void main(){
  vec2 d = (uv - .5);
  vec3 c;
  if (ab > .001) {
    vec2 o = d * ab * .012;
    c = vec3(texture2D(t, uv + o).r, texture2D(t, uv).g, texture2D(t, uv - o).b);
  } else c = texture2D(t, uv).rgb;
  vec3 bl = texture2D(b1, uv).rgb * .8 + texture2D(b2, uv).rgb * 1.1;
  c += bl * bloom;
  c *= expo;
  c = c * tint + lift * (1. - c);
  c = (c - .5) * con + .5;
  float l = dot(c, vec3(.299,.587,.114));
  c = mix(vec3(l), c, sat * (1. - desat));
  float v = smoothstep(.85, .2, length(d * vec2(res.x/res.y, 1.) * .9));
  c *= mix(1. - vig, 1., v);
  c += (rnd(uv * res) - .5) * grain;
  c = mix(c, flashCol, flash);
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;

export function createPostFX(src) {
  const P = {
    enabled: true, bloom: 0.55, thr: 0.62, vig: 0.42, ab: 0, grain: 0.035, sat: 1.06, con: 1.06, expo: 1,
    desat: 0, flash: 0, tint: [1, 1, 1], lift: [0.0, 0.0, 0.0], flashCol: [1, 1, 1],
  };
  const out = document.createElement('canvas');
  out.id = 'fx';
  let gl = null;
  try { gl = out.getContext('webgl', { premultipliedAlpha: false, antialias: false, alpha: false, preserveDrawingBuffer: false }); } catch (e) { gl = null; }
  if (!gl) return { P, ok: false, render() {}, resize() {}, set(o) { Object.assign(P, o); } };
  src.parentNode.insertBefore(out, src.nextSibling);
  src.style.opacity = '0';

  const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = fs => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  };
  let pb, pbl, pf;
  try { pb = prog(FS_BRIGHT); pbl = prog(FS_BLUR); pf = prog(FS_FINAL); }
  catch (e) { out.remove(); src.style.opacity = ''; return { P, ok: false, render() {}, resize() {}, set(o) { Object.assign(P, o); } }; }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const srcTex = tex();
  const fbo = (w, h) => {
    const t = tex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  let A1, A2, B1, B2, W = 0, H = 0;
  function resize(w, h) {
    if (w === W && h === H) return;
    W = w; H = h; out.width = w; out.height = h;
    const q = (n, d) => Math.max(1, Math.round(n / d));
    A1 = fbo(q(w, 4), q(h, 4)); A2 = fbo(q(w, 4), q(h, 4));
    B1 = fbo(q(w, 10), q(h, 10)); B2 = fbo(q(w, 10), q(h, 10));
  }
  const draw = (p, target, setup) => {
    gl.useProgram(p.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
    setup(p.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const bind = (unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); };

  function render(time) {
    if (!P.enabled) return;
    if (!W) return;
    bind(0, srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    draw(pb, A1, u => { bind(0, srcTex); gl.uniform1i(u.t, 0); gl.uniform1f(u.thr, P.thr); gl.uniform2f(u.px, 1 / W, 1 / H); });
    draw(pbl, A2, u => { bind(0, A1.t); gl.uniform1i(u.t, 0); gl.uniform2f(u.dir, 1 / A1.w, 0); });
    draw(pbl, A1, u => { bind(0, A2.t); gl.uniform1i(u.t, 0); gl.uniform2f(u.dir, 0, 1 / A1.h); });
    draw(pbl, B1, u => { bind(0, A1.t); gl.uniform1i(u.t, 0); gl.uniform2f(u.dir, 1.5 / A1.w, 0); });
    draw(pbl, B2, u => { bind(0, B1.t); gl.uniform1i(u.t, 0); gl.uniform2f(u.dir, 1 / B1.w, 0); });
    draw(pbl, B1, u => { bind(0, B2.t); gl.uniform1i(u.t, 0); gl.uniform2f(u.dir, 0, 1 / B1.h); });
    draw(pf, null, u => {
      bind(0, srcTex); bind(1, A1.t); bind(2, B1.t);
      gl.uniform1i(u.t, 0); gl.uniform1i(u.b1, 1); gl.uniform1i(u.b2, 2);
      gl.uniform1f(u.time, time % 100); gl.uniform1f(u.bloom, P.bloom); gl.uniform1f(u.vig, P.vig);
      gl.uniform1f(u.ab, P.ab); gl.uniform1f(u.grain, P.grain); gl.uniform1f(u.sat, P.sat); gl.uniform1f(u.con, P.con);
      gl.uniform1f(u.expo, P.expo); gl.uniform1f(u.desat, P.desat); gl.uniform1f(u.flash, P.flash);
      gl.uniform3fv(u.tint, P.tint); gl.uniform3fv(u.lift, P.lift); gl.uniform3fv(u.flashCol, P.flashCol);
      gl.uniform2f(u.res, W, H);
    });
  }
  function setEnabled(on) {
    P.enabled = on;
    out.style.display = on ? '' : 'none';
    src.style.opacity = on ? '0' : '';
  }
  return { P, ok: true, render, resize, canvas: out, setEnabled, set(o) { Object.assign(P, o); } };
}
