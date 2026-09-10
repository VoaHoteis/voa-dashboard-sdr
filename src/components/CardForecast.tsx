'use client';

import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { hoje, nomeDoMes } from '@/lib/dates';
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
  const mes = nomeDoMes(hoje());

  return (
    <Painel titulo="Forecast — previsão do mês" periodo={`fecham em ${mes}`} estado={estado}>
      {(d) => {
        const etapas = [...d.porEtapa].sort((a, b) => b.valor - a.valor);
        const itens = [...d.itens].sort((a, b) => b.valor - a.valor);

        return (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span className="numero medio" style={{ color: CORES_FUNIL.salabim }}>
                {moeda(d.valor)}
              </span>
              <span className="rotulo">
                previstos para fechar ·{' '}
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

            {etapas.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <span className="rotulo">Por etapa · maior valor primeiro</span>
                <table className="tabela" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      <th>Funil</th>
                      <th className="num">Negócios</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map((e) => (
                      <tr key={e.funil + ':' + e.etapaId}>
                        <td>{e.etapa}</td>
                        <td style={{ color: CORES_FUNIL[e.funil], whiteSpace: 'nowrap' }}>
                          {FUNNEL_LABEL[e.funil]}
                        </td>
                        <td className="num">{e.total}</td>
                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                          {moeda(e.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <span className="rotulo">Negócios com fechamento previsto · maior valor primeiro</span>
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
        Nenhum negócio com fechamento previsto para este mês.
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
            <td style={{ whiteSpace: 'nowrap' }}>{i.etapa}</td>
            <td className="num" style={{ whiteSpace: 'nowrap' }}>
              {moeda(i.valor)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
