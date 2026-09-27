export const gitOpsTransientKeys = ['id', 'version', 'iteration'];

export function cleanForGitOps(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanForGitOps);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!gitOpsTransientKeys.includes(key)) {
        newObj[key] = cleanForGitOps(value);
      }
    }
    return newObj;
  }
  return obj;
}
