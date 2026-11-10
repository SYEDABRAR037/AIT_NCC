export const isValidFaceDescriptor = (value: unknown): value is number[] => {
  if (!Array.isArray(value) || value.length !== 128) return false;
  if (!value.every((item) => typeof item === 'number' && Number.isFinite(item))) return false;
  return value.some((item) => item !== 0);
};
