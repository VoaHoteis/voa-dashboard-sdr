/**
 * Tipos e rotulos do dashboard de Marketing Inbound.
 *
 * Fica separado de `marketing.ts` de proposito: este arquivo nao importa nada
 * do servidor (nem Pipedrive, nem process.env), entao pode ser usado tanto pela
 * rota de API quanto pelos componentes de tela sem arrastar codigo de servidor
 * para o bundle do navegador -- o mesmo cuidado que `config.ts` ja tem.
 */

/**
 * Status de pre-qualificacao do lead, na ordem em que aparecem na planilha
 * "Mensal Marketing Inbound". Cada lead cai em exatamente um destes, entao a
 * soma dos status fecha com o total de leads do mes.
 *
 * Hoje vem do Kinbox (bot de pre-qualificacao). O nome de cada status na conta
 * do Kinbox e mapeado para uma destas chaves no conector.
 */
export type StatusLead =
  | 'duplicado'
  | 'semRetorno'
  | 'emContato'
  | 'desqualificado'
  | 'desqualificadoTempoLimite'
  | 'qualificado';

export const STATUS_ORDEM: StatusLead[] = [
  'duplicado',
  'semRetorno',
  'emContato',
  'desqualificado',
  'desqualificadoTempoLimite',
  'qualificado',
];

export const STATUS_LABEL: Record<StatusLead, string> = {
  duplicado: 'Duplicado',
  semRetorno: 'Sem Retorno',
  emContato: 'Em Contato',
  desqualificado: 'Desqualificado',
  desqualificadoTempoLimite: 'Desq. por Tempo Limite',
  qualificado: 'Qualificado',
};

export interface LeadsDoMes {
  /** Todos os leads que entraram no mes (topo de funil). */
  total: number;
  /** Quebra por status de pre-qualificacao; soma dos valores = total. */
  status: Record<StatusLead, number>;
}

/** Uma linha da tabela mensal: o mes com os numeros das tres fontes. */
export interface MesMarketing {
  ano: number;
  /** 1 = janeiro ... 12 = dezembro. */
  mes: number;
  /** Topo de funil e status -- Kinbox. */
  leads: LeadsDoMes;
  /** Reunioes realizadas no mes -- Pipedrive. */
  reunioes: number;
  /** Contratos ganhos no mes -- Pipedrive. */
  contratos: number;
  /** Soma do valor dos contratos ganhos (MRR total) -- Pipedrive. */
  mrr: number;
  /** Investimento em midia (Meta Ads) no mes -- Windsor.ai / Looker. */
  investimento: number;
}

/**
 * De onde veio cada bloco de numeros:
 * - 'live' : da API real da fonte;
 * - 'mock' : estimativa deterministica, porque a fonte ainda nao esta conectada.
 *
 * A tela mostra isso ao lado da tabela -- nenhum numero estimado se passa por real.
 */
export type Origem = 'live' | 'mock';

export interface FontesMarketing {
  /** Topo de funil e status de pre-qualificacao (Kinbox). */
  leads: Origem;
  /** Reunioes, contratos e MRR (Pipedrive). */
  pipedrive: Origem;
  /** Investimento em midia (Windsor.ai). */
  investimento: Origem;
}

export interface MarketingResposta {
  ano: number;
  /** Sempre 12 posicoes (janeiro a dezembro); meses futuros vem zerados. */
  meses: MesMarketing[];
  fontes: FontesMarketing;
}
