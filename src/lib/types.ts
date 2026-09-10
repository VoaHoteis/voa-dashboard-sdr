import type { EtapaKey, FunnelKey, SdrKey, UnidadeContagem } from './config';
import type { ISODate } from './dates';

export interface Periodo {
  inicio: ISODate;
  fim: ISODate;
}

export type PorFunil = Record<FunnelKey, number>;

/**
 * Uma linha do modal de detalhe: o agendamento por tras de um numero.
 *
 * As rotas devolvem a lista inteira do periodo junto com as contagens, e o
 * modal recorta em memoria. Assim o detalhe nunca vira uma segunda consulta que
 * poderia discordar do numero exibido.
 */
export interface ItemAgendamento {
  atividadeId: number;
  /** null quando a atividade nao tem negocio vinculado (acontece em no-shows). */
  negocioId: number | null;
  titulo: string;
  data: ISODate;
  /** null quando nao da para saber o funil -- sem negocio, ou negocio de outro funil. */
  funil: FunnelKey | null;
  /** Chaves de PESSOAS -- pode incluir closer e quem já saiu do time. */
  sdrs: string[];
  /**
   * De onde veio a atribuicao:
   * - 'campo'         : campo SDR do negocio preenchido (soberano);
   * - 'proprietario'  : campo vazio, caiu para o dono do negocio;
   * - 'nenhuma'       : campo vazio e dono desconhecido.
   */
  atribuicao: 'campo' | 'proprietario' | 'nenhuma';
  assunto: string;
  tipo: string;
}

export interface AgendamentosResposta {
  periodo: Periodo;
  unidade: UnidadeContagem;
  time: {
    total: number;
    porFunil: PorFunil;
    /** Contagem pela outra unidade, para o dashboard avisar quando divergem. */
    totalAlternativo: number;
    porFunilAlternativo: PorFunil;
  };
  porSdr: Array<{
    sdr: SdrKey;
    nome: string;
    total: number;
    porFunil: PorFunil;
    metas: PorFunil;
  }>;
  /** Nem campo SDR nem dono conhecido -- nao da para dizer de quem e. */
  semSdr: number;
  /** Atribuidos apenas a quem ja saiu do time (campo SDR de negocio antigo). */
  inativos: number;
  /** Tudo que entrou na conta, para o modal de detalhe. */
  itens: ItemAgendamento[];
}

export interface FunilResposta {
  porSdr: Array<{
    sdr: SdrKey;
    nome: string;
    funis: Record<FunnelKey, {
      etapas: Record<EtapaKey, number>;
      saude: { emDia: number; atrasado: number; semAtividade: number };
      indiceSaude: number | null;
    }>;
  }>;
}

export interface FuturosResposta {
  ateFim: ISODate;
  total: number;
  porFunil: PorFunil;
  itens: ItemAgendamento[];
}

export interface NoShowsResposta {
  periodo: Periodo;
  /** Somente no-shows com negocio vinculado num dos dois funis. */
  total: number;
  porFunil: PorFunil;
  itens: ItemAgendamento[];
  /**
   * Lancamentos sem negocio vinculado (ou em outro funil). Ficam FORA do total,
   * por decisao do Joao em 09/09/2026, mas continuam na resposta para o card
   * poder mostrar que existem -- some-los da tela viraria subnotificacao
   * silenciosa.
   */
  foraDaConta: number;
  itensForaDaConta: ItemAgendamento[];
}

/** Uma linha do modal de detalhe do card de Fechamentos. */
export interface ItemFechamento {
  negocioId: number;
  titulo: string;
  /** Data do ganho (won_time). */
  data: ISODate;
  funil: FunnelKey | null;
  /** Chave de PESSOAS do dono do negocio (o closer), ou null. */
  closer: string | null;
  /** Valor do negocio, na moeda da conta (BRL). */
  valor: number;
}

export interface FechamentosResposta {
  periodo: Periodo;
  time: {
    /** Quantidade de negocios ganhos no periodo. */
    total: number;
    /** Soma dos valores ganhos no periodo. */
    valor: number;
    porFunil: PorFunil;
    valorPorFunil: PorFunil;
  };
  porCloser: Array<{
    /** Chave de PESSOAS do closer. */
    closer: string;
    nome: string;
    total: number;
    valor: number;
    porFunil: PorFunil;
  }>;
  /** Ganhos cujo dono nao e um closer ativo (owned por SDR, inativo, etc.). */
  outros: { total: number; valor: number };
  itens: ItemFechamento[];
}

/** Uma linha da tabela do card de Forecast (um negocio aberto). */
export interface ItemForecast {
  negocioId: number;
  titulo: string;
  funil: FunnelKey;
  etapa: EtapaKey;
  /** Valor do negocio, na moeda da conta (BRL). */
  valor: number;
}

export interface ForecastResposta {
  /** Quantidade de negocios abertos nas etapas acompanhadas. */
  total: number;
  /** Soma dos valores abertos. */
  valor: number;
  porFunil: PorFunil;
  valorPorFunil: PorFunil;
  /** Uma entrada por combinacao funil x etapa que tem ao menos um negocio. */
  porEtapa: Array<{
    funil: FunnelKey;
    etapa: EtapaKey;
    total: number;
    valor: number;
  }>;
  itens: ItemForecast[];
}

export interface AtividadesResposta {
  mes: Periodo;
  semanas: string[];
  porSdr: Array<{
    sdr: SdrKey;
    nome: string;
    total: number;
    /** Uma linha por semana: { semana, [tipoKey]: n }, pronto para o Recharts. */
    series: Array<Record<string, string | number>>;
    porTipo: Record<string, number>;
  }>;
}
