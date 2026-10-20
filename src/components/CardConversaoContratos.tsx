'use client';

import { Painel, useApi } from '@/components/base';
import { nomeDoMes } from '@/lib/dates';
import type { ConversaoContratosResposta } from '@/lib/types';

function percentual(valor: number | null): string {
  if (valor === null) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function CardConversaoContratos() {
  const estado = useApi<ConversaoContratosResposta>('/api/conversao-contratos');

  return (
    <Painel
      titulo="Conversão de reuniões em contratos"
      periodo={estado.dados ? nomeDoMes(estado.dados.periodo.inicio) : 'Mês corrente'}
      estado={estado}
    >
      {(dados) => (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
            <strong
              style={{ color: 'var(--destaque)', fontSize: 38, fontVariantNumeric: 'tabular-nums' }}
              title="Contratos ganhos no mês divididos pelas reuniões realizadas no mês"
            >
              {percentual(dados.taxaConversao)}
            </strong>
            <span className="rotulo">
              {dados.totalContratos} {dados.totalContratos === 1 ? 'contrato fechado' : 'contratos fechados'}
              {' ÷ '}
              {dados.totalReunioes} {dados.totalReunioes === 1 ? 'reunião realizada' : 'reuniões realizadas'}
              {' · '}
              {nomeDoMes(dados.periodo.inicio)}
            </span>
          </div>

          <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
            <span className="rotulo">Por closer</span>
            {dados.porCloser.map((closer) => (
              <div
                key={closer.closer}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 1fr) auto auto',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <strong style={{ fontSize: 14 }}>{closer.nome}</strong>
                <span className="rotulo">
                  {closer.contratos} {closer.contratos === 1 ? 'contrato' : 'contratos'} /{' '}
                  {closer.reunioes} {closer.reunioes === 1 ? 'reunião' : 'reuniões'}
                </span>
                <strong style={{ color: 'var(--destaque)', fontVariantNumeric: 'tabular-nums' }}>
                  {percentual(closer.taxaConversao)}
                </strong>
              </div>
            ))}
          </div>

          <p className="nota perdas-nota">
            Taxa calculada como contratos ganhos no mês ÷ reuniões concluídas no mês. Reuniões
            contabilizadas quando vinculadas a um negócio dos funis acompanhados; contratos atribuídos
            pelo proprietário do negócio. É um índice mensal, não uma coorte de oportunidades, e pode
            ultrapassar 100%.
          </p>
        </>
      )}
    </Painel>
  );
}
