'use client';

import type { TooltipContentProps } from 'recharts';

const numeroBR = new Intl.NumberFormat('pt-BR');

export interface SerieTooltipBI {
  chave: string;
  nome: string;
  cor: string;
}

interface TooltipMensalBIProps extends TooltipContentProps {
  series: SerieTooltipBI[];
  chaveTotalAtual: string;
  nomeTotalAtual: string;
  chaveTotalAnterior?: string;
  nomeTotalAnterior?: string;
  mostrarAnterior?: boolean;
}

export function TooltipMensalBI({
  active,
  payload,
  label,
  series,
  chaveTotalAtual,
  nomeTotalAtual,
  chaveTotalAnterior,
  nomeTotalAnterior,
  mostrarAnterior = false,
}: TooltipMensalBIProps) {
  if (!active || !payload.length) return null;

  const linha = payload[0]?.payload as Record<string, unknown> | undefined;
  if (!linha) return null;

  return (
    <div className="bi-tooltip">
      <strong className="bi-tooltip-titulo">{label}</strong>
      {series.map((serie) => (
        <div className="bi-tooltip-linha" key={serie.chave}>
          <i style={{ backgroundColor: serie.cor }} aria-hidden="true" />
          <span>{serie.nome}</span>
          <strong>{numeroBR.format(Number(linha[serie.chave] ?? 0))}</strong>
        </div>
      ))}
      <div className="bi-tooltip-total">
        <span>{nomeTotalAtual}</span>
        <strong>{numeroBR.format(Number(linha[chaveTotalAtual] ?? 0))}</strong>
      </div>
      {mostrarAnterior && chaveTotalAnterior && nomeTotalAnterior && (
        <div className="bi-tooltip-total bi-tooltip-total-anterior">
          <span>{nomeTotalAnterior}</span>
          <strong>{numeroBR.format(Number(linha[chaveTotalAnterior] ?? 0))}</strong>
        </div>
      )}
    </div>
  );
}
