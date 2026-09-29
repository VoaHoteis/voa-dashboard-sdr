'use client';

import { useState } from 'react';
import { CORES_FUNIL, FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { addDias, hoje, nomeDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { linkDoNegocio } from '@/lib/detalhe';
import type { ForecastResposta, ItemForecast } from '@/lib/types';
import { Painel, useApi } from './base';

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

function nomeMesAno(data: string): string {
  return `${nomeDoMes(data)} de ${data.slice(0, 4)}`;
}

export function CardForecast() {
  const [mesSelecionado, setMesSelecionado] = useState<'referencia' | 'proximo'>('proximo');
  const referencia = hoje();
  const primeiroDiaProximoMes = addDias(ultimoDiaDoMes(referencia), 1);
  const inicioReferencia = `${referencia.slice(0, 7)}-01`;
  const fimReferencia = ultimoDiaDoMes(referencia);
  const fimProximoMes = ultimoDiaDoMes(primeiroDiaProximoMes);

  const estadoReferencia = useApi<ForecastResposta>(
    `/api/forecast?inicio=${inicioReferencia}&fim=${fimReferencia}`
  );
  const estadoProximo = useApi<ForecastResposta>(
    `/api/forecast?inicio=${primeiroDiaProximoMes}&fim=${fimProximoMes}`
  );

  const estado = {
    dados:
      estadoReferencia.dados && estadoProximo.dados
        ? { referencia: estadoReferencia.dados, proximo: estadoProximo.dados }
        : null,
    carregando: estadoReferencia.carregando || estadoProximo.carregando,
    erro: estadoReferencia.erro || estadoProximo.erro,
    recarregar: () => {
      estadoReferencia.recarregar();
      estadoProximo.recarregar();
    },
  };

  return (
    <Painel
      titulo="Forecast — mês de referência x próximo mês"
      periodo={`${nomeMesAno(referencia)} → ${nomeMesAno(primeiroDiaProximoMes)}`}
      estado={estado}
    >
      {({ referencia: atual, proximo }) => {
        const forecastSelecionado = mesSelecionado === 'referencia' ? atual : proximo;
        const dataSelecionada = mesSelecionado === 'referencia' ? referencia : primeiroDiaProximoMes;
        const itens = [...forecastSelecionado.itens].sort((a, b) => b.valor - a.valor);
        const variacaoValor = proximo.valor - atual.valor;
        const variacaoPercentual = atual.valor > 0 ? (variacaoValor / atual.valor) * 100 : null;
        const variacaoNegocios = proximo.total - atual.total;

        return (
          <>
            <div className="forecast-comparacao">
              <button
                type="button"
                className={`forecast-mes referencia${mesSelecionado === 'referencia' ? ' selecionado' : ''}`}
                aria-label={`Ver forecast de ${nomeMesAno(referencia)}`}
                aria-pressed={mesSelecionado === 'referencia'}
                onClick={() => setMesSelecionado('referencia')}
              >
                <span className="rotulo">Mês de referência · {nomeDoMes(referencia)}</span>
                <strong className="numero medio">{moeda(atual.valor)}</strong>
                <span className="rotulo">
                  {atual.total} {atual.total === 1 ? 'negócio previsto' : 'negócios previstos'}
                </span>
              </button>
              <button
                type="button"
                className={`forecast-mes proximo${mesSelecionado === 'proximo' ? ' selecionado' : ''}`}
                aria-label={`Ver forecast de ${nomeMesAno(primeiroDiaProximoMes)}`}
                aria-pressed={mesSelecionado === 'proximo'}
                onClick={() => setMesSelecionado('proximo')}
              >
                <span className="rotulo">Próximo mês · {nomeDoMes(primeiroDiaProximoMes)}</span>
                <strong className="numero medio">{moeda(proximo.valor)}</strong>
                <span className="rotulo">
                  {proximo.total} {proximo.total === 1 ? 'negócio previsto' : 'negócios previstos'}
                </span>
              </button>
            </div>

            <p className="forecast-variacao">
              Variação estimada:{' '}
              <strong>{variacaoValor > 0 ? '+' : ''}{moeda(variacaoValor)}</strong>
              {variacaoPercentual !== null && (
                <> ({variacaoPercentual > 0 ? '+' : ''}{variacaoPercentual.toFixed(1).replace('.', ',')}%)</>
              )}
              {' · '}
              <strong>{variacaoNegocios > 0 ? '+' : ''}{variacaoNegocios}</strong>{' '}
              {Math.abs(variacaoNegocios) === 1 ? 'negócio' : 'negócios'}
            </p>

            <div className="rolagem" style={{ marginTop: 22 }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Funil</th>
                    <th className="num">Referência</th>
                    <th className="num">Próximo mês</th>
                    <th className="num">Valor no próximo mês</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNIS.map((funil) => (
                    <tr key={funil}>
                      <td style={{ color: CORES_FUNIL[funil], whiteSpace: 'nowrap' }}>
                        {FUNNEL_LABEL[funil]}
                      </td>
                      <td className="num">{atual.porFunil[funil]}</td>
                      <td className="num">{proximo.porFunil[funil]}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {moeda(proximo.valorPorFunil[funil])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24 }}>
              <span className="rotulo">
                Negócios com fechamento previsto para {nomeDoMes(dataSelecionada)} · maior valor primeiro
              </span>
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
                    <th className="num">U.Hs</th>
                    <th>Proprietário</th>
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
            <td className="num" style={{ whiteSpace: 'nowrap' }}>
              {i.uhs ?? '—'}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>{i.proprietario}</td>
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
