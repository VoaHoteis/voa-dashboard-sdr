import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isActionFormReady,
  parseQueueActionInput,
  parseQueueOrderInput,
  QueueConflictError,
  QueueInputError,
} from './fila-atendimento-core';
import { createQueueService, type QueueDatabasePort, type QueueMemberRow, type QueueTransactionPort, type QueueEventInsert } from './fila-atendimento-service';
import type { QueueEvent } from './fila-atendimento-types';

class MemoryQueueDatabase implements QueueDatabasePort {
  private turn = Promise.resolve();
  private version = 'v1';
  private nextEventId = 1;
  members: QueueMemberRow[];
  events: QueueEvent[] = [];

  constructor(members: QueueMemberRow[]) {
    this.members = members.map((member) => ({ ...member }));
  }

  async transaction<T>(operation: (transaction: QueueTransactionPort) => Promise<T>): Promise<T> {
    const previousTurn = this.turn;
    let release!: () => void;
    this.turn = new Promise<void>((resolve) => { release = resolve; });
    await previousTurn;

    const original = {
      version: this.version,
      members: this.members.map((member) => ({ ...member })),
      events: [...this.events],
      nextEventId: this.nextEventId,
    };
    const transaction: QueueTransactionPort = {
      lockAndReadVersion: async () => this.version,
      getActiveQueue: async () =>
        this.members
          .filter((member) => member.isActive)
          .sort((a, b) => a.position - b.position || a.memberKey.localeCompare(b.memberKey))
          .map((member) => ({ ...member })),
      insertEvent: async (event: QueueEventInsert) => {
        const saved: QueueEvent = {
          ...event,
          id: this.nextEventId++,
          createdAt: new Date().toISOString(),
        };
        this.events.push(saved);
        return saved;
      },
      replaceQueueOrder: async (memberKeys, roster) => {
        for (const member of roster) {
          const existing = this.members.find((item) => item.memberKey === member.memberKey);
          if (existing) Object.assign(existing, member);
          else this.members.push({ ...member, position: 0, isActive: false });
        }
        this.members = this.members.map((member) => ({ ...member, isActive: false, position: 0 }));
        memberKeys.forEach((memberKey, position) => {
          const member = this.members.find((item) => item.memberKey === memberKey);
          if (!member) throw new Error('Membro ausente no teste.');
          member.position = position;
          member.isActive = true;
        });
      },
      advanceVersion: async () => {
        this.version = `v${Number(this.version.slice(1)) + 1}`;
        return this.version;
      },
    };

    try {
      return await operation(transaction);
    } catch (error) {
      this.version = original.version;
      this.members = original.members;
      this.events = original.events;
      this.nextEventId = original.nextEventId;
      throw error;
    } finally {
      release();
    }
  }
}

const member = (memberKey: string, position: number): QueueMemberRow => ({
  memberKey,
  sourceUserId: null,
  name: `Pessoa ${memberKey.toUpperCase()}`,
  position,
  isActive: true,
});

function assumeInput(expectedMemberKey: string, expectedQueueVersion = 'v1'): Parameters<ReturnType<typeof createQueueService>['registerAction']>[0] {
  return {
    action: 'assumir',
    expectedMemberKey,
    expectedQueueVersion,
    source: 'kinbox',
    link: 'https://kinbox.example/atendimento/42',
  };
}

describe('validação dos formulários', () => {
  it('habilita salvar apenas com os campos obrigatórios da origem', () => {
    assert.equal(isActionFormReady({ action: 'assumir', source: '' }), false);
    assert.equal(isActionFormReady({ action: 'assumir', source: 'kinbox', link: 'não é URL' }), false);
    assert.equal(isActionFormReady({ action: 'assumir', source: 'kinbox', link: 'https://kinbox.example/42' }), true);
    assert.equal(isActionFormReady({ action: 'assumir', source: 'redirecionamento', redirectedBy: ' Ana ', hotelName: '' }), false);
    assert.equal(isActionFormReady({ action: 'assumir', source: 'redirecionamento', redirectedBy: 'Ana', hotelName: 'Hotel Azul' }), true);
    assert.equal(isActionFormReady({ action: 'passar_vez', reason: '' }), false);
    assert.equal(isActionFormReady({ action: 'passar_vez', reason: 'folga' }), true);
  });

  it('valida e normaliza ações no servidor', () => {
    const parsed = parseQueueActionInput({
      action: 'assumir',
      expectedMemberKey: ' juliana ',
      expectedQueueVersion: '2026-11-09 10:00:00+00',
      source: 'kinbox',
      link: ' https://kinbox.example/ticket/42 ',
    });
    assert.equal(parsed.action, 'assumir');
    assert.equal(parsed.expectedMemberKey, 'juliana');
    if (parsed.action === 'assumir' && parsed.source === 'kinbox') {
      assert.equal(parsed.link, 'https://kinbox.example/ticket/42');
    } else {
      assert.fail('A origem Kinbox deveria ter sido mantida.');
    }
    assert.throws(
      () => parseQueueActionInput({ action: 'passar_vez', expectedMemberKey: 'juliana', expectedQueueVersion: '2026-11-09 10:00:00+00', reason: 'outro' }),
      QueueInputError
    );
    assert.throws(
      () => parseQueueActionInput({ action: 'assumir', expectedMemberKey: 'juliana', expectedQueueVersion: '2026-11-09 10:00:00+00', source: 'redirecionamento', redirectedBy: ' ', hotelName: 'Hotel Azul' }),
      QueueInputError
    );
  });

  it('permite composição vazia e rejeita usuários duplicados', () => {
    assert.deepEqual(
      parseQueueOrderInput({ expectedQueueVersion: '2026-11-09 10:00:00+00', memberKeys: [] }).memberKeys,
      []
    );
    assert.throws(
      () => parseQueueOrderInput({ expectedQueueVersion: '2026-11-09 10:00:00+00', memberKeys: ['juliana', 'juliana'] }),
      QueueInputError
    );
  });
});

describe('registro e rotação transacional', () => {
  it('registra o evento e mantém a única pessoa no topo', async () => {
    const database = new MemoryQueueDatabase([member('a', 0)]);
    const service = createQueueService(database);
    const result = await service.registerAction({
      action: 'passar_vez',
      expectedMemberKey: 'a',
      expectedQueueVersion: 'v1',
      reason: 'folga',
    });

    assert.equal(database.events.length, 1);
    assert.equal(database.events[0].queueMemberKey, 'a');
    assert.equal(database.events[0].reason, 'folga');
    assert.equal(database.members[0].position, 0);
    assert.equal(database.members[0].isActive, true);
    assert.equal(result.queueVersion, 'v2');
  });

  it('registra o redirecionamento com responsável e hotel', async () => {
    const database = new MemoryQueueDatabase([member('a', 0)]);
    const service = createQueueService(database);
    const result = await service.registerAction({
      action: 'assumir',
      expectedMemberKey: 'a',
      expectedQueueVersion: 'v1',
      source: 'redirecionamento',
      redirectedBy: 'Recepção',
      hotelName: 'Hotel Azul',
    });

    assert.equal(result.event.source, 'redirecionamento');
    assert.equal(result.event.redirectedBy, 'Recepção');
    assert.equal(result.event.hotelName, 'Hotel Azul');
    assert.equal(result.event.queueMemberName, 'Pessoa A');
  });

  it('move a pessoa do topo para o fim da fila', async () => {
    const database = new MemoryQueueDatabase([member('a', 0), member('b', 1), member('c', 2)]);
    const service = createQueueService(database);
    await service.registerAction(assumeInput('a'));

    assert.deepEqual(
      database.members.filter((item) => item.isActive).sort((a, b) => a.position - b.position).map((item) => item.memberKey),
      ['b', 'c', 'a']
    );
    assert.equal(database.events[0].action, 'assumir');
    assert.equal(database.events[0].source, 'kinbox');
    assert.equal(database.events[0].link, 'https://kinbox.example/atendimento/42');
  });

  it('serializa ações concorrentes e grava somente uma para a mesma versão', async () => {
    const database = new MemoryQueueDatabase([member('a', 0), member('b', 1)]);
    const service = createQueueService(database);
    const attempts = await Promise.allSettled([
      service.registerAction(assumeInput('a')),
      service.registerAction(assumeInput('a')),
    ]);

    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
    assert.equal(database.events.length, 1);
    assert.deepEqual(
      database.members.filter((item) => item.isActive).sort((a, b) => a.position - b.position).map((item) => item.memberKey),
      ['b', 'a']
    );
  });

  it('não registra ação se a pessoa esperada não está mais no topo', async () => {
    const database = new MemoryQueueDatabase([member('a', 0), member('b', 1)]);
    const service = createQueueService(database);
    await assert.rejects(service.registerAction(assumeInput('b')), QueueConflictError);
    assert.equal(database.events.length, 0);
  });

  it('permite salvar, reordenar e esvaziar a composição completa', async () => {
    const database = new MemoryQueueDatabase([]);
    const service = createQueueService(database);
    const saved = await service.saveQueue({ expectedQueueVersion: 'v1', memberKeys: ['barbara', 'juliana'] });
    assert.deepEqual(
      database.members.filter((item) => item.isActive).sort((a, b) => a.position - b.position).map((item) => item.memberKey),
      ['barbara', 'juliana']
    );
    const emptied = await service.saveQueue({ expectedQueueVersion: saved.queueVersion, memberKeys: [] });
    assert.equal(database.members.some((item) => item.isActive), false);
    assert.equal(emptied.queueVersion, 'v3');
  });

  it('recusa ações quando a fila está vazia', async () => {
    const database = new MemoryQueueDatabase([]);
    const service = createQueueService(database);
    await assert.rejects(service.registerAction(assumeInput('a')), QueueConflictError);
    assert.equal(database.events.length, 0);
  });
});
