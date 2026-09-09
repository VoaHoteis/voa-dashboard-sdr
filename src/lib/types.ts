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
  sdrs: SdrKey[];
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
  /** Atividades que nao puderam ser atribuidas a nenhuma SDR. */
  semSdr: number;
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
