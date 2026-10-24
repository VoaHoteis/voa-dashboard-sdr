import { NextResponse } from 'next/server';
import { addDias, hoje, primeiroDiaDoMes } from '@/lib/dates';
import { TIPOS_AGENDAMENTO } from '@/lib/config';
import { buscarAgendamentosPorNegocio, buscarNegociosGanhos } from '@/lib/pipedrive';
import type { CicloVendasResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

function diasEntre(inicio: string, fim: string): number {
  return Math.round(
    (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000
  );
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const fimMesAnterior = addDias(primeiroDiaDoMes(ref), -1);
    const inicioPadrao = primeiroDiaDoMes(addDias(primeiroDiaDoMes(fimMesAnterior), -1));
    const inicio = searchParams.get('inicio') || inicioPadrao;
    const fim = searchParams.get('fim') || ref;
    const periodo = { inicio, fim };
    const ganhos = await buscarNegociosGanhos(periodo);
    const datasAgendamentos = await buscarAgendamentosPorNegocio(ganhos, TIPOS_AGENDAMENTO);

    const itens = ganhos.flatMap((negocio) => {
      const assinatura = (negocio as { won_time?: string | null }).won_time?.slice(0, 10);
      const agendamentos = datasAgendamentos.get(negocio.id);
      if (!assinatura || !agendamentos) return [];

      const primeiroAgendamento = agendamentos.primeiro;
      const ultimoAgendamento = agendamentos.maisRecente;
      return [{
        negocioId: negocio.id,
        hotel: negocio.title.trim() || 'Hotel sem nome',
        primeiroAgendamento,
        ultimoAgendamento,
        assinatura,
        diasDesdePrimeira: diasEntre(primeiroAgendamento, assinatura),
        diasDesdeUltima: diasEntre(ultimoAgendamento, assinatura),
      }];
    });

    const resposta: CicloVendasResposta = {
      periodo,
      totalContratos: ganhos.length,
      contratosComAgendamento: itens.length,
      semAgendamento: ganhos.length - itens.length,
      diasMediosDesdePrimeira:
        itens.length > 0
          ? itens.reduce((total, item) => total + item.diasDesdePrimeira, 0) / itens.length
          : null,
      diasMediosDesdeUltima:
        itens.length > 0
          ? itens.reduce((total, item) => total + item.diasDesdeUltima, 0) / itens.length
          : null,
      itens: itens.sort((a, b) => b.assinatura.localeCompare(a.assinatura) || a.hotel.localeCompare(b.hotel, 'pt-BR')),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
