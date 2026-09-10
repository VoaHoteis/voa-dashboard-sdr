/**
 * Recorte dos itens que produziram cada numero do dashboard.
 *
 * Espelha `contarPorFunil` de metrics.ts de proposito: se os dois discordarem,
 * o modal mostraria uma lista com tamanho diferente do numero clicado, que e a
 * pior coisa que uma tela de conferencia pode fazer. Qualquer mudanca em um
 * precisa acontecer no outro.
 */

import { pessoaPorChave, type FunnelKey, type UnidadeContagem } from './config';
import type { ItemAgendamento } from './types';

export interface Recorte {
  funil?: FunnelKey;
  /** Chave de PESSOAS. */
  sdr?: string;
  /** Nem campo SDR nem proprietario conhecido. */
  semSdr?: boolean;
  /** Atribuido apenas a quem ja saiu do time. */
  inativo?: boolean;
  unidade?: UnidadeContagem;
}

export function filtrarItens(itens: ItemAgendamento[], r: Recorte): ItemAgendamento[] {
  let out = itens;

  if (r.funil) out = out.filter((i) => i.funil === r.funil);
  if (r.sdr) out = out.filter((i) => i.sdrs.includes(r.sdr as string));
  if (r.semSdr) out = out.filter((i) => i.atribuicao === 'nenhuma');
  if (r.inativo) {
    out = out.filter(
      (i) => i.sdrs.length > 0 && i.sdrs.every((k) => pessoaPorChave(k)?.papel === 'inativo')
    );
  }

  // Na unidade "negocios", duas reunioes com o mesmo hotel no mesmo funil valem
  // 1 -- entao a lista tambem mostra so a primeira.
  if (r.unidade === 'negocios') {
    const vistos = new Set<string>();
    out = out.filter((i) => {
      const chave = i.funil + ':' + i.negocioId;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  }

  return [...out].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/**
 * Quantos ficariam se os agendamentos marcados fossem confirmados.
 *
 * Junta as duas listas ANTES de deduplicar, de proposito: na unidade "negocios
 * distintos", um hotel que ja teve reuniao e tem outra marcada precisa valer 1,
 * nao 2. Contar cada lista em separado e somar daria o numero errado.
 */
export function contarProjecao(
  feitos: ItemAgendamento[],
  marcados: ItemAgendamento[],
  r: Recorte
): number {
  return filtrarItens([...feitos, ...marcados], r).length;
}

/** Link do negocio no Pipedrive. Nao e segredo -- e a URL publica da conta. */
export const PIPEDRIVE_WEB = 'https://voahoteis2.pipedrive.com';

export function linkDoNegocio(id: number): string {
  return `${PIPEDRIVE_WEB}/deal/${id}`;
}
