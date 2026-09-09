/**
 * Regras de negocio do dashboard de metas do time de SDR.
 *
 * Tudo que e "conhecimento sobre o Pipedrive da VOA" mora aqui. Se o time mudar
 * meta, etapa de funil ou tipo de atividade, este e o unico arquivo a mexer.
 */

export const PIPELINES = {
  novosNegocios: 6,
  salabim: 10,
} as const;

export type FunnelKey = keyof typeof PIPELINES;

export const FUNNEL_LABEL: Record<FunnelKey, string> = {
  novosNegocios: 'Novos Negócios',
  salabim: 'Salabim',
};

export const PIPELINE_TO_FUNNEL: Record<number, FunnelKey> = {
  [PIPELINES.novosNegocios]: 'novosNegocios',
  [PIPELINES.salabim]: 'salabim',
};

/**
 * Campo personalizado "SDR" do negocio. Tipo `set`: o valor vem como string de
 * ids separados por virgula ("645,680"). E este campo que define de quem e o
 * agendamento / o funil / a saude -- nao o dono (`owner_id`) do negocio nem da
 * atividade, que nao batem com a operacao real do time.
 */
export const SDR_FIELD_KEY = '8bf893d50586a148d5a5f39bb09198ae3edfb7d5';

export type SdrKey = 'juliana' | 'barbara';

export interface SdrConfig {
  key: SdrKey;
  nome: string;
  /** Opcao do campo personalizado "SDR" do negocio. */
  sdrOptionId: number;
  /** Usuario do Pipedrive -- usado no card de Atividades (executor real). */
  userId: number;
  metas: Record<FunnelKey, number>;
}

export const SDRS: SdrConfig[] = [
  {
    key: 'juliana',
    nome: 'Juliana',
    sdrOptionId: 645,
    userId: 27038398,
    metas: { novosNegocios: 20, salabim: 10 },
  },
  {
    key: 'barbara',
    nome: 'Bárbara Almeida',
    sdrOptionId: 680,
    userId: 27867501,
    metas: { novosNegocios: 20, salabim: 10 },
  },
];

/** Meta do time = soma das metas individuais (40 Novos + 20 Salabim = 60). */
export const METAS_TIME: Record<FunnelKey, number> = {
  novosNegocios: SDRS.reduce((s, x) => s + x.metas.novosNegocios, 0),
  salabim: SDRS.reduce((s, x) => s + x.metas.salabim, 0),
};

export const META_TIME_TOTAL = METAS_TIME.novosNegocios + METAS_TIME.salabim;

/**
 * Um "agendamento" e uma atividade de um destes 3 tipos, concluida, com negocio
 * vinculado num dos dois funis.
 *
 * Fica de fora de proposito o tipo inativo `apresentacao_institucional`
 * ("Reuniao de Apresentacao" duplicado) -- decisao do Joao.
 */
export const TIPOS_AGENDAMENTO = [
  'reuniao_de_apresentacao_gc',
  'meeting',
  'visita_presencial',
] as const;

/**
 * No-show = atividade concluida deste tipo.
 *
 * Diferente do agendamento, aqui o negocio vinculado NAO e exigido: 15 a 25% dos
 * no-shows sao lancados sem vinculo (1 em jun, 8 em jul, 4 em ago, 2 em set) e
 * sao no-shows de verdade, so nao ligados ao negocio. Exigir o vinculo esconderia
 * um quarto do numero. Eles entram no total e aparecem como "sem funil".
 */
export const TIPO_NO_SHOW = 'registro_de_no_show';

/** Tipos de atividade de esforco, do card "Atividades por semana". */
export const TIPOS_ESFORCO = [
  { key: 'ligacao_de_prospeccao_plan', label: 'Ligação de Prospecção', cor: '#C4FF3D' },
  { key: 'whatsapp', label: 'Follow up WhatsApp', cor: '#5CD0FF' },
  { key: 'primeiro_contato', label: 'Follow up', cor: '#F2A33C' },
  { key: 'pesquisa_de_qualificacao', label: 'Qualificação', cor: '#B98CFF' },
  { key: 'envio_de_e_mail', label: 'Envio de E-mail', cor: '#FF7A8A' },
  { key: 'tentativa_de_contato', label: 'Tentativa não efetiva', cor: '#6E7A63' },
] as const;

export type EtapaKey = 'preQualificacao' | 'emContato' | 'reagendamento' | 'apresentacaoAgendada';

export const ETAPA_LABEL: Record<EtapaKey, string> = {
  preQualificacao: 'Pré Qualificação',
  emContato: 'Em Contato',
  reagendamento: 'Reagendamento',
  apresentacaoAgendada: 'Apresentação Agendada',
};

export const ETAPAS_ORDEM: EtapaKey[] = [
  'preQualificacao',
  'emContato',
  'reagendamento',
  'apresentacaoAgendada',
];

/**
 * stage_id por funil. Lista vazia = a etapa nao existe naquele funil, e a tabela
 * mostra "-" em vez de zero (sao coisas diferentes).
 *
 * O Salabim tem duas particularidades:
 * - **nao tem Pre Qualificacao**. O handoff mandava usar "Disparo Enviado" (70)
 *   como equivalente, mas o Joao corrigiu em 08/09/2026: sao coisas distintas.
 *   Os ~378 negocios abertos no stage 70 nao entram em nenhuma etapa hoje.
 * - "Em Contato Avancado" (71) e somado a "Em Contato" (77).
 */
export const STAGES: Record<FunnelKey, Record<EtapaKey, number[]>> = {
  novosNegocios: {
    preQualificacao: [34],
    emContato: [35],
    reagendamento: [52],
    apresentacaoAgendada: [36],
  },
  salabim: {
    preQualificacao: [],
    emContato: [77, 71],
    reagendamento: [72],
    apresentacaoAgendada: [73],
  },
};

/** A etapa existe naquele funil? Distingue "nao se aplica" de "zero negocios". */
export function etapaExiste(funil: FunnelKey, etapa: EtapaKey): boolean {
  return STAGES[funil][etapa].length > 0;
}

/**
 * A Pre Qualificacao / Disparo Enviado nao entra no calculo de saude: e um
 * repositorio de leads, atividade vencida ali nao significa nada.
 */
export const ETAPAS_FORA_DA_SAUDE: EtapaKey[] = ['preQualificacao'];

/** Margens do indicador de temperatura do card "Detalhamento SDR". */
export const RITMO_ACIMA = 1.1;
export const RITMO_NO_RITMO = 0.9;

/**
 * Unidade de contagem dos agendamentos.
 * - 'atividades': cada reuniao concluida conta 1 (dois encontros com o mesmo
 *   hotel no periodo contam 2). E o comportamento do prototipo.
 * - 'negocios': conta negocios distintos com pelo menos uma reuniao no periodo.
 *
 * Ponto ainda nao confirmado com o Joao. A API aceita `?unidade=` para trocar
 * sem redeploy, e o dashboard mostra os dois numeros quando divergem.
 */
export type UnidadeContagem = 'atividades' | 'negocios';
export const UNIDADE_PADRAO: UnidadeContagem = 'atividades';

/**
 * Mostra as notas de rodape dos cards (as que explicam de onde vem cada numero
 * e por que a atribuicao muda de campo entre eles).
 *
 * Desligadas em 09/09/2026 a pedido do Joao, para avaliar o visual sem elas.
 * Uma linha para voltar. O conteudo continua no codigo, nao foi apagado -- e a
 * explicacao de decisoes que ninguem lembra em janeiro.
 */
export const MOSTRAR_NOTAS = false;

export const CORES = {
  fundo: '#0B0C0A',
  painel: '#131512',
  borda: '#232720',
  texto: '#F1F3ED',
  textoFraco: '#8A9080',
  salabim: '#C4FF3D',
  novosNegocios: '#5CD0FF',
  alerta: '#FF7A8A',
  atencao: '#F2A33C',
} as const;

export const CORES_FUNIL: Record<FunnelKey, string> = {
  salabim: CORES.salabim,
  novosNegocios: CORES.novosNegocios,
};
