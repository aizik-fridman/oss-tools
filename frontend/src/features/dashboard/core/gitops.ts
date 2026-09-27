export const gitOpsTransientKeys = ['id', 'version', 'iteration'];

export function cleanForGitOps(dash: any): any {
  if (!dash || typeof dash !== 'object') return dash;
  
  // Create a deep copy to avoid mutating the original
  const newDash = JSON.parse(JSON.stringify(dash));
  
  // Only remove id, version, and iteration from the root level.
  // We MUST NOT remove "id" recursively, because panels use "id" for their identifiers.
  delete newDash.id;
  delete newDash.version;
  delete newDash.iteration;
  
  return newDash;
}