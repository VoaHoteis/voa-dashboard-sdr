import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resumirNegociosDoEvento, type EtapaPipeline, type Negocio } from './pipedrive';

describe('resumo do Evento Porto Seguro', () => {
  it('inclui negócios do Bruno no funil Salabim e os agrupa pelas etapas', () => {
    const gruposEtapas = [
      {
        funil: 'Novos Negócios',
        pipelineId: 6,
        etapas: [{ id: 61, nome: 'Qualificação', ordem: 1 }],
      },
      {
        funil: 'Salabim',
        pipelineId: 10,
        etapas: [
          { id: 101, nome: 'Proposta', ordem: 1 },
          { id: 102, nome: 'Negociação', ordem: 2 },
        ],
      },
    ] satisfies Array<{ funil: string; pipelineId: number; etapas: EtapaPipeline[] }>;
    const negocios = [
      {
        id: 1,
        title: 'Hotel Serra',
        pipeline_id: 10,
        stage_id: 101,
        status: 'open',
        undone_activities_count: 0,
        next_activity_date: null,
        owner_id: 12029818,
      },
      {
        id: 2,
        title: 'Hotel Mar',
        pipeline_id: 10,
        stage_id: 102,
        status: 'open',
        undone_activities_count: 0,
        next_activity_date: null,
        owner_id: 12029818,
      },
      {
        id: 3,
        title: 'Negócio fora dos funis acompanhados',
        pipeline_id: 99,
        stage_id: 990,
        status: 'open',
        undone_activities_count: 0,
        next_activity_date: null,
        owner_id: 12029818,
      },
    ] satisfies Negocio[];

    const resumo = resumirNegociosDoEvento(negocios, gruposEtapas);

    assert.deepEqual(resumo.negociosPorProprietario, [{ nome: 'Bruno Dias', total: 2 }]);
    assert.equal(
      resumo.negociosPorProprietarioEtapa.find(
        (item) => item.funil === 'Salabim' && item.etapaId === 101
      )?.total,
      1
    );
    assert.equal(
      resumo.negociosPorProprietarioEtapa.find(
        (item) => item.funil === 'Salabim' && item.etapaId === 102
      )?.total,
      1
    );
    assert.equal(
      resumo.negociosPorEtapa.find((item) => item.funil === 'Salabim' && item.etapaId === 102)?.total,
      1
    );
  });
});
