export function createMutableSearchParams() {
  const params = new URLSearchParams();

  const reset = () => {
    const keys = Array.from(params.keys());
    for (const key of keys) {
      params.delete(key);
    }
  };

  return { params, reset };
}
