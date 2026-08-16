import * as THREE from 'three';
import { gsap } from 'gsap';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ModelLoader } from './ModelLoader.js';
import { CameraController } from './CameraController.js';
import { LightingRig } from './Lighting.js';
import { HotspotManager } from './HotspotManager.js';
import { CAMERA_CONFIG, LIGHT_CONFIG, MODEL_CONFIG, RENDER_CONFIG } from './modelConfig.js';
import { hashFromLookKey, lookKeyFromHash } from '../ui/archiveData.js';
import { readTransform, roundArray } from '../utils/modelUtils.js';

const pointerNdc = new THREE.Vector2();
const lookWorldPosition = new THREE.Vector3();

function isMobileRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= 768
    || window.matchMedia('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 1;
}

export class SceneManager {
  constructor({ container, ui, state, debug = false }) {
    this.container = container;
    this.ui = ui;
    this.state = state;
    this.debug = debug;
    this.isMobile = isMobileRuntime();
    this.models = {};
    this.selectableMeshes = [];
    this.focusDragging = false;
    this.focusRotationTarget = 0;
    this.focusRotationOrigin = new Map();
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    this.handleResize = this.handleResize.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);
    this.update = this.update.bind(this);
  }

  async init() {
    this.setupRenderer();
    this.setupScene();
    await this.setupEnvironment();
    this.setupCamera();
    this.createFloorReceiver();
    this.setupLighting();
    this.setupEvents();
    this.start();

    const manager = new THREE.LoadingManager();
    const loader = new ModelLoader({
      manager,
      onProgress: (progress) => this.ui.updateLoading(progress),
      onError: ({ key, path }) => {
        this.ui.showLoadingError(`Unable to load ${key} from ${path}.`);
      }
    });

    const { models, errors } = await loader.loadAll(this.getRuntimeModelConfig());
    this.modelLoader = loader;
    this.models = models;

    for (const model of Object.values(models)) {
      this.scene.add(model.pivot);
      this.selectableMeshes.push(...model.selectableMeshes);
    }

    this.applyEnvironmentToSceneMaterials();
    this.reportModelMetrics(errors);
    this.setupHotspots();

    if (this.debug) {
      await this.setupDebug();
    }

    this.state.loaded = true;
    await this.ui.completeLoading();
    this.state.mode = 'runway';
    this.ui.setMode('runway');
    this.cameraController.playIntroDolly();

    const initialLook = lookKeyFromHash();
    if (initialLook && this.models[initialLook]) {
      window.setTimeout(() => this.selectLook(initialLook, { fromHash: true }), 980);
    }
  }

  setupRenderer() {
    THREE.ColorManagement.enabled = true;
    const renderSettings = this.getRenderSettings();

    this.renderer = new THREE.WebGLRenderer({
      antialias: renderSettings.antialias,
      alpha: false,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance'
    });

    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = renderSettings.exposure;
    this.renderer.shadowMap.enabled = renderSettings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if ('useLegacyLights' in this.renderer) {
      this.renderer.useLegacyLights = false;
    }

    if ('physicallyCorrectLights' in this.renderer) {
      this.renderer.physicallyCorrectLights = true;
    }

    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.container.append(this.renderer.domElement);
  }

  setupScene() {
    const renderSettings = this.getRenderSettings();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020202);
    this.scene.fog = new THREE.FogExp2(RENDER_CONFIG.fogColor, renderSettings.fogDensity);
  }

  async setupEnvironment() {
    const environment = RENDER_CONFIG.environment;

    if (!environment?.path || this.getRenderSettings().skipEnvironment) {
      return;
    }

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    try {
      const hdrTexture = await new RGBELoader().loadAsync(environment.path);
      const envMap = this.pmremGenerator.fromEquirectangular(hdrTexture).texture;

      this.environmentMap = envMap;
      this.scene.environment = envMap;

      if ('environmentIntensity' in this.scene) {
        this.scene.environmentIntensity = environment.intensity;
      }

      if (environment.useAsBackground) {
        this.scene.background = envMap;
      }

      hdrTexture.dispose();
    } catch (error) {
      console.warn(`[HYACYN] HDR environment could not be loaded from ${environment.path}`, error);
    }
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.initial.fov,
      this.container.clientWidth / this.container.clientHeight,
      0.05,
      120
    );
    this.camera.name = 'ArchiveCamera';
    this.cameraController = new CameraController(this.camera, CAMERA_CONFIG);
  }

  setupLighting() {
    this.lighting = new LightingRig(this.scene, this.renderer, this.scene.fog, LIGHT_CONFIG);

    if (this.isMobile) {
      this.setupMobileAccentLighting();
    }
  }

  setupMobileAccentLighting() {
    const carAccent = RENDER_CONFIG.mobile?.carAccent;

    if (!carAccent) {
      return;
    }

    this.mobileCarLightTarget = new THREE.Object3D();
    this.mobileCarLightTarget.name = 'MobileCarAccentTarget';
    this.mobileCarLightTarget.position.fromArray(carAccent.target);
    this.scene.add(this.mobileCarLightTarget);

    this.mobileCarLight = new THREE.SpotLight(
      carAccent.color,
      carAccent.intensity,
      carAccent.distance,
      carAccent.angle,
      carAccent.penumbra,
      carAccent.decay
    );
    this.mobileCarLight.name = 'MobileCarAccent';
    this.mobileCarLight.position.fromArray(carAccent.position);
    this.mobileCarLight.target = this.mobileCarLightTarget;
    this.mobileCarLight.castShadow = false;
    this.scene.add(this.mobileCarLight);
  }

  createFloorReceiver() {
    const geometry = new THREE.PlaneGeometry(RENDER_CONFIG.floor.size, RENDER_CONFIG.floor.size);
    const material = new THREE.MeshStandardMaterial({
      color: RENDER_CONFIG.floor.color,
      roughness: RENDER_CONFIG.floor.roughness ?? 1,
      metalness: RENDER_CONFIG.floor.metalness ?? 0,
      envMapIntensity: RENDER_CONFIG.floor.envMapIntensity ?? RENDER_CONFIG.environment?.intensity ?? 0
    });

    this.floor = new THREE.Mesh(geometry, material);
    this.floor.name = 'ShadowReceivingFloor';
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = RENDER_CONFIG.floor.y;
    this.floor.receiveShadow = this.getRenderSettings().shadows;
    this.scene.add(this.floor);
  }

  getRuntimeModelConfig() {
    if (!this.isMobile) {
      return MODEL_CONFIG;
    }

    return Object.fromEntries(
      Object.entries(MODEL_CONFIG).map(([key, config]) => [
        key,
        {
          ...config,
          path: config.mobilePath || config.path,
          shadows: {
            cast: false,
            receive: false
          }
        }
      ])
    );
  }

  getRenderSettings() {
    const mobile = this.isMobile ? RENDER_CONFIG.mobile || {} : {};

    return {
      antialias: mobile.antialias ?? true,
      pixelRatioCap: mobile.pixelRatioCap ?? RENDER_CONFIG.pixelRatioCap ?? 2,
      shadows: mobile.shadows ?? true,
      skipEnvironment: mobile.skipEnvironment ?? false,
      exposure: mobile.exposure ?? RENDER_CONFIG.exposure,
      fogDensity: mobile.fogDensity ?? RENDER_CONFIG.fogDensity
    };
  }

  getPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.getRenderSettings().pixelRatioCap);
  }

  setupEvents() {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  setupHotspots() {
    const targets = {};

    for (const key of ['look3', 'look11']) {
      if (!this.models[key]) {
        continue;
      }

      targets[key] = {
        object: this.models[key].pivot,
        offset: MODEL_CONFIG[key].hotspotOffset
      };
    }

    this.hotspotManager = new HotspotManager({
      camera: this.camera,
      container: this.container,
      ui: this.ui
    });
    this.hotspotManager.setTargets(targets);
  }

  reportModelMetrics(errors) {
    if (errors.length > 0) {
      console.warn('[HYACYN] Model loading issues:', errors);
    }

    const measurements = Object.fromEntries(
      Object.entries(this.models).map(([key, model]) => [key, model.metrics])
    );
    console.info('[HYACYN] GLB measurements:', measurements);
  }

  applyEnvironmentToSceneMaterials() {
    const environment = RENDER_CONFIG.environment;

    if (!this.environmentMap || !environment) {
      return;
    }

    this.scene.traverse((child) => {
      if (!child.isMesh || !child.material) {
        return;
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material];

      for (const material of materials) {
        if (!material || (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial)) {
          continue;
        }

        material.envMapIntensity = environment.intensity;

        if (
          material.isMeshPhysicalMaterial
          && (material.transmission > 0 || material.transparent || material.opacity < 1)
        ) {
          material.envMapIntensity = environment.refractionIntensity ?? environment.intensity;
          material.ior = environment.refractionIor ?? material.ior;
          material.thickness = Math.max(material.thickness ?? 0, environment.refractionThickness ?? 0);
        }

        material.needsUpdate = true;
      }
    });
  }

  setEnvironmentIntensity(value) {
    if (!RENDER_CONFIG.environment) {
      return;
    }

    RENDER_CONFIG.environment.intensity = value;

    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity = value;
    }

    this.applyEnvironmentToSceneMaterials();
  }

  addColorControl(folder, label, color, onChange) {
    const params = {
      [label]: `#${color.getHexString()}`
    };

    folder.addColor(params, label).onChange((value) => {
      color.set(value);
      onChange?.(value);
    });
  }

  addVectorControls(folder, label, vector, range = 30, onChange) {
    const vectorFolder = folder.addFolder(label);

    vectorFolder.add(vector, 'x', -range, range, 0.01).onChange(onChange);
    vectorFolder.add(vector, 'y', -range, range, 0.01).onChange(onChange);
    vectorFolder.add(vector, 'z', -range, range, 0.01).onChange(onChange);

    return vectorFolder;
  }

  addSpotShapeControls(folder, light) {
    folder.add(light, 'distance', 0, 80, 0.1).name('distance');
    folder.add(light, 'angle', 0.01, Math.PI / 2, 0.001).name('angle');
    folder.add(light, 'penumbra', 0, 1, 0.01).name('penumbra');
    folder.add(light, 'decay', 0, 2.5, 0.01).name('decay');
  }

  addBasicLightControls(parent, label, light, paramsKey, setter, max = 40) {
    if (!light) {
      return null;
    }

    const folder = parent.addFolder(label);
    folder.add(this.lighting.params, paramsKey, 0, max, 0.01).name('intensity').onChange((value) => setter.call(this.lighting, value));
    this.addColorControl(folder, 'color', light.color);

    return folder;
  }

  addTargetedLightControls(parent, label, light, target, paramsKey, setter, options = {}) {
    const folder = this.addBasicLightControls(parent, label, light, paramsKey, setter, options.max ?? 60);

    if (!folder) {
      return null;
    }

    this.addVectorControls(folder, 'position', light.position, options.positionRange ?? 45, () => light.updateMatrixWorld());

    if (target) {
      this.addVectorControls(folder, 'target', target.position, options.targetRange ?? 45, () => target.updateMatrixWorld());
    }

    if (light.isSpotLight) {
      this.addSpotShapeControls(folder, light);
    }

    return folder;
  }

  addHemisphereControls(parent) {
    const light = this.lighting.hemisphere;

    if (!light) {
      return;
    }

    const folder = parent.addFolder('hemisphere');
    folder.add(this.lighting.params, 'hemisphereIntensity', 0, 2, 0.01).name('intensity').onChange((value) => this.lighting.setHemisphereIntensity(value));
    this.addColorControl(folder, 'sky color', light.color);
    this.addColorControl(folder, 'ground color', light.groundColor);
  }

  addSunControls(parent) {
    const folder = this.addTargetedLightControls(
      parent,
      'sun',
      this.lighting.sun,
      this.lighting.sunTarget,
      'sunIntensity',
      this.lighting.setSunIntensity,
      {
        max: 20,
        positionRange: 60,
        targetRange: 45
      }
    );

    if (!folder || !this.lighting.sun) {
      return;
    }

    const shadowParams = {
      size: Math.abs(this.lighting.sun.shadow.camera.right)
    };

    folder.add(shadowParams, 'size', 1, 60, 0.1).name('shadow size').onChange((value) => {
      const camera = this.lighting.sun.shadow.camera;
      camera.left = -value;
      camera.right = value;
      camera.top = value;
      camera.bottom = -value;
      camera.updateProjectionMatrix();
    });

    if (this.lighting.sunVisual) {
      const visualFolder = folder.addFolder('visual');
      visualFolder.add(this.lighting.sunVisual, 'visible').name('visible');
      this.addVectorControls(visualFolder, 'position', this.lighting.sunVisual.position, 40);
      visualFolder.add(this.lighting.params, 'sunVisualOpacity', 0, 1, 0.01).name('disc opacity').onChange((value) => this.lighting.setSunVisualOpacity(value));
      visualFolder.add(this.lighting.params, 'sunBeamOpacity', 0, 0.5, 0.005).name('beam opacity').onChange((value) => this.lighting.setSunBeamOpacity(value));
      visualFolder.add(this.lighting.sunVisual.scale, 'x', 0.1, 3, 0.01).name('scale').onChange((value) => this.lighting.sunVisual.scale.setScalar(value));
    }
  }

  addSelectedLightControls(parent) {
    const light = this.lighting.selectedAccent;

    if (!light) {
      return;
    }

    const folder = parent.addFolder('selected');
    folder.add(this.lighting.params, 'selectedIntensity', 0, 40, 0.1).name('look intensity').onChange((value) => this.lighting.setSelectedIntensity(value));
    folder.add(this.lighting.params, 'selectedFocusIntensity', 0, 50, 0.1).name('focus intensity').onChange((value) => this.lighting.setSelectedFocusIntensity(value));
    this.addColorControl(folder, 'color', light.color);
    this.addVectorControls(folder, 'offset', this.lighting.selectedOffset, 10);
    this.addSpotShapeControls(folder, light);
  }

  addLookAccentControls(parent) {
    if (!this.lighting.lookAccentLights?.size) {
      return;
    }

    const folder = parent.addFolder('look accents');

    if (this.lighting.lookAccentLights.has('look3')) {
      folder.add(this.lighting.params, 'look3AccentIntensity', 0, 12, 0.05)
        .name('look03 intensity')
        .onChange((value) => this.lighting.setLookAccentIntensity('look3', value));
    }

    if (this.lighting.lookAccentLights.has('look11')) {
      folder.add(this.lighting.params, 'look11AccentIntensity', 0, 12, 0.05)
        .name('look11 intensity')
        .onChange((value) => this.lighting.setLookAccentIntensity('look11', value));
    }
  }

  addLightDebugControls(parent) {
    this.addBasicLightControls(parent, 'ambient', this.lighting.ambient, 'ambientIntensity', this.lighting.setAmbientIntensity, 2);
    this.addHemisphereControls(parent);
    this.addSunControls(parent);
    this.addTargetedLightControls(parent, 'key', this.lighting.key, this.lighting.keyTarget, 'keyIntensity', this.lighting.setKeyIntensity, { max: 90 });
    this.addTargetedLightControls(parent, 'entrance', this.lighting.entrance, this.lighting.entranceTarget, 'entranceIntensity', this.lighting.setEntranceIntensity, { max: 60 });
    this.addTargetedLightControls(parent, 'fill', this.lighting.fill, this.lighting.fillTarget, 'fillIntensity', this.lighting.setFillIntensity, { max: 40 });
    this.addTargetedLightControls(parent, 'rim', this.lighting.rim, this.lighting.rimTarget, 'rimIntensity', this.lighting.setRimIntensity, { max: 40 });
    this.addLookAccentControls(parent);
    this.addSelectedLightControls(parent);
  }

  handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.cameraController.setViewport(width);
    this.renderer.setPixelRatio(this.getPixelRatio());
    this.renderer.setSize(width, height);
  }

  handlePointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.cameraController.setPointerFromEvent(event, rect);

    if (this.state.mode === 'focus' && this.focusDragging && this.state.selectedLook) {
      this.focusRotationTarget += event.movementX * 0.007;
      return;
    }

    if (!this.state.loaded || this.state.mode === 'focus') {
      return;
    }

    const lookKey = this.raycastLook(event);
    this.ui.setHotspotHover(lookKey);
    this.ui.setSceneCursor(lookKey ? 'pointer' : 'default');
  }

  handlePointerDown(event) {
    if (this.state.mode !== 'focus') {
      return;
    }

    this.focusDragging = true;
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
    this.ui.setSceneCursor('grabbing');
  }

  handlePointerUp(event) {
    if (!this.focusDragging) {
      return;
    }

    this.focusDragging = false;
    this.renderer?.domElement.releasePointerCapture?.(event.pointerId);
    this.ui.setSceneCursor(this.state.mode === 'focus' ? 'grab' : 'default');
  }

  handleWheel(event) {
    event.preventDefault();
    this.cameraController.addScroll(event.deltaY);
  }

  handleCanvasClick(event) {
    if (!this.state.loaded || this.state.mode === 'focus') {
      return;
    }

    const lookKey = this.raycastLook(event);

    if (lookKey) {
      this.selectLook(lookKey);
    }
  }

  handleKeydown(event) {
    if (event.key === 'Escape') {
      this.closeLook();
    }
  }

  handleContextLost(event) {
    event.preventDefault();
    window.cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ui.showLoadingError('WebGL paused on this device. Reload the archive to try again.');
  }

  handleContextRestored() {
    if (!this.raf) {
      this.start();
    }
  }

  raycastLook(event) {
    if (this.selectableMeshes.length === 0) {
      return null;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    this.raycaster.setFromCamera(pointerNdc, this.camera);
    const intersections = this.raycaster.intersectObjects(this.selectableMeshes, false);

    return intersections[0]?.object.userData.lookKey || null;
  }

  explore() {
    if (this.state.mode !== 'runway') {
      return;
    }

    this.cameraController.scrollProgress = Math.min(this.cameraController.scrollProgress + 0.38, 1);
  }

  selectLook(key, { fromHash = false } = {}) {
    if (!this.models[key]) {
      return;
    }

    if (this.state.mode === 'focus') {
      this.restoreFocusRotation(key);
    }

    this.state.mode = 'look';
    this.state.selectedLook = key;
    this.ui.setMode('look');
    this.ui.openLookPanel(key);
    this.ui.setSceneCursor('default');
    this.cameraController.transitionToLook(key, this.getLookBasePosition(key));
    this.lighting.setLookMode(true);
    this.lighting.setFocusMode(false);
    this.lighting.setLookAccentMode(key, 'look');
    this.lighting.setSelectedLook(this.getLookWorldPosition(key), 'look');
    this.setEnvironmentOpacity(false);

    if (!fromHash) {
      this.setHash(key);
    }
  }

  enterFocusMode() {
    const key = this.state.selectedLook;

    if (!key || !this.models[key]) {
      return;
    }

    const pivot = this.models[key].pivot;

    if (!this.focusRotationOrigin.has(key)) {
      this.focusRotationOrigin.set(key, {
        x: pivot.rotation.x,
        y: pivot.rotation.y,
        z: pivot.rotation.z
      });
    }

    this.focusRotationTarget = pivot.rotation.y;
    this.state.mode = 'focus';
    this.ui.setMode('focus');
    this.ui.closeLookPanel({ immediate: true });
    this.ui.setSceneCursor('grab');
    this.cameraController.transitionToFocus(key, this.getLookBasePosition(key));
    this.lighting.setFocusMode(true);
    this.lighting.setLookAccentMode(key, 'focus');
    this.lighting.setSelectedLook(this.getLookWorldPosition(key), 'focus');
    this.setEnvironmentOpacity(true);
  }

  closeLook() {
    if (this.state.mode === 'runway' && !this.state.selectedLook) {
      return;
    }

    const key = this.state.selectedLook;

    if (key) {
      this.restoreFocusRotation(key);
    }

    this.state.mode = 'runway';
    this.state.selectedLook = null;
    this.focusDragging = false;
    this.ui.setMode('runway');
    this.ui.closeLookPanel();
    this.ui.setHotspotHover(null);
    this.ui.setSceneCursor('default');
    this.cameraController.transitionToRunway();
    this.lighting.clearSelectedLook();
    this.lighting.setLookMode(false);
    this.lighting.setFocusMode(false);
    this.lighting.setLookAccentMode(null, 'runway');
    this.setEnvironmentOpacity(false);
    this.setHash(null);
  }

  restoreFocusRotation(key) {
    const pivot = this.models[key]?.pivot;
    const origin = this.focusRotationOrigin.get(key);

    if (!pivot || !origin) {
      return;
    }

    gsap.to(pivot.rotation, {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      duration: 0.85,
      ease: 'power3.out',
      overwrite: true
    });

    this.focusRotationOrigin.delete(key);
  }

  setEnvironmentOpacity(focused) {
    this.setModelOpacity('church', focused ? 0.3 : 1);
    this.setModelOpacity('cars', focused ? 0.44 : 1);
  }

  setModelOpacity(key, opacity) {
    const model = this.models[key]?.model;

    if (!model) {
      return;
    }

    model.traverse((child) => {
      if (!child.isMesh || !child.material) {
        return;
      }

      const state = this.ensureDimMaterials(child);

      state.materials.forEach((material, index) => {
        const original = state.original[index];
        material.transparent = opacity < 0.999 || original.transparent;
        material.depthWrite = opacity >= 0.999 ? original.depthWrite : false;

        gsap.to(material, {
          opacity: opacity >= 0.999 ? original.opacity : opacity,
          duration: 0.72,
          ease: 'power2.out',
          overwrite: true,
          onUpdate: () => {
            material.needsUpdate = true;
          },
          onComplete: () => {
            if (opacity >= 0.999) {
              material.transparent = original.transparent;
              material.depthWrite = original.depthWrite;
              material.needsUpdate = true;
            }
          }
        });
      });
    });
  }

  ensureDimMaterials(mesh) {
    if (mesh.userData.hyacynDimState) {
      return mesh.userData.hyacynDimState;
    }

    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clonedMaterials = sourceMaterials.map((material) => material.clone());

    mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0];
    mesh.userData.hyacynDimState = {
      materials: clonedMaterials,
      original: sourceMaterials.map((material) => ({
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite
      }))
    };

    return mesh.userData.hyacynDimState;
  }

  getLookWorldPosition(key) {
    const model = this.models[key];

    if (!model) {
      return null;
    }

    const offset = MODEL_CONFIG[key].hotspotOffset || [0, 1, 0];
    lookWorldPosition.fromArray(offset);
    model.pivot.localToWorld(lookWorldPosition);

    return lookWorldPosition.clone();
  }

  getLookBasePosition(key) {
    const model = this.models[key];

    if (!model) {
      return null;
    }

    return model.pivot.getWorldPosition(new THREE.Vector3());
  }

  setHash(key) {
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', key ? `${base}${hashFromLookKey(key)}` : base);
  }

  async setupDebug() {
    const { GUI } = await import('lil-gui');
    this.gui = new GUI({ title: 'HYACYN DEBUG' });
    this.gui.domElement.style.zIndex = '50';

    const modelsFolder = this.gui.addFolder('Models');

    for (const [key, model] of Object.entries(this.models)) {
      const pivot = model.pivot;
      const params = {
        positionX: pivot.position.x,
        positionY: pivot.position.y,
        positionZ: pivot.position.z,
        rotationX: pivot.rotation.x,
        rotationY: pivot.rotation.y,
        rotationZ: pivot.rotation.z,
        scale: pivot.scale.x
      };
      const folder = modelsFolder.addFolder(key);
      const positionRange = key === 'church' ? 24 : 10;
      const scaleMax = key === 'church' ? 30 : key === 'cars' ? 10 : 3;
      const apply = () => {
        pivot.position.set(params.positionX, params.positionY, params.positionZ);
        pivot.rotation.set(params.rotationX, params.rotationY, params.rotationZ);
        pivot.scale.setScalar(params.scale);
        this.logTransformConfig();
      };

      folder.add(params, 'positionX', -positionRange, positionRange, 0.01).name('position x').onChange(apply);
      folder.add(params, 'positionY', -positionRange, positionRange, 0.01).name('position y').onChange(apply);
      folder.add(params, 'positionZ', -positionRange, positionRange, 0.01).name('position z').onChange(apply);
      folder.add(params, 'rotationX', -Math.PI, Math.PI, 0.001).name('rotation x').onChange(apply);
      folder.add(params, 'rotationY', -Math.PI, Math.PI, 0.001).name('rotation y').onChange(apply);
      folder.add(params, 'rotationZ', -Math.PI, Math.PI, 0.001).name('rotation z').onChange(apply);
      folder.add(params, 'scale', 0.01, scaleMax, 0.01).name('uniform scale').onChange(apply);
    }

    const cameraParams = this.cameraController.getDebugParams();
    const cameraFolder = this.gui.addFolder('Camera');
    cameraFolder.add(cameraParams.cameraPosition, 'x', -12, 12, 0.01).name('position x').onChange((value) => this.cameraController.setBasePositionAxis('x', value));
    cameraFolder.add(cameraParams.cameraPosition, 'y', -2, 12, 0.01).name('position y').onChange((value) => this.cameraController.setBasePositionAxis('y', value));
    cameraFolder.add(cameraParams.cameraPosition, 'z', -12, 14, 0.01).name('position z').onChange((value) => this.cameraController.setBasePositionAxis('z', value));
    cameraFolder.add(cameraParams.cameraTarget, 'x', -10, 10, 0.01).name('target x').onChange((value) => this.cameraController.setTargetAxis('x', value));
    cameraFolder.add(cameraParams.cameraTarget, 'y', -2, 8, 0.01).name('target y').onChange((value) => this.cameraController.setTargetAxis('y', value));
    cameraFolder.add(cameraParams.cameraTarget, 'z', -14, 8, 0.01).name('target z').onChange((value) => this.cameraController.setTargetAxis('z', value));
    cameraFolder.add(cameraParams, 'cameraFov', 18, 58, 0.1).name('fov').onChange((value) => this.cameraController.setFov(value));

    const renderFolder = this.gui.addFolder('Render');
    renderFolder.add(this.lighting.params, 'exposure', 0.4, 2.2, 0.01).name('exposure').onChange((value) => this.lighting.setExposure(value));
    if (RENDER_CONFIG.environment) {
      renderFolder.add(RENDER_CONFIG.environment, 'intensity', 0, 2, 0.01).name('hdr intensity').onChange((value) => this.setEnvironmentIntensity(value));
    }
    renderFolder.add(this.lighting.params, 'fogDensity', 0, 0.1, 0.001).name('fog density').onChange((value) => this.lighting.setFogDensity(value));

    const lightsFolder = this.gui.addFolder('Lights');
    this.addLightDebugControls(lightsFolder);

    this.debugTargetHelper = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4f1eb, depthTest: false })
    );
    this.debugTargetHelper.name = 'CameraTargetDebugHelper';
    this.debugTargetHelper.renderOrder = 1000;
    this.scene.add(this.debugTargetHelper);
  }

  logTransformConfig() {
    const transforms = Object.fromEntries(
      Object.entries(this.models).map(([key, model]) => {
        const transform = readTransform(model.pivot);
        return [key, {
          position: roundArray(transform.position),
          rotation: roundArray(transform.rotation),
          scale: Math.round(transform.scale * 1000) / 1000
        }];
      })
    );

    console.log('[HYACYN] Copy these transform values into MODEL_CONFIG:', transforms);
  }

  update() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    this.cameraController.update(delta, elapsed);

    if (this.state.mode === 'focus' && this.state.selectedLook) {
      const pivot = this.models[this.state.selectedLook]?.pivot;

      if (pivot) {
        pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, this.focusRotationTarget, 5.5, delta);
      }
    }

    if (this.state.selectedLook) {
      this.lighting.updateSelectedPosition(
        this.getLookWorldPosition(this.state.selectedLook),
        this.state.mode
      );
    }

    for (const key of ['look3', 'look11']) {
      this.lighting.updateLookAccentPosition(key, this.getLookBasePosition(key));
    }

    this.hotspotManager?.update({
      mode: this.state.mode,
      selectedLook: this.state.selectedLook
    });

    if (this.debugTargetHelper) {
      this.debugTargetHelper.position.copy(this.cameraController.baseTarget);
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = window.requestAnimationFrame(this.update);
  }

  start() {
    this.clock.start();
    this.update();
  }

  dispose() {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('click', this.handleCanvasClick);
    this.renderer.domElement.removeEventListener('wheel', this.handleWheel);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.modelLoader?.dispose();
    this.environmentMap?.dispose();
    this.pmremGenerator?.dispose();
    this.gui?.destroy();
  }
}
