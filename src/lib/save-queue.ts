// Keep snapshot writes ordered, including a write requested just before backup.
export function createSaveQueue<T>(save: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  return (value: T): Promise<void> => {
    const next = tail.catch(() => undefined).then(() => save(value));
    tail = next;
    return next;
  };
}
