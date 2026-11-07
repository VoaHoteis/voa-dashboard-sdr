import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINE_TO_FUNNEL, TIPOS_AGENDAMENTO, type FunnelKey } from '@/lib/config';
import { intervaloUltimosDias } from '@/lib/dates';
import {
  buscarAtividades,
  buscarNegociosGanhos,
  buscarNegociosPorIds,
  buscarOrigensDosNegocios,
  pessoaDoProprietario,
} from '@/lib/pipedrive';
import type { ConversaoContratosResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const periodo = intervaloUltimosDias(90);
    const [atividades, todosGanhos] = await Promise.all([
      buscarAtividades({ ...periodo, tipos: TIPOS_AGENDAMENTO, concluidas: true }),
      buscarNegociosGanhos(periodo),
    ]);
    const ganhos = todosGanhos.filter(
      (negocio) => PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined
    );
    const idsNegocios = atividades
      .map((atividade) => atividade.deal_id)
      .filter((id): id is number => typeof id === 'number');
    const negocios = await buscarNegociosPorIds(idsNegocios);
    const negociosParaOrigem = [...new Map(
      [...ganhos, ...negocios.values()].map((negocio) => [negocio.id, negocio] as const)
    ).values()];
    const origens = await buscarOrigensDosNegocios(negociosParaOrigem);
    const agendamentosValidos = atividades.filter((atividade) => {
      const data = atividade.due_date?.slice(0, 10);
      if (
        !data ||
        data < periodo.inicio ||
        data > periodo.fim ||
        atividade.deal_id == null
      ) return false;
      const negocio = negocios.get(atividade.deal_id);
      return negocio !== undefined && PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined;
    });

    const porFunil: ConversaoContratosResposta['porFunil'] = {
      novosNegocios: { contratos: 0, agendamentos: 0, taxaConversao: null },
      salabim: { contratos: 0, agendamentos: 0, taxaConversao: null },
    };

    for (const atividade of agendamentosValidos) {
      if (atividade.deal_id == null) continue;
      const negocio = negocios.get(atividade.deal_id);
      const funil = negocio ? PIPELINE_TO_FUNNEL[negocio.pipeline_id] : undefined;
      if (funil) porFunil[funil].agendamentos += 1;
    }

    for (const negocio of ganhos) {
      const funil = PIPELINE_TO_FUNNEL[negocio.pipeline_id];
      if (funil) porFunil[funil].contratos += 1;
    }

    for (const funil of Object.keys(porFunil) as FunnelKey[]) {
      const metricas = porFunil[funil];
      metricas.taxaConversao = metricas.agendamentos > 0
        ? (metricas.contratos / metricas.agendamentos) * 100
        : null;
    }

    const hoteisDoCloser = (closerKey: string) => {
      const porHotel = new Map<string, {
        hotel: string;
        agendamentos: number;
        contratos: number;
        origens: string[];
      }>();
      const itemPara = (nome: string, negocioId: number) => {
        const hotel = nome.trim() || 'Hotel sem nome';
        let item = porHotel.get(hotel);
        if (!item) {
          item = { hotel, agendamentos: 0, contratos: 0, origens: [] };
          porHotel.set(hotel, item);
        }
        const origem = origens.get(negocioId);
        if (origem && !item.origens.includes(origem)) item.origens.push(origem);
        return item;
      };

      for (const atividade of agendamentosValidos) {
        const negocio = atividade.deal_id == null ? undefined : negocios.get(atividade.deal_id);
        if (negocio && pessoaDoProprietario(negocio) === closerKey) {
          itemPara(negocio.title, negocio.id).agendamentos += 1;
        }
      }
      for (const negocio of ganhos) {
        if (pessoaDoProprietario(negocio) === closerKey) {
          itemPara(negocio.title, negocio.id).contratos += 1;
        }
      }

      return [...porHotel.values()].sort((a, b) => a.hotel.localeCompare(b.hotel, 'pt-BR'));
    };

    const porCloser = CLOSERS.map((closer) => {
      const agendamentos = agendamentosValidos.filter((atividade) => {
        const negocio = atividade.deal_id == null ? undefined : negocios.get(atividade.deal_id);
        return negocio !== undefined && pessoaDoProprietario(negocio) === closer.key;
      }).length;
      const contratos = ganhos.filter((negocio) => pessoaDoProprietario(negocio) === closer.key).length;

      return {
        closer: closer.key,
        nome: closer.nome,
        agendamentos,
        contratos,
        taxaConversao: agendamentos > 0 ? (contratos / agendamentos) * 100 : null,
        hoteis: hoteisDoCloser(closer.key),
      };
    });

    const totalAgendamentos = agendamentosValidos.length;
    const totalContratos = ganhos.length;

    const resposta: ConversaoContratosResposta = {
      periodo,
      totalAgendamentos,
      totalContratos,
      taxaConversao: totalAgendamentos > 0 ? (totalContratos / totalAgendamentos) * 100 : null,
      porFunil,
      porCloser,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
