/**
 * Card — Ligações de Prospecção por dia.
 *
 * GET /api/ligacoes
 *
 * Conta, por SDR, as atividades do tipo "Ligação de Prospecção" concluídas em
 * cada dia útil do mês corrente, contra a meta diária (20). Como o card de
 * Atividades, a atribuição é pelo EXECUTOR da atividade (user_id do Pipedrive):
 * a pergunta aqui é quanto esforço a pessoa fez, não de quem é a carteira.
 */

import { NextResponse } from 'next/server';
import { META_LIGACOES_DIA, SDRS, TIPO_LIGACAO } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { resolverLigacoesDiarias } from '@/lib/metrics';
import { buscarAtividades } from '@/lib/pipedrive';
import type { LigacoesResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(ref);
    const fim = ultimoDiaDoMes(ref);

    // Busca por data MARCADA (due_date), mas o resolver conta por data de
    // CONCLUSÃO. Alargamos ~35 dias para trás para pegar ligações concluídas
    // neste mês que estavam marcadas no anterior; o resolver recorta o excedente.
    const janelaInicio = addDias(inicio, -35);

    const porSdr: LigacoesResposta['porSdr'] = [];

    for (const s of SDRS) {
      const atividades = await buscarAtividades({
        inicio: janelaInicio,
        fim,
        tipos: [TIPO_LIGACAO],
        concluidas: true,
        userId: s.userId,
      });

      // Só ligações com negócio vinculado contam. O discador automático (Kinbox)
      // registra uma atividade por tentativa de chamada, sempre SEM negócio
      // (deal_id null); as ligações que a SDR faz de fato e marca no CRM ficam
      // ligadas a um negócio. Contar só as com negócio deixa a meta de 20/dia
      // medir ligação efetiva, não tentativa de discagem. Decisão do Joao em
      // 13/09/2026.
      const efetivas = atividades.filter((a) => a.deal_id != null);

      const r = resolverLigacoesDiarias(efetivas, {
        inicio,
        hojeIso: ref,
        meta: META_LIGACOES_DIA,
      });

      porSdr.push({
        sdr: s.key,
        nome: s.nome,
        total: r.total,
        diasBatidos: r.diasBatidos,
        diasUteisDecorridos: r.diasUteisDecorridos,
        sequenciaAtual: r.sequenciaAtual,
        dias: r.dias,
      });
    }

    const resposta: LigacoesResposta = {
      mes: { inicio, fim },
      meta: META_LIGACOES_DIA,
      hoje: ref,
      porSdr,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
