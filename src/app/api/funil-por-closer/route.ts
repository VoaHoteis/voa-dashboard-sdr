/**
 * Funil por closer, no mesmo formato do card de Funil por SDR: uma tabela de
 * etapas com uma coluna por funil, saude dos negocios e hoteis perdidos no mes.
 *
 * GET /api/funil-por-closer
 *
 * As etapas sao as da visao do Closer (as mesmas de /api/funil-closers): no
 * Novos Negocios as etapas de pre-venda (SDR) ficam de fora e no Salabim o
 * "Disparo Enviado" (repositorio de leads). Etapas com o mesmo nome nos dois
 * funis viram uma linha so; quando a etapa nao existe num funil, a celula fica
 * nula e o card mostra "—".
 *
 * Atribuicao pelo proprietario do negocio, como no funil das SDRs.
 */

import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINES, PIPELINE_TO_FUNNEL, STAGES, type FunnelKey } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { statusSaude } from '@/lib/metrics';
import {
  buscarEtapasDoPipeline,
  buscarNegociosAbertos,
  buscarNegociosPerdidos,
  donoDoNegocio,
  nomeDoProprietario,
  type EtapaPipeline,
} from '@/lib/pipedrive';
import type { FunilPorCloserResposta, ItemNegocioEtapa } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

const ETAPAS_OCULTAS: Record<FunnelKey, number[]> = {
  salabim: [70],
  novosNegocios: [
    ...STAGES.novosNegocios.preQualificacao,
    ...STAGES.novosNegocios.emContato,
    ...STAGES.novosNegocios.reagendamento,
    ...STAGES.novosNegocios.apresentacaoAgendada,
  ],
};

const normalizar = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const NOMES_OCULTOS = new Set(
  ['Em Contato', 'Em Contato Avançado', 'Reagendamento', 'Apresentação Agendada'].map(normalizar)
);

const AGRUPAMENTOS: Record<string, { chave: string; nome: string }> = Object.fromEntries(
  ['Negociação - Decisão em andamento', 'Em Negociação'].map((nome) => [
    normalizar(nome),
    { chave: 'negociacao', nome: 'Negociação' },
  ])
);

interface Linha {
  chave: string;
  nome: string;
  posicao: number;
  stages: Record<FunnelKey, number[] | null>;
}

/**
 * Une as etapas visiveis dos dois funis pelo nome. A ordem usa a posicao
 * relativa da etapa dentro do seu funil, para que etapas so de um funil caiam
 * no lugar certo entre as compartilhadas.
 */
function montarLinhas(etapasPorFunil: Record<FunnelKey, EtapaPipeline[]>): Linha[] {
  const linhas = new Map<string, Linha>();

  for (const funil of FUNIS) {
    const visiveis = etapasPorFunil[funil];
    visiveis.forEach((etapa, i) => {
      const normalizado = normalizar(etapa.nome);
      const grupo = AGRUPAMENTOS[normalizado];
      const chave = grupo?.chave ?? normalizado;
      const posicao = visiveis.length > 1 ? i / (visiveis.length - 1) : 0;
      const linha = linhas.get(chave) ?? {
        chave,
        nome: grupo?.nome ?? etapa.nome,
        posicao,
        stages: { novosNegocios: null, salabim: null },
      };
      linha.stages[funil] = [...(linha.stages[funil] ?? []), etapa.id];
      linha.posicao = Math.min(linha.posicao, posicao);
      linhas.set(chave, linha);
    });
  }

  return [...linhas.values()].sort((a, b) => a.posicao - b.posicao);
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const hojeIso = hoje();
    const periodoPerdidos = { inicio: primeiroDiaDoMes(hojeIso), fim: ultimoDiaDoMes(hojeIso) };

    const [negocios, perdidos, etapasNovos, etapasSalabim] = await Promise.all([
      buscarNegociosAbertos(),
      buscarNegociosPerdidos(periodoPerdidos),
      buscarEtapasDoPipeline(PIPELINES.novosNegocios),
      buscarEtapasDoPipeline(PIPELINES.salabim),
    ]);

    const visivel = (funil: FunnelKey) => (e: EtapaPipeline) =>
      !ETAPAS_OCULTAS[funil].includes(e.id) && !NOMES_OCULTOS.has(normalizar(e.nome));
    const etapasPorFunil: Record<FunnelKey, EtapaPipeline[]> = {
      novosNegocios: etapasNovos.filter(visivel('novosNegocios')),
      salabim: etapasSalabim.filter(visivel('salabim')),
    };
    const linhas = montarLinhas(etapasPorFunil);
    const visiveis: Record<FunnelKey, Set<number>> = {
      novosNegocios: new Set(etapasPorFunil.novosNegocios.map((e) => e.id)),
      salabim: new Set(etapasPorFunil.salabim.map((e) => e.id)),
    };

    const resposta: FunilPorCloserResposta = {
      periodoPerdidos,
      etapas: linhas.map((l) => ({ chave: l.chave, nome: l.nome })),
      porCloser: CLOSERS.map((closer) => {
        const funis = {} as FunilPorCloserResposta['porCloser'][number]['funis'];

        for (const funil of FUNIS) {
          const pipelineId = PIPELINES[funil];
          const meus = negocios.filter(
            (d) =>
              d.status === 'open' &&
              d.pipeline_id === pipelineId &&
              visiveis[funil].has(d.stage_id) &&
              donoDoNegocio(d) === closer.userId
          );

          const porStage = new Map<number, ItemNegocioEtapa[]>();
          const saude = { emDia: 0, atrasado: 0, semAtividade: 0 };
          for (const d of meus) {
            const lista = porStage.get(d.stage_id) ?? [];
            lista.push({ negocioId: d.id, titulo: d.title, proprietario: nomeDoProprietario(d) });
            porStage.set(d.stage_id, lista);
            saude[statusSaude(d, hojeIso)] += 1;
          }

          const considerados = saude.emDia + saude.atrasado + saude.semAtividade;

          funis[funil] = {
            etapas: linhas.map((l) => {
              const stageIds = l.stages[funil];
              if (stageIds === null) return null;
              const lista = stageIds.flatMap((id) => porStage.get(id) ?? []);
              return { total: lista.length, negocios: lista };
            }),
            saude,
            indiceSaude: considerados > 0 ? saude.emDia / considerados : null,
            perdidos: perdidos.filter(
              (d) =>
                PIPELINE_TO_FUNNEL[d.pipeline_id] === funil && donoDoNegocio(d) === closer.userId
            ).length,
          };
        }

        return { closer: closer.key, nome: closer.nome, funis };
      }),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
