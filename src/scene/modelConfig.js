/**
 * EDIT THESE VALUES AFTER LOADING THE MESHY GLBs.
 * Open the site with ?debug=1 to visually tune them.
 */
export const MODEL_CONFIG = {
  church: {
    path: '/models/newchurch.glb',
    mobilePath: '/models/mobile/newchurch.glb',
    position: [0.1, -2.28, -6.55],
    rotation: [0, 0, 0],
    scale: 0.48,
    normalize: {
      center: false,
      floor: false
    },
    shadows: {
      cast: false,
      receive: true
    },
    material: {
      minRoughness: 0.78,
      maxMetalness: 0.12
    }
  },
  cars: {
    path: '/models/cars.glb',
    mobilePath: '/models/mobile/cars.glb',
    position: [-0.28, 0.5, -7.25],
    rotation: [0, -0.18, 0],
    scale: 4.18,
    normalize: {
      center: false,
      floor: true
    },
    shadows: {
      cast: true,
      receive: true
    },
    material: {
      minRoughness: 0.66,
      maxMetalness: 0.78
    }
  },
  look3: {
    path: '/models/look3.glb',
    mobilePath: '/models/mobile/look3.glb',
    position: [-2.05, 0.54, -2.25],
    rotation: [0, 0.54, 0],
    scale: 0.88,
    normalize: {
      center: false,
      floor: true
    },
    shadows: {
      cast: true,
      receive: true
    },
    hotspotOffset: [0, 1.62, 0]
  },
  look11: {
    path: '/models/look11.glb',
    mobilePath: '/models/mobile/look11.glb',
    position: [0.65, 0.66, 0.55],
    rotation: [0, -0.26, 0],
    scale: 0.98,
    normalize: {
      center: false,
      floor: true
    },
    shadows: {
      cast: true,
      receive: true
    },
    hotspotOffset: [0, 1.7, 0]
  }
};

export const CAMERA_CONFIG = {
  intro: {
    position: [-0.38, 1.74, 8.65],
    target: [0.32, 1.16, -7.7],
    duration: 2.15
  },
  initial: {
    position: [-0.52, 1.52, 5.85],
    target: [0.22, 1.14, -7.45],
    fov: 45
  },
  mobile: {
    initial: {
      position: [-0.06, 1.54, 6.25],
      target: [-0.48, 1.14, -4.35],
      fov: 62
    },
    lookViews: {
      look3: {
        targetOffset: [0.22, 0.78, 0],
        cameraOffset: [0.68, 0.32, 3.05],
        fov: 36
      },
      look11: {
        position: [0.65, 1.82, 3.4],
        targetOffset: [-0.27, 1.04, 0],
        fov: 38
      }
    },
    focusViews: {
      look3: {
        targetOffset: [0.58, 0.7, 0],
        cameraOffset: [0.58, 0.26, 1.92],
        fov: 26,
        minDistance: 1.22,
        maxDistance: 2.08
      },
      look11: {
        targetOffset: [0.56, 0.68, 0],
        cameraOffset: [0.54, 0.3, 1.86],
        fov: 26,
        minDistance: 1.24,
        maxDistance: 2.12
      }
    }
  },
  scrollOffset: [0.04, -0.02, -1.35],
  mouse: {
    positionX: 0.09,
    positionY: 0.032,
    targetX: 0.14,
    targetY: 0.065
  },
  idle: {
    x: 0.012,
    y: 0.008,
    z: 0.016,
    speed: 0.28
  },
  lookViews: {
    look3: {
      position: [-2.19, 1.58, 1.85],
      target: [-1.75, 1.31, -2.25],
      targetOffset: [0.3, 0.77, 0],
      cameraOffset: [-0.44, 0.27, 4.1],
      fov: 31
    },
    look11: {
      position: [2.65, 1.96, 4.95],
      target: [1.15, 1.5, 0.55],
      targetOffset: [0.5, 0.84, 0],
      cameraOffset: [1.5, 0.46, 4.4],
      fov: 30
    }
  },
  focusViews: {
    look3: {
      position: [-1.49, 1.48, -0.3],
      target: [-2.05, 1.22, -2.25],
      targetOffset: [0, 0.68, 0],
      cameraOffset: [0.56, 0.26, 1.95],
      fov: 23,
      minDistance: 1.28,
      maxDistance: 2.25
    },
    look11: {
      position: [0.07, 1.64, 2.45],
      target: [0.65, 1.32, 0.55],
      targetOffset: [0, 0.66, 0],
      cameraOffset: [-0.58, 0.34, 1.9],
      fov: 23,
      minDistance: 1.32,
      maxDistance: 2.38
    }
  }
};

export const RENDER_CONFIG = {
  exposure: 1.02,
  pixelRatioCap: 1.5,
  mobile: {
    antialias: false,
    pixelRatioCap: 1,
    shadows: false,
    skipEnvironment: true,
    exposure: 1.08,
    fogDensity: 0.019,
    carAccent: {
      color: 0xd9e5f2,
      intensity: 7.4,
      position: [-2.85, 2.55, -1.95],
      target: [-0.25, 0.95, -6.85],
      distance: 12,
      angle: 0.64,
      penumbra: 0.88,
      decay: 1.25
    }
  },
  environment: {
    path: '/hdr/studio.hdr',
    intensity: 0.2,
    useAsBackground: false,
    refractionIntensity: 0.28,
    refractionIor: 1.45,
    refractionThickness: 0.12
  },
  fogColor: 0x020202,
  fogDensity: 0.026,
  floor: {
    size: 34,
    y: 0.12,
    color: 0x010101,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.045
  }
};

export const LIGHT_CONFIG = {
  ambient: {
    color: 0xd8deea,
    intensity: 0.02
  },
  hemisphere: {
    skyColor: 0x8793a3,
    groundColor: 0x010101,
    intensity: 0.045
  },
  sun: {
    color: 0xd7e6ff,
    intensity: 1.25,
    position: [0, 9.5, -36],
    target: [0.05, 1.25, -4.2],
    shadowSize: 24
  },
  key: {
    color: 0xc5ceda,
    intensity: 7.2,
    position: [-5.8, 4.55, -1.1],
    target: [-0.9, 1.1, -5.8],
    distance: 20,
    angle: 0.29,
    penumbra: 0.86,
    decay: 1.2
  },
  entrance: {
    color: 0xdce8f5,
    intensity: 9.4,
    position: [0.4, 5.25, -13.8],
    target: [0.1, 0.92, -4.2],
    distance: 26,
    angle: 0.15,
    penumbra: 0.82,
    decay: 1.35
  },
  fill: {
    color: 0xaebdce,
    intensity: 1.15,
    position: [0.2, 2.15, 4.8],
    target: [-0.1, 1.05, -5.2],
    distance: 16,
    angle: 0.78,
    penumbra: 1,
    decay: 1.3
  },
  rim: {
    color: 0xcbd9eb,
    intensity: 6.2,
    position: [4.4, 3.05, -9.4],
    target: [-0.2, 1.1, -5.8],
    distance: 18,
    angle: 0.27,
    penumbra: 0.78,
    decay: 1.2
  },
  lookAccents: {
    look3: {
      color: 0xdce7f5,
      intensity: 3.2,
      selectedIntensity: 4.0,
      focusIntensity: 5.4,
      targetOffset: [0, 1.02, 0],
      positionOffset: [-1.15, 1.45, 2.1],
      distance: 8,
      angle: 0.31,
      penumbra: 0.9,
      decay: 1.2
    },
    look11: {
      color: 0xffdfcf,
      intensity: 5.3,
      selectedIntensity: 6.0,
      focusIntensity: 7.2,
      targetOffset: [0, 1.1, 0],
      positionOffset: [-1.0, 1.7, 2.05],
      distance: 8.5,
      angle: 0.29,
      penumbra: 0.88,
      decay: 1.2
    }
  },
  selected: {
    color: 0xeaf1ff,
    intensity: 0,
    selectedIntensity: 2.7,
    focusIntensity: 5.4,
    position: [0.7, 2.8, 2.5],
    positionOffset: [0.7, 2.8, 2.5],
    distance: 8,
    angle: 0.34,
    penumbra: 0.92,
    decay: 1.15
  }
};
