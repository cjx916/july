import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Custom Shaders (Vortex/Spiral Version) ---

const sparkleVertexShader = `
  attribute float size;
  attribute float speed;
  attribute float phase;
  attribute vec3 color;
  
  varying vec3 vColor;
  varying float vOpacity;
  varying float vIntensity;
  
  uniform float uTime;
  uniform float uPixelRatio;

  // Simple sine-based turbulence for "floating in water" feel
  vec3 getTurbulence(vec3 p, float t) {
      float x = sin(p.y * 1.5 + t) * 0.08 + sin(p.z * 1.0 + t * 0.5) * 0.04;
      float y = cos(p.x * 1.0 + t) * 0.08 + sin(p.z * 1.5 + t * 0.6) * 0.04;
      float z = sin(p.x * 1.2 + t * 0.7) * 0.08 + cos(p.y * 1.0 + t) * 0.04;
      return vec3(x, y, z);
  }

  // Rotation Matrix (Column Major)
  mat2 rot2d(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat2(c, s, -s, c);
  }

  void main() {
    vColor = color;
    
    vec3 p = position;
    
    // --- Vortex/Spiral Motion ---
    // Instead of rotating the whole mesh, we rotate each particle 
    // around the Y-axis based on Time and Height.
    
    float rotSpeed = 0.2;  // Base rotation speed
    float twistAmt = 0.25; // How much height affects the angle (The "Twist")
    
    // Calculate rotation angle theta
    // uTime * rotSpeed: continuous rotation
    // p.y * twistAmt: creates the spiral/barber-pole effect up the tree
    float theta = uTime * rotSpeed + p.y * twistAmt;
    
    // Apply rotation to XZ plane (around Y axis)
    p.xz = rot2d(theta) * p.xz;

    // --- Turbulence ---
    // Apply turbulence on top of the spiral motion
    p += getTurbulence(p, uTime * 0.5);

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // --- Breathing & Sparkle Logic ---
    float t = uTime * speed + phase;
    float sineWave = 0.5 + 0.5 * sin(t); // Range 0.0 -> 1.0
    
    // Opacity: Keep it semi-opaque (0.5) to fully opaque (1.0)
    vOpacity = 0.5 + 0.5 * sineWave;
    
    // Intensity: Dynamic HDR control
    vIntensity = 0.8 + 2.2 * sineWave;
    
    // Size Pulse
    float sizePulse = 0.8 + 0.4 * sineWave;
    
    // Size attenuation
    gl_PointSize = size * sizePulse * uPixelRatio * (200.0 / -mvPosition.z);
  }
`;

const sparkleFragmentShader = `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  varying float vOpacity;
  varying float vIntensity;

  void main() {
    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
    
    // Soft circular clip
    if (texColor.a < 0.05) discard;
    
    // Apply dynamic intensity to the RGB color
    // Values > 1.0 will trigger Bloom if they pass the threshold
    vec3 hdrColor = vColor * vIntensity;
    
    // NormalBlending handling
    gl_FragColor = vec4(hdrColor, vOpacity * texColor.a);
  }
`;

const ChristmasScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    let animationFrameId: number;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050205, 0.02); // Deep dark purple fog

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 4, 18);

    const renderer = new THREE.WebGLRenderer({ 
      antialias: false, 
      powerPreference: "high-performance",
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // --- Tone Mapping (Strict control to prevent white-out) ---
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.7; // Lower exposure to preserve pinks
    
    mountRef.current.appendChild(renderer.domElement);

    // --- Post Processing ---
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    
    // --- Bloom Refinement ---
    // High threshold: Only very bright sparkles glow
    // Low strength: Subtle, elegant glow rather than fog
    // High radius: Dreamy atmosphere
    bloomPass.threshold = 0.85; 
    bloomPass.strength = 0.35;
    bloomPass.radius = 0.85;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // --- Assets ---
    const createBokehTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if(ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1.0)'); 
        grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,64,64);
      }
      return new THREE.CanvasTexture(canvas);
    };
    const bokehTexture = createBokehTexture();

    const globalUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      pointTexture: { value: bokehTexture }
    };

    // --- Object Creation ---

    // 1. Tiered Glitter Tree
    const createGlitterTree = () => {
        const geometry = new THREE.BufferGeometry();
        const count = 40000; 
        
        const positions = [];
        const colors = [];
        const sizes = [];
        const speeds = [];
        const phases = [];

        const tiers = 8;
        const totalHeight = 12;
        const maxRadius = 5.5;

        // --- Palette ---
        const palette = [
            new THREE.Color(0xFF007F), // Bright Rose
            new THREE.Color(0xFF1493), // Deep Neon Pink
            new THREE.Color(0xC71585), // Medium Violet Red
            new THREE.Color(0xFFD700), // Gold
            new THREE.Color(0xFF69B4), // Hot Pink
        ];

        for(let i=0; i<count; i++) {
            const tierIndex = Math.floor(Math.random() * tiers);
            const tierHeightStart = (tierIndex / tiers) * totalHeight;
            const tierHeightEnd = ((tierIndex + 0.9) / tiers) * totalHeight;
            
            const y = tierHeightStart + Math.random() * (tierHeightEnd - tierHeightStart);
            const tierProgress = (y - tierHeightStart) / (tierHeightEnd - tierHeightStart);
            const overallProgress = y / totalHeight;
            
            let radiusAtY = maxRadius * (1 - overallProgress);
            radiusAtY *= (1.0 + 0.3 * (1-tierProgress));

            const rRatio = Math.pow(Math.random(), 0.8); 
            const r = radiusAtY * rRatio;
            
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            
            positions.push(x, y - 6, z);

            // Color Assignment
            const colorRef = palette[Math.floor(Math.random() * palette.length)];
            const c = colorRef.clone();
            
            // Outer tips get Gold
            if (rRatio > 0.85) {
               c.lerp(new THREE.Color(0xFFD700), 0.4); 
            }
            // Inner core gets Deep Red for volume
            if (rRatio < 0.3) {
                c.lerp(new THREE.Color(0x880022), 0.6);
            }
            colors.push(c.r, c.g, c.b);

            sizes.push(0.2 + Math.random() * 0.4);
            speeds.push(1.0 + Math.random() * 3.0);
            phases.push(Math.random() * Math.PI * 2);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
        geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: globalUniforms,
            vertexShader: sparkleVertexShader,
            fragmentShader: sparkleFragmentShader,
            blending: THREE.NormalBlending, 
            depthWrite: false,
            transparent: true,
        });

        const tree = new THREE.Points(geometry, material);
        scene.add(tree);
        return tree;
    };

    // 2. Solid Heart Topper
    const createSolidHeart = () => {
        const geometry = new THREE.BufferGeometry();
        const count = 3500;
        
        const positions = [];
        const colors = [];
        const sizes = [];
        const speeds = [];
        const phases = [];

        for(let i=0; i<count; i++) {
            const t = Math.random() * Math.PI * 2;
            let x = 16 * Math.pow(Math.sin(t), 3);
            let y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            let z = (Math.random() - 0.5) * 6;
            
            const scaleVol = Math.sqrt(Math.random());
            x *= scaleVol; y *= scaleVol; z *= scaleVol;

            positions.push(x * 0.05, y * 0.05 + 6.2, z * 0.05);

            // Vibrant Heart
            const c = new THREE.Color(Math.random() > 0.3 ? 0xFF0055 : 0xFFD700);
            colors.push(c.r, c.g, c.b);
            
            sizes.push(0.3 + Math.random() * 0.4);
            speeds.push(2.0 + Math.random() * 3.0);
            phases.push(Math.random() * Math.PI * 2);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
        geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: globalUniforms,
            vertexShader: sparkleVertexShader,
            fragmentShader: sparkleFragmentShader,
            blending: THREE.NormalBlending,
            depthWrite: false,
            transparent: true,
        });

        const heart = new THREE.Points(geometry, material);
        scene.add(heart);
        return heart;
    };

    // 3. Swirling Base (Restored Spiral)
    const createSwirlingBase = () => {
        const geometry = new THREE.BufferGeometry();
        const count = 4000;
        
        const positions = [];
        const colors = [];
        const sizes = [];
        const speeds = [];
        const phases = [];
        
        for(let i=0; i<count; i++) {
            const r = 3 + Math.random() * 12;
            const angle = (Math.random() * Math.PI * 2) + (r * 0.3);
            
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            const y = -6 + Math.sin(r * 0.5 + angle) * 0.15; 

            positions.push(x, y, z);

            const c = new THREE.Color().setHSL(0.9 + Math.random()*0.1, 0.7, 0.5);
            colors.push(c.r, c.g, c.b);
            
            sizes.push(0.2 + Math.random() * 0.2);
            speeds.push(1.0 + Math.random());
            phases.push(Math.random() * 10);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('speed', new THREE.Float32BufferAttribute(speeds, 1));
        geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: globalUniforms,
            vertexShader: sparkleVertexShader,
            fragmentShader: sparkleFragmentShader,
            blending: THREE.AdditiveBlending, // Additive for light reflections
            depthWrite: false,
            transparent: true,
            opacity: 0.5
        });

        const base = new THREE.Points(geometry, material);
        scene.add(base);
        return base;
    };

    // 4. Ambient Snow
    const createSnow = () => {
        const geometry = new THREE.BufferGeometry();
        const count = 1500;
        const positions = [];
        
        for(let i=0; i<count; i++) {
            positions.push(
                (Math.random()-0.5) * 50,
                (Math.random()-0.5) * 40,
                (Math.random()-0.5) * 50
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xFFEEEE,
            size: 0.1,
            map: bokehTexture,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const snow = new THREE.Points(geometry, material);
        scene.add(snow);
        return snow;
    };

    const treeSystem = createGlitterTree();
    const heartSystem = createSolidHeart();
    const baseSystem = createSwirlingBase();
    const snowSystem = createSnow();

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = false; // Disabled to let the shader vortex shine
    controls.maxPolarAngle = Math.PI / 2 - 0.1;

    // --- Animation ---
    const clock = new THREE.Clock();
    
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        
        globalUniforms.uTime.value = time;
        controls.update();

        // Note: Mesh rotations removed to rely on shader vortex logic
        
        if (heartSystem) {
            const beat = 1 + Math.sin(time * 3) * 0.05;
            heartSystem.scale.set(beat, beat, beat);
        }

        if (snowSystem) {
            const pos = snowSystem.geometry.attributes.position.array as Float32Array;
            for(let i=1; i<pos.length; i+=3) {
                pos[i] -= 0.03;
                pos[i-1] += Math.sin(time * 0.5 + pos[i]) * 0.01; 
                if(pos[i] < -20) pos[i] = 20;
            }
            snowSystem.geometry.attributes.position.needsUpdate = true;
        }

        composer.render();
    };

    animate();

    // --- Cleanup ---
    const onWindowResize = () => {
      if(!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      globalUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    };
    window.addEventListener('resize', onWindowResize);

    return () => {
      window.removeEventListener('resize', onWindowResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ChristmasScene;