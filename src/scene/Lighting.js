import * as THREE from 'three';
import { gsap } from 'gsap';

const accentTargetPosition = new THREE.Vector3();
const accentLightPosition = new THREE.Vector3();

export class LightingRig {
  constructor(scene, renderer, fog, config) {
    this.scene = scene;
    this.renderer = renderer;
    this.fog = fog;
    this.config = config;
    this.selectedWorldPosition = new THREE.Vector3();
    this.selectedOffset = new THREE.Vector3().fromArray(config.selected.positionOffset);
    this.lookAccentLights = new Map();
    this.lookAccentTargets = new Map();
    this.params = {
      exposure: renderer.toneMappingExposure,
      ambientIntensity: config.ambient?.intensity ?? 0,
      hemisphereIntensity: config.hemisphere?.intensity ?? 0,
      sunIntensity: config.sun?.intensity ?? 0,
      sunVisualOpacity: config.sun?.visual?.opacity ?? 0,
      sunBeamOpacity: config.sun?.visual?.beamOpacity ?? 0,
      keyIntensity: config.key.intensity,
      entranceIntensity: config.entrance?.intensity ?? 0,
      fillIntensity: config.fill.intensity,
      rimIntensity: config.rim.intensity,
      look3AccentIntensity: config.lookAccents?.look3?.intensity ?? 0,
      look11AccentIntensity: config.lookAccents?.look11?.intensity ?? 0,
      selectedIntensity: config.selected.selectedIntensity,
      selectedFocusIntensity: config.selected.focusIntensity,
      fogDensity: fog.density
    };

    this.targetRoot = new THREE.Group();
    this.targetRoot.name = 'LightTargets';
    scene.add(this.targetRoot);

    this.createLights();
  }

  createLights() {
    const { ambient, hemisphere, sun, key, entrance, fill, rim, selected } = this.config;

    if (ambient) {
      this.ambient = new THREE.AmbientLight(ambient.color, ambient.intensity);
      this.ambient.name = 'SoftExteriorAmbient';
      this.scene.add(this.ambient);
    }

    this.hemisphere = new THREE.HemisphereLight(
      hemisphere.skyColor,
      hemisphere.groundColor,
      hemisphere.intensity
    );
    this.scene.add(this.hemisphere);

    if (sun) {
      this.sunTarget = this.createTarget('SunLightTarget', sun.target);
      this.sun = new THREE.DirectionalLight(sun.color, sun.intensity);
      this.sun.name = 'FarSunLight';
      this.sun.position.fromArray(sun.position);
      this.sun.target = this.sunTarget;
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.bias = -0.0001;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 80;
      this.sun.shadow.camera.left = -sun.shadowSize;
      this.sun.shadow.camera.right = sun.shadowSize;
      this.sun.shadow.camera.top = sun.shadowSize;
      this.sun.shadow.camera.bottom = -sun.shadowSize;
      this.scene.add(this.sun);

      if (sun.visual) {
        this.createSunVisual(sun);
      }
    }

    this.keyTarget = this.createTarget('KeyLightTarget', key.target);
    this.key = this.createSpotLight('KeyLight', key, this.keyTarget);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.00008;

    if (entrance) {
      this.entranceTarget = this.createTarget('EntranceLightTarget', entrance.target);
      this.entrance = this.createSpotLight('EntranceLight', entrance, this.entranceTarget);
    }

    this.fillTarget = this.createTarget('FillLightTarget', fill.target);
    this.fill = this.createSpotLight('FillLight', fill, this.fillTarget);

    this.rimTarget = this.createTarget('RimLightTarget', rim.target);
    this.rim = this.createSpotLight('RimLight', rim, this.rimTarget);

    this.selectedTarget = this.createTarget('SelectedLookTarget', [0, 1, 0]);
    this.selectedAccent = this.createSpotLight('SelectedLookLight', selected, this.selectedTarget);
    this.selectedAccent.intensity = selected.intensity;
    this.selectedAccent.castShadow = false;

    this.createLookAccentLights();
  }

  createLookAccentLights() {
    for (const [key, options] of Object.entries(this.config.lookAccents || {})) {
      const target = this.createTarget(`${key}EditorialAccentTarget`, [0, 1, 0]);
      const light = this.createSpotLight(`${key}EditorialAccent`, {
        ...options,
        position: [0, 0, 0]
      }, target);
      light.castShadow = false;

      this.lookAccentTargets.set(key, target);
      this.lookAccentLights.set(key, light);
    }
  }

  createSunVisual(sun) {
    const visual = sun.visual;
    const group = new THREE.Group();
    group.name = 'FarSunVisual';
    group.position.fromArray(visual.position);

    const discMaterial = new THREE.MeshBasicMaterial({
      color: sun.color,
      transparent: true,
      opacity: visual.opacity,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: sun.color,
      transparent: true,
      opacity: visual.opacity * 0.18,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false
    });

    const disc = new THREE.Mesh(new THREE.CircleGeometry(visual.size * 0.5, 64), discMaterial);
    disc.name = 'FarSunDisc';
    disc.renderOrder = 4;
    group.add(disc);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(visual.size, 64), glowMaterial);
    glow.name = 'FarSunGlow';
    glow.position.z = -0.04;
    glow.renderOrder = 3;
    group.add(glow);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color: sun.color,
      transparent: true,
      opacity: visual.beamOpacity,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false
    });

    const beam = new THREE.Mesh(new THREE.ConeGeometry(visual.size * 0.54, 30, 48, 1, true), beamMaterial);
    beam.name = 'FarSunBeam';
    beam.position.set(0.6, -2.6, 10);
    beam.rotation.x = Math.PI / 2;
    beam.renderOrder = 2;
    group.add(beam);

    this.scene.add(group);
    this.sunVisual = group;
    this.sunVisualMaterials = {
      disc: discMaterial,
      glow: glowMaterial,
      beam: beamMaterial
    };
  }

  createTarget(name, position) {
    const target = new THREE.Object3D();
    target.name = name;
    target.position.fromArray(position);
    this.targetRoot.add(target);
    return target;
  }

  createSpotLight(name, options, target) {
    const light = new THREE.SpotLight(
      options.color,
      options.intensity,
      options.distance,
      options.angle,
      options.penumbra,
      options.decay
    );

    light.name = name;
    light.position.fromArray(options.position);
    light.target = target;
    this.scene.add(light);

    return light;
  }

  setExposure(value) {
    this.params.exposure = value;
    this.renderer.toneMappingExposure = value;
  }

  setSunIntensity(value) {
    this.params.sunIntensity = value;
    this.config.sun.intensity = value;

    if (this.sun) {
      this.sun.intensity = value;
    }
  }

  setSunVisualOpacity(value) {
    this.params.sunVisualOpacity = value;

    if (this.sunVisualMaterials) {
      this.sunVisualMaterials.disc.opacity = value;
      this.sunVisualMaterials.glow.opacity = value * 0.18;
    }
  }

  setSunBeamOpacity(value) {
    this.params.sunBeamOpacity = value;

    if (this.sunVisualMaterials) {
      this.sunVisualMaterials.beam.opacity = value;
    }
  }

  setAmbientIntensity(value) {
    this.params.ambientIntensity = value;
    this.config.ambient.intensity = value;

    if (this.ambient) {
      this.ambient.intensity = value;
    }
  }

  setHemisphereIntensity(value) {
    this.params.hemisphereIntensity = value;
    this.config.hemisphere.intensity = value;

    if (this.hemisphere) {
      this.hemisphere.intensity = value;
    }
  }

  setFogDensity(value) {
    this.params.fogDensity = value;
    this.fog.density = value;
  }

  setKeyIntensity(value) {
    this.params.keyIntensity = value;
    this.config.key.intensity = value;
    this.key.intensity = value;
  }

  setFillIntensity(value) {
    this.params.fillIntensity = value;
    this.config.fill.intensity = value;
    this.fill.intensity = value;
  }

  setEntranceIntensity(value) {
    this.params.entranceIntensity = value;
    this.config.entrance.intensity = value;

    if (this.entrance) {
      this.entrance.intensity = value;
    }
  }

  setRimIntensity(value) {
    this.params.rimIntensity = value;
    this.config.rim.intensity = value;
    this.rim.intensity = value;
  }

  setLookAccentIntensity(key, value) {
    const light = this.lookAccentLights.get(key);
    const config = this.config.lookAccents?.[key];

    if (!light || !config) {
      return;
    }

    config.intensity = value;
    light.intensity = value;

    if (key === 'look3') {
      this.params.look3AccentIntensity = value;
    }

    if (key === 'look11') {
      this.params.look11AccentIntensity = value;
    }
  }

  setSelectedIntensity(value) {
    this.params.selectedIntensity = value;
    this.config.selected.selectedIntensity = value;
  }

  setSelectedFocusIntensity(value) {
    this.params.selectedFocusIntensity = value;
    this.config.selected.focusIntensity = value;
  }

  setSelectedLook(worldPosition, mode = 'look') {
    this.selectedWorldPosition.copy(worldPosition);
    this.selectedTarget.position.copy(worldPosition);
    this.selectedAccent.position.copy(worldPosition).add(this.selectedOffset);

    const intensity = mode === 'focus'
      ? this.config.selected.focusIntensity
      : this.config.selected.selectedIntensity;

    gsap.to(this.selectedAccent, {
      intensity,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: true
    });
  }

  clearSelectedLook() {
    gsap.to(this.selectedAccent, {
      intensity: 0,
      duration: 0.8,
      ease: 'power2.out',
      overwrite: true
    });
  }

  setLookAccentMode(selectedLook, mode = 'runway') {
    for (const [key, light] of this.lookAccentLights) {
      const config = this.config.lookAccents[key];
      let intensity = config.intensity;

      if (selectedLook && selectedLook !== key) {
        intensity = config.intensity * (mode === 'focus' ? 0.08 : 0.22);
      }

      if (selectedLook === key && mode === 'look') {
        intensity = config.selectedIntensity ?? config.intensity;
      }

      if (selectedLook === key && mode === 'focus') {
        intensity = config.focusIntensity ?? config.selectedIntensity ?? config.intensity;
      }

      gsap.to(light, {
        intensity,
        duration: 0.85,
        ease: 'power2.out',
        overwrite: true
      });
    }
  }

  setLookMode(active) {
    gsap.to(this.fill, {
      intensity: active ? this.config.fill.intensity * 0.72 : this.params.fillIntensity,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: true
    });
  }

  setFocusMode(active) {
    gsap.to(this.key, {
      intensity: active ? this.config.key.intensity * 0.62 : this.params.keyIntensity,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: true
    });

    gsap.to(this.fill, {
      intensity: active ? this.config.fill.intensity * 0.35 : this.params.fillIntensity,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: true
    });

    gsap.to(this.rim, {
      intensity: active ? this.config.rim.intensity * 0.55 : this.config.rim.intensity,
      duration: 0.9,
      ease: 'power2.out',
      overwrite: true
    });
  }

  updateSelectedPosition(worldPosition, mode) {
    if (!worldPosition) {
      return;
    }

    this.selectedWorldPosition.copy(worldPosition);
    this.selectedTarget.position.copy(worldPosition);
    this.selectedAccent.position.copy(worldPosition).add(this.selectedOffset);

    if (mode === 'focus' && this.selectedAccent.intensity < this.config.selected.focusIntensity * 0.9) {
      this.setSelectedLook(worldPosition, 'focus');
    }
  }

  updateLookAccentPosition(key, basePosition) {
    const light = this.lookAccentLights.get(key);
    const target = this.lookAccentTargets.get(key);
    const config = this.config.lookAccents?.[key];

    if (!light || !target || !config || !basePosition) {
      return;
    }

    accentTargetPosition.fromArray(config.targetOffset || [0, 1, 0]);
    accentLightPosition.fromArray(config.positionOffset || [0, 2, 2]);

    target.position.copy(basePosition).add(accentTargetPosition);
    light.position.copy(target.position).add(accentLightPosition);
  }
}
