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

/**
 * Papel de quem pode aparecer atribuido a um agendamento.
 * - 'sdr'     : as duas com meta (Juliana e Barbara);
 * - 'closer'  : Bruno e Joao -- fazem agendamentos, mas nao tem meta de SDR;
 * - 'inativo' : quem saiu do time ou nao atua mais como SDR. Continua no campo
 *               SDR de negocios antigos, entao precisa de nome, senao o
 *               agendamento apareceria como "sem SDR" -- que e falso: o campo
 *               esta preenchido, so nao com alguem ativo.
 */
export type Papel = 'sdr' | 'closer' | 'inativo';

export interface Pessoa {
  key: string;
  nome: string;
  /** Opcao do campo personalizado "SDR" do negocio. */
  sdrOptionId?: number;
  /** Usuario do Pipedrive -- dono de negocio e executor de atividade. */
  userId?: number;
  papel: Papel;
  metas?: Record<FunnelKey, number>;
}

export interface SdrConfig extends Pessoa {
  key: SdrKey;
  sdrOptionId: number;
  userId: number;
  papel: 'sdr';
  metas: Record<FunnelKey, number>;
}

/** Só estas duas têm meta e aparecem nos cards de meta, funil e atividades. */
export const SDRS: SdrConfig[] = [
  {
    key: 'juliana',
    nome: 'Juliana',
    sdrOptionId: 645,
    userId: 27038398,
    papel: 'sdr',
    metas: { novosNegocios: 20, salabim: 10 },
  },
  {
    key: 'barbara',
    nome: 'Bárbara Almeida',
    sdrOptionId: 680,
    userId: 27867501,
    papel: 'sdr',
    metas: { novosNegocios: 20, salabim: 10 },
  },
];

/**
 * Todo mundo que pode aparecer atribuido a um agendamento.
 *
 * Cobre as nove opcoes do campo SDR mais quem so aparece como dono de negocio.
 * Sem esta lista, um agendamento do Bruno ou da Mariana caia em "sem SDR", o que
 * e factualmente errado: o campo esta preenchido.
 */
export const PESSOAS: Pessoa[] = [
  ...SDRS,
  { key: 'bruno', nome: 'Bruno Dias', sdrOptionId: 635, userId: 12029818, papel: 'closer' },
  { key: 'joao', nome: 'João Pacheco', sdrOptionId: 636, userId: 12696278, papel: 'closer' },
  { key: 'mariana', nome: 'Mariana Teixeira', sdrOptionId: 267, userId: 23227690, papel: 'inativo' },
  { key: 'daniela', nome: 'Daniela', sdrOptionId: 326, papel: 'inativo' },
  { key: 'marcela', nome: 'Marcela', sdrOptionId: 634, papel: 'inativo' },
  { key: 'pedro', nome: 'Pedro Siniscalchi', sdrOptionId: 691, userId: 24237677, papel: 'inativo' },
  { key: 'bot', nome: 'Bot', sdrOptionId: 627, papel: 'inativo' },
  { key: 'jessica', nome: 'Jéssica Garcia', userId: 15020508, papel: 'inativo' },
];

export function pessoaPorChave(key: string): Pessoa | undefined {
  return PESSOAS.find((p) => p.key === key);
}

export function nomeDaPessoa(key: string): string {
  return pessoaPorChave(key)?.nome ?? key;
}

/**
 * Closers ativos -- Bruno e Joao. Sao os donos dos negocios que fecham, entao o
 * card de Fechamentos atribui cada venda pelo proprietario do negocio, nao pelo
 * campo SDR. Ambos tem `userId`, que e o que a atribuicao por proprietario usa.
 */
export interface CloserConfig extends Pessoa {
  userId: number;
  papel: 'closer';
}

export const CLOSERS: CloserConfig[] = PESSOAS.filter(
  (p): p is CloserConfig => p.papel === 'closer' && p.userId !== undefined
);

export const PAPEL_LABEL: Record<Papel, string> = {
  sdr: 'SDR',
  closer: 'closer',
  inativo: 'inativo',
};

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
