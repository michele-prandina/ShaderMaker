export type UniformType = 'float' | 'int' | 'vec2' | 'vec3' | 'vec4';

export interface UniformDef {
  name: string;
  type: UniformType;
  value: number | number[];
  min: number;
  max: number;
  step: number;
}

export interface CompileResult {
  success: boolean;
  errors: { line: number; message: string }[];
}

export interface Shader {
  id: string;
  name: string;
  code: string;
  thumbnail: string | null;
  uniforms: UniformDef[];
  createdAt: number;
  updatedAt: number;
}
