import type { UniformDef, UniformType } from '@/types/shader';

/** Built-in uniforms that the renderer sets automatically. */
const BUILTIN_UNIFORMS = new Set(['u_resolution', 'u_time', 'u_mouse']);

/** Supported GLSL types that map to controllable uniforms. */
const SUPPORTED_TYPES = new Set<UniformType>([
  'float',
  'int',
  'vec2',
  'vec3',
  'vec4',
]);

/**
 * Parse uniform declarations from GLSL source code and return an array of
 * `UniformDef` objects. Built-in uniforms (u_resolution, u_time, u_mouse) are
 * automatically skipped.
 *
 * The parser recognises optional inline range/default/step hints in trailing
 * comments, for example:
 *
 *   uniform float u_zoom; // range: 0.1, 10.0, default: 1.0
 *   uniform vec2  u_center; // range: -2.0, 2.0, default: -0.5, 0.0
 *   uniform float u_cells; // range: 2.0, 20.0, default: 8.0, step: 1.0
 */
export function parseUniforms(code: string): UniformDef[] {
  const uniforms: UniformDef[] = [];

  // Match: uniform <type> <name>; with optional trailing comment
  const uniformRegex =
    /uniform\s+(float|int|vec2|vec3|vec4)\s+(\w+)\s*;([^\n]*)/g;

  let match: RegExpExecArray | null;

  while ((match = uniformRegex.exec(code)) !== null) {
    const type = match[1] as UniformType;
    const name = match[2];
    const comment = match[3] || '';

    // Skip built-in uniforms
    if (BUILTIN_UNIFORMS.has(name)) continue;

    // Skip unsupported types (shouldn't happen given the regex, but be safe)
    if (!SUPPORTED_TYPES.has(type)) continue;

    // Start with sensible defaults for this type
    const def = getDefaults(type, name);

    // Try to parse range/default/step hints from the trailing comment
    parseComment(comment, type, def);

    uniforms.push(def);
  }

  return uniforms;
}

/** Return sensible default UniformDef values for a given type. */
function getDefaults(type: UniformType, name: string): UniformDef {
  switch (type) {
    case 'float':
      return { name, type, value: 0.5, min: 0.0, max: 1.0, step: 0.01 };

    case 'int':
      return { name, type, value: 1, min: 0, max: 10, step: 1 };

    case 'vec2':
      return {
        name,
        type,
        value: [0.0, 0.0],
        min: -1.0,
        max: 1.0,
        step: 0.01,
      };

    case 'vec3': {
      const isColor = name.toLowerCase().includes('color');
      return {
        name,
        type,
        value: isColor ? [1.0, 1.0, 1.0] : [0.0, 0.0, 0.0],
        min: isColor ? 0.0 : -1.0,
        max: 1.0,
        step: 0.01,
      };
    }

    case 'vec4':
      return {
        name,
        type,
        value: [0.0, 0.0, 0.0, 1.0],
        min: 0.0,
        max: 1.0,
        step: 0.01,
      };
  }
}

/**
 * Parse a trailing comment for range, default, and step hints.
 * Supports formats like:
 *   // range: 0.1, 10.0, default: 1.0
 *   // range: -2.0, 2.0, default: -0.5, 0.0
 *   // range: 2.0, 20.0, default: 8.0, step: 1.0
 */
function parseComment(comment: string, type: UniformType, def: UniformDef): void {
  // Strip leading "//" if present
  const stripped = comment.replace(/^\s*\/\/\s*/, '').trim();
  if (!stripped) return;

  // Parse range: min, max
  const rangeMatch = stripped.match(
    /range:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    def.min = parseFloat(rangeMatch[1]);
    def.max = parseFloat(rangeMatch[2]);
  }

  // Parse default: value(s)
  // For vec types this could be multiple comma-separated numbers
  const defaultMatch = stripped.match(
    /default:\s*((?:[+-]?\d+(?:\.\d+)?(?:\s*,\s*)?)+)/
  );
  if (defaultMatch) {
    const rawValues = defaultMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(parseFloat);

    if (type === 'float' || type === 'int') {
      def.value = type === 'int' ? Math.round(rawValues[0]) : rawValues[0];
    } else {
      // vec2, vec3, vec4 - use as many values as provided, keep defaults for rest
      const currentArr = def.value as number[];
      const componentCount = currentArr.length;
      const newArr = [...currentArr];
      for (let i = 0; i < Math.min(rawValues.length, componentCount); i++) {
        newArr[i] = rawValues[i];
      }
      def.value = newArr;
    }
  }

  // Parse step: value
  const stepMatch = stripped.match(/step:\s*([+-]?\d+(?:\.\d+)?)/);
  if (stepMatch) {
    def.step = parseFloat(stepMatch[1]);
  }
}
