/**
 * Agregacoes. Funcoes puras: recebem o que veio do Pipedrive e devolvem os
 * numeros dos cards. Nenhuma chamada de rede aqui, de proposito -- e a parte
 * que precisa ser conferivel no papel quando o Joao perguntar "de onde saiu
 * esse 47?".
 */

import {
  ETAPAS_FORA_DA_SAUDE,
  ETAPAS_ORDEM,
  type EtapaKey,
  type FunnelKey,
  PIPELINE_TO_FUNNEL,
  RITMO_ACIMA,
  RITMO_NO_RITMO,
  nomeDaPessoa,
  pessoaPorChave,
  type SdrKey,
  STAGES,
  type UnidadeContagem,
} from './config';
import type { Negocio } from './pipedrive';
import { pessoaDoProprietario, pessoasDoCampoSdr, type Atividade } from './pipedrive';
import type { PorFunil } from './types';

export function zeroPorFunil(): PorFunil {
  return { novosNegocios: 0, salabim: 0 };
}

/**
 * Um agendamento valido = atividade com negocio vinculado cujo funil e um dos
 * dois acompanhados.
 *
 * O filtro do funil nao e detalhe: o tipo `meeting` tambem e usado nas reunioes
 * internas do time (alinhamento, checkpoint, almoco), que quase nunca tem
 * negocio vinculado. Sem esta linha, o card de agendamentos contaria almoço.
 */
export interface AgendamentoResolvido {
  atividade: Atividade;
  negocio: Negocio;
  funil: FunnelKey;
  sdrs: string[];
  atribuicao: 'campo' | 'proprietario' | 'nenhuma';
}

/**
 * De quem e o agendamento.
 *
 * O campo SDR do negocio e **soberano**: se estiver preenchido, vale ele, mesmo
 * que nomeie alguem que saiu do time (esses aparecem marcados como inativos, em
 * vez de virarem "sem SDR" -- o campo nao esta vazio, so nao aponta para alguem
 * ativo). So quando o campo esta vazio a atribuicao cai para o proprietario do
 * negocio. Decisao do Joao em 09/09/2026.
 */
export function atribuir(negocio: Negocio): Pick<AgendamentoResolvido, 'sdrs' | 'atribuicao'> {
  const doCampo = pessoasDoCampoSdr(negocio);
  if (doCampo.length > 0) return { sdrs: doCampo, atribuicao: 'campo' };

  const dono = pessoaDoProprietario(negocio);
  if (dono) return { sdrs: [dono], atribuicao: 'proprietario' };

  return { sdrs: [], atribuicao: 'nenhuma' };
}

export function resolverAgendamentos(
  atividades: Atividade[],
  negocios: Map<number, Negocio>
): AgendamentoResolvido[] {
  const out: AgendamentoResolvido[] = [];
  for (const a of atividades) {
    if (!a.deal_id) continue;
    const negocio = negocios.get(a.deal_id);
    if (!negocio) continue;
    const funil = PIPELINE_TO_FUNNEL[negocio.pipeline_id];
    if (!funil) continue;
    out.push({ atividade: a, negocio, funil, ...atribuir(negocio) });
  }
  return out;
}

/**
 * Conta por funil na unidade pedida.
 * - 'atividades': cada reuniao vale 1 (duas com o mesmo hotel no periodo = 2);
 * - 'negocios': negocios distintos com ao menos uma reuniao no periodo.
 */
export function contarPorFunil(
  itens: AgendamentoResolvido[],
  unidade: UnidadeContagem
): PorFunil {
  const acc = zeroPorFunil();
  if (unidade === 'atividades') {
    for (const i of itens) acc[i.funil] += 1;
    return acc;
  }
  const vistos = new Set<string>();
  for (const i of itens) {
    const chave = i.funil + ':' + i.negocio.id;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    acc[i.funil] += 1;
  }
  return acc;
}

export function totalDe(p: PorFunil): number {
  return p.novosNegocios + p.salabim;
}

/** Filtra os agendamentos de uma pessoa. Negocio com duas marcadas entra nas duas. */
export function agendamentosDaSdr(
  itens: AgendamentoResolvido[],
  sdr: string
): AgendamentoResolvido[] {
  return itens.filter((i) => i.sdrs.includes(sdr));
}

// ------------------------------------------------------------- fechamentos

/**
 * Um fechamento = negocio GANHO num dos dois funis acompanhados.
 *
 * Atribuido pelo PROPRIETARIO do negocio (o closer), nao pelo campo SDR -- quem
 * fecha e o dono da venda. Negocio ganho em outro funil (pipeline 1, etc.) fica
 * de fora, para o card manter o mesmo recorte Novos Negocios / Salabim do resto
 * do dashboard.
 */
export interface FechamentoResolvido {
  negocio: Negocio;
  funil: FunnelKey;
  /** Dono do negocio traduzido para uma pessoa conhecida (ou null). */
  dono: string | null;
  valor: number;
  /** Data do ganho (won_time), so a parte YYYY-MM-DD. */
  data: string;
}

export function resolverFechamentos(negocios: Negocio[]): FechamentoResolvido[] {
  const out: FechamentoResolvido[] = [];
  for (const d of negocios) {
    const funil = PIPELINE_TO_FUNNEL[d.pipeline_id];
    if (!funil) continue;

    const valorBruto = (d as { value?: unknown }).value;
    const valor = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto) || 0;
    const wt = (d as { won_time?: string | null }).won_time ?? null;

    out.push({
      negocio: d,
      funil,
      dono: pessoaDoProprietario(d),
      valor,
      data: wt ? wt.slice(0, 10) : '',
    });
  }
  return out;
}

// --------------------------------------------------------------- forecast

/**
 * Forecast = todo negocio ABERTO nas etapas acompanhadas dos dois funis.
 *
 * Recebe os negocios ja agrupados por funil e etapa (uma consulta por
 * `stage_id`, como o card de Funil faz), e devolve a lista achatada com funil,
 * etapa e valor de cada um. Diferente do funil, aqui NAO se quebra por SDR: o
 * card mostra a carteira aberta inteira, entao as 4 etapas entram -- inclusive
 * a Pre Qualificacao, por escolha do time.
 */
export interface ForecastItemResolvido {
  negocio: Negocio;
  funil: FunnelKey;
  etapa: EtapaKey;
  valor: number;
}

export function resolverForecast(
  porFunilEtapa: Record<FunnelKey, Record<EtapaKey, Negocio[]>>
): ForecastItemResolvido[] {
  const out: ForecastItemResolvido[] = [];
  for (const funil of ['novosNegocios', 'salabim'] as FunnelKey[]) {
    for (const etapa of ETAPAS_ORDEM) {
      for (const d of porFunilEtapa[funil]?.[etapa] ?? []) {
        if (d.status !== 'open') continue;
        const valorBruto = (d as { value?: unknown }).value;
        const valor = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto) || 0;
        out.push({ negocio: d, funil, etapa, valor });
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------- ritmo

export type Temperatura = 'meta-batida' | 'acima' | 'no-ritmo' | 'abaixo';

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  'meta-batida': 'Meta batida',
  acima: 'Acima do ritmo',
  'no-ritmo': 'No ritmo',
  abaixo: 'Abaixo do ritmo',
};

/**
 * Compara o realizado com o que seria esperado ate hoje se a meta fosse
 * distribuida por igual entre os dias uteis do mes.
 *
 * As margens de +-10% sao definicao do Claude na sessao anterior, nao do Joao.
 * Ficam em config.ts para virar uma linha de mudanca quando ele opinar.
 */
export function classificarRitmo(
  realizado: number,
  meta: number,
  diasUteisDecorridos: number,
  diasUteisTotais: number
): { temperatura: Temperatura; esperado: number; esperadoExibido: number } {
  const esperado = diasUteisTotais > 0 ? (meta * diasUteisDecorridos) / diasUteisTotais : 0;

  // A classificacao usa o valor exato; so a exibicao arredonda. Arredondar antes
  // de comparar faria o selo pular de faixa por causa de meio agendamento.
  const esperadoExibido = Math.round(esperado);

  const r = (temperatura: Temperatura) => ({ temperatura, esperado, esperadoExibido });
  if (realizado >= meta) return r('meta-batida');
  if (realizado >= esperado * RITMO_ACIMA) return r('acima');
  if (realizado >= esperado * RITMO_NO_RITMO) return r('no-ritmo');
  return r('abaixo');
}

/**
 * Cadencia necessaria para fechar a meta no que resta do mes.
 *
 * Nao existe meia reuniao, entao o numero nunca sai fracionado. E quando falta
 * menos de um por dia, a leitura util para o planejamento delas nao e "0,3 por
 * dia" e sim "1 a cada 3 dias uteis" -- que e uma instrucao que cabe na agenda.
 */
export type Cadencia =
  | { tipo: 'meta-batida' }
  | { tipo: 'sem-dias'; falta: number }
  | { tipo: 'por-dia'; quantidade: number; falta: number; dias: number }
  /** `intervalo` = de quantos em quantos dias uteis; `dias` = quantos ainda restam. */
  | { tipo: 'a-cada'; intervalo: number; falta: number; dias: number };

export function cadenciaNecessaria(
  realizado: number,
  meta: number,
  diasUteisRestantes: number
): Cadencia {
  const falta = meta - realizado;
  if (falta <= 0) return { tipo: 'meta-batida' };
  if (diasUteisRestantes <= 0) return { tipo: 'sem-dias', falta };

  // Precisa de mais de um por dia: arredonda para CIMA. Para baixo seria uma
  // meta que nao fecha -- o numero existe para orientar, nao para consolar.
  if (falta >= diasUteisRestantes) {
    return {
      tipo: 'por-dia',
      quantidade: Math.ceil(falta / diasUteisRestantes),
      falta,
      dias: diasUteisRestantes,
    };
  }

  // Menos de um por dia: vira intervalo. Para BAIXO aqui, porque esperar mais
  // que isso entre um e outro nao fecha a meta.
  return {
    tipo: 'a-cada',
    intervalo: Math.floor(diasUteisRestantes / falta),
    falta,
    dias: diasUteisRestantes,
  };
}

/** Texto curto da cadencia, do jeito que a SDR le na agenda. */
export function textoCadencia(c: Cadencia): string {
  switch (c.tipo) {
    case 'meta-batida':
      return 'meta batida';
    case 'sem-dias':
      return 'sem dia útil restante';
    case 'por-dia':
      return c.quantidade === 1 ? '1 por dia útil' : `${c.quantidade} por dia útil`;
    case 'a-cada':
      // Falta so um: dizer "1 a cada 16 dias uteis" soa como uma rotina; o que
      // ela precisa saber e que basta um antes do mes acabar.
      if (c.falta === 1) return '1 até o fim do mês';
      return c.intervalo === 1 ? '1 por dia útil' : `1 a cada ${c.intervalo} dias úteis`;
  }
}

/** "faltam 4 em 16 dias úteis" -- a conta crua por tras da cadencia. */
export function textoRestante(c: Cadencia): string | null {
  if (c.tipo === 'meta-batida') return null;
  if (c.tipo === 'sem-dias') return `faltaram ${c.falta}`;
  // Sempre os dias que realmente restam -- nao os que a cadencia consumiria.
  return `faltam ${c.falta} em ${c.dias === 1 ? '1 dia útil' : c.dias + ' dias úteis'}`;
}

// ------------------------------------------------------------------- saude

export type StatusSaude = 'emDia' | 'atrasado' | 'semAtividade';

/**
 * Saude do negocio pelos campos nativos.
 * - sem atividade pendente          -> 'semAtividade'
 * - pendente com data ja vencida    -> 'atrasado'
 * - pendente com data de hoje adiante -> 'emDia'
 */
export function statusSaude(negocio: Negocio, hojeIso: string): StatusSaude {
  const pendentes = Number(negocio.undone_activities_count ?? 0);
  if (!pendentes) return 'semAtividade';
  const prox = negocio.next_activity_date;
  if (!prox) return 'semAtividade';
  return prox < hojeIso ? 'atrasado' : 'emDia';
}

export function etapaDoNegocio(negocio: Negocio, funil: FunnelKey): EtapaKey | null {
  for (const etapa of ETAPAS_ORDEM) {
    if (STAGES[funil][etapa].includes(negocio.stage_id)) return etapa;
  }
  return null;
}

export function etapaContaParaSaude(etapa: EtapaKey): boolean {
  return !ETAPAS_FORA_DA_SAUDE.includes(etapa);
}

export interface ResumoFunil {
  etapas: Record<EtapaKey, number>;
  saude: { emDia: number; atrasado: number; semAtividade: number };
  indiceSaude: number | null;
}

export function zerarResumoFunil(): ResumoFunil {
  return {
    etapas: { preQualificacao: 0, emContato: 0, reagendamento: 0, apresentacaoAgendada: 0 },
    saude: { emDia: 0, atrasado: 0, semAtividade: 0 },
    indiceSaude: null,
  };
}

/**
 * Conta negocios abertos por etapa e por status de saude.
 *
 * Recebe os negocios ja agrupados por etapa, porque e assim que eles chegam da
 * API (uma consulta por `stage_id`).
 *
 * A Pre Qualificacao aparece na contagem de etapas mas nao entra na saude: e um
 * repositorio de leads, atividade vencida ali nao diz nada sobre o time.
 */
export function resumirFunil(
  porEtapa: Record<EtapaKey, Negocio[]>,
  hojeIso: string
): ResumoFunil {
  const r = zerarResumoFunil();

  for (const etapa of ETAPAS_ORDEM) {
    for (const d of porEtapa[etapa] ?? []) {
      if (d.status !== 'open') continue;
      r.etapas[etapa] += 1;
      if (!etapaContaParaSaude(etapa)) continue;
      r.saude[statusSaude(d, hojeIso)] += 1;
    }
  }

  const considerados = r.saude.emDia + r.saude.atrasado + r.saude.semAtividade;
  r.indiceSaude = considerados > 0 ? r.saude.emDia / considerados : null;
  return r;
}

// -------------------------------------------------------------------- misc

export function nomeDaSdr(key: string): string {
  return nomeDaPessoa(key);
}

/** O agendamento so tem gente que saiu do time? */
export function soInativos(sdrs: string[]): boolean {
  if (sdrs.length === 0) return false;
  return sdrs.every((k) => pessoaPorChave(k)?.papel === 'inativo');
}
