import { LocalHost } from './localHost';
import type { FromWorker, ToHost } from './protocol';

// The worker's global scope, typed by hand: the client compiles against the DOM lib, not WebWorker.
const scope = self as unknown as {
  postMessage(msg: FromWorker): void;
  onmessage: ((e: MessageEvent<ToHost>) => void) | null;
};

const host = new LocalHost((msg) => scope.postMessage(msg));
scope.onmessage = (e) => host.handle(e.data);
