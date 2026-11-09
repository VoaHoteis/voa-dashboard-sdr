export type QueueAction = 'assumir' | 'passar_vez';
export type QueueSource = 'kinbox' | 'redirecionamento';
export type QueueReason = 'ausencia' | 'folga' | 'ferias' | 'vez_cedida';

export interface QueueMember {
  memberKey: string;
  sourceUserId: number | null;
  name: string;
  position: number | null;
  isActive: boolean;
  isEligible: boolean;
}

export interface QueueEvent {
  id: number;
  createdAt: string;
  action: QueueAction;
  queueMemberKey: string;
  queueMemberName: string;
  actorName: string | null;
  source: QueueSource | null;
  link: string | null;
  redirectedBy: string | null;
  hotelName: string | null;
  reason: QueueReason | null;
}

export interface QueuePersonMetrics {
  memberKey: string;
  name: string;
  atendimentos: number;
  kinbox: number;
  redirecionamentos: number;
  passadas: number;
  motivos: Record<QueueReason, number>;
}

export interface QueueSnapshot {
  queueVersion: string;
  members: QueueMember[];
  queue: QueueMember[];
  events: QueueEvent[];
  metrics: {
    atendimentos: number;
    passadas: number;
    pessoas: QueuePersonMetrics[];
    limit: number;
    considered: number;
  };
}

export type QueueActionInput =
  | {
      action: 'assumir';
      expectedMemberKey: string;
      expectedQueueVersion: string;
      source: 'kinbox';
      link: string;
    }
  | {
      action: 'assumir';
      expectedMemberKey: string;
      expectedQueueVersion: string;
      source: 'redirecionamento';
      redirectedBy: string;
      hotelName: string;
    }
  | {
      action: 'passar_vez';
      expectedMemberKey: string;
      expectedQueueVersion: string;
      reason: QueueReason;
    };

export interface QueueOrderInput {
  expectedQueueVersion: string;
  memberKeys: string[];
}
