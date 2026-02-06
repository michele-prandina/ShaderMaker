/**
 * WebGL 2.0 shader compilation and program linking utilities.
 *
 * Provides structured error reporting with line numbers parsed from the
 * driver's info log (format: "ERROR: 0:LINE: message").
 */

import type { CompileResult } from '@/types/shader';

/**
 * Parse a WebGL info log string into an array of structured errors.
 *
 * Most drivers produce lines that look like:
 *   ERROR: 0:12: 'foo' : undeclared identifier
 *
 * We extract the line number and the remainder as the message.
 * Lines that don't match the pattern are kept with line = 0.
 */
function parseInfoLog(log: string): { line: number; message: string }[] {
  if (!log || log.trim().length === 0) return [];

  const errors: { line: number; message: string }[] = [];
  const lines = log.split('\n');

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    // Match patterns like "ERROR: 0:12: message" or "WARNING: 0:5: message"
    const match = trimmed.match(/^(?:ERROR|WARNING):\s*\d+:(\d+):\s*(.+)/i);
    if (match) {
      errors.push({
        line: parseInt(match[1], 10),
        message: match[2].trim(),
      });
    } else {
      // Keep unrecognised log lines with line 0 so nothing is silently lost
      errors.push({ line: 0, message: trimmed });
    }
  }

  return errors;
}

/**
 * Compile a single shader (vertex or fragment).
 *
 * @param gl   - The WebGL 2 rendering context.
 * @param source - GLSL ES 3.00 source code.
 * @param type - `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`.
 * @returns A result object with the compiled shader on success, or parsed
 *          errors on failure.
 */
export function compileShader(
  gl: WebGL2RenderingContext,
  source: string,
  type: number,
): { success: boolean; shader: WebGLShader | null; errors: { line: number; message: string }[] } {
  const shader = gl.createShader(type);
  if (!shader) {
    return {
      success: false,
      shader: null,
      errors: [{ line: 0, message: 'Failed to create shader object' }],
    };
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    const errors = parseInfoLog(log);
    gl.deleteShader(shader);
    return { success: false, shader: null, errors };
  }

  return { success: true, shader, errors: [] };
}

/**
 * Link a vertex and fragment shader into a program.
 *
 * @returns A result object with the linked program on success, or parsed
 *          errors on failure.
 */
export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): { success: boolean; program: WebGLProgram | null; errors: { line: number; message: string }[] } {
  const program = gl.createProgram();
  if (!program) {
    return {
      success: false,
      program: null,
      errors: [{ line: 0, message: 'Failed to create program object' }],
    };
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? '';
    const errors = parseInfoLog(log);
    gl.deleteProgram(program);
    return { success: false, program: null, errors };
  }

  return { success: true, program, errors: [] };
}
