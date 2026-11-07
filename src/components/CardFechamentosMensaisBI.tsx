'use client';

import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FUNNEL_LABEL } from '@/lib/config';
import { hoje } from '@/lib/dates';
import type { FechamentosMensaisResposta, PorFunil } from '@/lib/types';
import { Painel, useApi } from './base';
import { TooltipMensalBI } from './TooltipMensalBI';

const numeroBR = new Intl.NumberFormat('pt-BR');
const ANO_ATUAL = Number(hoje().slice(0, 4));
const ANO_ANTERIOR = ANO_ATUAL - 1;
const SERIES: Array<{ chave: keyof PorFunil; nome: string; cor: string }> = [
  { chave: 'novosNegocios', nome: FUNNEL_LABEL.novosNegocios, cor: 'var(--novos)' },
  { chave: 'salabim', nome: FUNNEL_LABEL.salabim, cor: 'var(--salabim)' },
];

export function CardFechamentosMensaisBI() {
  const [comparar, setComparar] = useState(false);
  const estado = useApi<FechamentosMensaisResposta>(`/api/fechamentos-bi?ano=${ANO_ATUAL}`);
  const estadoAnterior = useApi<FechamentosMensaisResposta>(
    `/api/fechamentos-bi?ano=${ANO_ANTERIOR}`,
    comparar
  );

  return (
    <Painel titulo={`Contratos fechados por mês · ${ANO_ATUAL}`} estado={estado}>
      {(dados) => {
        const totalAtual = dados.meses.reduce((soma, mes) => soma + mes.total, 0);
        const totalAnterior = (estadoAnterior.dados?.meses ?? []).reduce(
          (soma, mes) => soma + mes.total,
          0
        );
        const mesesAnteriores = new Map(
          (estadoAnterior.dados?.meses ?? []).map((mes) => [mes.mes.slice(5), mes.total])
        );
        const totaisPorFunil = dados.meses.reduce(
          (soma, mes) => ({
            novosNegocios: soma.novosNegocios + mes.porFunil.novosNegocios,
            salabim: soma.salabim + mes.porFunil.salabim,
          }),
          { novosNegocios: 0, salabim: 0 }
        );
        const mesesGrafico = dados.meses.map((mes) => ({
          ...mes,
          ...mes.porFunil,
          totalAnterior: mesesAnteriores.get(mes.mes.slice(5)) ?? 0,
        }));

        return (
          <>
            <div className="bi-resumo">
              <div className="bi-total">
                <strong>{numeroBR.format(totalAtual)}</strong>
                <span>contratos fechados no ano</span>
              </div>
              <div className="bi-resumo-lateral">
                <div className="bi-controles">
                  <button
                    type="button"
                    className="bi-historico-botao"
                    aria-pressed={comparar}
                    onClick={() => setComparar((ativo) => !ativo)}
                  >
                    Exibir histórico do ano anterior
                  </button>
                  {comparar && estadoAnterior.carregando && (
                    <span className="bi-comparacao-status" role="status">
                      Carregando dados de {ANO_ANTERIOR}…
                    </span>
                  )}
                  {comparar && estadoAnterior.erro && (
                    <span className="bi-comparacao-erro" role="alert">
                      Comparação indisponível: {estadoAnterior.erro}
                    </span>
                  )}
                </div>
                <div className="bi-legenda" aria-label="Contratos fechados por funil">
                  {SERIES.map((serie) => (
                    <span key={serie.chave}>
                      <i className="bi-cor" data-tipo={serie.chave} aria-hidden="true" />
                      {serie.nome}{' '}
                      <strong>{numeroBR.format(totaisPorFunil[serie.chave])}</strong>
                    </span>
                  ))}
                  {comparar && estadoAnterior.dados && (
                    <span>
                      <i className="bi-cor bi-cor-linha" aria-hidden="true" />
                      Total {ANO_ANTERIOR} <strong>{numeroBR.format(totalAnterior)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className="bi-grafico"
              role="img"
              aria-label={`Contratos fechados por mês em ${dados.ano}, empilhados pelos funis ${FUNNEL_LABEL.novosNegocios} e ${FUNNEL_LABEL.salabim}.${
                comparar && estadoAnterior.dados
                  ? ` Linha comparativa: total mensal de ${estadoAnterior.dados.ano}.`
                  : ''
              }`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={mesesGrafico}
                  margin={{ top: 12, right: 8, bottom: 0, left: -16 }}
                  barCategoryGap="28%"
                  accessibilityLayer
                >
                  <CartesianGrid vertical={false} stroke="var(--borda)" />
                  <XAxis
                    dataKey="nome"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[0, 'dataMax + 5']}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--painel-alto)' }}
                    content={(props) => (
                      <TooltipMensalBI
                        {...props}
                        series={SERIES}
                        chaveTotalAtual="total"
                        nomeTotalAtual={`Total ${dados.ano}`}
                        chaveTotalAnterior="totalAnterior"
                        nomeTotalAnterior={`Total ${ANO_ANTERIOR}`}
                        mostrarAnterior={comparar && Boolean(estadoAnterior.dados)}
                      />
                    )}
                  />
                  <Bar
                    dataKey="novosNegocios"
                    name={FUNNEL_LABEL.novosNegocios}
                    stackId="contratos"
                    fill="var(--novos)"
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="salabim"
                    name={FUNNEL_LABEL.salabim}
                    stackId="contratos"
                    fill="var(--salabim)"
                    maxBarSize={38}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    dataKey="total"
                    name={`Total ${dados.ano}`}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      offset={7}
                      fill="var(--texto-fraco)"
                      fontSize={11}
                      formatter={(valor) => numeroBR.format(Number(valor))}
                    />
                  </Line>
                  {comparar && estadoAnterior.dados && (
                    <Line
                      type="monotone"
                      dataKey="totalAnterior"
                      name={`Total ${ANO_ANTERIOR}`}
                      stroke="var(--atencao)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: 'var(--atencao)' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        );
      }}
    </Painel>
  );
}
