/**
 * Dados falsos para rodar o dashboard sem token do Pipedrive.
 *
 * Serve para validar layout e regra de agregacao antes de ligar na conta real.
 * Ativado por PIPEDRIVE_MOCK=1. O gerador e deterministico (seed fixa), entao
 * dois refreshes seguidos mostram os mesmos numeros.
 */

import {
  CLOSERS,
  ETAPA_LABEL,
  type EtapaKey,
  type FunnelKey,
  PIPELINES,
  SDRS,
  SDR_FIELD_KEY,
  STAGES,
  TIPOS_AGENDAMENTO,
  TIPOS_ESFORCO,
  TIPO_LIGACAO,
  TIPO_NO_SHOW,
} from './config';
import { addDias, ehDiaUtil, hoje, listarDias, primeiroDiaDoMes, type ISODate } from './dates';
import type { Atividade, Negocio } from './pipedrive';

/**
 * Chave do campo "Quantidade UH" no modo mock. Em producao a chave e um hash de
 * 40 caracteres resolvido pelo nome em runtime; aqui basta um rotulo estavel.
 */
export const CHAVE_UH_MOCK = 'quantidade_uh_mock';

/** PRNG mulberry32: pequeno, deterministico, bom o bastante para dado de exemplo. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const HOTEIS = [
  'Pousada Mar da Vila', 'Hotel Cadoro São Paulo', 'Aquaria Natal Hotel', 'Sandi Hotel',
  'Pousada Portal de Paraty', 'Uiara Amazon Resort', 'Hotel Luxor', 'Milano Hotel Canoa Quebrada',
  'Premier Pallace Hotel', 'Pousada Sol e Mar', 'Hotel Villa Balidende', 'Via Contorno Hotel',
  'Santa Clara Hotel', 'Pousada Maré Cheia', 'Tropical Praia Hotel', 'Shallom Hotel',
  'Pousada do Frei', 'Uai Hotel Jaíba', 'Denali Hotel', 'Hotel Conexão',
  'Pousada Toca da Praia', 'Vila dos Orixás', 'Hamburgo Palace Hotel', 'Arrey Gran Hotel',
  'Hotel Portal da Lua', 'Pousada Brisa do Porto', 'Citi Executivo Hotel', 'Mac Hotel',
  'Pousada Alto da Neblina', 'Hotel Fazenda Paciência', 'Pioneiro Hotel', 'Búzios Flat Pousada',
  'Pousada Valle das Colinas', 'Hotel CasaBlanca', 'GoldMen Vila do Mar', 'Pousada Rumo dos Ventos',
  'Hotel Internacional Guarulhos', 'Hotel Ponte Aérea', 'Pousada Jardim de Minas', 'Almanara Cuiabá',
];

/** Base fixa de negocios: 40 hoteis espalhados pelos dois funis e pelas etapas. */
const NEGOCIOS: Negocio[] = HOTEIS.map((titulo, i) => {
  const r = rng(hash(titulo));
  const funil = i % 3 === 0 ? 'salabim' : 'novosNegocios';
  const pipelineId = funil === 'salabim' ? PIPELINES.salabim : PIPELINES.novosNegocios;

  const etapas = Object.values(STAGES[funil]).flat();
  const stageId = etapas[Math.floor(r() * etapas.length)];

  // Distribuicao proposital: uma parcela sem SDR, uma com as duas marcadas.
  const sorteio = r();
  const sdrIds =
    sorteio < 0.08 ? '' : sorteio < 0.14 ? '645,680' : sorteio < 0.57 ? '645' : '680';

  const pendentes = r() < 0.25 ? 0 : 1 + Math.floor(r() * 3);
  const hojeRef = new Date().toISOString().slice(0, 10);
  const proxima = pendentes === 0 ? null : addDias(hojeRef, Math.floor(r() * 14) - 6);
  const valor = 12000 + Math.floor(r() * 108000);

  // Data de fechamento esperada: ~55% no mês corrente (entram no forecast),
  // ~25% em meses seguintes e ~20% sem data preenchida (ficam de fora).
  const inicioMes = primeiroDiaDoMes(hoje());
  const sorteioData = r();
  const expected =
    sorteioData < 0.2
      ? null
      : sorteioData < 0.75
        ? addDias(inicioMes, Math.floor(r() * 27))
        : addDias(inicioMes, 33 + Math.floor(r() * 40));

  // Dono do negocio no formato objeto da v1 ({id, name}), alternando entre os
  // closers, para o card de Forecast ter um proprietario nomeado para exibir.
  const dono = CLOSERS[i % CLOSERS.length];

  return {
    id: 1000 + i,
    title: titulo,
    pipeline_id: pipelineId,
    stage_id: stageId,
    status: 'open',
    undone_activities_count: pendentes,
    next_activity_date: proxima,
    value: valor,
    expected_close_date: expected,
    user_id: { id: dono.userId, name: dono.nome },
    [SDR_FIELD_KEY]: sdrIds,
    // Unidades habitacionais: hoteis pequenos a medios, entre ~12 e ~200 U.Hs.
    [CHAVE_UH_MOCK]: 12 + Math.floor(r() * 189),
  } as Negocio;
});

const POR_ID = new Map(NEGOCIOS.map((d) => [d.id, d]));

export async function negociosFalsosDaEtapa(stageId: number): Promise<Negocio[]> {
  return NEGOCIOS.filter((d) => d.stage_id === stageId);
}

/** Todos os negocios abertos da base -- o forecast recorta por funil e data. */
export async function negociosAbertosFalsos(): Promise<Negocio[]> {
  return NEGOCIOS.filter((d) => d.status === 'open');
}

/** Etapas conhecidas (id -> nome), montadas a partir do STAGES. */
export async function etapasFalsas(): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  for (const funil of Object.keys(STAGES) as FunnelKey[]) {
    for (const etapa of Object.keys(STAGES[funil]) as EtapaKey[]) {
      for (const id of STAGES[funil][etapa]) m.set(id, ETAPA_LABEL[etapa]);
    }
  }
  return m;
}

export async function negociosFalsosPorIds(ids: number[]): Promise<Map<number, Negocio>> {
  const m = new Map<number, Negocio>();
  for (const id of ids) {
    const d = POR_ID.get(id);
    if (d) m.set(id, d);
  }
  return m;
}

/**
 * Atividades geradas dia a dia. Em dia util sai mais coisa; a chance de um
 * agendamento e baixa de proposito para o volume mensal ficar perto da meta.
 */
export async function atividadesFalsas(opts: {
  inicio: ISODate;
  fim: ISODate;
  tipos: readonly string[];
  concluidas: boolean;
  userId?: number;
}): Promise<Atividade[]> {
  const out: Atividade[] = [];
  const ehAgendamento = opts.tipos.some((t) => (TIPOS_AGENDAMENTO as readonly string[]).includes(t));
  const ehNoShow = opts.tipos.includes(TIPO_NO_SHOW);
  const ehLigacoes = opts.tipos.length === 1 && opts.tipos[0] === TIPO_LIGACAO;
  const usuarios = opts.userId ? [opts.userId] : SDRS.map((s) => s.userId);
  let id = 500000;

  for (const dia of listarDias(opts.inicio, opts.fim)) {
    if (!ehDiaUtil(dia)) continue;

    for (const userId of usuarios) {
      const r = rng(hash(dia + ':' + userId + ':' + (opts.concluidas ? 'd' : 'p')));

      if (ehLigacoes) {
        // Volume alto de tentativas (como o discador automático real): ~34 a 60
        // por dia útil, mas só uma fração fica ligada a um negócio (as que a SDR
        // marca no CRM). O card conta só as com negócio, então o número efetivo
        // por dia cai para perto da meta de 20 — o resto entra sem deal_id, como
        // a "Ligação ativa realizada por agente" do Kinbox.
        const quantos = opts.concluidas ? 34 + Math.floor(r() * 27) : 0;
        for (let k = 0; k < quantos; k++) {
          const efetiva = r() < 0.45;
          out.push({
            id: id++,
            type: TIPO_LIGACAO,
            subject: efetiva ? 'Ligação de Prospecção' : 'Ligação ativa realizada por agente',
            done: opts.concluidas,
            due_date: dia,
            marked_as_done_time: opts.concluidas ? dia + ' 12:00:00' : null,
            deal_id: efetiva ? negocioDaSdr(r, userId).id : null,
            user_id: userId,
          });
        }
      } else if (ehNoShow) {
        // Volume baixo, e ~20% sem negocio vinculado, como na conta real.
        if (r() < 0.12) {
          const negocio = negocioDaSdr(r, userId);
          const semVinculo = r() < 0.2;
          out.push({
            id: id++,
            type: TIPO_NO_SHOW,
            subject: semVinculo ? 'Reunião de Apresentacão' : 'No show — ' + negocio.title,
            done: opts.concluidas,
            due_date: dia,
            marked_as_done_time: opts.concluidas ? dia + ' 12:00:00' : null,
            deal_id: semVinculo ? null : negocio.id,
            user_id: userId,
          });
        }
      } else if (ehAgendamento) {
        // ~1,4 reuniao por SDR por dia util => ~30/mes, perto da meta de 30.
        const n = r() < 0.55 ? 2 : r() < 0.85 ? 1 : 0;
        const quantos = opts.concluidas ? n : r() < 0.3 ? 1 : 0;
        for (let k = 0; k < quantos; k++) {
          const negocio = negocioDaSdr(r, userId);
          out.push({
            id: id++,
            type: opts.tipos[Math.floor(r() * opts.tipos.length)],
            subject: 'Reunião de Apresentação — ' + negocio.title,
            done: opts.concluidas,
            due_date: dia,
            marked_as_done_time: opts.concluidas ? dia + ' 12:00:00' : null,
            deal_id: negocio.id,
            user_id: userId,
          });
        }
      } else {
        // Esforco: bem mais volume, distribuido entre os 6 tipos.
        const quantos = 4 + Math.floor(r() * 9);
        for (let k = 0; k < quantos; k++) {
          const tipo = opts.tipos[Math.floor(r() * opts.tipos.length)];
          const label = TIPOS_ESFORCO.find((t) => t.key === tipo)?.label ?? tipo;
          out.push({
            id: id++,
            type: tipo,
            subject: label,
            done: opts.concluidas,
            due_date: dia,
            marked_as_done_time: opts.concluidas ? dia + ' 12:00:00' : null,
            deal_id: negocioDaSdr(r, userId).id,
            user_id: userId,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Negocios ganhos no periodo, atribuidos aos closers pelo proprietario.
 *
 * ~12 fechamentos por closer por mes, divididos entre os dois funis, com valor
 * entre R$ 15 mil e R$ 120 mil. Deterministico como o resto do mock.
 */
export async function negociosGanhosFalsos(opts: {
  inicio: ISODate;
  fim: ISODate;
}): Promise<Negocio[]> {
  const out: Negocio[] = [];
  let id = 900000;

  for (const dia of listarDias(opts.inicio, opts.fim)) {
    if (!ehDiaUtil(dia)) continue;

    for (const closer of CLOSERS) {
      const r = rng(hash('ganho:' + dia + ':' + closer.userId));
      const quantos = r() < 0.5 ? 1 : r() < 0.72 ? 2 : 0;

      for (let k = 0; k < quantos; k++) {
        const r2 = rng(hash('ganho:' + dia + ':' + closer.userId + ':' + k));
        const funil = r2() < 0.34 ? 'salabim' : 'novosNegocios';
        const pipelineId = funil === 'salabim' ? PIPELINES.salabim : PIPELINES.novosNegocios;
        const titulo = HOTEIS[Math.floor(r2() * HOTEIS.length)];
        const valor = 15000 + Math.floor(r2() * 105000);

        out.push({
          id: id++,
          title: titulo,
          pipeline_id: pipelineId,
          stage_id: STAGES[funil].apresentacaoAgendada[0] ?? 0,
          status: 'won',
          undone_activities_count: 0,
          next_activity_date: null,
          user_id: closer.userId,
          value: valor,
          won_time: dia + ' 12:00:00',
        } as unknown as Negocio);
      }
    }
  }
  return out;
}

/** Escolhe um negocio que tenha a SDR daquele usuario marcada no campo SDR. */
function negocioDaSdr(r: () => number, userId: number): Negocio {
  const sdr = SDRS.find((s) => s.userId === userId);
  const candidatos = sdr
    ? NEGOCIOS.filter((d) => String(d[SDR_FIELD_KEY] ?? '').includes(String(sdr.sdrOptionId)))
    : NEGOCIOS;
  const lista = candidatos.length ? candidatos : NEGOCIOS;
  return lista[Math.floor(r() * lista.length)];
}

/** Só para deixar explícito que o mês do mock é sempre o corrente. */
export function mesDoMock(hojeIso: ISODate): ISODate {
  return primeiroDiaDoMes(hojeIso);
}
