'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ContagemValorNegocio } from '@/lib/types';

const PALETA = [
  'var(--novos)',
  'var(--salabim)',
  'var(--atencao)',
  'var(--alerta)',
  'var(--texto-fraco)',
];
const numeroBR = new Intl.NumberFormat('pt-BR');
const percentualBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function GraficoPizzaBI({
  campo,
  dados,
  totalNegocios,
}: {
  campo: string;
  dados: ContagemValorNegocio[];
  totalNegocios: number;
}) {
  const totalValores = dados.reduce((total, item) => total + item.quantidade, 0);

  return (
    <div className="bi-distribuicao">
      <div className="bi-distribuicao__layout">
        <div className="bi-distribuicao__grafico" aria-hidden="true">
          {dados.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="quantidade"
                  nameKey="nome"
                  innerRadius="60%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="var(--painel)"
                  strokeWidth={2}
                >
                  {dados.map((item, indice) => (
                    <Cell key={item.nome} fill={PALETA[indice % PALETA.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(valor) => [
                    `${numeroBR.format(Number(valor))} negócios`,
                    'Quantidade',
                  ]}
                  contentStyle={{
                    background: 'var(--painel-alto)',
                    border: '1px solid var(--borda)',
                    borderRadius: 8,
                    color: 'var(--texto)',
                  }}
                  labelStyle={{ color: 'var(--texto)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="bi-distribuicao__vazio">Sem negócios para exibir</div>
          )}
          <div className="bi-distribuicao__centro">
            <strong>{numeroBR.format(totalNegocios)}</strong>
            <span>negócios abertos</span>
          </div>
        </div>

        {dados.length > 0 ? (
          <ul className="bi-distribuicao__legenda" aria-label={`Distribuição por ${campo}`}>
            {dados.map((item, indice) => {
              const percentual = totalValores > 0 ? (item.quantidade / totalValores) * 100 : 0;
              const cor = PALETA[indice % PALETA.length];

              return (
                <li
                  className="bi-distribuicao__item"
                  key={item.nome}
                  aria-label={`${item.nome}: ${numeroBR.format(item.quantidade)} negócios, ${percentualBR.format(percentual)}%`}
                >
                  <i
                    className="bi-distribuicao__amostra"
                    style={{ backgroundColor: cor }}
                    aria-hidden="true"
                  />
                  <span className="bi-distribuicao__nome">{item.nome}</span>
                  <strong>{numeroBR.format(item.quantidade)}</strong>
                  <span className="bi-distribuicao__percentual">
                    {percentualBR.format(percentual)}%
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="bi-distribuicao__vazio">Nenhum negócio aberto encontrado.</p>
        )}
      </div>
      <p className="bi-distribuicao__nota">
        Base: negócios abertos. Campos vazios aparecem como “Não informado”.
      </p>
    </div>
  );
}
