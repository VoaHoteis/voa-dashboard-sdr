'use client';

import { Painel, numeroBR, useApi } from '@/components/base';
import type { MetricasEventoPortoSeguroResposta } from '@/lib/types';

const numeroInteiroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function CardEventoPortoSeguro() {
  const estado = useApi<MetricasEventoPortoSeguroResposta>('/api/evento-porto-seguro');

  return (
    <Painel titulo="Evento Porto Seguro" estado={estado}>
      {(dados) => {
        const funis = [...new Set(dados.negociosPorEtapa.map((item) => item.funil))];

        return (
          <div className="evento-conteudo" aria-label="Métricas da etiqueta Evento Porto Seguro">
            <div className="evento-metricas">
              <div className="evento-metrica">
                <strong className="numero grande" aria-label={`${numeroInteiroBR.format(dados.leads)} leads`}>
                  {numeroBR(dados.leads, 0)}
                </strong>
                <span>Leads com a etiqueta</span>
              </div>
              <div className="evento-metrica">
                <strong
                  className="numero grande"
                  aria-label={`${numeroInteiroBR.format(dados.negociosAbertos)} negócios abertos`}
                >
                  {numeroBR(dados.negociosAbertos, 0)}
                </strong>
                <span>Negócios em aberto com a etiqueta</span>
              </div>
            </div>

            <div className="evento-detalhes">
              <section className="evento-detalhes__coluna" aria-labelledby="evento-proprietarios">
                <h3 id="evento-proprietarios">Negócios por proprietário</h3>
                {dados.negociosPorProprietario.length > 0 ? (
                  <ul className="evento-lista" aria-label="Quantidade de negócios por proprietário">
                    {dados.negociosPorProprietario.map((item) => (
                      <li key={item.nome}>
                        <span>{item.nome}</span>
                        <strong
                          className="evento-contagem"
                          aria-label={`${numeroInteiroBR.format(item.total)} negócios`}
                        >
                          {numeroBR(item.total, 0)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="evento-vazio">Nenhum negócio aberto com esta etiqueta.</p>
                )}
              </section>

              <section className="evento-detalhes__coluna" aria-labelledby="evento-etapas">
                <h3 id="evento-etapas">Negócios por etapa do funil</h3>
                {funis.map((funil) => (
                  <div className="evento-funil" key={funil}>
                    <h4>{funil}</h4>
                    <ul className="evento-lista" aria-label={`Quantidade de negócios em ${funil}`}>
                      {dados.negociosPorEtapa
                        .filter((item) => item.funil === funil)
                        .map((item) => (
                          <li key={`${funil}-${item.etapa}-${item.ordem}`}>
                            <span>{item.etapa}</span>
                            <strong
                              className="evento-contagem"
                              aria-label={`${numeroInteiroBR.format(item.total)} negócios`}
                            >
                              {numeroBR(item.total, 0)}
                            </strong>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </section>
            </div>
          </div>
        );
      }}
    </Painel>
  );
}
