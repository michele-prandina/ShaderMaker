---
name: glsl
description: GLSL ES 3.00 shader generation for ShaderMmaker — AI-powered fragment shader creation from natural language
model: sonnet
risk_level: LOW
version: 2.0.0
---

# GLSL Shader Generation Skill

> **File Organization**: Core patterns inline. See `references/advanced-patterns.md` for SDF library, noise functions, and complete effect recipes.

## 1. Overview

This skill powers AI-generated GLSL ES 3.00 fragment shaders in ShaderMmaker. When a user describes a visual effect in natural language, this skill guides the generation of correct, performant, visually stunning shader code.

**Target**: WebGL 2.0 fullscreen fragment shaders (no vertex shader — fullscreen triangle approach)

**Available Uniforms** (provided by the engine):
- `uniform vec2 u_resolution;` — viewport size in pixels
- `uniform float u_time;` — elapsed time in seconds
- `uniform vec2 u_mouse;` — mouse position in pixels

**Custom Uniforms**: Declared with range comments, auto-detected by the UI:
```glsl
// range: 0.0 - 10.0, default: 5.0
uniform float u_intensity;
```

## 2. Shader Requirements

Every generated shader MUST:

1. Start with `#version 300 es` as the very first line
2. Declare `precision highp float;`
3. Declare `out vec4 fragColor;` (NOT `gl_FragColor`)
4. Use explicit float literals: `1.0` not `1`, `2.0` not `2`
5. Use constant loop bounds with early `break`
6. Guard all divisions: `1.0 / max(d, 0.001)`
7. Include at least `u_resolution` and `u_time` uniforms
8. Output visible content (not just black)
9. Animate with `u_time`
10. Correct aspect ratio: `(gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y`

## 3. Generation Pipeline

```
1. Parse prompt → Extract keywords (style, motion, color, technique)
2. Select template → 2D (simple) or 3D (raymarched)
3. Map keywords → Technique functions (see §5)
4. Generate uniforms → With range comments for UI sliders
5. Assemble helpers → Only include functions actually used
6. Build main scene → Combine techniques
7. Add post-processing → Vignette, ACES tone mapping, gamma
8. Validate → GLSL ES 3.00 compliance check
```

## 4. Templates

### Minimal 2D Template
```glsl
#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// --- Helpers (include only what's needed) ---

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

    // Effect goes here
    vec3 color = vec3(0.0);

    // Post-processing
    color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}
```

### 3D Raymarching Template
```glsl
#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const int MAX_STEPS = 100;
const float MAX_DIST = 100.0;
const float EPSILON = 0.001;

// --- SDF + helpers ---

float map(vec3 p) {
    // Scene definition
    return length(p) - 1.0;
}

vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(EPSILON, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    float t = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < EPSILON || t > MAX_DIST) break;
        t += d;
    }

    vec3 color = vec3(0.0);
    if (t < MAX_DIST) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        color = vec3(max(dot(n, normalize(vec3(1, 2, -1))), 0.0));
    }

    fragColor = vec4(color, 1.0);
}
```

## 5. Keyword-to-Technique Mapping

| User says | Technique | Key function |
|-----------|-----------|-------------|
| swirling, spiral, vortex | Polar coords + angle distortion | `atan(uv.y, uv.x) + radius * k` |
| pulsing, breathing | Sin/cos modulation | `sin(u_time * speed) * 0.5 + 0.5` |
| fractal, recursive | FBM (Fractal Brownian Motion) | `fbm(uv, octaves)` |
| glowing, neon, energy | Inverse-distance glow | `intensity / (d * d + 0.001)` |
| electric, lightning | High-freq noise + threshold | `smoothstep(0.95, 1.0, noise(...))` |
| kaleidoscope, mirrored | Polar repetition | `mod(angle, TAU / N)` |
| flowing, liquid, fluid | Noise-based UV distortion | `uv += noise(uv) * amount` |
| tunnel, warp | Inverse-radius mapping | `vec2(angle/PI, 1.0/dist)` |
| cellular, organic | Voronoi / Worley noise | F1, F2 distances |
| geometric, shapes | SDFs with repetition | `mod(p, period) - period*0.5` |
| galaxy, nebula, stars | FBM + spiral + star particles | Layered approach |
| aurora, northern lights | Vertical noise bands + gradient | Wave distortion |
| ocean, water, waves | Gerstner waves + Fresnel | Layered wave functions |
| crystal, gem | Faceted refraction + dispersion | RGB offset per facet |
| holographic, iridescent | Fresnel + interference | View-dependent rainbow |
| cyberpunk, neon city | SDF glow + scanlines + grid | Neon glow formula |
| fire, flame | Upward FBM + fire gradient | Temperature coloring |
| smoke, clouds | Turbulent FBM + density fade | Volumetric accumulation |
| 3D object, raymarched | SDF scene + lighting | Full raymarch pipeline |

## 6. Essential Helper Functions

### Cosine Palette (IQ's technique — the gold standard)
```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
}

// Presets: pass different d values for different moods
// Rainbow:    d = vec3(0.0, 0.33, 0.67)
// Warm:       d = vec3(0.0, 0.10, 0.20)
// Cool:       d = vec3(0.0, 0.15, 0.20) with c = vec3(1.0, 0.7, 0.4)
// Sunset:     d = vec3(0.8, 0.90, 0.30) with c = vec3(1.0, 1.0, 0.5)
```

### Hash + Noise + FBM
```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5, freq = 1.0;
    for (int i = 0; i < 8; i++) {
        if (i >= octaves) break;
        v += a * noise(p * freq);
        freq *= 2.0;
        a *= 0.5;
    }
    return v;
}
```

### Rotation
```glsl
mat2 rot2D(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}
```

### Post-Processing (always include)
```glsl
// ACES tone mapping (inline version)
vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Vignette
vec3 vignette(vec3 col, vec2 uv, float strength) {
    return col * mix(1.0, smoothstep(0.8, 0.4, length(uv)), strength);
}
```

## 7. Custom Uniform Conventions

Format: `// range: MIN - MAX, default: VALUE`

```glsl
// === COMMON PATTERNS ===

// range: 0.0 - 5.0, default: 1.0
uniform float u_speed;

// range: 0.1 - 5.0, default: 1.0
uniform float u_scale;

// range: 0.0 - 10.0, default: 5.0
uniform float u_glow_intensity;

// range: 0.0 - 1.0, default: 0.5
uniform float u_smoothness;

// range: 0.0 - 6.283, default: 0.0
uniform float u_color_shift;
```

Use `u_` prefix, snake_case, descriptive names. Group related uniforms with common prefixes.

## 8. Quality Checklist

Before returning generated shader code:

- [ ] `#version 300 es` is first line
- [ ] `precision highp float;` declared
- [ ] `out vec4 fragColor;` declared (not gl_FragColor)
- [ ] All number literals are floats: `1.0` not `1`
- [ ] All loops use constant bounds
- [ ] No division by zero possible
- [ ] Uses `u_time` for animation
- [ ] Aspect ratio corrected
- [ ] ACES tone mapping applied
- [ ] Gamma correction: `pow(color, vec3(1.0/2.2))`
- [ ] Custom uniforms have range comments
- [ ] No unused helper functions included
- [ ] Visually produces something (not black screen)

## 9. Anti-Patterns to Avoid

```glsl
// WRONG: Integer in float context
vec2 uv = uv * 2 - 1;
// RIGHT:
vec2 uv = uv * 2.0 - 1.0;

// WRONG: Using gl_FragColor
gl_FragColor = vec4(1.0);
// RIGHT:
fragColor = vec4(1.0);

// WRONG: Dynamic loop bound
for (int i = 0; i < int(u_count); i++) { }
// RIGHT:
const int MAX = 100;
for (int i = 0; i < MAX; i++) {
    if (float(i) >= u_count) break;
}

// WRONG: Unbounded division
float glow = 1.0 / distance;
// RIGHT:
float glow = 1.0 / max(distance, 0.001);

// WRONG: Large time values causing jitter
float t = u_time * 1000.0;
// RIGHT:
float t = mod(u_time, TAU);
```

## 10. Performance Guidelines

1. **Use built-ins**: `length()`, `normalize()`, `distance()`, `clamp()`, `mix()`, `smoothstep()`
2. **Avoid branching**: Use `mix()` + `step()` instead of if/else
3. **Vector ops**: `p * p` instead of per-component scalar multiply
4. **Early exit**: Break from raymarch loops on hit or max distance
5. **Cache texture lookups**: Store `texture(...)` result in variable
6. **Limit raymarching**: 64-128 steps max, adaptive precision `d < 0.001 * t`
7. **FBM octaves**: 4-6 for visual quality, more is diminishing returns
8. **Keep it simple**: 3 similar lines > premature abstraction

---

**References**:
- `references/advanced-patterns.md` — Complete SDF library, noise variants, effect recipes, OKLab color space
