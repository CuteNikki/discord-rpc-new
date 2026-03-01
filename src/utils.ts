// Safe fallback generator for Node < 14.17.0
export const generateNonce = (): string => {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Spec-compliant UUID v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
