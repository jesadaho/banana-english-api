import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { ConfigService } from '@nestjs/config';
import { getLesson } from '../lessons/lessons.data';
import { reviveSessionData, type SessionPersistence } from './session-persistence';
import { SessionPersistenceInterceptor } from './session-persistence.interceptor';
import { SessionStoreService, type SessionData } from './session-store.service';

class MemoryPersistence implements SessionPersistence {
  rows = new Map<string, { json: string; expiresAt: Date }>();
  saves = 0;
  async load(id: string) {
    const row = this.rows.get(id);
    return row ? reviveSessionData(JSON.parse(row.json)) : null;
  }
  async save(id: string, data: SessionData, expiresAt: Date) {
    this.saves += 1;
    this.rows.set(id, { json: JSON.stringify(data), expiresAt });
  }
  async deleteExpired(now: Date) {
    let n = 0;
    for (const [id, row] of this.rows) if (row.expiresAt < now) { this.rows.delete(id); n++; }
    return n;
  }
}

const config = { get: (_k: string, d?: unknown) => d } as unknown as ConfigService;
const lesson = getLesson('pron_phonics_05_short_u')!;

function ctx(sessionId?: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ params: sessionId ? { sessionId } : {} }) }),
  } as any;
}

describe('live session persistence', () => {
  it('survives a restart: new instance loads the session from the DB', async () => {
    const db = new MemoryPersistence();
    const before = new SessionStoreService(config, db);
    let id = '';
    await before.runInRequest(async () => {
      const data = before.createTraining(lesson, 'Rookie');
      id = data.session.id;
      before.addTurn(id, { speaker: 'ai', textEn: 'hello', v7Step: 1 });
      data.session.progressTurn = 1; // direct mutation, like the controller
      before.markEnded(id);
      await before.flushTouched();
    });

    const after = new SessionStoreService(config, db); // fresh memory = after deploy
    assert.equal(after.get(id), undefined);
    await after.hydrate(id);
    const loaded = after.get(id)!;
    assert.equal(loaded.turns.length, 1);
    assert.equal(loaded.session.progressTurn, 1);
    assert.ok(loaded.endedAt instanceof Date);
    assert.equal(loaded.learnerFirstName, 'Rookie');
  });

  it('interceptor hydrates before and saves after, even when the handler throws', async () => {
    const db = new MemoryPersistence();
    const seed = new SessionStoreService(config, db);
    let id = '';
    await seed.runInRequest(async () => {
      id = seed.createTraining(lesson).session.id;
      await seed.flushTouched();
    });

    const store = new SessionStoreService(config, db);
    const interceptor = new SessionPersistenceInterceptor(store);
    const ok = await lastValueFrom(
      interceptor.intercept(ctx(id), {
        handle: () => {
          store.addTurn(id, { speaker: 'user', textEn: 'cup' });
          return of('done');
        },
      }),
    );
    assert.equal(ok, 'done');
    assert.equal(JSON.parse(db.rows.get(id)!.json).turns.length, 1);

    await assert.rejects(
      lastValueFrom(
        interceptor.intercept(ctx(id), {
          handle: () => {
            store.addTurn(id, { speaker: 'ai', textEn: 'retry' });
            return throwError(() => new Error('gemini down'));
          },
        }),
      ),
      /gemini down/,
    );
    assert.equal(JSON.parse(db.rows.get(id)!.json).turns.length, 2);
  });

  it('does not write sessions a request never touched, and works without a DB', async () => {
    const db = new MemoryPersistence();
    const store = new SessionStoreService(config, db);
    await store.runInRequest(async () => store.flushTouched());
    assert.equal(db.saves, 0);

    const memoryOnly = new SessionStoreService(config);
    await memoryOnly.runInRequest(async () => {
      const id = memoryOnly.createTraining(lesson).session.id;
      await memoryOnly.hydrate('missing');
      await memoryOnly.flushTouched();
      assert.ok(memoryOnly.get(id));
    });
  });

  it('cleanup drops expired rows', async () => {
    const db = new MemoryPersistence();
    db.rows.set('old', { json: '{}', expiresAt: new Date(Date.now() - 1000) });
    const store = new SessionStoreService(config, db);
    await store.cleanup();
    assert.equal(db.rows.has('old'), false);
  });
});
