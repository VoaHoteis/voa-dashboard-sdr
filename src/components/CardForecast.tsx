'use client';

import {
  CORES_FUNIL,
  ETAPAS_ORDEM,
  ETAPA_LABEL,
  etapaExiste,
  FUNNEL_LABEL,
  type EtapaKey,
  type FunnelKey,
} from '@/lib/config';
import { linkDoNegocio } from '@/lib/detalhe';
import type { ForecastResposta, ItemForecast } from '@/lib/types';
import { BarraFunis, LegendaFunis, Painel, useApi } from './base';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

/** Valor em reais, sem centavos -- carteira se lê em milhares, não em moedas. */
const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function moeda(n: number): string {
  return MOEDA.format(n);
}

export function CardForecast() {
  const estado = useApi<ForecastResposta>('/api/forecast');

  return (
    <Painel titulo="Forecast — negócios abertos" periodo="posição atual" estado={estado}>
      {(d) => {
        const celula = (funil: FunnelKey, etapa: EtapaKey) =>
          d.porEtapa.find((x) => x.funil === funil && x.etapa === etapa);

        const itens = [...d.itens].sort((a, b) => b.valor - a.valor);

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="numero medio" style={{ color: CORES_FUNIL.salabim }}>
                {moeda(d.valor)}
              </span>
              <span className="rotulo">
                em aberto ·{' '}
                <strong style={{ color: 'var(--texto)' }}>{d.total}</strong>{' '}
                {d.total === 1 ? 'negócio' : 'negócios'}
              </span>
            </div>

            <div style={{ marginTop: 22 }}>
              <div className="linha-meta">
                <span className="rotulo">Proporção por funil</span>
              </div>
              <BarraFunis salabim={d.porFunil.salabim} novos={d.porFunil.novosNegocios} />
            </div>

            <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
              {FUNIS.map((f) => (
                <div key={f}>
                  <span className="numero medio" style={{ color: CORES_FUNIL[f] }}>
                    {d.porFunil[f]}
                  </span>
                  <div className="rotulo" style={{ marginTop: 4 }}>
                    {FUNNEL_LABEL[f]} · {moeda(d.valorPorFunil[f])}
                  </div>
                </div>
              ))}
            </div>

            <LegendaFunis />

            <div style={{ marginTop: 24 }}>
              <span className="rotulo">Por etapa</span>
              <table className="tabela" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    {FUNIS.map((f) => (
                      <th key={f} className="num" style={{ color: CORES_FUNIL[f] }}>
                        {FUNNEL_LABEL[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ETAPAS_ORDEM.map((etapa) => (
                    <tr key={etapa}>
                      <td>{ETAPA_LABEL[etapa]}</td>
                      {FUNIS.map((f) => {
                        const c = celula(f, etapa);
                        return (
                          <td key={f} className="num">
                            {!etapaExiste(f, etapa) ? (
                              <span style={{ color: 'var(--texto-fraco)' }} title="Etapa não existe neste funil">
                                —
                              </span>
                            ) : c ? (
                              <>
                                {c.total}
                                <span style={{ color: 'var(--texto-fraco)' }}> · {moeda(c.valor)}</span>
                              </>
                            ) : (
                              <span style={{ color: 'var(--texto-fraco)' }}>0</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24 }}>
              <span className="rotulo">Todos os negócios abertos · maior valor primeiro</span>
              <div className="rolagem" style={{ marginTop: 8 }}>
                <TabelaForecast itens={itens} />
              </div>
            </div>
          </>
        );
      }}
    </Painel>
  );
}

function TabelaForecast({ itens }: { itens: ItemForecast[] }) {
  if (itens.length === 0) {
    return (
      <p className="nota" style={{ border: 'none', marginTop: 0 }}>
        Nenhum negócio aberto nas etapas acompanhadas.
      </p>
    );
  }

  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>#</th>
          <th>Negócio</th>
          <th>Funil</th>
          <th>Etapa</th>
          <th className="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((i, n) => (
          <tr key={i.negocioId}>
            <td style={{ color: 'var(--texto-fraco)' }}>{n + 1}</td>
            <td>
              <a href={linkDoNegocio(i.negocioId)} target="_blank" rel="noopener noreferrer">
                {i.titulo}
              </a>
            </td>
            <td style={{ color: CORES_FUNIL[i.funil], whiteSpace: 'nowrap' }}>
              {FUNNEL_LABEL[i.funil]}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{ETAPA_LABEL[i.etapa]}</td>
            <td className="num" style={{ whiteSpace: 'nowrap' }}>
              {moeda(i.valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
