'use client';

import { SDRS } from '@/lib/config';
import { formatarBR, hoje, nomeDoMes, parse } from '@/lib/dates';
import type { LigacoesResposta } from '@/lib/types';
import { Painel, useApi } from './base';

/**
 * Card — Ligações de Prospecção por dia.
 *
 * Um painel por SDR (as duas com meta). Mostra a grade de dias úteis do mês,
 * cada um marcado como batido ou não contra a meta diária, mais dois números de
 * leitura rápida: quantos dias do mês bateram a meta e a sequência de dias úteis
 * seguidos na meta.
 */
export function CardLigacoes() {
  const estado = useApi<LigacoesResposta>('/api/ligacoes');

  return (
    <>
      {SDRS.map((cfg) => (
        <Painel
          key={cfg.key}
          titulo={`Ligações de Prospecção · ${cfg.nome}`}
          periodo={nomeDoMes(estado.dados?.mes.inicio ?? hoje())}
          estado={estado}
        >
          {(d) => {
            const sdr = d.porSdr.find((x) => x.sdr === cfg.key);
            if (!sdr) return <div className="estado">Sem dados.</div>;

            return (
              <>
                <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="numero medio">{sdr.diasBatidos}</span>
                      <span className="rotulo">/ {sdr.diasUteisDecorridos}</span>
                    </div>
                    <div className="rotulo" style={{ marginTop: 6 }}>
                      dias na meta
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span
                        className="numero medio"
                        style={{ color: sdr.sequenciaAtual > 0 ? 'var(--salabim)' : undefined }}
                      >
                        {sdr.sequenciaAtual}
                      </span>
                    </div>
                    <div className="rotulo" style={{ marginTop: 6 }}>
                      dias úteis seguidos
                    </div>
                  </div>
                </div>

                <p className="rotulo" style={{ marginTop: 16 }}>
                  {sdr.total} ligações no mês · meta de {d.meta}/dia útil
                </p>

                {sdr.dias.length > 0 ? (
                  <div className="dias-ligacoes">
                    {sdr.dias.map((dia) => (
                      <div
                        key={dia.data}
                        className="dia-ligacao"
                        data-batida={dia.batida}
                        data-hoje={dia.data === d.hoje}
                        title={`${formatarBR(dia.data)} — ${dia.quantidade} ligações${
                          dia.batida ? ' (meta batida)' : ''
                        }`}
                      >
                        <span className="n">{dia.quantidade}</span>
                        <span className="dnum">{parse(dia.data).d}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="nota">Nenhum dia útil decorrido no mês ainda.</p>
                )}
              </>
            );
          }}
        </Painel>
      ))}
    </>
  );
}
