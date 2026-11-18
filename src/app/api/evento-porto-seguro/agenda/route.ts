import { NextResponse } from 'next/server';
import type { ISODate } from '@/lib/dates';
import { buscarAtividades, buscarNegociosPorIds, filtrarNegociosPorEtiqueta } from '@/lib/pipedrive';
import type { AgendaEventoResposta, ItemAgendaEvento } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../../_comum';

export const dynamic = 'force-dynamic';

const INICIO: ISODate = '2026-11-30';
const FIM: ISODate = '2026-12-04';

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function identificarDestino(texto: string): ItemAgendaEvento['destino'] {
  const normalizado = normalizar(texto);
  if (normalizado.includes('arraial')) return 'arraial-dajuda';
  if (normalizado.includes('porto seguro')) return 'porto-seguro';
  return 'nao-definido';
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const atividades = await buscarAtividades({
      inicio: INICIO,
      fim: FIM,
      tipos: [],
      concluidas: false,
    });
    const negocios = await buscarNegociosPorIds(
      atividades
        .map((atividade) => atividade.deal_id)
        .filter((id): id is number => typeof id === 'number')
    );
    const negociosComEtiqueta = await filtrarNegociosPorEtiqueta(
      [...negocios.values()],
      'Evento Porto Seguro'
    );
    const idsNegociosComEtiqueta = new Set(negociosComEtiqueta.map((negocio) => negocio.id));

    const itens: ItemAgendaEvento[] = atividades.flatMap((atividade) => {
      if (!atividade.due_date || !atividade.deal_id || !idsNegociosComEtiqueta.has(atividade.deal_id)) return [];
      const negocio = negocios.get(atividade.deal_id);
      const assunto = atividade.subject?.trim() || atividade.type || 'Atividade';
      const local = atividade.location?.trim() || null;
      const tituloNegocio = negocio?.title?.trim() || null;
      const destino = identificarDestino([assunto, local, tituloNegocio].filter(Boolean).join(' '));

      return [{
        atividadeId: atividade.id,
        data: atividade.due_date,
        hora: atividade.due_time?.slice(0, 5) || null,
        duracao: atividade.duration || null,
        assunto,
        negocio: tituloNegocio,
        local,
        destino,
      }];
    });

    itens.sort((a, b) =>
      a.data.localeCompare(b.data) ||
      (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
      a.assunto.localeCompare(b.assunto, 'pt-BR')
    );

    const resposta: AgendaEventoResposta = { inicio: INICIO, fim: FIM, itens };
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
