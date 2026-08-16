import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  applyTransform,
  centerModel,
  fitModelToHeight,
  getModelMeasurements,
  moveLowestPointToY
} from '../utils/modelUtils.js';

export class ModelLoader {
  constructor({ manager, onProgress, onError } = {}) {
    this.manager = manager || new THREE.LoadingManager();
    this.onProgress = onProgress;
    this.onError = onError;
    this.progressRecords = new Map();
    this.completed = 0;
    this.total = 0;

    this.dracoLoader = new DRACOLoader(this.manager);
    this.dracoLoader.setDecoderPath('/draco/');
    this.dracoLoader.setDecoderConfig({ type: 'wasm' });

    this.loader = new GLTFLoader(this.manager);
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  async loadAll(config) {
    const entries = Object.entries(config);
    this.total = entries.length;

    const results = await Promise.all(entries.map(([key, modelConfig]) => this.loadModel(key, modelConfig)));
    const models = {};
    const errors = [];

    for (const result of results) {
      if (result.error) {
        errors.push(result);
      } else {
        models[result.key] = result;
      }
    }

    this.emitProgress(1);

    return { models, errors };
  }

  loadModel(key, config) {
    this.progressRecords.set(key, {
      loaded: 0,
      total: 0,
      done: false
    });

    return new Promise((resolve) => {
      this.loader.load(
        config.path,
        (gltf) => {
          this.completed += 1;
          this.progressRecords.set(key, {
            loaded: 1,
            total: 1,
            done: true
          });
          this.emitProgress();

          resolve(this.prepareModel(key, config, gltf));
        },
        (event) => {
          const record = this.progressRecords.get(key);
          record.loaded = event.loaded || record.loaded;
          record.total = event.lengthComputable ? event.total : record.total;
          this.emitProgress();
        },
        (error) => {
          this.completed += 1;
          this.progressRecords.set(key, {
            loaded: 1,
            total: 1,
            done: true
          });
          this.emitProgress();

          const normalizedError = {
            key,
            path: config.path,
            error
          };
          this.onError?.(normalizedError);
          resolve(normalizedError);
        }
      );
    });
  }

  prepareModel(key, config, gltf) {
    const model = gltf.scene || gltf.scenes[0];
    model.name = `${key}Model`;

    const rawMetrics = getModelMeasurements(model);

    if (config.normalize?.center) {
      centerModel(model);
    }

    if (config.normalize?.fitHeight) {
      fitModelToHeight(model, config.normalize.fitHeight);
    }

    if (config.normalize?.floor) {
      moveLowestPointToY(model, 0);
    }

    const pivot = new THREE.Group();
    pivot.name = `${key}Pivot`;
    pivot.add(model);
    applyTransform(pivot, config);

    const selectableMeshes = [];
    this.configureModelMeshes(model, key, config, selectableMeshes);

    return {
      key,
      path: config.path,
      gltf,
      pivot,
      model,
      selectableMeshes,
      metrics: {
        raw: rawMetrics,
        normalized: getModelMeasurements(model)
      }
    };
  }

  configureModelMeshes(model, key, config, selectableMeshes) {
    model.traverse((child) => {
      if (!child.isMesh) {
        return;
      }

      child.castShadow = Boolean(config.shadows?.cast);
      child.receiveShadow = Boolean(config.shadows?.receive);

      if (key === 'look3' || key === 'look11') {
        child.userData.lookKey = key;
        selectableMeshes.push(child);
      }

      this.constrainMaterial(child.material, config.material);
    });
  }

  constrainMaterial(material, materialConfig) {
    if (!material || !materialConfig) {
      return;
    }

    const materials = Array.isArray(material) ? material : [material];

    for (const item of materials) {
      if (!item || (!item.isMeshStandardMaterial && !item.isMeshPhysicalMaterial)) {
        continue;
      }

      if (typeof materialConfig.minRoughness === 'number') {
        item.roughness = Math.max(item.roughness ?? 0.5, materialConfig.minRoughness);
      }

      if (typeof materialConfig.maxMetalness === 'number') {
        item.metalness = Math.min(item.metalness ?? 0, materialConfig.maxMetalness);
      }

      item.needsUpdate = true;
    }
  }

  emitProgress(forcedProgress) {
    if (typeof forcedProgress === 'number') {
      this.onProgress?.(forcedProgress);
      return;
    }

    const records = [...this.progressRecords.values()];
    const knownTotal = records.reduce((sum, record) => sum + record.total, 0);
    const knownLoaded = records.reduce((sum, record) => sum + Math.min(record.loaded, record.total || record.loaded), 0);

    if (knownTotal > 0) {
      this.onProgress?.(Math.min(knownLoaded / knownTotal, 0.995));
      return;
    }

    this.onProgress?.(Math.min(this.completed / Math.max(this.total, 1), 0.995));
  }

  dispose() {
    this.dracoLoader.dispose();
  }
}
