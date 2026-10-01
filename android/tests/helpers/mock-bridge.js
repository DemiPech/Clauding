// Faux pont Android pour les tests : remplace window.AndroidApp et simule
// Cognito, FaBrary (une liste « Liste test ») et l'API CardNexus sur un
// inventaire en memoire. Les tests le parametrent avant chargement via
// window.__mockInv, __mockLocations, __mockClasses, __mockTalents, __mockExp,
// __mock429 (nombre de 429 a renvoyer), __mockDelay (latence de chaque
// requete, en ms), et l'inspectent via window.__inv.
(() => {
  localStorage.setItem('cardnexus_api_key', 'cnk_test');
  const P = (id, name, nameSlug, fabId, pitch, types, subTypes = []) =>
    ({ id, name, nameSlug, printNumber: 'X' + id, imageUrl: null, expansion: { name: (window.__mockExp || {})[id] || 'HNT' }, attributes: { fabId, pitch, types, subTypes, classes: (window.__mockClasses || {})[id] || ['Generic'], talents: (window.__mockTalents || {})[id] || [], cost: 1, attack: 3, defense: 3 } });
  const products = [
    P('p1', 'Buckwild (Red)', 'buckwild', 'buckwild-1', 1, ['Action'], ['Attack']),
    P('p2', 'Buckwild (Blue)', 'buckwild', 'buckwild-3', 3, ['Action'], ['Attack']),
    P('p3', 'Sink Below (Red)', 'sink-below', 'sink-below-1', 1, ['Defense Reaction']),
    P('p4', 'Dorinthea Ironsong', 'dorinthea-ironsong', 'dorinthea-ironsong', null, ['Hero']),
    P('p5', 'Enlightened Strike (Red)', 'enlightened-strike', 'enlightened-strike-1', 1, ['Action'], ['Attack']),
    P('pk1', 'Pikachu', 'pikachu', null, null, ['Pokemon']),
  ];
  // Une extension a importer : « Heavy Hitters » (id 7), raretes et finitions variees.
  const E = (id, name, slug, pitch, rarity, printNumber, finishes, attrs = {}) => {
    const base = P(id, name, slug, `${slug}-${pitch}`, pitch, ['Action']);
    return {
      ...base,
      attributes: { ...base.attributes, ...attrs },
      expansion: { id: 7, name: 'Heavy Hitters', code: 'HVY' },
      rarity, printNumber, finishes, languages: ['en', 'fr'], imageUrl: null,
    };
  };
  products.push(
    E('e1', 'Pummel (Red)', 'pummel', 1, 'Common', 'HVY001', ['Standard', 'Rainbow Foil']),
    E('e2', 'Pummel (Blue)', 'pummel', 3, 'Common', 'HVY002', ['Standard', 'Rainbow Foil']),
    E('e3', 'Beast Mode (Red)', 'beast-mode', 1, 'Rare', 'HVY003', ['Standard', 'Rainbow Foil']),
    E('e4', 'Ancestral Empowerment (Red)', 'ancestral-empowerment', 1, 'S', 'HVY004', ['Standard', 'Rainbow Foil', 'Cold Foil']),
    E('e5', 'Kayo, Armed and Dangerous', 'kayo', null, 'Majestic', 'HVY005', ['Cold Foil']),
    // CardNexus classe tokens et basiques en « Common » : le type et les attributs les trahissent.
    E('e6', 'Might', 'might', null, 'Common', 'HVY006', ['Standard'], { types: ['Token', 'Aura'] }),
    E('e7', 'Cracked Bauble', 'cracked-bauble', 2, 'Common', 'HVY007', ['Standard'], { rarity: 'Basic', types: ['Resource'] }),
  );
  const expansions = [
    { id: 7, name: 'Heavy Hitters', code: 'HVY', releaseDate: '2023-11-03T00:00:00.000Z', cardCount: 5, languages: ['en', 'fr'] },
    { id: 3, name: 'Welcome to Rathe', code: 'WTR', releaseDate: '2019-10-11T00:00:00.000Z', cardCount: 0, languages: ['en'] },
    { id: 8, name: 'Armory Deck: Kayo', code: 'AKO', releaseDate: '2024-01-01T00:00:00.000Z', cardCount: 40, languages: ['en'] },
    { id: 9, name: 'Kayo Blitz Deck', code: 'KYO', releaseDate: '2023-11-03T00:00:00.000Z', cardCount: 40, languages: ['en'] },
  ];
  const L = (id, productId, quantity, location, extra = {}) =>
    ({ id, productId, quantity, location, finish: 'Standard', condition: 'NM', language: 'en', forSale: false, updatedAt: '2026-09-01', ...extra });
  const inv = window.__mockInv || [
    L('l1', 'p4', 1, 'Deck A'),
    L('l2', 'p1', 2, 'Deck A'),
    L('l3', 'p1', 3, 'Binder'),
    L('l4', 'p5', 2, 'Deck A'),
    L('l5', 'p2', 3, 'Deck A'),
    L('l6', 'p3', 2, 'Binder'),
  ];
  const locations = window.__mockLocations || [{ name: 'Deck A', color: 'red', icon: 'deck' }, { name: 'Binder', color: 'blue', icon: 'box' }];
  window.__inv = inv;
  let seq = 100;

  const card = (name, pitch, types, subtypes = []) => ({ cardIdentifier: name, name, defaultImage: null, pitch, cost: 1, power: 3, defense: 3, types, subtypes, talents: [], classes: [], keywords: [] });
  const fabDeck = {
    deckId: '01ABCDEFGH', name: 'Liste test', format: 'Classic Constructed', notes: null, tags: [], proxyAuthor: 'moi',
    hero: { cardIdentifier: 'dorinthea', name: 'Dorinthea Ironsong', defaultImage: null, intellect: 4, life: 40, types: ['Hero'], classes: [], talents: [] },
    deckCards: [
      { cardIdentifier: 'buckwild-red', quantity: 3, sideboardQuantity: 0, card: card('Buckwild', 1, ['Action'], ['Attack']) },
      { cardIdentifier: 'buckwild-blue', quantity: 2, sideboardQuantity: 0, card: card('Buckwild', 3, ['Action'], ['Attack']) },
      { cardIdentifier: 'sink-below-red', quantity: 2, sideboardQuantity: 0, card: card('Sink Below', 1, ['Defense Reaction']) },
    ],
  };

  function handle(method, url, body) {
    const u = new URL(url);
    if (u.host.startsWith('cognito')) {
      return body.IdentityPoolId ? { IdentityId: 'id' } : { Credentials: { AccessKeyId: 'A', SecretKey: 'S', SessionToken: 'T', Expiration: Date.now() / 1000 + 3600 } };
    }
    if (u.host.includes('appsync')) return { data: { getDeck: fabDeck } };
    const path = u.pathname.replace('/v1', '');
    if (path.startsWith('/inventory/locations/')) {
      const name = decodeURIComponent(path.slice('/inventory/locations/'.length));
      const loc = locations.find((l) => l.name === name);
      if (!loc) throw new Error('404 location');
      if (method === 'PATCH') {
        for (const l of inv) if (l.location === name) l.location = body.name;
        loc.name = body.name;
        return loc;
      }
      if (method === 'DELETE') {
        for (const l of inv) if (l.location === name) l.location = null;
        locations.splice(locations.indexOf(loc), 1);
        return null;
      }
    }
    if (path === '/inventory/locations' && method === 'GET') return locations;
    if (path === '/inventory/locations') { if (!locations.some((l) => l.name === body.name)) locations.push({ name: body.name, color: body.color, icon: body.icon }); return { name: body.name }; }
    if (path === '/games/fab/expansions') return { data: expansions, pagination: { offset: 0, limit: 200, total: expansions.length, hasMore: false } };
    if (path === '/inventory' && method === 'POST') {
      const created = [];
      const errors = [];
      body.lines.forEach((req, index) => {
        const product = products.find((p) => p.id === String(req.productId) || p.id === req.productId);
        if (!product) return errors.push({ index, code: 'PRODUCT_NOT_FOUND' });
        if (product.finishes && !product.finishes.includes(req.finish)) return errors.push({ index, code: 'INVALID_FINISH' });
        if (req.location && !locations.some((l) => l.name === req.location)) return errors.push({ index, code: 'LOCATION_NOT_FOUND' });
        const same = inv.find((l) => l.quantity > 0 && l.productId === product.id && l.finish === req.finish && l.condition === req.condition && l.language === req.language && (l.location ?? null) === (req.location ?? null));
        if (same) {
          same.quantity += req.quantity;
          created.push({ ...same });
        } else {
          const line = { id: 'n' + (seq += 1), productId: product.id, finish: req.finish, condition: req.condition, language: req.language, quantity: req.quantity, location: req.location ?? null, forSale: false, tags: [], updatedAt: '2026-10-01T10:00:00Z' };
          inv.push(line);
          created.push({ ...line });
        }
      });
      window.__addCalls = (window.__addCalls || 0) + 1;
      return { created, errors };
    }
    if (path === '/inventory') {
      const g = u.searchParams.get('game');
      return { data: inv.filter((l) => l.quantity > 0 && (!u.searchParams.has('location') || l.location === u.searchParams.get('location')) && (!g || (l.game || 'fab') === g)), pagination: {} };
    }
    if (path === '/products/search') {
      if (body.expansionId) {
        const all = products.filter((p) => body.expansionId.includes(p.expansion?.id));
        const offset = body.offset || 0, limit = body.limit || 50;
        return { data: all.slice(offset, offset + limit), pagination: { offset, limit, total: all.length, hasMore: offset + limit < all.length } };
      }
      return { data: products.filter((p) => body.productIds.includes(p.id)) };
    }
    if (path === '/inventory/search') {
      window.__searchCalls = (window.__searchCalls || 0) + 1;
      const hit = (p) => (body.nameSlug ? p.nameSlug === body.nameSlug : body.name ? p.name.toLowerCase().includes(body.name.toLowerCase()) : true);
      const where = (l) => !body.location || body.location.values.some((v) => (v === null ? l.location == null : (l.location || '').toLowerCase() === v.toLowerCase()));
      const game = (l) => !body.gameFilters?.game || (l.game || 'fab') === body.gameFilters.game;
      const all = inv.filter((l) => l.quantity > 0 && where(l) && game(l) && (!body.name && !body.nameSlug ? true : hit(products.find((p) => p.id === l.productId) || { name: '', nameSlug: '' })));
      const offset = body.offset || 0, limit = body.limit || 50;
      const data = all.slice(offset, offset + limit);
      return { data, pagination: { offset, limit, total: all.length, hasMore: offset + limit < all.length } };
    }
    if (path.startsWith('/inventory/') && method === 'DELETE' && !path.startsWith('/inventory/locations')) {
      const id = decodeURIComponent(path.slice('/inventory/'.length));
      const line = inv.find((l) => l.id === id && l.quantity > 0);
      if (!line) throw new Error('404 NOT_FOUND');
      line.quantity = 0;
      window.__deleteCalls = (window.__deleteCalls || 0) + 1;
      return { deleted: true };
    }
    if (path === '/inventory/bulk/update') {
      return {
        results: body.items.map((item, index) => {
          const line = inv.find((l) => l.id === item.inventoryId);
          if (!line) return { index, status: 'error', code: 'NOT_FOUND' };
          if (item.tags) { line.tags = item.tags.set; return { index, status: 'ok', inventoryId: line.id }; }
          if (item.quantity) {
            if (line.quantity + item.quantity.adjust <= 0) return { index, status: 'error', code: 'INSUFFICIENT_QUANTITY' };
            line.quantity += item.quantity.adjust;
            return { index, status: 'ok', inventoryId: line.id };
          }
          if (item.count > line.quantity) return { index, status: 'error', code: 'INSUFFICIENT_QUANTITY' };
          if (item.count === line.quantity) { line.location = item.location; return { index, status: 'ok', inventoryId: line.id }; }
          line.quantity -= item.count;
          const split = { ...line, id: 'l' + (seq += 1), quantity: item.count, location: item.location };
          inv.push(split);
          return { index, status: 'ok', inventoryId: split.id };
        }),
      };
    }
    throw new Error('route non simulee ' + method + ' ' + url);
  }

  window.AndroidApp = {
    request(id, method, url, headersJson, hasBody, body) {
      setTimeout(() => {
        if (window.__mock429 > 0) {
          window.__mock429 -= 1;
          window.__androidHttpDone(id, 429, JSON.stringify({ 'retry-after': '1' }), '{"code":"TOO_MANY_REQUESTS"}', '');
          return;
        }
        try {
          const res = handle(method, url, hasBody ? JSON.parse(body) : null);
          window.__androidHttpDone(id, 200, '{}', res === null ? '' : JSON.stringify(res), '');
        } catch (e) {
          window.__androidHttpDone(id, 500, '{}', String(e.message), '');
        }
      }, window.__mockDelay ?? 5);
    },
    copyText: () => true,
    openExternal: () => {},
  };
})();
