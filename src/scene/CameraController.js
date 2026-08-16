import * as THREE from 'three';
import { gsap } from 'gsap';

const vectorA = new THREE.Vector3();
const vectorB = new THREE.Vector3();
const vectorC = new THREE.Vector3();

export class CameraController {
  constructor(camera, config) {
    this.camera = camera;
    this.config = config;
    this.mode = 'loading';
    this.activeLook = null;
    this.pointer = new THREE.Vector2();
    this.rawPointer = new THREE.Vector2();
    this.scrollProgress = 0;
    this.focusZoom = 0.18;
    this.transitioning = false;

    this.viewportProfile = this.getViewportProfile();
    const initialView = this.getInitialView();

    this.basePosition = new THREE.Vector3().fromArray(initialView.position);
    this.baseTarget = new THREE.Vector3().fromArray(initialView.target);
    this.introPosition = new THREE.Vector3().fromArray(config.intro?.position || config.initial.position);
    this.introTarget = new THREE.Vector3().fromArray(config.intro?.target || config.initial.target);
    this.currentTarget = this.baseTarget.clone();

    this.lookPosition = this.basePosition.clone();
    this.lookTarget = this.baseTarget.clone();
    this.focusPosition = this.basePosition.clone();
    this.focusTarget = this.baseTarget.clone();
    this.activeFocusView = null;

    this.camera.position.copy(this.basePosition);
    this.camera.fov = initialView.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.currentTarget);
  }

  getViewportProfile(width = typeof window !== 'undefined' ? window.innerWidth : 1440) {
    return width <= 640 ? 'mobile' : 'desktop';
  }

  getInitialView(profile = this.viewportProfile) {
    return profile === 'mobile' && this.config.mobile?.initial
      ? this.config.mobile.initial
      : this.config.initial;
  }

  getLookView(key) {
    return this.viewportProfile === 'mobile' && this.config.mobile?.lookViews?.[key]
      ? this.config.mobile.lookViews[key]
      : this.config.lookViews[key];
  }

  getFocusView(key) {
    return this.viewportProfile === 'mobile' && this.config.mobile?.focusViews?.[key]
      ? this.config.mobile.focusViews[key]
      : this.config.focusViews[key];
  }

  setViewport(width) {
    const nextProfile = this.getViewportProfile(width);

    if (nextProfile === this.viewportProfile) {
      return;
    }

    this.viewportProfile = nextProfile;
    const initialView = this.getInitialView(nextProfile);
    this.basePosition.fromArray(initialView.position);
    this.baseTarget.fromArray(initialView.target);

    if (this.mode === 'runway' && !this.transitioning) {
      this.camera.position.copy(this.basePosition);
      this.currentTarget.copy(this.baseTarget);
      this.camera.fov = initialView.fov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.currentTarget);
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  setPointerFromEvent(event, rect) {
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.rawPointer.set(
      THREE.MathUtils.clamp(x, -1, 1),
      THREE.MathUtils.clamp(y, -1, 1)
    );
  }

  addScroll(deltaY) {
    if (this.mode === 'focus') {
      this.focusZoom = THREE.MathUtils.clamp(this.focusZoom + deltaY * 0.0012, 0, 1);
      return;
    }

    if (this.mode !== 'runway') {
      return;
    }

    this.scrollProgress = THREE.MathUtils.clamp(this.scrollProgress + deltaY * 0.00055, 0, 1);
  }

  playIntroDolly() {
    this.mode = 'runway';
    this.transitioning = false;
    this.camera.position.copy(this.basePosition);
    this.currentTarget.copy(this.baseTarget);
    this.camera.lookAt(this.currentTarget);
  }

  transitionToRunway() {
    this.activeLook = null;
    this.activeFocusView = null;
    this.mode = 'runway';
    this.transitioning = true;

    gsap.to(this.camera.position, {
      x: this.basePosition.x,
      y: this.basePosition.y,
      z: this.basePosition.z,
      duration: 1.45,
      ease: 'power3.inOut',
      overwrite: true
    });

    gsap.to(this.currentTarget, {
      x: this.baseTarget.x,
      y: this.baseTarget.y,
      z: this.baseTarget.z,
      duration: 1.45,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => this.camera.lookAt(this.currentTarget),
      onComplete: () => {
        this.transitioning = false;
      }
    });

    gsap.to(this.camera, {
      fov: this.getInitialView().fov,
      duration: 1.45,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => this.camera.updateProjectionMatrix()
    });
  }

  transitionToLook(key, modelPosition = null) {
    const view = this.resolveView(this.getLookView(key), modelPosition);

    if (!view) {
      return;
    }

    this.activeLook = key;
    this.mode = 'look';
    this.transitioning = true;
    this.lookPosition.fromArray(view.position);
    this.lookTarget.fromArray(view.target);

    this.transitionToView(view, 1.55, () => {
      this.transitioning = false;
    });
  }

  transitionToFocus(key, modelPosition = null) {
    const view = this.resolveView(this.getFocusView(key), modelPosition);

    if (!view) {
      return;
    }

    this.activeLook = key;
    this.mode = 'focus';
    this.transitioning = true;
    this.activeFocusView = view;
    this.focusZoom = 0.2;
    this.focusPosition.fromArray(view.position);
    this.focusTarget.fromArray(view.target);

    this.transitionToView(view, 1.35, () => {
      this.transitioning = false;
    });
  }

  transitionToView(view, duration, onComplete) {
    gsap.to(this.camera.position, {
      x: view.position[0],
      y: view.position[1],
      z: view.position[2],
      duration,
      ease: 'power3.inOut',
      overwrite: true
    });

    gsap.to(this.currentTarget, {
      x: view.target[0],
      y: view.target[1],
      z: view.target[2],
      duration,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => this.camera.lookAt(this.currentTarget),
      onComplete
    });

    gsap.to(this.camera, {
      fov: view.fov,
      duration,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => this.camera.updateProjectionMatrix()
    });
  }

  resolveView(view, modelPosition) {
    if (!view) {
      return null;
    }

    if (!modelPosition) {
      return view;
    }

    const target = vectorA
      .copy(modelPosition)
      .add(vectorB.fromArray(view.targetOffset || [0, 0, 0]));
    const position = view.cameraOffset
      ? vectorC.copy(target).add(vectorB.fromArray(view.cameraOffset))
      : vectorC.fromArray(view.position);

    return {
      ...view,
      position: position.toArray(),
      target: target.toArray()
    };
  }

  update(delta, elapsed) {
    this.updatePointer(delta);

    if (this.transitioning) {
      this.camera.lookAt(this.currentTarget);
      return;
    }

    if (this.mode === 'focus') {
      this.updateFocus(delta);
      return;
    }

    const isLookMode = this.mode === 'look' && this.activeLook;
    const basePosition = isLookMode ? this.lookPosition : this.basePosition;
    const baseTarget = isLookMode ? this.lookTarget : this.baseTarget;
    const pointerScale = isLookMode ? 0.28 : 1;
    const scrollScale = isLookMode ? 0 : this.scrollProgress;
    const smooth = 1 - Math.exp(-delta * 1.55);

    vectorA.copy(basePosition);
    vectorB.fromArray(this.config.scrollOffset).multiplyScalar(scrollScale);
    vectorA.add(vectorB);

    vectorA.x += this.pointer.x * this.config.mouse.positionX * pointerScale;
    vectorA.y += this.pointer.y * this.config.mouse.positionY * pointerScale;

    if (!isLookMode) {
      vectorA.x += Math.sin(elapsed * this.config.idle.speed) * this.config.idle.x;
      vectorA.y += Math.cos(elapsed * this.config.idle.speed * 0.82) * this.config.idle.y;
      vectorA.z += Math.sin(elapsed * this.config.idle.speed * 0.56) * this.config.idle.z;
    }

    vectorC.copy(baseTarget);
    vectorC.x += this.pointer.x * this.config.mouse.targetX * pointerScale;
    vectorC.y += this.pointer.y * this.config.mouse.targetY * pointerScale;

    this.camera.position.lerp(vectorA, smooth);
    this.currentTarget.lerp(vectorC, smooth);
    this.camera.lookAt(this.currentTarget);
  }

  updatePointer(delta) {
    this.pointer.x = THREE.MathUtils.damp(this.pointer.x, this.rawPointer.x, 2.2, delta);
    this.pointer.y = THREE.MathUtils.damp(this.pointer.y, this.rawPointer.y, 2.2, delta);
  }

  updateFocus(delta) {
    const view = this.activeFocusView || this.getFocusView(this.activeLook);

    if (!view) {
      return;
    }

    const smooth = 1 - Math.exp(-delta * 3.2);
    const target = vectorB.fromArray(view.target);
    const start = vectorA.fromArray(view.position);
    const direction = start.sub(target).normalize();
    const distance = THREE.MathUtils.lerp(view.maxDistance, view.minDistance, this.focusZoom);
    const desiredPosition = vectorC.copy(target).add(direction.multiplyScalar(distance));

    desiredPosition.x += this.pointer.x * 0.045;
    desiredPosition.y += this.pointer.y * 0.035;

    this.camera.position.lerp(desiredPosition, smooth);
    this.currentTarget.lerp(target, smooth);
    this.camera.lookAt(this.currentTarget);
  }

  setBasePositionAxis(axis, value) {
    this.basePosition[axis] = value;

    if (this.mode === 'runway' && !this.transitioning) {
      this.camera.position[axis] = value;
    }
  }

  setTargetAxis(axis, value) {
    this.baseTarget[axis] = value;

    if (this.mode === 'runway' && !this.transitioning) {
      this.currentTarget[axis] = value;
      this.camera.lookAt(this.currentTarget);
    }
  }

  setFov(value) {
    this.config.initial.fov = value;

    if (this.mode === 'runway' && !this.transitioning) {
      this.camera.fov = value;
      this.camera.updateProjectionMatrix();
    }
  }

  getDebugParams() {
    return {
      cameraPosition: {
        x: this.basePosition.x,
        y: this.basePosition.y,
        z: this.basePosition.z
      },
      cameraTarget: {
        x: this.baseTarget.x,
        y: this.baseTarget.y,
        z: this.baseTarget.z
      },
      cameraFov: this.config.initial.fov
    };
  }
}
