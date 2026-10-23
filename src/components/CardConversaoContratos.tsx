'use client';

import { Painel, useApi } from '@/components/base';
import { formatarBR } from '@/lib/dates';
import type { ConversaoContratosResposta } from '@/lib/types';

function percentual(valor: number | null): string {
  if (valor === null) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

export function CardConversaoContratos() {
  const estado = useApi<ConversaoContratosResposta>('/api/conversao-contratos');

  return (
    <Painel
      titulo="Conversão de agendamentos em contratos"
      periodo={
        estado.dados
          ? `2 meses anteriores + mês atual · ${formatarBR(estado.dados.periodo.inicio)}–${formatarBR(estado.dados.periodo.fim)}`
          : 'Últimos 3 meses'
      }
      estado={estado}
    >
      {(dados) => (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
            <strong
              style={{ color: 'var(--destaque)', fontSize: 38, fontVariantNumeric: 'tabular-nums' }}
              title="Contratos ganhos divididos por todas as reuniões concluídas nos últimos três meses"
            >
              {percentual(dados.taxaConversao)}
            </strong>
            <span className="rotulo">
              {dados.totalContratos} {dados.totalContratos === 1 ? 'contrato assinado' : 'contratos assinados'}
              {' ÷ '}
              {dados.totalAgendamentos} {dados.totalAgendamentos === 1 ? 'agendamento' : 'agendamentos'}
              {' · '}
              {formatarBR(dados.periodo.inicio)}–{formatarBR(dados.periodo.fim)}
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
                  {closer.agendamentos} {closer.agendamentos === 1 ? 'agendamento' : 'agendamentos'}
                </span>
                <strong style={{ color: 'var(--destaque)', fontVariantNumeric: 'tabular-nums' }}>
                  {percentual(closer.taxaConversao)}
                </strong>
              </div>
            ))}
          </div>

          <p className="nota perdas-nota">
            Taxa calculada como contratos assinados (negócios ganhos) ÷ reuniões concluídas nos dois meses
            anteriores e no mês atual até hoje. Contamos reuniões de todos os usuários, desde que vinculadas
            a negócios dos funis acompanhados; o detalhamento é atribuído pelo proprietário do negócio.
            Como não é uma coorte de oportunidades, a taxa pode ultrapassar 100%.
          </p>
        </>
      )}
    </Painel>
  );
}
