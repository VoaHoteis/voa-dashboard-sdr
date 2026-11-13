import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resumirAtividadesDoEvento,
  resumirNegociosDoEvento,
  resumirNegociosPerdidosDoEvento,
  type Atividade,
  type EtapaPipeline,
  type Negocio,
} from './pipedrive';

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

  it('resume hotéis perdidos por SDR proprietária e motivo', () => {
    const negocios = [
      {
        id: 1,
        title: 'Hotel A',
        pipeline_id: 6,
        stage_id: 34,
        status: 'lost',
        undone_activities_count: 0,
        next_activity_date: null,
        user_id: { id: 27038398, name: 'Juliana' },
        lost_reason: { label: 'Sem orçamento' },
      },
      {
        id: 2,
        title: 'Hotel B',
        pipeline_id: 6,
        stage_id: 35,
        status: 'lost',
        undone_activities_count: 0,
        next_activity_date: null,
        user_id: { id: 27038398, name: 'Juliana' },
      },
      {
        id: 3,
        title: 'Hotel C',
        pipeline_id: 10,
        stage_id: 101,
        status: 'lost',
        undone_activities_count: 0,
        next_activity_date: null,
        user_id: { id: 27867501, name: 'Bárbara Almeida' },
        lost_reason: 'Escolheu concorrente',
      },
      {
        id: 4,
        title: 'Hotel D',
        pipeline_id: 10,
        stage_id: 102,
        status: 'lost',
        undone_activities_count: 0,
        next_activity_date: null,
        user_id: { id: 12029818, name: 'Bruno Dias' },
        lost_reason: null,
      },
    ] satisfies Negocio[];

    const resumo = resumirNegociosPerdidosDoEvento(negocios);

    assert.equal(resumo.total, 4);
    assert.deepEqual(
      resumo.porSdr.filter(({ total }) => total > 0),
      [
        { nome: 'Juliana', total: 2 },
        { nome: 'Bárbara Almeida', total: 1 },
        { nome: 'Outros responsáveis', total: 1 },
      ]
    );
    assert.deepEqual(resumo.porMotivo, [
      { motivo: 'Sem motivo informado', total: 2 },
      { motivo: 'Escolheu concorrente', total: 1 },
      { motivo: 'Sem orçamento', total: 1 },
    ]);
  });

  it('conta atividades concluídas ligadas a negócios do evento por hoje, semana e mês', () => {
    const criarAtividade = (
      id: number,
      data: string,
      negocioId: number,
      userId: number | null = 12029818,
      done = true
    ): Atividade => ({
      id,
      type: 'call',
      subject: 'Ligação',
      done,
      due_date: data,
      marked_as_done_time: done ? `${data} 15:00:00` : null,
      deal_id: negocioId,
      user_id: userId,
    });
    const atividades = [
      criarAtividade(1, '2026-11-10', 1),
      criarAtividade(2, '2026-11-09', 2),
      criarAtividade(3, '2026-11-08', 1),
      criarAtividade(4, '2026-10-31', 1),
      criarAtividade(5, '2026-11-10', 3),
      criarAtividade(6, '2026-11-10', 1, 12029818, false),
    ];

    const resumo = resumirAtividadesDoEvento(atividades, new Set([1, 2]), '2026-11-10');
    const bruno = resumo.find((pessoa) => pessoa.pessoa === 'Bruno Dias');

    assert.deepEqual(bruno, { pessoa: 'Bruno Dias', hoje: 1, semana: 2, mes: 3 });
  });
});
