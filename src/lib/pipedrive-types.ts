import type { ISODate } from './dates';

export interface Atividade {
  id: number;
  type: string;
  subject: string;
  done: boolean;
  due_date: ISODate | null;
  due_time?: string | null;
  duration?: string | null;
  location?: string | null;
  /** Data em que foi concluída, em UTC; é a base das métricas de esforço diário. */
  marked_as_done_time: string | null;
  deal_id: number | null;
  user_id: number | null;
}

export interface Negocio {
  id: number;
  title: string;
  pipeline_id: number;
  stage_id: number;
  status: string;
  undone_activities_count: number;
  next_activity_date: ISODate | null;
  [campoPersonalizado: string]: unknown;
}
