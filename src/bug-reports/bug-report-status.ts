export const BUG_REPORT_STATUSES = ['open', 'done'] as const;

export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

export function isBugReportStatus(value: string): value is BugReportStatus {
  return (BUG_REPORT_STATUSES as readonly string[]).includes(value);
}

export function normalizeBugReportStatus(
  value: string | undefined,
): BugReportStatus | null {
  const raw = value?.trim().toLowerCase() ?? '';
  if (raw === 'resolved') return 'done';
  if (isBugReportStatus(raw)) return raw;
  return null;
}

export function formatTicketCode(ticketNumber: number): string {
  return `B-${ticketNumber}`;
}

export function statusForFilter(
  filter: string | undefined,
): BugReportStatus | undefined {
  const raw = filter?.trim().toLowerCase() || 'open';
  if (raw === 'all') return undefined;
  return normalizeBugReportStatus(raw) ?? 'open';
}
