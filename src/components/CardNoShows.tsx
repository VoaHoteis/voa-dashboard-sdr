'use client';

import { useState } from 'react';
import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { formatarBR, intervaloUltimosDias } from '@/lib/dates';
import type { AgendamentosResposta, ItemAgendamento, NoShowsResposta } from '@/lib/types';
import { BarraFunis, LegendaFunis, Modal, NumeroClicavel, Painel, pct, useApi } from './base';
import { TabelaNegocios } from './TabelaNegocios';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

function urlComPeriodo(url: string, inicio: string, fim: string): string {
  const [caminho, query = ''] = url.split('?');
  const parametros = new URLSearchParams(query);
  parametros.set('inicio', inicio);
  parametros.set('fim', fim);
  return `${caminho}?${parametros.toString()}`;
}

/** Um hotel (negócio) e quantos no-shows ele teve no período. */
interface NoShowsPorHotel {
  negocioId: number;
  titulo: string;
  total: number;
  origens: string[];
  itens: ItemAgendamento[];
}

/**
 * Agrupa os no-shows já contabilizados (com negócio vinculado) por hotel.
 *
 * Usa os mesmos `itens` que formam o total do card -- os sem vínculo
 * (`itensForaDaConta`) não entram aqui pela mesma razão que não entram no
 * total: não há hotel para agrupar.
 */
function agruparPorHotel(itens: ItemAgendamento[]): NoShowsPorHotel[] {
  const porNegocio = new Map<number, NoShowsPorHotel>();
  for (const item of itens) {
    if (item.negocioId === null) continue;
    const atual = porNegocio.get(item.negocioId);
    if (atual) {
      atual.total += 1;
      atual.itens.push(item);
      if (item.origem && !atual.origens.includes(item.origem)) atual.origens.push(item.origem);
    } else {
      porNegocio.set(item.negocioId, {
        negocioId: item.negocioId,
        titulo: item.titulo,
        total: 1,
        origens: item.origem ? [item.origem] : [],
        itens: [item],
      });
    }
  }
  return [...porNegocio.values()].sort((a, b) => b.total - a.total);
}

/**
 * No-shows do período, por funil.
 *
 * Conta apenas os que têm negócio vinculado. Os sem vínculo ficam fora do total,
 * mas aparecem numa linha discreta abaixo: são 15 a 25% dos lançamentos, e
 * tirá-los da tela junto com a contagem viraria subnotificação silenciosa.
 */
export function CardNoShows({ url, urlAgendamentos }: { url: string; urlAgendamentos: string }) {
  const estado = useApi<NoShowsResposta>(url);
  // Denominador da taxa: reuniões efetivamente realizadas no mesmo período,
  // mesmo recorte de funil do resto do dashboard.
  const agendamentos = useApi<AgendamentosResposta>(urlAgendamentos);
  const periodo90Dias = intervaloUltimosDias(90);
  const estado90Dias = useApi<NoShowsResposta>(
    urlComPeriodo(url, periodo90Dias.inicio, periodo90Dias.fim)
  );
  const agendamentos90Dias = useApi<AgendamentosResposta>(
    urlComPeriodo(urlAgendamentos, periodo90Dias.inicio, periodo90Dias.fim)
  );
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: ItemAgendamento[] } | null>(null);
  const [porHotelAberto, setPorHotelAberto] = useState(false);

  return (
    <>
      <Painel
        titulo="No-shows"
        periodo={
          estado.dados
            ? `${formatarBR(estado.dados.periodo.inicio)} a ${formatarBR(estado.dados.periodo.fim)}`
            : undefined
        }
        estado={estado}
      >
        {(d) => {
          const porHotel = agruparPorHotel(d.itens);
          // Taxa = no-shows / (no-shows + reuniões realizadas) no mesmo período.
          // Só sai do "—" quando as duas buscas do card já responderam.
          const realizados = agendamentos.dados?.time.total ?? null;
          const taxa =
            realizados !== null && d.total + realizados > 0
              ? d.total / (d.total + realizados)
              : null;
          const totalNoShows90Dias = estado90Dias.dados?.total ?? null;
          const realizados90Dias = agendamentos90Dias.dados?.time.total ?? null;
          const taxa90Dias =
            totalNoShows90Dias !== null &&
            realizados90Dias !== null &&
            totalNoShows90Dias + realizados90Dias > 0
              ? totalNoShows90Dias / (totalNoShows90Dias + realizados90Dias)
              : null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ display: 'flex', gap: 44, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <NumeroClicavel
                    valor={d.total}
                    cor="var(--alerta)"
                    aoAbrir={() => setDetalhe({ titulo: 'No-shows do período', itens: d.itens })}
                    titulo="Ver os no-shows que formam este número"
                    desabilitado={d.total === 0}
                  />
                  <div className="rotulo" style={{ marginTop: 6 }}>
                    no-shows no período
                  </div>
                </div>

                <div>
                  <span
                    className="numero medio"
                    style={{ color: 'var(--alerta)' }}
                    title="No-shows ÷ (no-shows + reuniões realizadas) no período"
                  >
                    {taxa !== null ? pct(taxa, 1) : '—'}
                  </span>
                  <div className="rotulo" style={{ marginTop: 6 }}>
                    % de no-shows no período
                  </div>
                  <div
                    className="rotulo"
                    style={{ marginTop: 8 }}
                    title="No-shows ÷ (no-shows + reuniões realizadas) nos últimos 90 dias"
                  >
                    Média 90 dias:{' '}
                    <strong style={{ color: 'var(--alerta)' }}>
                      {taxa90Dias !== null ? pct(taxa90Dias, 1) : '—'}
                    </strong>
                  </div>
                </div>

                <div>
                  <NumeroClicavel
                    valor={porHotel.length}
                    classe="numero medio"
                    cor="var(--alerta)"
                    aoAbrir={() => setPorHotelAberto(true)}
                    titulo="Ver os no-shows agrupados por hotel"
                    desabilitado={porHotel.length === 0}
                  />
                  <div className="rotulo" style={{ marginTop: 6 }}>
                    {porHotel.length === 1 ? 'hotel com no-show' : 'hotéis com no-show'}
                  </div>
                </div>

                <div style={{ flex: '1 1 280px', minWidth: 240 }}>
                  <div className="linha-meta">
                    <span className="rotulo">Por funil</span>
                  </div>
                  <BarraFunis salabim={d.porFunil.salabim} novos={d.porFunil.novosNegocios} />

                  <div style={{ display: 'flex', gap: 28, marginTop: 14, flexWrap: 'wrap' }}>
                    {FUNIS.map((f) => (
                      <div key={f}>
                        <NumeroClicavel
                          valor={d.porFunil[f]}
                          classe="numero medio"
                          cor={CORES_FUNIL[f]}
                          aoAbrir={() =>
                            setDetalhe({
                              titulo: `No-shows · ${FUNNEL_LABEL[f]}`,
                              itens: d.itens.filter((i) => i.funil === f),
                            })
                          }
                          titulo={`Ver os no-shows de ${FUNNEL_LABEL[f]}`}
                          desabilitado={d.porFunil[f] === 0}
                        />
                        <div className="rotulo" style={{ marginTop: 4 }}>
                          {FUNNEL_LABEL[f]}
                        </div>
                      </div>
                    ))}
                  </div>

                  <LegendaFunis />

                  {d.foraDaConta > 0 && (
                    <p className="rotulo" style={{ marginTop: 12, lineHeight: 1.5 }}>
                      <button
                        className="link"
                        onClick={() =>
                          setDetalhe({
                            titulo: 'No-shows sem negócio vinculado (fora da conta)',
                            itens: d.itensForaDaConta,
                          })
                        }
                        title="Não entram no total — precisam ser vinculados a um negócio no Pipedrive"
                      >
                        + {d.foraDaConta} sem negócio vinculado
                      </button>
                      , fora da conta
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }}
      </Painel>

      {detalhe && (
        <Modal
          titulo={detalhe.titulo}
          subtitulo={`${detalhe.itens.length} ${
            detalhe.itens.length === 1 ? 'registro' : 'registros'
          }`}
          aoFechar={() => setDetalhe(null)}
        >
          <TabelaNegocios itens={detalhe.itens} />
        </Modal>
      )}

      {porHotelAberto && estado.dados && (
        <Modal
          titulo="No-shows por hotel"
          subtitulo={`${agruparPorHotel(estado.dados.itens).length} ${
            agruparPorHotel(estado.dados.itens).length === 1 ? 'hotel' : 'hotéis'
          }`}
          aoFechar={() => setPorHotelAberto(false)}
        >
          <table className="tabela">
            <thead>
              <tr>
                <th>Hotel</th>
                <th>Origem do lead</th>
                <th className="num">No-shows</th>
              </tr>
            </thead>
            <tbody>
              {agruparPorHotel(estado.dados.itens).map((h) => (
                <tr key={h.negocioId}>
                  <td>
                    <button
                      className="link"
                      onClick={() => {
                        setPorHotelAberto(false);
                        setDetalhe({ titulo: `No-shows · ${h.titulo}`, itens: h.itens });
                      }}
                      title={`Ver os no-shows de ${h.titulo}`}
                    >
                      {h.titulo}
                    </button>
                  </td>
                  <td>{h.origens.length ? h.origens.join(', ') : '—'}</td>
                  <td className="num">
                    <span className="numero medio" style={{ color: 'var(--alerta)' }}>
                      {h.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
