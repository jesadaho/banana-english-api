import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidBugReportStoragePath } from './bug-report-storage-path';
import {
  formatTicketCode,
  normalizeBugReportStatus,
  statusForFilter,
} from './bug-report-status';

describe('isValidBugReportStoragePath', () => {
  it('accepts app-written screenshot paths', () => {
    assert.equal(
      isValidBugReportStoragePath(
        'bug-reports/abcDEF0123456789xyz/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg',
      ),
      true,
    );
    assert.equal(
      isValidBugReportStoragePath(
        'bug-reports/firebase_uid-12345678/report-1.webp',
      ),
      true,
    );
  });

  it('rejects paths outside the bug-reports prefix', () => {
    assert.equal(isValidBugReportStoragePath('other/uid/file.jpg'), false);
    assert.equal(
      isValidBugReportStoragePath('bug-reports/../secrets/file.jpg'),
      false,
    );
    assert.equal(
      isValidBugReportStoragePath('bug-reports/uid/file.gif'),
      false,
    );
    assert.equal(isValidBugReportStoragePath('bug-reports/short/a.jpg'), false);
  });
});

describe('ticket status', () => {
  it('formats a human ticket code', () => {
    assert.equal(formatTicketCode(12), 'B-12');
  });

  it('only allows open and done', () => {
    assert.equal(normalizeBugReportStatus('open'), 'open');
    assert.equal(normalizeBugReportStatus('done'), 'done');
    assert.equal(normalizeBugReportStatus('in_progress'), null);
  });

  it('defaults the admin filter to open', () => {
    assert.equal(statusForFilter(undefined), 'open');
    assert.equal(statusForFilter('all'), undefined);
    assert.equal(statusForFilter('done'), 'done');
  });
});
