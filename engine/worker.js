/*
 * Pikafish UCI Web Worker adapter.
 * Engine build: https://github.com/brianhliou/pikafish-wasm/releases/tag/v0.1.0
 * Upstream source: https://github.com/official-pikafish/Pikafish
 * The WASM build and this adapter are used under GPL-3.0-or-later terms.
 */
let sendCommand = null;

async function loadNetwork(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`棋力网络下载失败：HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    self.postMessage({ type: 'net-progress', loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

self.addEventListener('message', async ({ data }) => {
  if (data?.type === 'init') {
    try {
      const root = new URL('./', self.location.href);
      const netPromise = loadNetwork(new URL('pikafish.nnue', root));
      const jsUrl = new URL('pikafish.js', root).href;
      importScripts(jsUrl);
      if (typeof self.Pikafish !== 'function') throw new Error('Pikafish WebAssembly 工厂函数未加载');
      const module = await self.Pikafish({
        locateFile: file => file.endsWith('.wasm') ? new URL('pikafish.wasm', root).href : file,
        mainScriptUrlOrBlob: jsUrl,
        print: line => self.postMessage({ type: 'line', line: String(line) }),
        printErr: line => self.postMessage({ type: 'stderr', line: String(line) }),
      });
      const net = await netPromise;
      module.FS.writeFile('/pikafish.nnue', net);
      const initialize = module.cwrap('pikafish_initialize', null, []);
      sendCommand = module.cwrap('pikafish_command', null, ['string']);
      initialize();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (data?.type === 'command' && typeof data.command === 'string') {
    if (!sendCommand) {
      self.postMessage({ type: 'error', error: 'Pikafish 尚未就绪' });
      return;
    }
    sendCommand(data.command);
  }
});
