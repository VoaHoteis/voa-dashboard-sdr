import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { META_TIME_TOTAL, METAS_TIME, SDRS, SDRS_ATIVOS } from './config';

describe('metas individuais de SDR', () => {
  it('define metas para as SDRs sem alterar a meta global de 60 reuniões', () => {
    const metasIndividuais = SDRS_ATIVOS.filter((sdr) =>
      ['julianaAguiar', 'wanderson', 'viviane'].includes(sdr.key)
    );

    assert.deepEqual(
      metasIndividuais.map(({ key, metas }) => ({ key, metas })),
      [
        { key: 'julianaAguiar', metas: { novosNegocios: 20, salabim: 10 } },
        { key: 'wanderson', metas: { novosNegocios: 20, salabim: 10 } },
        { key: 'viviane', metas: { novosNegocios: 20, salabim: 10 } },
      ]
    );
    assert.deepEqual(SDRS.map((sdr) => sdr.key), ['juliana', 'barbara']);
    assert.deepEqual(METAS_TIME, { novosNegocios: 40, salabim: 20 });
    assert.equal(META_TIME_TOTAL, 60);
  });
});
