'use client';

import { useState } from 'react';
import { Modal, NumeroClicavel, Painel, useApi } from '@/components/base';
import { COR_DO_FUNIL, ListaNegocios } from '@/components/CardFunilClosers';
import { CLOSERS, FUNNEL_LABEL, type CloserConfig, type FunnelKey } from '@/lib/config';
import type { FunilClosersResposta } from '@/lib/types';

type EtapaFunil = FunilClosersResposta['etapas'][number];

function CardFunilDoCloser({ closer, funil }: { closer: CloserConfig; funil: FunnelKey }) {
  const estado = useApi<FunilClosersResposta>(
    `/api/funil-closers?funil=${funil}&closer=${closer.key}`
  );
  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaFunil | null>(null);
  const cor = COR_DO_FUNIL[funil];
  const nomeFunil = FUNNEL_LABEL[funil];

  return (
    <>
      <Painel
        titulo={`Funil · ${closer.nome}`}
        periodo={`${nomeFunil} · negócios abertos, agora`}
        estado={estado}
      >
        {(dados) => {
          const maior = Math.max(1, ...dados.etapas.map((e) => e.total));

          return (
            <div>
              <div className="funil-closers-total">
                <strong className="medio" style={{ color: cor }}>
                  {dados.total}
                </strong>
                <span className="rotulo">negócios abertos como proprietário</span>
              </div>

              <table className="tabela" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th className="num" style={{ textAlign: 'right' }}>
                      Negócios
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.etapas.map((etapa) => (
                    <tr key={etapa.id}>
                      <td>
                        <div style={{ display: 'grid', gap: 5 }}>
                          <span>{etapa.nome}</span>
                          <div
                            aria-hidden="true"
                            style={{
                              height: 4,
                              borderRadius: 2,
                              background: 'var(--borda)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${(etapa.total / maior) * 100}%`,
                                height: '100%',
                                background: cor,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        <NumeroClicavel
                          valor={etapa.total}
                          classe=""
                          aoAbrir={() => setEtapaSelecionada(etapa)}
                          titulo={`Ver os ${etapa.total} negócios de ${closer.nome} em ${etapa.nome}`}
                          desabilitado={etapa.total === 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Painel>

      {etapaSelecionada && (
        <Modal
          titulo={`${closer.nome} · ${etapaSelecionada.nome}`}
          subtitulo={`${nomeFunil} · ${etapaSelecionada.total} ${etapaSelecionada.total === 1 ? 'negócio aberto' : 'negócios abertos'}`}
          aoFechar={() => setEtapaSelecionada(null)}
        >
          <ListaNegocios etapa={etapaSelecionada} />
        </Modal>
      )}
    </>
  );
}

/** Funil por closer, atribuido pelo proprietario do negocio. Um card por closer. */
export function CardsFunilPorCloser({ funil }: { funil: FunnelKey }) {
  return (
    <>
      {CLOSERS.map((closer) => (
        <CardFunilDoCloser key={closer.key} closer={closer} funil={funil} />
      ))}
    </>
  );
}
