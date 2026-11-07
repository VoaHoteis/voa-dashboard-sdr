'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgendamentosMensaisResposta } from '@/lib/types';
import { Painel, useApi } from './base';

const numeroBR = new Intl.NumberFormat('pt-BR');

export function CardAgendamentosBI() {
  const estado = useApi<AgendamentosMensaisResposta>('/api/agendamentos-bi?ano=2026');

  return (
    <Painel titulo="Agendamentos por mês · 2026" estado={estado}>
      {(dados) => {
        const totais = dados.meses.reduce(
          (soma, mes) => ({
            sdrs: soma.sdrs + mes.sdrs,
            closers: soma.closers + mes.closers,
            outros: soma.outros + mes.outros,
            total: soma.total + mes.total,
          }),
          { sdrs: 0, closers: 0, outros: 0, total: 0 }
        );

        return (
          <>
            <div className="bi-resumo">
              <div className="bi-total">
                <strong>{numeroBR.format(totais.total)}</strong>
                <span>agendamentos no ano</span>
              </div>
              <div className="bi-legenda" aria-label="Resumo por responsável">
                <span>
                  <i className="bi-cor" data-tipo="sdrs" aria-hidden="true" />
                  SDRs <strong>{numeroBR.format(totais.sdrs)}</strong>
                </span>
                <span>
                  <i className="bi-cor" data-tipo="closers" aria-hidden="true" />
                  Closers <strong>{numeroBR.format(totais.closers)}</strong>
                </span>
                {totais.outros > 0 && (
                  <span>
                    <i className="bi-cor" data-tipo="outros" aria-hidden="true" />
                    Outros <strong>{numeroBR.format(totais.outros)}</strong>
                  </span>
                )}
              </div>
            </div>

            <div
              className="bi-grafico"
              role="img"
              aria-label={`Agendamentos mensais de ${dados.ano}: ${numeroBR.format(
                totais.sdrs
              )} de SDRs, ${numeroBR.format(totais.closers)} de closers e ${numeroBR.format(
                totais.outros
              )} de outras atribuições.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dados.meses}
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
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'var(--texto-fraco)', fontSize: 11 }}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--painel-alto)' }}
                    contentStyle={{
                      backgroundColor: 'var(--painel-alto)',
                      border: '1px solid var(--borda)',
                      borderRadius: 10,
                      color: 'var(--texto)',
                    }}
                    labelStyle={{ color: 'var(--texto)' }}
                    formatter={(valor, nome) => [numeroBR.format(Number(valor)), nome]}
                  />
                  <Bar
                    dataKey="sdrs"
                    name="SDRs"
                    stackId="agendamentos"
                    fill="var(--novos)"
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="closers"
                    name="Closers"
                    stackId="agendamentos"
                    fill="var(--salabim)"
                    maxBarSize={38}
                  />
                  <Bar
                    dataKey="outros"
                    name="Outros"
                    stackId="agendamentos"
                    fill="var(--texto-fraco)"
                    maxBarSize={38}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="bi-nota">
              Segue o critério dos cards atuais: reuniões concluídas vinculadas aos funis
              acompanhados, agrupadas pela data do agendamento. A atribuição usa o campo SDR do
              negócio ou, quando vazio, o proprietário. Registros sem atribuição única de SDR ou
              closer aparecem como Outros.
            </p>
          </>
        );
      }}
    </Painel>
  );
}
