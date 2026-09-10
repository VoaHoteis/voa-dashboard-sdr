'use client';

import { useState } from 'react';
import {
  CLOSERS,
  CORES_FUNIL,
  FUNNEL_LABEL,
  pessoaPorChave,
  type FunnelKey,
} from '@/lib/config';
import { formatarBR, nomeDoMes } from '@/lib/dates';
import { linkDoNegocio } from '@/lib/detalhe';
import type { FechamentosResposta, ItemFechamento } from '@/lib/types';
import { BarraFunis, LegendaFunis, Modal, NumeroClicavel, Painel, useApi } from './base';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];
const CLOSER_KEYS = new Set(CLOSERS.map((c) => c.key));

/** Valor em reais, sem centavos -- fechamento se lê em milhares, não em moedas. */
const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function moeda(n: number): string {
  return MOEDA.format(n);
}

/** Recorte do modal: por funil, por closer, ou os ganhos "de outros". */
interface Recorte {
  funil?: FunnelKey;
  closer?: string;
  outros?: boolean;
}

function filtrar(itens: ItemFechamento[], r: Recorte): ItemFechamento[] {
  let out = itens;
  if (r.funil) out = out.filter((i) => i.funil === r.funil);
  if (r.closer) out = out.filter((i) => i.closer === r.closer);
  if (r.outros) out = out.filter((i) => !(i.closer && CLOSER_KEYS.has(i.closer)));
  return [...out].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

interface Detalhe {
  titulo: string;
  recorte: Recorte;
}

export function CardFechamentos() {
  const estado = useApi<FechamentosResposta>('/api/fechamentos');
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);

  const periodoLabel = estado.dados
    ? `${nomeDoMes(estado.dados.periodo.inicio)} de ${estado.dados.periodo.inicio.slice(0, 4)}`
    : undefined;

  return (
    <>
      <Painel titulo="Fechamentos do mês" periodo={periodoLabel} estado={estado}>
        {(d) => {
          const abrir = (titulo: string, recorte: Recorte) => setDetalhe({ titulo, recorte });

          return (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <NumeroClicavel
                  valor={d.time.total}
                  cor={CORES_FUNIL.salabim}
                  aoAbrir={() => abrir('Fechamentos do mês', {})}
                  titulo="Ver os negócios ganhos que formam este número"
                  desabilitado={d.time.total === 0}
                />
                <span className="rotulo">
                  {d.time.total === 1 ? 'negócio ganho' : 'negócios ganhos'} ·{' '}
                  <strong style={{ color: 'var(--texto)' }}>{moeda(d.time.valor)}</strong> fechados
                  {d.outros.total > 0 && (
                    <>
                      {' · '}
                      <button
                        className="link"
                        onClick={() => abrir('Fechamentos de fora dos closers', { outros: true })}
                        title="Negócios ganhos cujo dono não é um closer ativo (Bruno ou João)"
                      >
                        {d.outros.total} de outros donos
                      </button>
                    </>
                  )}
                </span>
              </div>

              <div style={{ marginTop: 22 }}>
                <div className="linha-meta">
                  <span className="rotulo">Proporção por funil</span>
                </div>
                <BarraFunis salabim={d.time.porFunil.salabim} novos={d.time.porFunil.novosNegocios} />
              </div>

              <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
                {FUNIS.map((f) => (
                  <div key={f}>
                    <NumeroClicavel
                      valor={d.time.porFunil[f]}
                      classe="numero medio"
                      cor={CORES_FUNIL[f]}
                      aoAbrir={() => abrir(`Fechamentos · ${FUNNEL_LABEL[f]}`, { funil: f })}
                      titulo={`Ver os negócios ganhos de ${FUNNEL_LABEL[f]}`}
                      desabilitado={d.time.porFunil[f] === 0}
                    />
                    <div className="rotulo" style={{ marginTop: 4 }}>
                      {FUNNEL_LABEL[f]} · {moeda(d.time.valorPorFunil[f])}
                    </div>
                  </div>
                ))}
              </div>

              <LegendaFunis />

              <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
                <span className="rotulo">Por closer</span>
                {d.porCloser.map((c) => (
                  <div
                    key={c.closer}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>{c.nome}</strong>
                    <span className="rotulo">
                      <NumeroClicavel
                        valor={c.total}
                        classe="numero forte"
                        aoAbrir={() => abrir(`Fechamentos · ${c.nome}`, { closer: c.closer })}
                        titulo={`Ver os fechamentos de ${c.nome}`}
                        desabilitado={c.total === 0}
                      />{' '}
                      {c.total === 1 ? 'negócio' : 'negócios'} ·{' '}
                      <strong style={{ color: 'var(--texto)' }}>{moeda(c.valor)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </>
          );
        }}
      </Painel>

      {detalhe && estado.dados && (
        <ModalFechamentos detalhe={detalhe} dados={estado.dados} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  );
}

function ModalFechamentos({
  detalhe,
  dados,
  aoFechar,
}: {
  detalhe: Detalhe;
  dados: FechamentosResposta;
  aoFechar: () => void;
}) {
  const itens = filtrar(dados.itens, detalhe.recorte);
  const soma = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <Modal
      titulo={detalhe.titulo}
      subtitulo={`${itens.length} ${itens.length === 1 ? 'negócio ganho' : 'negócios ganhos'} · ${moeda(
        soma
      )} · ${formatarBR(dados.periodo.inicio)} a ${formatarBR(dados.periodo.fim)}`}
      aoFechar={aoFechar}
    >
      <TabelaFechamentos itens={itens} />
    </Modal>
  );
}

function TabelaFechamentos({ itens }: { itens: ItemFechamento[] }) {
  if (itens.length === 0) {
    return (
      <p className="nota" style={{ border: 'none', marginTop: 0 }}>
        Nenhum negócio ganho neste recorte.
      </p>
    );
  }

  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>#</th>
          <th>Negócio</th>
          <th>Ganho em</th>
          <th>Funil</th>
          <th>Closer</th>
          <th className="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i, n) => {
          const closer = i.closer ? pessoaPorChave(i.closer) : undefined;
          return (
            <tr key={i.negocioId}>
              <td style={{ color: 'var(--texto-fraco)' }}>{n + 1}</td>
              <td>
                <a href={linkDoNegocio(i.negocioId)} target="_blank" rel="noopener noreferrer">
                  {i.titulo}
                </a>
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
                {closer ? (
                  closer.nome
                ) : (
                  <span style={{ color: 'var(--texto-fraco)' }} title="Dono não é um closer ativo">
                    {i.closer ? (pessoaPorChave(i.closer)?.nome ?? i.closer) : '—'}
                  </span>
                )}
              </td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                {moeda(i.valor)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
