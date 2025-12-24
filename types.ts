export interface SceneConfig {
  particleCount: number;
  colorBottom: number;
  colorTop: number;
  floorRings: number;
  heartParticles: number;
}

export const DEFAULT_CONFIG: SceneConfig = {
  particleCount: 40000,
  colorBottom: 0xff0055, // Deep Pink/Red
  colorTop: 0xffeef5,    // Pale Pink/White
  floorRings: 8,
  heartParticles: 2000,
};