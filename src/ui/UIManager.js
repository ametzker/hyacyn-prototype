import { gsap } from 'gsap';
import { looks } from './archiveData.js';

export class UIManager {
  constructor({ state }) {
    this.state = state;
    this.callbacks = new Map();
    this.hotspots = new Map();

    this.elements = {
      app: document.querySelector('#app'),
      sceneRoot: document.querySelector('[data-scene-root]'),
      loader: document.querySelector('[data-loader]'),
      loadingValue: document.querySelector('[data-loading-value]'),
      loadingError: document.querySelector('[data-loading-error]'),
      interfaceItems: [...document.querySelectorAll('[data-interface]')],
      hotspotRoot: document.querySelector('[data-hotspots]'),
      panel: document.querySelector('[data-look-panel]'),
      lookTitle: document.querySelector('[data-look-title]'),
      lookCollection: document.querySelector('[data-look-collection]'),
      lookIndex: document.querySelector('[data-look-index]'),
      garmentList: document.querySelector('[data-garment-list]'),
      lookInfo: document.querySelector('[data-look-info]'),
      closeLook: document.querySelector('[data-close-look]'),
      focusHelp: document.querySelector('[data-focus-help]'),
      backRunway: document.querySelector('[data-back-runway]'),
      aboutButton: document.querySelector('[data-about-button]'),
      aboutNote: document.querySelector('[data-about-note]')
    };

    this.createHotspots();
    this.bindEvents();
    this.setMode('loading');
  }

  on(eventName, callback) {
    if (!this.callbacks.has(eventName)) {
      this.callbacks.set(eventName, new Set());
    }

    this.callbacks.get(eventName).add(callback);
  }

  emit(eventName, payload) {
    for (const callback of this.callbacks.get(eventName) || []) {
      callback(payload);
    }
  }

  createHotspots() {
    for (const [key, look] of Object.entries(looks)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot is-hidden';
      button.dataset.lookKey = key;
      button.setAttribute('aria-label', `Open ${look.title}`);
      button.innerHTML = `
        <span class="hotspot__mark" aria-hidden="true"></span>
        <span>${look.title}</span>
      `;
      button.addEventListener('click', () => this.emit('selectLook', key));
      this.elements.hotspotRoot.append(button);
      this.hotspots.set(key, button);
    }
  }

  bindEvents() {
    this.elements.closeLook.addEventListener('click', () => this.emit('closeLook'));
    this.elements.backRunway.addEventListener('click', () => this.emit('closeLook'));

    this.elements.aboutButton.addEventListener('click', () => {
      const isOpen = !this.elements.aboutNote.hidden;
      this.elements.aboutNote.hidden = isOpen;
      this.elements.aboutButton.setAttribute('aria-expanded', String(!isOpen));

      gsap.to(this.elements.aboutNote, {
        autoAlpha: isOpen ? 0 : 1,
        duration: 0.28,
        ease: 'power2.out'
      });
    });

  }

  updateLoading(progress) {
    const clamped = Math.max(0, Math.min(progress, 1));
    const value = Math.floor(clamped * 100).toString().padStart(2, '0');
    this.elements.loadingValue.textContent = value;
  }

  showLoadingError(message) {
    this.elements.loadingError.hidden = false;
    this.elements.loadingError.textContent = message;
  }

  completeLoading() {
    this.updateLoading(1);
    this.elements.app.classList.remove('app--loading');
    this.elements.app.classList.add('app--ready');

    const interfaceElements = [...this.elements.interfaceItems, this.elements.hotspotRoot];

    gsap.set(this.elements.sceneRoot, { autoAlpha: 0 });
    gsap.set(interfaceElements, { autoAlpha: 0 });

    return new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(this.elements.loader, {
          autoAlpha: 0,
          duration: 0.65,
          ease: 'power2.out'
        })
        .to(this.elements.sceneRoot, {
          autoAlpha: 1,
          duration: 1.35,
          ease: 'power2.out'
        }, '-=0.22')
        .to(interfaceElements, {
          autoAlpha: 1,
          duration: 0.95,
          ease: 'power2.out',
          stagger: 0.035
        }, '-=0.62');
    });
  }

  setMode(mode) {
    this.elements.app.classList.toggle('app--look', mode === 'look');
    this.elements.app.classList.toggle('app--focus', mode === 'focus');
    this.elements.focusHelp.hidden = mode !== 'focus';

    gsap.to(this.elements.focusHelp, {
      autoAlpha: mode === 'focus' ? 1 : 0,
      duration: 0.36,
      ease: 'power2.out',
      overwrite: true
    });
  }

  openLookPanel(key) {
    const look = looks[key];

    if (!look) {
      return;
    }

    const panelOnLeft = window.matchMedia('(max-width: 640px)').matches && key === 'look11';
    const openDirection = panelOnLeft ? -100 : 100;

    this.elements.panel.classList.toggle('is-left', panelOnLeft);
    this.elements.lookTitle.textContent = look.title;
    this.elements.lookCollection.textContent = look.collection;
    this.elements.lookIndex.textContent = look.index;
    this.elements.lookInfo.textContent = look.info;
    this.elements.garmentList.replaceChildren(
      ...look.garments.map((garment, index) => {
        const item = document.createElement('li');
        const number = document.createElement('span');
        const label = document.createElement('span');
        number.textContent = String(index + 1).padStart(2, '0');
        label.textContent = garment;
        item.append(number, label);
        return item;
      })
    );

    this.elements.panel.setAttribute('aria-hidden', 'false');
    this.elements.panel.classList.add('is-open');

    gsap.killTweensOf(this.elements.panel);
    gsap.set(this.elements.panel, {
      autoAlpha: 0,
      xPercent: openDirection
    });
    gsap.to(this.elements.panel, {
      autoAlpha: 1,
      xPercent: 0,
      duration: 0.62,
      ease: 'power3.out',
      overwrite: true
    });
  }

  closeLookPanel({ immediate = false } = {}) {
    const closeDirection = this.elements.panel.classList.contains('is-left') ? -100 : 100;

    this.elements.panel.setAttribute('aria-hidden', 'true');
    this.elements.panel.classList.remove('is-open');

    gsap.killTweensOf(this.elements.panel);

    if (immediate) {
      gsap.set(this.elements.panel, {
        autoAlpha: 0,
        xPercent: closeDirection
      });
      return;
    }

    gsap.to(this.elements.panel, {
      autoAlpha: 0,
      xPercent: closeDirection,
      duration: 0.48,
      ease: 'power2.inOut',
      overwrite: true
    });
  }

  updateHotspotPosition(key, { x, y, visible, muted }) {
    const hotspot = this.hotspots.get(key);

    if (!hotspot) {
      return;
    }

    hotspot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    hotspot.classList.toggle('is-visible', visible);
    hotspot.classList.toggle('is-hidden', !visible);
    hotspot.classList.toggle('is-muted', Boolean(muted));
  }

  setHotspotHover(key) {
    for (const [hotspotKey, element] of this.hotspots) {
      element.classList.toggle('is-hovered', hotspotKey === key);
    }
  }

  setSceneCursor(mode) {
    const root = this.elements.sceneRoot;
    root.classList.toggle('is-pointer', mode === 'pointer');
    root.classList.toggle('is-grab', mode === 'grab');
    root.classList.toggle('is-grabbing', mode === 'grabbing');
  }
}
