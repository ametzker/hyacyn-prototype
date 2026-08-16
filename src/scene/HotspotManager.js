import * as THREE from 'three';

const worldPosition = new THREE.Vector3();
const screenPosition = new THREE.Vector3();

export class HotspotManager {
  constructor({ camera, container, ui }) {
    this.camera = camera;
    this.container = container;
    this.ui = ui;
    this.targets = {};
  }

  setTargets(targets) {
    this.targets = targets;
  }

  update({ mode, selectedLook }) {
    const rect = this.container.getBoundingClientRect();

    for (const [key, target] of Object.entries(this.targets)) {
      const offset = target.offset || [0, 1, 0];
      worldPosition.fromArray(offset);
      target.object.localToWorld(worldPosition);
      screenPosition.copy(worldPosition).project(this.camera);

      const inFront = screenPosition.z > -1 && screenPosition.z < 1;
      const visible = mode !== 'focus' && inFront;
      const muted = mode === 'look' && selectedLook && selectedLook !== key;

      this.ui.updateHotspotPosition(key, {
        x: (screenPosition.x * 0.5 + 0.5) * rect.width,
        y: (-screenPosition.y * 0.5 + 0.5) * rect.height,
        visible,
        muted
      });
    }
  }
}
