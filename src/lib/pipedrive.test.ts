import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { limparCache, resolverTiposEsforco } from './pipedrive';

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
});
