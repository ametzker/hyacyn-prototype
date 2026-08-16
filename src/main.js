import './style.css';
import { SceneManager } from './scene/SceneManager.js';
import { UIManager } from './ui/UIManager.js';

const state = {
  mode: 'loading',
  selectedLook: null,
  loaded: false
};

const debug = new URLSearchParams(window.location.search).get('debug') === '1';
const ui = new UIManager({ state });
const sceneManager = new SceneManager({
  container: document.querySelector('[data-scene-root]'),
  ui,
  state,
  debug
});

ui.on('selectLook', (key) => sceneManager.selectLook(key));
ui.on('closeLook', () => sceneManager.closeLook());

sceneManager.init().catch((error) => {
  console.error('[HYACYN] Fatal scene initialization error:', error);
  ui.showLoadingError('The archive could not initialize. Check the console for details.');
});
