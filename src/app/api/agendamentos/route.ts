/**
 * Cards 1 (Agendamentos Totais), 2 (Agendamento por SDR) e a base do 3.
 *
 * GET /api/agendamentos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&unidade=atividades|negocios
 */

import { NextResponse } from 'next/server';
import { METAS_TIME, SDRS, TIPOS_AGENDAMENTO, UNIDADE_PADRAO, type UnidadeContagem } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import {
  agendamentosDaSdr,
  contarPorFunil,
  resolverAgendamentos,
  soInativos,
  totalDe,
} from '@/lib/metrics';
import {
  buscarAtividades,
  buscarNegociosPorIds,
  quantidadeUhDoNegocio,
  resolverChaveCampoUh,
} from '@/lib/pipedrive';
import type { AgendamentosResposta, ItemAgendamento } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);
    const unidade = (searchParams.get('unidade') as UnidadeContagem) || UNIDADE_PADRAO;
    const outraUnidade: UnidadeContagem = unidade === 'atividades' ? 'negocios' : 'atividades';

    // O filtro de data do topo age sobre a data de vencimento da atividade.
    const atividades = await buscarAtividades({
      inicio,
      fim,
      tipos: TIPOS_AGENDAMENTO,
      concluidas: true,
    });

    const negocios = await buscarNegociosPorIds(
      atividades.map((a) => a.deal_id).filter((id): id is number => typeof id === 'number')
    );
    const itens = resolverAgendamentos(atividades, negocios);
    const uhKey = await resolverChaveCampoUh();

    const porFunil = contarPorFunil(itens, unidade);
    const porFunilAlt = contarPorFunil(itens, outraUnidade);

    const resposta: AgendamentosResposta = {
      periodo: { inicio, fim },
      unidade,
      time: {
        total: totalDe(porFunil),
        porFunil,
        totalAlternativo: totalDe(porFunilAlt),
        porFunilAlternativo: porFunilAlt,
      },
      porSdr: SDRS.map((s) => {
        const meus = contarPorFunil(agendamentosDaSdr(itens, s.key), unidade);
        return {
          sdr: s.key,
          nome: s.nome,
          total: totalDe(meus),
          porFunil: meus,
          metas: s.metas,
        };
      }),
      semSdr: itens.filter((i) => i.atribuicao === 'nenhuma').length,
      inativos: itens.filter((i) => soInativos(i.sdrs)).length,
      // A lista crua vai junto para o modal de detalhe recortar em memoria --
      // sem uma segunda consulta que poderia discordar do numero exibido.
      itens: itens.map(
        (i): ItemAgendamento => ({
          atividadeId: i.atividade.id,
          negocioId: i.negocio.id,
          titulo: i.negocio.title,
          data: i.atividade.due_date ?? inicio,
          funil: i.funil,
          sdrs: i.sdrs,
          atribuicao: i.atribuicao,
          assunto: i.atividade.subject,
          tipo: i.atividade.type,
          uhs: quantidadeUhDoNegocio(i.negocio, uhKey),
        })
      ),
    };

    return NextResponse.json({ ...resposta, metasTime: METAS_TIME });
  } catch (e) {
    return respostaDeErro(e);
  }
}
