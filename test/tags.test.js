'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, card, board } = require('./helpers');

test('etiquetas', async (t) => {
  const app = await startServer();
  t.after(app.close);
  const me = await app.owner();
  const anonymous = app.client();

  const tags = {
    pago: { id: 'g-pago', name: 'Pago', single: true, pop: true, boardIds: [], tags: [{ id: 't-pagado', name: 'Pagado', color: '#6fd08c' }, { id: 't-pendiente', name: 'Pendiente', color: '#fbbf24' }] },
    tipo: { id: 'g-tipo', name: 'Tipo', single: false, pop: false, boardIds: [], tags: [{ id: 't-ych', name: 'YCH', color: '#f472b6' }, { id: 't-doodle', name: 'Doodle', color: '#38bdf8' }] },
  };
  const save = (groups, cards, extra = {}) => me('PUT', '/api/workspace', { boards: [board({ cards, ...extra })], groups, notices: [] });

  await t.test('se guardan grupos y etiquetas con su color', async () => {
    const res = await save([tags.pago, tags.tipo], [card({ id: 'k1', tagIds: ['t-pagado', 't-ych'] })]);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.groups.map((g) => g.name), ['Pago', 'Tipo']);
    assert.deepEqual(res.json.boards[0].cards[0].tagIds, ['t-pagado', 't-ych']);
  });

  await t.test('colores no válidos, etiquetas sin nombre y etiquetas que no existen se limpian', async () => {
    const dirty = { ...tags.tipo, tags: [{ id: 'a', name: 'Con color malo', color: 'rojo' }, { id: 'b', name: '   ', color: '#ffffff' }] };
    const res = await save([dirty], [card({ tagIds: ['a', 'b', 'no-existe'] })]);
    assert.equal(res.json.groups[0].tags.length, 1);
    assert.equal(res.json.groups[0].tags[0].color, '#9aa0b4');
    assert.deepEqual(res.json.boards[0].cards[0].tagIds, ['a']);
  });

  await t.test('un grupo "una sola por ficha" deja solo una', async () => {
    const res = await save([tags.pago], [card({ tagIds: ['t-pagado', 't-pendiente'] })]);
    assert.deepEqual(res.json.boards[0].cards[0].tagIds, ['t-pagado']);
  });

  await t.test('un grupo asignado a otro tablero no vale aquí', async () => {
    const other = { ...tags.tipo, boardIds: ['otro-tablero'] }; // ese tablero no existe: el grupo vuelve a valer para todos
    assert.deepEqual((await save([other], [card({ tagIds: ['t-ych'] })])).json.groups[0].boardIds, []);

    const twoBoards = await me('PUT', '/api/workspace', {
      boards: [board({ id: 'b1', slug: 'arte', cards: [card({ id: 'k1', tagIds: ['t-ych'] })] }), board({ id: 'b2', slug: 'codigo', cards: [card({ id: 'k2', tagIds: ['t-ych'] })] })],
      groups: [{ ...tags.tipo, boardIds: ['b1'] }],
      notices: [],
    });
    assert.deepEqual(twoBoards.json.boards.map((b) => b.cards[0].tagIds), [['t-ych'], []]);
  });

  await t.test('en lo público: etiquetas de fichas privadas solo si el grupo es "visible en privadas"', async () => {
    const open = card({ id: 'a', title: 'Abierta', tagIds: ['t-pagado', 't-ych'] });
    const closed = card({ id: 'b', title: 'Cerrada', vis: 'private', tagIds: ['t-pendiente', 't-doodle'] });
    await save([tags.pago, tags.tipo], [open, closed]);

    const pub = (await anonymous('GET', '/api/public/arte')).json.board;
    assert.deepEqual(pub.cards.find((k) => k.id === 'a').tagIds, ['t-pagado', 't-ych']);
    assert.deepEqual(pub.cards.find((k) => k.id === 'b').tagIds, ['t-pendiente']); // Pago es "pop"; Tipo no
    const sent = pub.groups.flatMap((g) => g.tags.map((x) => x.id)).sort();
    assert.deepEqual(sent, ['t-pagado', 't-pendiente', 't-ych']); // "Doodle" no la usa ninguna ficha visible: no se envía
    assert.ok(!JSON.stringify(pub).includes('Doodle'));
  });

  await t.test('las etiquetas de fichas ocultas no se envían', async () => {
    const hidden = card({ id: 'h', vis: 'hidden', tagIds: ['t-doodle'] });
    await save([tags.tipo], [hidden]);
    const pub = (await anonymous('GET', '/api/public/arte')).json.board;
    assert.deepEqual(pub.groups, []);
  });

  await t.test('borrar un tablero quita su referencia en los grupos', async () => {
    const res = await me('PUT', '/api/workspace', { boards: [], groups: [{ ...tags.tipo, boardIds: ['b1'] }], notices: [] });
    assert.deepEqual(res.json.groups[0].boardIds, []);
  });
});
