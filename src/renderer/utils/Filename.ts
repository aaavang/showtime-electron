export const getFilename = (path: string) => {
  // Use regex to handle both forward (/) and backward (\) slashes as path separators
  const pathParts = path.split(/[/\\]/);
  // Get the last part of the path which is the filename with extension
  const filenameWithExtension = pathParts.pop() || '';
  // Remove the extension by slicing off the last dot and everything after it
  return filenameWithExtension.split('.').slice(0, -1).join('.');
};
