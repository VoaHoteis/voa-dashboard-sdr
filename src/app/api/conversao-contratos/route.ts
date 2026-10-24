import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINE_TO_FUNNEL, TIPOS_AGENDAMENTO } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes } from '@/lib/dates';
import {
  buscarAtividades,
  buscarNegociosGanhos,
  buscarNegociosPorIds,
  pessoaDoProprietario,
} from '@/lib/pipedrive';
import type { ConversaoContratosResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const fimMesAnterior = addDias(primeiroDiaDoMes(ref), -1);
    const inicioPadrao = primeiroDiaDoMes(addDias(primeiroDiaDoMes(fimMesAnterior), -1));
    const inicio = searchParams.get('inicio') || inicioPadrao;
    const fim = searchParams.get('fim') || ref;
    const [atividades, ganhos] = await Promise.all([
      buscarAtividades({ inicio, fim, tipos: TIPOS_AGENDAMENTO, concluidas: true }),
      buscarNegociosGanhos({ inicio, fim }),
    ]);
    const idsNegocios = atividades
      .map((atividade) => atividade.deal_id)
      .filter((id): id is number => typeof id === 'number');
    const negocios = await buscarNegociosPorIds(idsNegocios);
    const agendamentosValidos = atividades.filter((atividade) => {
      const data = atividade.due_date?.slice(0, 10);
      if (!data || data < inicio || data > fim || atividade.deal_id == null) return false;
      const negocio = negocios.get(atividade.deal_id);
      return negocio !== undefined && PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined;
    });

    const hoteisDoCloser = (closerKey: string) => {
      const porHotel = new Map<string, { hotel: string; agendamentos: number; contratos: number }>();
      const itemPara = (nome: string) => {
        const hotel = nome.trim() || 'Hotel sem nome';
        let item = porHotel.get(hotel);
        if (!item) {
          item = { hotel, agendamentos: 0, contratos: 0 };
          porHotel.set(hotel, item);
        }
        return item;
      };

      for (const atividade of agendamentosValidos) {
        const negocio = atividade.deal_id == null ? undefined : negocios.get(atividade.deal_id);
        if (negocio && pessoaDoProprietario(negocio) === closerKey) {
          itemPara(negocio.title).agendamentos += 1;
        }
      }
      for (const negocio of ganhos) {
        if (pessoaDoProprietario(negocio) === closerKey) itemPara(negocio.title).contratos += 1;
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
      periodo: { inicio, fim },
      totalAgendamentos,
      totalContratos,
      taxaConversao: totalAgendamentos > 0 ? (totalContratos / totalAgendamentos) * 100 : null,
      porCloser,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
