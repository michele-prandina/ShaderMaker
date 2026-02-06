export const PRESET_SHADERS: { name: string; code: string }[] = [
  // ---------------------------------------------------------------
  // 1. Gradient - Simple UV color gradient
  // ---------------------------------------------------------------
  {
    name: 'Gradient',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    fragColor = vec4(uv, 0.5 + 0.5 * sin(u_time), 1.0);
}
`,
  },

  // ---------------------------------------------------------------
  // 2. Plasma - Classic plasma effect
  // ---------------------------------------------------------------
  {
    name: 'Plasma',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    float v = sin(uv.x * 10.0 + u_time)
            + sin(uv.y * 10.0 + u_time)
            + sin((uv.x + uv.y) * 10.0 + u_time)
            + sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 10.0 + u_time);
    v = v / 4.0;

    fragColor = vec4(
        sin(v * 3.14159),
        sin(v * 3.14159 + 2.094),
        sin(v * 3.14159 + 4.189),
        1.0
    );
}
`,
  },

  // ---------------------------------------------------------------
  // 3. Noise - Value noise with FBM
  // ---------------------------------------------------------------
  {
    name: 'Noise',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

// Hash function for pseudo-random values
float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

// Value noise with bilinear interpolation
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation curve
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion - 3 octaves
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 3; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv * 6.0;

    float n = fbm(p + u_time * 0.4);
    float n2 = fbm(p + vec2(n * 1.5, u_time * 0.3));

    vec3 col = vec3(0.0);
    col = mix(vec3(0.05, 0.1, 0.2), vec3(0.9, 0.6, 0.2), n);
    col = mix(col, vec3(0.2, 0.8, 0.7), n2 * 0.6);

    fragColor = vec4(col, 1.0);
}
`,
  },

  // ---------------------------------------------------------------
  // 4. Raymarching - Basic sphere SDF with ground plane
  // ---------------------------------------------------------------
  {
    name: 'Raymarching',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

// Signed distance function for a sphere
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

// Ground plane at y = -1
float sdPlane(vec3 p) {
    return p.y + 1.0;
}

// Scene: combine sphere and ground plane
float scene(vec3 p) {
    float sphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 0.8);
    float plane = sdPlane(p);
    return min(sphere, plane);
}

// Compute normal via gradient
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        scene(p + e.xyy) - scene(p - e.xyy),
        scene(p + e.yxy) - scene(p - e.yxy),
        scene(p + e.yyx) - scene(p - e.yyx)
    ));
}

// Raymarch the scene
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        float d = scene(p);
        if (d < 0.001) break;
        t += d;
        if (t > 50.0) break;
    }
    return t;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Camera orbits around the origin
    float angle = u_time * 0.5;
    vec3 ro = vec3(3.0 * cos(angle), 1.5, 3.0 * sin(angle));
    vec3 target = vec3(0.0, 0.0, 0.0);

    // Camera basis
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);

    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Raymarch
    float t = raymarch(ro, rd);

    // Shading
    vec3 col = vec3(0.05, 0.05, 0.1); // background

    if (t < 50.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // Light position
        vec3 lightPos = vec3(2.0, 4.0, -1.0);
        vec3 lightDir = normalize(lightPos - p);
        vec3 viewDir = normalize(ro - p);
        vec3 halfDir = normalize(lightDir + viewDir);

        // Diffuse
        float diff = max(dot(n, lightDir), 0.0);

        // Specular (Blinn-Phong)
        float spec = pow(max(dot(n, halfDir), 0.0), 32.0);

        // Ambient
        float amb = 0.15;

        // Material color: checkerboard for floor, solid for sphere
        vec3 matColor;
        if (p.y < -0.99) {
            // Floor - checkerboard
            float check = mod(floor(p.x) + floor(p.z), 2.0);
            matColor = mix(vec3(0.3, 0.3, 0.35), vec3(0.8, 0.8, 0.85), check);
        } else {
            // Sphere
            matColor = vec3(0.8, 0.2, 0.3);
        }

        col = matColor * (amb + diff * 0.8) + vec3(1.0) * spec * 0.5;

        // Fog
        float fog = 1.0 - exp(-0.02 * t * t);
        col = mix(col, vec3(0.05, 0.05, 0.1), fog);
    }

    // Gamma correction
    col = pow(col, vec3(1.0 / 2.2));

    fragColor = vec4(col, 1.0);
}
`,
  },

  // ---------------------------------------------------------------
  // 5. Waves - Animated sine wave pattern
  // ---------------------------------------------------------------
  {
    name: 'Waves',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 center = uv - 0.5;
    float dist = length(center);

    // Multiple concentric wave layers
    float wave1 = sin(dist * 30.0 - u_time * 3.0) * 0.5 + 0.5;
    float wave2 = sin(dist * 20.0 - u_time * 2.0 + 1.5) * 0.5 + 0.5;
    float wave3 = sin(dist * 15.0 - u_time * 4.0 + 3.0) * 0.5 + 0.5;

    // Parallel horizontal wave
    float hwave = sin(uv.y * 20.0 + uv.x * 5.0 - u_time * 2.5) * 0.5 + 0.5;

    // Color channels from different waves
    vec3 col;
    col.r = wave1 * 0.6 + hwave * 0.4;
    col.g = wave2 * 0.5 + wave3 * 0.3;
    col.b = wave3 * 0.7 + wave1 * 0.2;

    // Fade edges
    float vignette = 1.0 - dist * 1.2;
    col *= vignette;

    fragColor = vec4(col, 1.0);
}
`,
  },

  // ---------------------------------------------------------------
  // 6. Fractal - Mandelbrot set
  // ---------------------------------------------------------------
  {
    name: 'Fractal',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

uniform float u_zoom; // range: 0.1, 10.0, default: 1.0
uniform vec2 u_center; // range: -2.0, 2.0, default: -0.5, 0.0

out vec4 fragColor;

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Scale by zoom and offset by center
    vec2 c = uv / u_zoom + u_center;

    vec2 z = vec2(0.0);
    int iter = 0;
    const int MAX_ITER = 100;

    for (int i = 0; i < MAX_ITER; i++) {
        if (dot(z, z) > 4.0) break;
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iter++;
    }

    // Smooth iteration count for better coloring
    float t = float(iter);
    if (iter < MAX_ITER) {
        float log_zn = log(dot(z, z)) / 2.0;
        float nu = log(log_zn / log(2.0)) / log(2.0);
        t = t + 1.0 - nu;
    }

    // Color using cosine palette animated by u_time
    float normalized = t / float(MAX_ITER);
    vec3 col = vec3(0.0);

    if (iter < MAX_ITER) {
        float hue = normalized * 6.0 + u_time * 0.3;
        col = 0.5 + 0.5 * cos(hue + vec3(0.0, 2.094, 4.189));
    }

    fragColor = vec4(col, 1.0);
}
`,
  },

  // ---------------------------------------------------------------
  // 7. Voronoi - Voronoi cell diagram
  // ---------------------------------------------------------------
  {
    name: 'Voronoi',
    code: `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;

uniform float u_cells; // range: 2.0, 20.0, default: 8.0, step: 1.0

out vec4 fragColor;

// Hash function for 2D -> 2D pseudo-random
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 p = uv * u_cells;

    vec2 cellId = vec2(0.0);
    float minDist = 100.0;
    float secondDist = 100.0;

    // Check 3x3 neighborhood
    vec2 ip = floor(p);
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cellOffset = ip + neighbor;

            // Animated cell center
            vec2 rnd = hash2(cellOffset);
            vec2 cellCenter = neighbor + 0.5 + 0.4 * sin(u_time + 6.2831 * rnd) - fract(p);

            float d = dot(cellCenter, cellCenter);
            if (d < minDist) {
                secondDist = minDist;
                minDist = d;
                cellId = cellOffset;
            } else if (d < secondDist) {
                secondDist = d;
            }
        }
    }

    minDist = sqrt(minDist);
    secondDist = sqrt(secondDist);

    // Edge detection
    float edge = secondDist - minDist;

    // Color by cell ID
    vec3 cellColor = 0.5 + 0.5 * cos(6.2831 * hash2(cellId).x + vec3(0.0, 2.094, 4.189));

    // Darken near edges
    vec3 col = cellColor * smoothstep(0.0, 0.05, edge);

    // Subtle highlight at cell center
    col += vec3(0.15) * (1.0 - smoothstep(0.0, 0.15, minDist));

    fragColor = vec4(col, 1.0);
}
`,
  },
];
