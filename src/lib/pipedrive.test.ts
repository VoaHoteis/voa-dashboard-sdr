import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buscarAtividades,
  limparCache,
  resolverTiposAgendamento,
  resolverTiposAgendamentoPorNomes,
  resolverTiposEsforco,
} from './pipedrive';

const originalFetch = globalThis.fetch;
const originalToken = process.env.PIPEDRIVE_API_TOKEN;
const originalBaseUrl = process.env.PIPEDRIVE_BASE_URL;
const originalMock = process.env.PIPEDRIVE_MOCK;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.PIPEDRIVE_API_TOKEN;
  else process.env.PIPEDRIVE_API_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.PIPEDRIVE_BASE_URL;
  else process.env.PIPEDRIVE_BASE_URL = originalBaseUrl;
  if (originalMock === undefined) delete process.env.PIPEDRIVE_MOCK;
  else process.env.PIPEDRIVE_MOCK = originalMock;
  limparCache();
});

describe('filtro de atividades', () => {
  it('retorna apenas os tipos de agendamento solicitados, mesmo se a API incluir outros', async () => {
    process.env.PIPEDRIVE_API_TOKEN = 'test-token';
    process.env.PIPEDRIVE_BASE_URL = 'https://example.test/api';
    process.env.PIPEDRIVE_MOCK = '0';
    const requisicoes: URL[] = [];
    globalThis.fetch = async (input) => {
      requisicoes.push(new URL(String(input)));
      return new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              type: 'meeting',
              subject: 'Apresentação',
              done: false,
              due_date: '2026-11-30',
              marked_as_done_time: null,
              deal_id: 101,
              user_id: 2,
            },
            {
              id: 2,
              type: 'call',
              subject: 'Ligação de prospecção',
              done: false,
              due_date: '2026-11-30',
              marked_as_done_time: null,
              deal_id: 101,
              user_id: 2,
            },
          ],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    const atividades = await buscarAtividades({
      inicio: '2026-11-30',
      fim: '2026-12-04',
      tipos: ['meeting'],
      concluidas: false,
    });

    assert.deepEqual(atividades.map((atividade) => atividade.id), [1]);
    assert.equal(requisicoes.length, 1);
    assert.equal(requisicoes[0].searchParams.get('type'), 'meeting');
  });
});

describe('resolver tipos de esforço do Pipedrive', () => {
  it('usa o key_string retornado pelo Pipedrive para tipos personalizados', async () => {
    process.env.PIPEDRIVE_API_TOKEN = 'test-token';
    process.env.PIPEDRIVE_BASE_URL = 'https://example.test/api';
    process.env.PIPEDRIVE_MOCK = '0';
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { key_string: 'custom_call_55', name: 'Prospecção Automática #55' },
            { key_string: 'custom_whatsapp_call', name: 'Ligação / Prospecção via Whatsapp' },
          ],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );

    const resolvidos = await resolverTiposEsforco([
      {
        key: 'ligacao_de_prospeccao_automatica_55',
        nomePipedrive: 'Ligação de Prospecção Automatica 55',
        tokensPipedrive: ['prospeccao', 'automatica', '55'],
      },
      {
        key: 'ligacao_de_prospeccao_whatsapp',
        nomePipedrive: 'Ligação de Prospecção WhatsApp',
        tokensPipedrive: ['prospeccao', 'whatsapp'],
      },
      { key: 'whatsapp' },
    ]);

    assert.deepEqual(resolvidos, {
      ligacao_de_prospeccao_automatica_55: 'custom_call_55',
      ligacao_de_prospeccao_whatsapp: 'custom_whatsapp_call',
      whatsapp: 'whatsapp',
    });
  });

  it('informa quais atividades não estão cadastradas no Pipedrive', async () => {
    process.env.PIPEDRIVE_API_TOKEN = 'test-token';
    process.env.PIPEDRIVE_BASE_URL = 'https://example.test/api';
    process.env.PIPEDRIVE_MOCK = '0';
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );

    await assert.rejects(
      resolverTiposEsforco([
        {
          key: 'ligacao_de_prospeccao_whatsapp',
          nomePipedrive: 'Ligação de Prospecção WhatsApp',
          tokensPipedrive: ['prospeccao', 'whatsapp'],
        },
      ]),
      /Tipos de atividade não encontrados ou ambíguos no Pipedrive: "Ligação de Prospecção WhatsApp"/
    );
  });

  it('não escolhe arbitrariamente entre tipos personalizados com nomes parecidos', async () => {
    process.env.PIPEDRIVE_API_TOKEN = 'test-token';
    process.env.PIPEDRIVE_BASE_URL = 'https://example.test/api';
    process.env.PIPEDRIVE_MOCK = '0';
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { key_string: 'whatsapp_call', name: 'Ligação / Prospecção via WhatsApp' },
            { key_string: 'whatsapp_followup', name: 'Prospecção WhatsApp follow-up' },
          ],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );

    await assert.rejects(
      resolverTiposEsforco([
        {
          key: 'ligacao_de_prospeccao_whatsapp',
          nomePipedrive: 'Ligação de Prospecção WhatsApp',
          tokensPipedrive: ['prospeccao', 'whatsapp'],
        },
      ]),
      /ambíguo: Ligação \/ Prospecção via WhatsApp, Prospecção WhatsApp follow-up/
    );
  });

  it('inclui todas as variantes de acentuação do mesmo tipo de agendamento', async () => {
    process.env.PIPEDRIVE_API_TOKEN = 'test-token';
    process.env.PIPEDRIVE_BASE_URL = 'https://example.test/api';
    process.env.PIPEDRIVE_MOCK = '0';
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { key_string: 'reuniao_gc', name: 'Reunião de Apresentação Prospecção Executivo' },
            { key_string: 'apresentacao_original', name: 'Reunião de Apresentação' },
            { key_string: 'apresentacao_variante_1', name: 'Reunião de Apresentacão' },
            { key_string: 'apresentacao_variante_2', name: 'Reunião de Apresentacão' },
          ],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );

    const tipos = await resolverTiposAgendamentoPorNomes([
      {
        key: 'reuniao_de_apresentacao_gc',
        nomePipedrive: 'Reunião de Apresentação Prospecção Executivo',
      },
      { key: 'apresentacao_institucional', nomePipedrive: 'Reunião de Apresentação' },
    ]);

    assert.deepEqual(tipos, [
      'reuniao_gc',
      'apresentacao_original',
      'apresentacao_variante_1',
      'apresentacao_variante_2',
    ]);
  });
});
