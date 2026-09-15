'use client';

import {
  CORES_FUNIL,
  FUNNEL_LABEL,
  PAPEL_LABEL,
  pessoaPorChave,
  TIPOS_ESFORCO,
  TIPO_NO_SHOW,
} from '@/lib/config';
import { formatarBR } from '@/lib/dates';
import { linkDoNegocio } from '@/lib/detalhe';
import type { ItemAgendamento } from '@/lib/types';

/** Nome legivel do tipo de atividade. */
const NOME_TIPO: Record<string, string> = {
  reuniao_de_apresentacao_gc: 'Reunião de Apresentação Prospecção Executivo',
  meeting: 'Reunião de Apresentação',
  visita_presencial: 'Reunião Presencial',
  [TIPO_NO_SHOW]: 'Registro de No Show',
  ...Object.fromEntries(TIPOS_ESFORCO.map((t) => [t.key, t.label])),
};

/**
 * Lista de negocios por tras de um numero.
 *
 * Cada linha leva ao negocio no Pipedrive: quem abre este modal quase sempre
 * quer conferir ou corrigir alguma coisa la, nao so olhar.
 */
export function TabelaNegocios({ itens }: { itens: ItemAgendamento[] }) {
  if (itens.length === 0) {
    return <p className="nota" style={{ border: 'none', marginTop: 0 }}>Nenhum negócio neste recorte.</p>;
  }

  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>#</th>
          <th>Negócio</th>
          <th className="num">U.Hs</th>
          <th>Data</th>
          <th>Funil</th>
          <th>SDR</th>
          <th>Atividade</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i, n) => (
          <tr key={i.atividadeId}>
            <td style={{ color: 'var(--texto-fraco)' }}>{n + 1}</td>
            <td>
              {/* Sem negocio vinculado nao ha para onde linkar; mostra o assunto
                  e sinaliza a lacuna, que e o que precisa ser corrigido no CRM. */}
              {i.negocioId === null ? (
                <span title="Atividade sem negócio vinculado no Pipedrive">
                  {i.titulo}{' '}
                  <span style={{ color: 'var(--atencao)', fontSize: 11 }}>· sem negócio</span>
                </span>
              ) : (
                <a href={linkDoNegocio(i.negocioId)} target="_blank" rel="noopener noreferrer">
                  {i.titulo}
                </a>
              )}
            </td>
            <td className="num" style={{ whiteSpace: 'nowrap' }}>
              {i.uhs ?? '—'}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{formatarBR(i.data)}</td>
            <td
              style={{
                color: i.funil ? CORES_FUNIL[i.funil] : 'var(--texto-fraco)',
                whiteSpace: 'nowrap',
              }}
            >
              {i.funil ? FUNNEL_LABEL[i.funil] : '—'}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {i.sdrs.length ? (
                <>
                  {i.sdrs.map((k, n) => {
                    const p = pessoaPorChave(k);
                    return (
                      <span key={k}>
                        {n > 0 && ', '}
                        {p?.nome ?? k}
                        {/* Quem nao e SDR ativa ganha selo: sem isso, um
                            agendamento de closer ou de quem ja saiu pareceria
                            contar para a meta das duas SDRs. */}
                        {p && p.papel !== 'sdr' && (
                          <span
                            style={{
                              color: p.papel === 'inativo' ? 'var(--atencao)' : 'var(--texto-fraco)',
                              fontSize: 11,
                            }}
                          >
                            {' '}
                            ({PAPEL_LABEL[p.papel]})
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {i.atribuicao === 'proprietario' && (
                    <span
                      style={{ color: 'var(--texto-fraco)', fontSize: 11, display: 'block' }}
                      title="Campo SDR vazio no negócio — atribuído pelo proprietário"
                    >
                      pelo proprietário
                    </span>
                  )}
                </>
              ) : i.negocioId === null ? (
                // Sem negocio nao ha campo SDR para estar vazio -- dizer "sem SDR"
                // aqui apontaria para a lacuna errada.
                <span style={{ color: 'var(--texto-fraco)' }} title="Sem negócio vinculado">
                  —
                </span>
              ) : (
                <span style={{ color: 'var(--atencao)' }} title="Campo SDR vazio no negócio">
                  sem SDR
                </span>
              )}
            </td>
            <td>
              {i.assunto}
              <span style={{ color: 'var(--texto-fraco)', display: 'block', fontSize: 11 }}>
                {NOME_TIPO[i.tipo] ?? i.tipo}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
