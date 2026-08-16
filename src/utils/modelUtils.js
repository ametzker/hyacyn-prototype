import * as THREE from 'three';

const reusableBox = new THREE.Box3();
const reusableSize = new THREE.Vector3();
const reusableCenter = new THREE.Vector3();

export function calculateBoundingBox(object) {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

export function calculateDimensions(object) {
  const box = calculateBoundingBox(object);
  return box.getSize(new THREE.Vector3());
}

export function calculateCenter(object) {
  const box = calculateBoundingBox(object);
  return box.getCenter(new THREE.Vector3());
}

export function getModelMeasurements(object) {
  const box = calculateBoundingBox(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  return {
    min: box.min.toArray(),
    max: box.max.toArray(),
    size: size.toArray(),
    center: center.toArray()
  };
}

export function centerModel(object) {
  const center = calculateCenter(object);
  object.position.sub(center);
  object.updateWorldMatrix(true, true);
  return getModelMeasurements(object);
}

export function moveLowestPointToY(object, y = 0) {
  reusableBox.setFromObject(object);
  object.position.y += y - reusableBox.min.y;
  object.updateWorldMatrix(true, true);
  return getModelMeasurements(object);
}

export function fitModelToHeight(object, desiredHeight) {
  reusableBox.setFromObject(object);
  reusableBox.getSize(reusableSize);

  if (reusableSize.y <= 0) {
    return 1;
  }

  const factor = desiredHeight / reusableSize.y;
  object.scale.multiplyScalar(factor);
  object.updateWorldMatrix(true, true);
  return factor;
}

export function applyTransform(object, transform) {
  object.position.fromArray(transform.position);
  object.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);

  if (Array.isArray(transform.scale)) {
    object.scale.fromArray(transform.scale);
  } else {
    object.scale.setScalar(transform.scale);
  }

  object.updateWorldMatrix(true, true);
}

export function readTransform(object) {
  return {
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.x
  };
}

export function getLocalCenterOffset(object) {
  reusableBox.setFromObject(object);
  reusableBox.getCenter(reusableCenter);
  object.worldToLocal(reusableCenter);
  return reusableCenter.clone();
}

export function roundArray(values, precision = 3) {
  const factor = 10 ** precision;
  return values.map((value) => Math.round(value * factor) / factor);
}
