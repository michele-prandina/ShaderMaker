# Advanced GLSL Patterns Reference

Comprehensive library of techniques for AI-generated fragment shaders in ShaderMmaker.

---

## 1. SDF Primitives

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdPlane(vec3 p, vec3 n, float h) { return dot(p, n) + h; }

// 2D primitives
float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdBox2D(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
```

## 2. SDF Operations

```glsl
// Boolean operations
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(-d1, d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }

// Smooth operations (k = smoothness, 0.1–1.0)
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

float smax(float a, float b, float k) { return -smin(-a, -b, k); }

// Shell / onion
float opOnion(float d, float thickness) { return abs(d) - thickness; }

// Domain repetition
vec3 opRepeat(vec3 p, vec3 c) { return mod(p + 0.5 * c, c) - 0.5 * c; }

vec3 opRepeatLimited(vec3 p, vec3 c, vec3 lim) {
    return p - c * clamp(round(p / c), -lim, lim);
}

// Polar repetition (N copies around Y axis)
vec2 opPolarRepeat(vec2 p, float n) {
    float angle = TAU / n;
    float a = atan(p.y, p.x) + angle * 0.5;
    a = mod(a, angle) - angle * 0.5;
    return vec2(cos(a), sin(a)) * length(p);
}
```

## 3. Domain Distortions

```glsl
// Twist around Y axis
vec3 opTwist(vec3 p, float k) {
    float c = cos(k * p.y), s = sin(k * p.y);
    return vec3(mat2(c, -s, s, c) * p.xz, p.y);
}

// Bend around X axis
vec3 opBend(vec3 p, float k) {
    float c = cos(k * p.x), s = sin(k * p.x);
    return vec3(p.x, mat2(c, -s, s, c) * p.yz);
}

// Displacement
float opDisplace(vec3 p, float time) {
    return sin(p.x * 3.0 + time) * sin(p.y * 3.0 + time) * sin(p.z * 3.0 + time) * 0.25;
}
```

## 4. Noise Functions

### 3D Simplex Noise (Optimized)

```glsl
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
```

### Worley / Voronoi Noise

```glsl
vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

vec2 worley(vec3 p) {
    vec3 n = floor(p);
    vec3 f = fract(p);
    float F1 = 8.0, F2 = 8.0;

    for (int k = -1; k <= 1; k++)
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
        vec3 g = vec3(i, j, k);
        float d = length(g + hash3(n + g) - f);
        if (d < F1) { F2 = F1; F1 = d; }
        else if (d < F2) { F2 = d; }
    }
    return vec2(F1, F2);
}
```

### FBM Variations

```glsl
// Classic FBM
float fbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5, freq = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        v += a * noise(p * freq);
        freq *= 2.0; a *= 0.5;
    }
    return v;
}

// Ridged multifractal
float ridgedFBM(vec2 p, int octaves) {
    float v = 0.0, a = 0.5, freq = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        float n = 1.0 - abs(noise(p * freq) * 2.0 - 1.0);
        v += a * n * n;
        freq *= 2.0; a *= 0.5;
    }
    return v;
}

// Turbulence (absolute value noise)
float turbulence(vec2 p, int octaves) {
    float v = 0.0, a = 0.5, freq = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        v += a * abs(noise(p * freq) * 2.0 - 1.0);
        freq *= 2.0; a *= 0.5;
    }
    return v;
}
```

### Domain Warping

```glsl
float warpedNoise(vec2 p, float amount, float time) {
    vec2 q = vec2(noise(p), noise(p + vec2(5.2, 1.3)));
    vec2 r = vec2(
        noise(p + amount * q + vec2(1.7, 9.2) + time * 0.1),
        noise(p + amount * q + vec2(8.3, 2.8) + time * 0.15)
    );
    return noise(p + amount * r);
}
```

## 5. Color Functions

### Cosine Palettes (Presets)

```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

// Standard presets (a=0.5, b=0.5, c=1.0 unless noted)
vec3 paletteRainbow(float t) {
    return palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
}
vec3 paletteOcean(float t) {
    return palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.10, 0.20));
}
vec3 paletteSunset(float t) {
    return palette(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.90, 0.30));
}
vec3 paletteCyberpunk(float t) {
    return palette(t, vec3(0.5), vec3(0.5), vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.20));
}
vec3 paletteNature(float t) {
    return palette(t, vec3(0.8, 0.5, 0.4), vec3(0.2, 0.4, 0.2), vec3(2.0, 1.0, 1.0), vec3(0.0, 0.25, 0.25));
}
```

### OKLab Color Space

Perceptually uniform — much better for smooth gradients than RGB lerp.

```glsl
vec3 linearToOklab(vec3 c) {
    const mat3 m1 = mat3(
        0.4122214708, 0.5363325363, 0.0514459929,
        0.2119034982, 0.6806995451, 0.1073969566,
        0.0883024619, 0.2817188376, 0.6299787005
    );
    vec3 lms = m1 * c;
    lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
    const mat3 m2 = mat3(
        0.2104542553, 0.7936177850, -0.0040720468,
        1.9779984951, -2.4285922050, 0.4505937099,
        0.0259040371, 0.7827717662, -0.8086757660
    );
    return m2 * lms;
}

vec3 oklabToLinear(vec3 lab) {
    const mat3 m1 = mat3(
        1.0, 0.3963377774, 0.2158037573,
        1.0, -0.1055613458, -0.0638541728,
        1.0, -0.0894841775, -1.2914855480
    );
    vec3 lms = m1 * lab;
    lms = lms * lms * lms;
    const mat3 m2 = mat3(
        4.0767416621, -3.3077115913, 0.2309699292,
        -1.2684380046, 2.6097574011, -0.3413193965,
        -0.0041960863, -0.7034186147, 1.7076147010
    );
    return m2 * lms;
}

// Smooth color mixing in OKLab
vec3 smoothMix(vec3 a, vec3 b, float t) {
    vec3 labA = linearToOklab(pow(a, vec3(2.2)));
    vec3 labB = linearToOklab(pow(b, vec3(2.2)));
    return pow(oklabToLinear(mix(labA, labB, t)), vec3(1.0 / 2.2));
}
```

### HSV to RGB

```glsl
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
```

## 6. Lighting & Shading

### Soft Shadows (for raymarching)

```glsl
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    float ph = 1e20;
    for (int i = 0; i < 64; i++) {
        float h = map(ro + rd * t);
        if (h < 0.001) return 0.0;
        float y = h * h / (2.0 * ph);
        float d = sqrt(max(h * h - y * y, 0.0));
        res = min(res, k * d / max(0.0, t - y));
        ph = h;
        t += h;
        if (t > maxt) break;
    }
    return res;
}
```

### Ambient Occlusion

```glsl
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        occ += (h - map(p + h * n)) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}
```

### Specular / Fresnel

```glsl
float specularBlinn(vec3 n, vec3 l, vec3 v, float shininess) {
    return pow(max(dot(n, normalize(l + v)), 0.0), shininess);
}

float fresnel(float cosTheta, float f0) {
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

float rimLight(vec3 n, vec3 v, float power) {
    return pow(1.0 - max(dot(n, v), 0.0), power);
}
```

## 7. Post-Processing

```glsl
// ACES filmic tone mapping
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Vignette
vec3 vignette(vec3 col, vec2 uv, float strength) {
    return col * mix(1.0, smoothstep(0.8, 0.4, length(uv)), strength);
}

// Simple bloom (threshold + boost)
vec3 bloom(vec3 color, float threshold, float intensity) {
    return color + max(color - threshold, 0.0) * intensity;
}

// Anti-banding dither
vec3 dither(vec3 color, vec2 fragCoord, float time) {
    return color + vec3(hash(fragCoord + time)) / 255.0;
}

// Gamma correction
vec3 toGamma(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
```

## 8. Effect Recipes

### Galaxy / Nebula

```glsl
vec3 galaxy(vec2 uv, float time) {
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Spiral arms
    angle += radius * 3.0 - time * 0.1;
    vec2 spiral = vec2(cos(angle), sin(angle)) * radius;

    // Nebula clouds
    float nebula = fbm(spiral * 3.0 + time * 0.05, 5);

    // Stars
    float stars = pow(hash(floor(uv * 200.0)), 20.0);

    vec3 color = paletteRainbow(nebula + time * 0.02) * nebula;
    color += stars * 1.5;
    color *= smoothstep(1.5, 0.0, radius); // fade edges
    return color;
}
```

### Aurora Borealis

```glsl
vec3 aurora(vec2 uv, float time) {
    float wave = sin(uv.x * 3.0 + time) * 0.1 + sin(uv.x * 5.0 - time * 0.7) * 0.05;
    float bands = fbm(vec2(uv.x * 2.0, uv.y + wave + time * 0.1), 5);
    bands *= smoothstep(0.2, 0.7, uv.y + 0.5); // vertical fade
    vec3 col = mix(vec3(0.0, 1.0, 0.5), vec3(0.5, 0.0, 1.0),
                   sin(uv.x * 2.0 + time) * 0.5 + 0.5);
    return col * bands * 1.5;
}
```

### Fire

```glsl
vec3 fire(vec2 uv, float time) {
    vec2 p = uv;
    p.y -= time * 0.3;
    float n = fbm(p * 3.0, 6) + fbm(p * 6.0 + vec2(time * 0.5, 0.0), 4) * 0.5;
    float shape = (1.0 - (uv.y + 0.5)) * smoothstep(0.6, 0.0, abs(uv.x));
    float intensity = pow(shape * (n + 0.5), 1.5);

    vec3 col = vec3(0.0);
    col += vec3(1.5, 1.2, 0.2) * smoothstep(0.3, 0.6, intensity);
    col += vec3(1.0, 0.3, 0.0) * smoothstep(0.5, 0.8, intensity);
    col += vec3(0.2, 0.0, 0.0) * smoothstep(0.7, 1.0, intensity);
    return col;
}
```

### Cyberpunk / Neon

```glsl
vec3 cyberpunk(vec2 uv, float time) {
    vec3 col = vec3(0.0);

    // Grid
    vec2 grid = abs(fract(uv * 10.0) - 0.5);
    float gridLine = min(grid.x, grid.y);
    col += 0.01 / (gridLine * gridLine + 0.001) * vec3(0.0, 0.5, 1.0) * 0.01;

    // Neon line
    float line = abs(uv.y - sin(uv.x * 3.0 + time) * 0.3);
    col += 0.005 / (line * line + 0.001) * vec3(1.0, 0.0, 1.0) * 0.05;

    // Scanlines
    col *= 0.9 + 0.1 * sin(uv.y * 100.0 - time * 10.0);

    return col;
}
```

### Fractal Mandelbulb (Volumetric Glow)

```glsl
float mandelbulb(vec3 pos, float power) {
    vec3 z = pos;
    float dr = 1.0, r = 0.0;
    for (int i = 0; i < 8; i++) {
        r = length(z);
        if (r > 2.0) break;
        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;
        float zr = pow(r, power);
        z = zr * vec3(sin(theta * power) * cos(phi * power),
                      sin(phi * power) * sin(theta * power),
                      cos(theta * power)) + pos;
    }
    return 0.5 * log(r) * r / dr;
}
```

### Holographic / Iridescent

```glsl
vec3 holographic(vec2 uv, float time) {
    float angle = atan(uv.y, uv.x);
    float dist = length(uv);
    float fresnel = pow(dist, 2.0);
    float interference = sin((fresnel * 20.0 + angle * 3.0 + time) * 3.0) * 0.5 + 0.5;
    vec3 rainbow = paletteRainbow(fresnel + time * 0.1);
    vec3 col = rainbow * (0.5 + interference * 0.5);
    col *= 0.8 + 0.2 * sin(uv.y * 100.0 + time * 5.0); // scanlines
    return col;
}
```

### Ocean / Water

```glsl
vec3 gerstnerWave(vec2 p, float time, vec2 dir, float steepness, float wavelength) {
    float k = TAU / wavelength;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(dir);
    float f = k * (dot(d, p) - c * time);
    float a = steepness / k;
    return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}

vec3 ocean(vec2 uv, float time) {
    vec3 wave = vec3(0.0);
    wave += gerstnerWave(uv, time, vec2(1, 0), 0.25, 0.6);
    wave += gerstnerWave(uv, time * 0.8, vec2(0, 1), 0.15, 0.4);
    wave += gerstnerWave(uv, time * 1.3, vec2(1, 1), 0.1, 0.2);

    vec3 normal = normalize(vec3(-wave.x, 1.0, -wave.z));
    float diff = max(dot(normal, normalize(vec3(1, 1, 0))), 0.0);
    float fres = pow(1.0 - diff, 3.0);

    return mix(vec3(0.0, 0.05, 0.15), vec3(0.0, 0.3, 0.5), diff) + fres * 0.5;
}
```

### Crystal / Gem

```glsl
vec3 crystal(vec2 uv, float time) {
    vec2 facet = floor(uv * 8.0);
    vec2 fuv = fract(uv * 8.0) - 0.5;
    float angle = atan(fuv.y, fuv.x);
    vec2 offset = vec2(cos(angle), sin(angle)) * 0.1;

    // Chromatic dispersion
    vec3 col = vec3(
        1.0 - length(fuv + offset * 1.1),
        1.0 - length(fuv + offset),
        1.0 - length(fuv + offset * 0.9)
    );
    col += fbm(facet + time * 0.1, 3) * 0.3; // internal reflections
    col += smoothstep(0.4, 0.5, length(fuv)) * 0.5; // facet edges
    return col;
}
```

## 9. Animation Helpers

```glsl
// Easing functions
float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

float easeOutElastic(float t) {
    float c4 = TAU / 3.0;
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    return pow(2.0, -10.0 * t) * sin((t * 10.0 - 0.75) * c4) + 1.0;
}

// Beat / pulse
float beatPulse(float time, float bpm) {
    float beatDuration = 60.0 / bpm;
    return exp(-5.0 * mod(time, beatDuration) / beatDuration);
}

// Smootherstep (C2 continuous)
float smootherstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
```

## 10. Camera Setup (for Raymarching)

```glsl
mat3 setCamera(vec3 ro, vec3 ta, float roll) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(roll), cos(roll), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

// Usage in main():
// mat3 cam = setCamera(ro, target, 0.0);
// vec3 rd = cam * normalize(vec3(uv, 1.5)); // 1.5 = focal length
```

## 11. 3D Rotation Matrices

```glsl
mat3 rotateX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1,0,0, 0,c,-s, 0,s,c);
}
mat3 rotateY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0,s, 0,1,0, -s,0,c);
}
mat3 rotateZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0, s,c,0, 0,0,1);
}
```
