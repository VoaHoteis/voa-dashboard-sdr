'use client';

import { Painel, useApi } from '@/components/base';
import { FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { nomeDoMes } from '@/lib/dates';
import type { PerdasClosersResposta } from '@/lib/types';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

export function CardPerdasClosers() {
  const estado = useApi<PerdasClosersResposta>('/api/perdas-closers');

  return (
    <Painel
      titulo="Negócios perdidos por etapa e motivo"
      periodo="Data de perda · mês corrente"
      estado={estado}
    >
      {(dados) => {
        if (dados.total === 0) {
          return <p className="nota">Nenhum negócio perdido de closer neste mês.</p>;
        }

        return (
          <>
            <p className="perdas-resumo">
              <strong>{dados.total}</strong> {dados.total === 1 ? 'negócio perdido' : 'negócios perdidos'}
              {' · '}{nomeDoMes(dados.periodo.inicio)}
            </p>
            <div className="rolagem perdas-rolagem">
              <table
                className="tabela tabela-perdas"
                aria-label="Quantidade de negócios perdidos por funil, etapa e motivo de perda"
              >
                <thead>
                  <tr>
                    <th>Funil</th>
                    <th>Etapa</th>
                    {dados.motivos.map((motivo) => (
                      <th key={motivo} className="num perdas-motivo">{motivo}</th>
                    ))}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNIS.flatMap((funil) =>
                    dados.etapas
                      .filter((etapa) => etapa.funil === funil)
                      .map((etapa) => (
                        <tr key={`${funil}-${etapa.etapaId}`}>
                          <td className="perdas-funil">{FUNNEL_LABEL[funil]}</td>
                          <td>{etapa.etapa}</td>
                          {dados.motivos.map((motivo) => (
                            <td key={motivo} className="num">
                              {etapa.porMotivo[motivo] ?? 0}
                            </td>
                          ))}
                          <td className="num perdas-total">{etapa.total}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="nota perdas-nota">
              Considera negócios perdidos no mês corrente, dos closers ativos, nas etapas exibidas
              no funil de closers.
            </p>
          </>
        );
      }}
    </Painel>
  );
}
