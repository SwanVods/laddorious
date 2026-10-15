import { Color, DoubleSide, ShaderMaterial } from 'three';

// The shield bubble's look (2026-10-15): nearly clear where you look straight through it, glowing along its
// outline like a soap bubble's rim. The first bubble, solid with a band round its middle, looked like a
// hamster ball; the user picked this one.

const VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-viewPosition.xyz);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFill;
uniform float uRim;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  // 0 face-on, 1 along the outline.
  float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
  float alpha = clamp(uFill + uRim * edge, 0.0, 1.0);
  gl_FragColor = vec4(uColor * (0.75 + 0.6 * edge), alpha);
}
`;

/** A bubble material of its own: each piece's shield fades on its own. */
export function createShieldMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uFill: { value: 0.05 }, uRim: { value: 0.8 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Set the bubble from `shieldLook`: its face stays nearly clear, its outline carries the glow. */
export function setShieldLook(material: ShaderMaterial, look: { opacity: number; rim: number }): void {
  material.uniforms.uFill!.value = look.opacity * 0.15;
  material.uniforms.uRim!.value = look.rim;
}
