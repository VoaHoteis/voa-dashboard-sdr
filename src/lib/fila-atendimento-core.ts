import type {
  QueueActionInput,
  QueueOrderInput,
  QueueReason,
  QueueSource,
} from './fila-atendimento-types';

export const QUEUE_REASONS: Array<{ value: QueueReason; label: string }> = [
  { value: 'ausencia', label: 'Ausência' },
  { value: 'folga', label: 'Folga' },
  { value: 'ferias', label: 'Férias' },
  { value: 'vez_cedida', label: 'Vez Cedida' },
];

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isActionFormReady(form: {
  action: 'assumir' | 'passar_vez';
  source?: QueueSource | '';
  link?: string;
  redirectedBy?: string;
  hotelName?: string;
  reason?: QueueReason | '';
}) {
  if (form.action === 'passar_vez') return Boolean(form.reason);
  if (form.source === 'kinbox') return isValidHttpUrl(form.link ?? '');
  if (form.source === 'redirecionamento') {
    return Boolean(form.redirectedBy?.trim() && form.hotelName?.trim());
  }
  return false;
}

export function parseQueueActionInput(input: unknown): QueueActionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new QueueInputError('Os dados enviados não são válidos.');
  }

  const value = input as Record<string, unknown>;
  const expectedMemberKey = readText(value.expectedMemberKey, 'Pessoa da vez', 80);
  const expectedQueueVersion = readVersion(value.expectedQueueVersion);

  if (value.action === 'assumir') {
    if (value.source === 'kinbox') {
      const link = readText(value.link, 'Link do atendimento', 2048);
      if (!isValidHttpUrl(link)) throw new QueueInputError('Informe um link HTTP ou HTTPS válido.');
      return { action: 'assumir', expectedMemberKey, expectedQueueVersion, source: 'kinbox', link };
    }

    if (value.source === 'redirecionamento') {
      return {
        action: 'assumir',
        expectedMemberKey,
        expectedQueueVersion,
        source: 'redirecionamento',
        redirectedBy: readText(value.redirectedBy, 'Quem direcionou', 160),
        hotelName: readText(value.hotelName, 'Nome do hotel', 160),
      };
    }

    throw new QueueInputError('Selecione a origem do atendimento.');
  }

  if (value.action === 'passar_vez') {
    const reasons = new Set(QUEUE_REASONS.map(({ value: reason }) => reason));
    if (typeof value.reason !== 'string' || !reasons.has(value.reason as QueueReason)) {
      throw new QueueInputError('Selecione um motivo válido para passar a vez.');
    }
    return {
      action: 'passar_vez',
      expectedMemberKey,
      expectedQueueVersion,
      reason: value.reason as QueueReason,
    };
  }

  throw new QueueInputError('Ação inválida.');
}

export function parseQueueOrderInput(input: unknown): QueueOrderInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new QueueInputError('Os dados da fila não são válidos.');
  }

  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.memberKeys) || value.memberKeys.length > 50) {
    throw new QueueInputError('A lista de usuários não é válida.');
  }

  const memberKeys = value.memberKeys.map((memberKey) => readText(memberKey, 'Usuário', 80));
  if (new Set(memberKeys).size !== memberKeys.length) {
    throw new QueueInputError('A fila não pode conter usuários duplicados.');
  }

  return { memberKeys, expectedQueueVersion: readVersion(value.expectedQueueVersion) };
}

export function rotateQueue<T>(queue: T[]): T[] {
  if (queue.length < 2) return [...queue];
  return [...queue.slice(1), queue[0]];
}

export class QueueInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueInputError';
  }
}

export class QueueConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueConflictError';
  }
}

function readText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string') throw new QueueInputError(`${label} é obrigatório.`);
  const text = value.trim();
  if (!text) throw new QueueInputError(`${label} é obrigatório.`);
  if (text.length > maxLength) throw new QueueInputError(`${label} excede o tamanho permitido.`);
  return text;
}

function readVersion(value: unknown) {
  if (typeof value !== 'string' || value.length > 80 || !Number.isFinite(Date.parse(value))) {
    throw new QueueInputError('A versão da fila está ausente ou inválida. Atualize os dados e tente novamente.');
  }
  return value;
}
