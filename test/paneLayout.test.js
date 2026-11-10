import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

let server;
let useFileManagerStore;
const settingsKey = 'carelo.phase1.settings';
const storage = new Map();
const previousWindow = globalThis.window;

before(async () => {
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  server = await createServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ useFileManagerStore } = await server.ssrLoadModule('/src/stores/fileManagerStore.js'));
});

after(async () => {
  await server?.close();
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});

function createStore(settings = {}) {
  storage.clear();
  storage.set(settingsKey, JSON.stringify(settings));
  setActivePinia(createPinia());
  return useFileManagerStore();
}

test('new and existing installations default to single pane', () => {
  const store = createStore({ paneSplitPercent: 60 });
  assert.equal(store.dualPaneVisible, false);
  assert.equal(store.activePaneId, 'left');
  store.$dispose();
});

test('toggle keeps the active right pane and both sets of tabs intact', () => {
  const store = createStore({ dualPaneVisible: true });
  store.setActivePane('right');
  const left = store.panes.left;
  const right = store.panes.right;
  store.toggleDualPane();
  assert.equal(store.dualPaneVisible, false);
  assert.equal(store.activePaneId, 'right');
  store.switchActivePane();
  assert.equal(store.activePaneId, 'right', 'Tab must not activate a hidden pane');
  store.toggleDualPane();
  assert.equal(store.dualPaneVisible, true);
  assert.equal(store.panes.left, left);
  assert.equal(store.panes.right, right);
  store.$dispose();
});

test('explicitly focusing the hidden pane reveals the split layout', () => {
  const store = createStore();
  store.setActivePane('right');
  assert.equal(store.dualPaneVisible, true);
  assert.equal(store.activePaneId, 'right');
  store.setActivePane('nonexistent');
  assert.equal(store.activePaneId, 'right');
  store.$dispose();
});

test('layout and active pane persist and restore', async () => {
  const store = createStore();
  store.setActivePane('right');
  store.toggleDualPane();
  await nextTick();
  const settings = JSON.parse(storage.get(settingsKey));
  assert.equal(settings.dualPaneVisible, false);
  assert.equal(settings.activePaneId, 'right');
  store.$dispose();
  const restored = createStore(settings);
  assert.equal(restored.dualPaneVisible, false);
  assert.equal(restored.activePaneId, 'right');
  restored.toggleDualPane();
  await nextTick();
  assert.equal(JSON.parse(storage.get(settingsKey)).dualPaneVisible, true);
  restored.$dispose();
});
