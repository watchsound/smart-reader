
export const serializeArrayBuffer = (arrayBuffer) => {
  return Array.from(new Uint8Array(arrayBuffer));
};

export const deserializeArrayBuffer = (serialized) => {
  return new Uint8Array(serialized).buffer;
};
