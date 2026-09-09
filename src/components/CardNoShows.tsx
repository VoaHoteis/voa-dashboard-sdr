'use client';

import { useState } from 'react';
import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { formatarBR } from '@/lib/dates';
import type { ItemAgendamento, NoShowsResposta } from '@/lib/types';
import { BarraFunis, LegendaFunis, Modal, NumeroClicavel, Painel, useApi } from './base';
import { TabelaNegocios } from './TabelaNegocios';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

/**
 * No-shows do período, por funil.
 *
 * Conta apenas os que têm negócio vinculado. Os sem vínculo ficam fora do total,
 * mas aparecem numa linha discreta abaixo: são 15 a 25% dos lançamentos, e
 * tirá-los da tela junto com a contagem viraria subnotificação silenciosa.
 */
export function CardNoShows({ url }: { url: string }) {
  const estado = useApi<NoShowsResposta>(url);
  const [detalhe, setDetalhe] = useState<{ titulo: string; itens: ItemAgendamento[] } | null>(null);

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
        {(d) => (
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
        )}
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
    </>
  );
}
