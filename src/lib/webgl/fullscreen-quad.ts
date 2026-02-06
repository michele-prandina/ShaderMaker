/**
 * Fullscreen triangle vertex shader and default fragment shader for WebGL 2.0.
 *
 * The vertex shader draws a single triangle that covers the entire clip space
 * using only gl_VertexID -- no vertex buffers are needed. Three vertices at
 * (-1,-1), (3,-1), (-1,3) form a triangle whose interior fully contains the
 * [-1,1] x [-1,1] clip rectangle.
 */

export const VERTEX_SHADER_SOURCE = `#version 300 es
void main() {
  float x = -1.0 + float((gl_VertexID & 1) << 2);
  float y = -1.0 + float((gl_VertexID >> 1) << 2);
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

export const DEFAULT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  fragColor = vec4(uv, 0.5 + 0.5 * sin(u_time), 1.0);
}
`;
