module.exports = async ({ page }) => {
  const r = await page.evaluate(async () => {
    const eng = await import('/src/systems/storyEngine.ts');
    const ch = await import('/src/data/story/storyChapters.ts');
    const { STORY_SCENES: S } = await import('/src/data/story/storyScenes.ts');
    const out = {};
    out.errors = eng.validateStoryScenes(S, { requireComplete: true });
    out.count = [S.length, S.filter((s) => s.npc !== 'event').length];
    // longest path / max choices stats
    let maxBoxes = 0, maxChoices = 0, maxText = 0, totalNodes = 0;
    for (const s of S) {
      totalNodes += Object.keys(s.nodes).length;
      for (const n of Object.values(s.nodes)) { maxText = Math.max(maxText, n.text.length, ...(n.variants ?? []).map((v) => v.text.length)); maxChoices = Math.max(maxChoices, n.choices?.length ?? 0); }
    }
    out.stats = { maxText, maxChoices, totalNodes };
    // enumerate every path (ignoring requires) -> collect max trust per npc per scene
    const maxGain = { kael: 0, lyra: 0, nyx: 0, vex: 0 };
    const setFlags = new Set(), readFlags = new Set();
    const pathBoxes = [];
    for (const s of S) {
      const best = { kael: 0, lyra: 0, nyx: 0, vex: 0 };
      const walk = (nid, gain, boxes) => {
        const node = s.nodes[nid]; if (!node) return;
        for (const v of node.variants ?? []) { if (v.when.flag) readFlags.add(v.when.flag); if (v.when.notFlag) readFlags.add(v.when.notFlag); }
        const targets = [];
        if (node.next) targets.push([node.next, null]);
        for (const c of node.choices ?? []) {
          if (c.requires?.flag) readFlags.add(c.requires.flag);
          for (const f of c.setFlags ?? []) setFlags.add(f);
          targets.push([c.next, c]);
        }
        for (const [t, c] of targets) {
          const g = { ...gain }; for (const [k, d] of Object.entries(c?.trust ?? {})) g[k] += d;
          if (t === 'end') { pathBoxes.push(boxes + 1); for (const k of Object.keys(best)) best[k] = Math.max(best[k], g[k]); }
          else if (t === '@speaker') for (const n of ['kael', 'lyra', 'nyx', 'vex']) walk('speech_' + n, g, boxes + 1);
          else walk(t, g, boxes + 1);
        }
      };
      walk(s.start, { kael: 0, lyra: 0, nyx: 0, vex: 0 }, 0);
      for (const k of Object.keys(maxGain)) maxGain[k] += best[k];
    }
    out.maxGain = maxGain; out.maxPath = Math.max(...pathBoxes);
    out.avgPath = +(pathBoxes.reduce((a, b) => a + b, 0) / pathBoxes.length).toFixed(2);
    const needSet = ch.ALL_STORY_FLAGS.filter((f) => f !== 'festival_seen' && f !== 'nyx_redeemed');
    const needRead = ch.ALL_STORY_FLAGS.filter((f) => f !== 'festival_seen');
    out.notSet = needSet.filter((f) => !setFlags.has(f));
    out.notRead = needRead.filter((f) => !readFlags.has(f));
    // 300 random full playthroughs through the real engine
    let bad = [];
    const rnd = (n) => Math.floor(Math.random() * n);
    for (let run = 0; run < 300; run++) {
      const p = ch.createEmptyStory();
      for (let chapter = 0; chapter <= 6; chapter++) {
        p.chapter = Math.max(p.chapter, chapter);
        const order = ['kael', 'lyra', 'nyx', 'vex'].sort(() => Math.random() - 0.5);
        for (const npc of order) {
          const scene = eng.getPendingScene(p, npc);
          if (!scene) continue;
          eng.prepareScene(p, scene);
          let nid = scene.start, guard = 0;
          while (nid !== 'end' && guard++ < 20) {
            const node = scene.nodes[nid];
            if (!node) { bad.push(`run${run} ${scene.id} missing ${nid}`); break; }
            const text = eng.formatStoryText(eng.resolveNodeText(node, p), 'Luca');
            if (!text || text.includes('{')) bad.push(`text ${scene.id}.${nid}`);
            if (node.choices) {
              const vis = eng.getVisibleChoices(node, p);
              if (vis.length === 0) { bad.push(`no visible choice ${scene.id}.${nid}`); break; }
              const c = vis[rnd(vis.length)];
              eng.applyChoice(p, scene.id, c);
              nid = c.next;
            } else nid = eng.resolveNext(node.next, p);
          }
          p.seenScenes.push(scene.id);
        }
        if (chapter === 5) { // festival
          const fest = S.find((s) => s.id === 'event_festival');
          let nid = fest.start, g = 0;
          while (nid !== 'end' && g++ < 10) { const node = fest.nodes[nid]; if (node.choices) { const vis = eng.getVisibleChoices(node, p); const c = vis[rnd(vis.length)]; eng.applyChoice(p, fest.id, c); nid = c.next; } else nid = eng.resolveNext(node.next, p); }
          p.flags.push('festival_seen');
        }
      }
      for (const k of Object.keys(p.trust)) if (p.trust[k] < 0 || p.trust[k] > 10) bad.push('trust range');
      if (p.seenScenes.length !== 28) bad.push(`run${run} seen ${p.seenScenes.length}`);
      if (p.choiceLog.length > 80) bad.push('log');
    }
    out.randomBad = bad.slice(0, 5);
    // greedy max-trust playthrough: every NPC must reach perk threshold
    const g = ch.createEmptyStory();
    for (let chapter = 0; chapter <= 6; chapter++) {
      g.chapter = chapter;
      for (const npc of ['kael', 'lyra', 'nyx', 'vex']) {
        const scene = eng.getPendingScene(g, npc); if (!scene) continue;
        eng.prepareScene(g, scene);
        let nid = scene.start, guard = 0;
        while (nid !== 'end' && guard++ < 20) {
          const node = scene.nodes[nid];
          if (node.choices) { const vis = eng.getVisibleChoices(node, g); vis.sort((a, b) => (b.trust?.[npc] ?? 0) - (a.trust?.[npc] ?? 0)); eng.applyChoice(g, scene.id, vis[0]); nid = vis[0].next; }
          else nid = eng.resolveNext(node.next, g);
        }
        g.seenScenes.push(scene.id);
      }
    }
    out.greedy = { ...g.trust }; out.perks = ['kael', 'lyra', 'nyx', 'vex'].filter((n) => eng.hasTrustPerk(g, n));
    // nyx_c4 choice c hidden without helion flag
    const nyx4 = S.find((s) => s.id === 'nyx_c4').nodes.n3;
    const base = ch.createEmptyStory();
    out.c4vis = [eng.getVisibleChoices(nyx4, base).length, eng.getVisibleChoices(nyx4, { ...base, flags: ['nyx_helion_known'] }).length];
    // variants
    const k1 = S.find((s) => s.id === 'kael_c1').nodes.n2;
    out.var = [eng.resolveNodeText(k1, base).startsWith('Dieses Zeichen'), eng.resolveNodeText(k1, { ...base, flags: ['knows_juno'] }).startsWith('Das ist Junos Zeichen')];
    // chronicle sentences present + unique per scene
    out.noChron = S.flatMap((s) => Object.values(s.nodes).flatMap((n) => (n.choices ?? []).filter((c) => !c.chronicle).map(() => s.id)));
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const ok = r.errors.length === 0 && r.count[0] === 29 && r.count[1] === 28 && r.stats.maxText <= 180 && r.stats.maxChoices <= 3 && r.maxPath <= 8 &&
    r.maxGain.kael + 2 >= 7 && r.maxGain.lyra + 2 >= 7 && r.maxGain.nyx + 2 >= 7 && r.maxGain.vex + 2 >= 7 &&
    r.notSet.length === 0 && r.notRead.length === 0 && r.randomBad.length === 0 &&
    r.perks.length === 4 && r.c4vis.join() === '2,3' && r.var.every(Boolean) && r.noChron.length === 0;
  if (!ok) throw new Error('M10 Phase 1 assert failed');
  console.log('M10 PHASE1 OK');
};
