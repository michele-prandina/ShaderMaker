/**
 * WebGL 2.0 renderer for fullscreen fragment shaders.
 *
 * Uses a single fullscreen triangle (no vertex buffers) and provides built-in
 * uniforms for time, resolution, and mouse position, plus support for
 * arbitrary custom uniforms.
 */

import type { CompileResult } from '@/types/shader';
import { VERTEX_SHADER_SOURCE } from './fullscreen-quad';
import { compileShader, linkProgram } from './shader-compiler';

/** Internal bookkeeping for a custom uniform. */
interface CustomUniformEntry {
  location: WebGLUniformLocation | null;
  value: number | number[];
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;
  private vertexShader: WebGLShader | null = null;
  private fragmentShader: WebGLShader | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private rafId: number | null = null;
  private startTime = 0;
  private mousePos: [number, number] = [0, 0];
  private customUniforms: Map<string, CustomUniformEntry> = new Map();
  private contextLost = false;
  private preserveDrawingBuffer = false;

  /** Cached built-in uniform locations (refreshed after each compile). */
  private uTime: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uMouse: WebGLUniformLocation | null = null;

  /** Saved fragment source so we can re-compile on context restore. */
  private lastFragmentSource: string | null = null;

  // Bound event handlers so we can properly remove them.
  private handleContextLost: ((e: Event) => void) | null = null;
  private handleContextRestored: ((e: Event) => void) | null = null;

  /**
   * Initialise the renderer on the given canvas element.
   *
   * @param canvas  The target `<canvas>`.
   * @param options Optional settings -- set `preserveDrawingBuffer` to `true`
   *               when you need to read pixels back (e.g. thumbnail capture).
   * @returns `true` if WebGL 2 is available, `false` otherwise.
   */
  init(
    canvas: HTMLCanvasElement,
    options?: { preserveDrawingBuffer?: boolean },
  ): boolean {
    this.preserveDrawingBuffer = options?.preserveDrawingBuffer ?? false;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: this.preserveDrawingBuffer,
    });

    if (!gl) return false;

    this.gl = gl;
    this.canvas = canvas;
    this.contextLost = false;

    // Create the VAO used for the fullscreen triangle draw call.
    this.vao = gl.createVertexArray();

    // -- Context loss / restore listeners --------------------------------
    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.stopLoop();
    };

    this.handleContextRestored = () => {
      this.contextLost = false;
      this.reInit();
    };

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    return true;
  }

  /**
   * Re-initialise internal GL state after a context restore event.
   * Re-creates the VAO and re-compiles the last known fragment shader.
   */
  private reInit(): void {
    const gl = this.gl;
    if (!gl) return;

    this.vao = gl.createVertexArray();

    if (this.lastFragmentSource) {
      this.compile(this.lastFragmentSource);
    }
  }

  /**
   * Compile a fragment shader, link it with the built-in vertex shader,
   * and cache uniform locations.
   */
  compile(fragmentSource: string): CompileResult {
    const gl = this.gl;
    if (!gl) {
      return {
        success: false,
        errors: [{ line: 0, message: 'WebGL context not initialised' }],
      };
    }

    // Remember the source for potential context-restore recompilation.
    this.lastFragmentSource = fragmentSource;

    // -- Vertex shader ---------------------------------------------------
    const vertResult = compileShader(gl, VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    if (!vertResult.success) {
      return { success: false, errors: vertResult.errors };
    }

    // -- Fragment shader -------------------------------------------------
    const fragResult = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
    if (!fragResult.success) {
      // Clean up the vertex shader we just created.
      if (vertResult.shader) gl.deleteShader(vertResult.shader);
      return { success: false, errors: fragResult.errors };
    }

    // -- Link program ----------------------------------------------------
    const linkResult = linkProgram(gl, vertResult.shader!, fragResult.shader!);
    if (!linkResult.success) {
      gl.deleteShader(vertResult.shader);
      gl.deleteShader(fragResult.shader);
      return { success: false, errors: linkResult.errors };
    }

    // Dispose of the previous program/shaders if present.
    this.deleteProgram();

    this.vertexShader = vertResult.shader;
    this.fragmentShader = fragResult.shader;
    this.program = linkResult.program;

    // Cache built-in uniform locations.
    this.uTime = gl.getUniformLocation(this.program!, 'u_time');
    this.uResolution = gl.getUniformLocation(this.program!, 'u_resolution');
    this.uMouse = gl.getUniformLocation(this.program!, 'u_mouse');

    // Re-resolve custom uniform locations against the new program.
    for (const [name, entry] of this.customUniforms) {
      entry.location = gl.getUniformLocation(this.program!, name);
    }

    return { success: true, errors: [] };
  }

  /**
   * Register (or update) a custom uniform value.
   *
   * The type is inferred from the value:
   * - `number`       -> float
   * - `[x, y]`       -> vec2
   * - `[x, y, z]`    -> vec3
   * - `[x, y, z, w]` -> vec4
   */
  setCustomUniform(name: string, value: number | number[]): void {
    const gl = this.gl;
    const location = gl && this.program
      ? gl.getUniformLocation(this.program, name)
      : null;

    this.customUniforms.set(name, { location, value });
  }

  /** Update the mouse position (in pixels, origin bottom-left). */
  setMouse(x: number, y: number): void {
    this.mousePos = [x, y];
  }

  /**
   * Render a single frame.
   *
   * @param time       Elapsed time in seconds.
   * @param resolution Canvas resolution as `[width, height]`.
   * @param mouse      Mouse position as `[x, y]` in pixels.
   */
  render(time: number, resolution: [number, number], mouse: [number, number]): void {
    const gl = this.gl;
    if (!gl || !this.program || this.contextLost) return;

    gl.viewport(0, 0, resolution[0], resolution[1]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Built-in uniforms.
    if (this.uTime !== null) gl.uniform1f(this.uTime, time);
    if (this.uResolution !== null) gl.uniform2f(this.uResolution, resolution[0], resolution[1]);
    if (this.uMouse !== null) gl.uniform2f(this.uMouse, mouse[0], mouse[1]);

    // Custom uniforms.
    for (const [, entry] of this.customUniforms) {
      if (entry.location === null) continue;
      const v = entry.value;
      if (typeof v === 'number') {
        gl.uniform1f(entry.location, v);
      } else if (Array.isArray(v)) {
        switch (v.length) {
          case 2: gl.uniform2f(entry.location, v[0], v[1]); break;
          case 3: gl.uniform3f(entry.location, v[0], v[1], v[2]); break;
          case 4: gl.uniform4f(entry.location, v[0], v[1], v[2], v[3]); break;
        }
      }
    }

    // Draw the fullscreen triangle.
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /**
   * Start a `requestAnimationFrame` loop that continuously renders.
   * Time is measured from the moment this method is first called.
   */
  startLoop(): void {
    if (this.rafId !== null) return; // already running

    this.startTime = performance.now() / 1000;

    const tick = () => {
      if (this.contextLost) {
        this.rafId = null;
        return;
      }

      const now = performance.now() / 1000;
      const elapsed = now - this.startTime;

      const width = this.canvas?.width ?? 0;
      const height = this.canvas?.height ?? 0;

      this.render(elapsed, [width, height], this.mousePos);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /** Stop the render loop. */
  stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Resize the canvas and update the WebGL viewport accordingly. */
  resize(width: number, height: number): void {
    if (!this.canvas || !this.gl) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Clean up all GPU resources and remove event listeners.
   * The renderer is unusable after this call.
   */
  destroy(): void {
    this.stopLoop();

    const gl = this.gl;
    if (gl) {
      this.deleteProgram();

      if (this.vao) {
        gl.deleteVertexArray(this.vao);
        this.vao = null;
      }

      // Trigger context loss so the browser can reclaim GPU memory promptly.
      const loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }

    // Remove event listeners.
    if (this.canvas) {
      if (this.handleContextLost) {
        this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      }
      if (this.handleContextRestored) {
        this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      }
    }

    this.gl = null;
    this.canvas = null;
    this.customUniforms.clear();
  }

  /** Delete the current program and its attached shaders. */
  private deleteProgram(): void {
    const gl = this.gl;
    if (!gl) return;

    if (this.program) {
      gl.deleteProgram(this.program);
      this.program = null;
    }
    if (this.vertexShader) {
      gl.deleteShader(this.vertexShader);
      this.vertexShader = null;
    }
    if (this.fragmentShader) {
      gl.deleteShader(this.fragmentShader);
      this.fragmentShader = null;
    }

    this.uTime = null;
    this.uResolution = null;
    this.uMouse = null;
  }
}
