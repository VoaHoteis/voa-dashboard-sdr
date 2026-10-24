'use client';

import { useState } from 'react';
import { Painel, useApi, type Estado } from '@/components/base';
import { FUNNEL_LABEL, type FunnelKey } from '@/lib/config';
import { formatarBR } from '@/lib/dates';
import type { PerdasClosersResposta } from '@/lib/types';

type ResumoPerdas = PerdasClosersResposta['porFunil'][FunnelKey];
type ModoPerdas = 'etapa' | 'motivo';

const FUNIS: FunnelKey[] = ['salabim', 'novosNegocios'];

export function CardPerdasClosers({ url = '/api/perdas-closers' }: { url?: string }) {
  const estado = useApi<PerdasClosersResposta>(url);
  const periodo = estado.dados
    ? `${formatarBR(estado.dados.periodo.inicio)}–${formatarBR(estado.dados.periodo.fim)}`
    : 'Período selecionado';

  return (
    <>
      {FUNIS.map((funil) => {
        const estadoDoFunil: Estado<ResumoPerdas> = {
          ...estado,
          dados: estado.dados?.porFunil[funil] ?? null,
        };

        return <CardPerdasFunil key={funil} funil={funil} periodo={periodo} estado={estadoDoFunil} />;
      })}
    </>
  );
}

function CardPerdasFunil({
  funil,
  periodo,
  estado,
}: {
  funil: FunnelKey;
  periodo: string;
  estado: Estado<ResumoPerdas>;
}) {
  const [modo, setModo] = useState<ModoPerdas>('etapa');

  return (
    <Painel
      titulo={`Negócios perdidos · ${FUNNEL_LABEL[funil]}`}
      periodo={`Data da perda · ${periodo}`}
      estado={estado}
    >
      {(dados) => (
        <>
          <p className="perdas-resumo">
            <strong>{dados.total}</strong>{' '}
            {dados.total === 1 ? 'negócio perdido' : 'negócios perdidos'}
          </p>

          <div className="perdas-modos" role="group" aria-label="Agrupar negócios perdidos">
            <button
              className="botao"
              type="button"
              aria-pressed={modo === 'etapa'}
              onClick={() => setModo('etapa')}
            >
              Ver por etapa
            </button>
            <button
              className="botao"
              type="button"
              aria-pressed={modo === 'motivo'}
              onClick={() => setModo('motivo')}
            >
              Ver por motivo
            </button>
          </div>

          {modo === 'etapa' ? (
            <div className="rolagem perdas-rolagem">
              <table className="tabela tabela-perdas" aria-label={`Negócios perdidos por etapa: ${FUNNEL_LABEL[funil]}`}>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.etapas.map(({ etapa, total }) => (
                    <tr key={etapa}>
                      <td>{etapa}</td>
                      <td className="num perdas-total">{total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rolagem perdas-rolagem">
              <table className="tabela tabela-perdas" aria-label={`Negócios perdidos por motivo: ${FUNNEL_LABEL[funil]}`}>
                <thead>
                  <tr>
                    <th>Motivo</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.motivos.map(({ motivo, total }) => (
                    <tr key={motivo}>
                      <td>{motivo}</td>
                      <td className="num perdas-total">{total}</td>
                    </tr>
                  ))}
                  {dados.motivos.length === 0 && (
                    <tr>
                      <td colSpan={2}>Nenhum motivo informado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <p className="nota perdas-nota">
            Total limitado às etapas definidas para {FUNNEL_LABEL[funil]}, entre negócios perdidos
            atribuídos a closers ativos.
          </p>
        </>
      )}
    </Painel>
  );
}
