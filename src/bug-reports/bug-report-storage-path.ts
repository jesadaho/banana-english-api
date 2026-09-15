/** Firebase Storage object path written by the app for a bug screenshot. */
const BUG_REPORT_STORAGE_PATH =
  /^bug-reports\/[A-Za-z0-9_-]{8,128}\/[A-Za-z0-9-]{8,64}\.(jpe?g|png|webp)$/i;

export function isValidBugReportStoragePath(path: string): boolean {
  return BUG_REPORT_STORAGE_PATH.test(path.trim());
}
