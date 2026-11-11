type StampedeCallback = () => void;
const stampedeListeners = new Set<StampedeCallback>();

export function triggerStampede(): void {
  stampedeListeners.forEach((fn) => fn());
}

export function subscribeStampede(fn: StampedeCallback): () => void {
  stampedeListeners.add(fn);
  return () => {
    stampedeListeners.delete(fn);
  };
}
