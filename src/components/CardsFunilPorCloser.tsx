'use client';

import { useState } from 'react';
import { LegendaFunis, Modal, NumeroClicavel, Painel, pct, useApi } from '@/components/base';
import { ListaNegocios } from '@/components/CardFunilClosers';
import { CLOSERS, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { nomeDoMes } from '@/lib/dates';
import type { FunilPorCloserResposta, ItemNegocioEtapa } from '@/lib/types';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

interface Detalhe {
  titulo: string;
  subtitulo: string;
  negocios: ItemNegocioEtapa[];
}

/** Funil por closer, no mesmo formato do Funil por SDR. Um card por closer. */
export function CardsFunilPorCloser() {
  const estado = useApi<FunilPorCloserResposta>('/api/funil-por-closer');
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);

  return (
    <>
      {CLOSERS.map((cfg) => (
        <Painel
          key={cfg.key}
          titulo={`Funil · ${cfg.nome}`}
          periodo="negócios abertos, agora"
          estado={estado}
        >
          {(d) => {
            const closer = d.porCloser.find((x) => x.closer === cfg.key);
            if (!closer) return <div className="estado">Sem dados.</div>;

            return (
              <div style={{ display: 'grid', gap: 18 }}>
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      {FUNIS.map((f) => (
                        <th key={f} className="num" style={{ textAlign: 'right' }}>
                          {FUNNEL_LABEL[f]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.etapas.map((etapa, i) => (
                      <tr key={etapa.chave}>
                        <td>{etapa.nome}</td>
                        {FUNIS.map((f) => {
                          const celula = closer.funis[f].etapas[i];
                          if (!celula) {
                            return (
                              <td key={f} className="num" title="Etapa não existe neste funil">
                                <span style={{ color: 'var(--texto-fraco)' }}>—</span>
                              </td>
                            );
                          }
                          return (
                            <td key={f} className="num">
                              <NumeroClicavel
                                valor={celula.total}
                                classe=""
                                aoAbrir={() =>
                                  setDetalhe({
                                    titulo: `${cfg.nome} · ${etapa.nome}`,
                                    subtitulo: `${FUNNEL_LABEL[f]} · ${celula.total} ${celula.total === 1 ? 'negócio aberto' : 'negócios abertos'}`,
                                    negocios: celula.negocios,
                                  })
                                }
                                titulo={`Ver os ${celula.total} negócios de ${cfg.nome} em ${etapa.nome} (${FUNNEL_LABEL[f]})`}
                                desabilitado={celula.total === 0}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div>
                  <div className="linha-meta">
                    <span className="rotulo">Saúde dos negócios</span>
                    <span className="rotulo">etapas do closer</span>
                  </div>

                  <table className="tabela">
                    <tbody>
                      {(
                        [
                          ['emDia', 'Em dia', 'var(--salabim)'],
                          ['atrasado', 'Atrasado', 'var(--alerta)'],
                          ['semAtividade', 'Sem atividade', 'var(--texto-fraco)'],
                        ] as const
                      ).map(([k, label, cor]) => (
                        <tr key={k}>
                          <td style={{ color: cor }}>{label}</td>
                          {FUNIS.map((f) => (
                            <td key={f} className="num">
                              {closer.funis[f].saude[k]}
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <td className="rotulo">Índice de saúde</td>
                        {FUNIS.map((f) => {
                          const indice = closer.funis[f].indiceSaude;
                          return (
                            <td key={f} className="num">
                              {indice === null ? '—' : pct(indice)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="linha-meta">
                    <span className="rotulo">Hotéis perdidos</span>
                    <span className="rotulo">
                      {nomeDoMes(d.periodoPerdidos.inicio)} · Data de perda
                    </span>
                  </div>

                  <table className="tabela">
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--alerta)' }}>Perdidos</td>
                        {FUNIS.map((f) => (
                          <td
                            key={f}
                            className="num"
                            title={`Negócios marcados como perdidos em ${FUNNEL_LABEL[f]} neste mês (por proprietário)`}
                          >
                            {closer.funis[f].perdidos}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <LegendaFunis />
              </div>
            );
          }}
        </Painel>
      ))}

      {detalhe && (
        <Modal
          titulo={detalhe.titulo}
          subtitulo={detalhe.subtitulo}
          aoFechar={() => setDetalhe(null)}
        >
          <ListaNegocios
            etapa={{ id: 0, nome: '', ordem: 0, total: detalhe.negocios.length, negocios: detalhe.negocios }}
          />
        </Modal>
      )}
    </>
  );
}
