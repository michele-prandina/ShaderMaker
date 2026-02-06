/**
 * Capture a 128x128 PNG thumbnail from a fragment shader.
 *
 * Creates a temporary offscreen canvas, renders one frame at t=1.0,
 * and returns the result as a data-URL string.
 */

import { WebGLRenderer } from './renderer';

/** Thumbnail size in pixels. */
const SIZE = 128;

/**
 * Render a single frame of the given fragment shader code and return the
 * canvas contents as a `data:image/png` URL.
 *
 * @param code  GLSL ES 3.00 fragment shader source.
 * @returns     A data-URL string on success, or `null` if compilation or
 *              rendering failed.
 */
export function captureThumbnail(code: string): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const renderer = new WebGLRenderer();

  // We need preserveDrawingBuffer so toDataURL can read pixels after the
  // draw call completes.
  const ok = renderer.init(canvas, { preserveDrawingBuffer: true });
  if (!ok) {
    return null;
  }

  const compileResult = renderer.compile(code);
  if (!compileResult.success) {
    renderer.destroy();
    return null;
  }

  // Render a single frame at time = 1.0 second.
  renderer.render(1.0, [SIZE, SIZE], [0, 0]);

  let dataUrl: string | null = null;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    dataUrl = null;
  }

  renderer.destroy();
  return dataUrl;
}
