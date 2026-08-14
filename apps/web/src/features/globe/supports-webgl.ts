export function supportsWebGl(documentValue: Document = document): boolean {
  try {
    const canvas = documentValue.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
