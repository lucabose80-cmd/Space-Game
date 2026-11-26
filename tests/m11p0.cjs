// M11 Phase 0 — Import-Pipeline (reines Node-/Python-Testen, der Browser wird nicht gebraucht)
module.exports = async () => {
  const assert = require('node:assert'); const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const root = path.resolve(__dirname, '..'); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'artimport-'));
  const py = (code) => execFileSync('python3', ['-I', '-c', code], { encoding: 'utf8' });
  fs.mkdirSync(path.join(tmp, 'src/rigs'), { recursive: true }); fs.mkdirSync(path.join(tmp, 'src/poses'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'rigs.json'), JSON.stringify({ dummy: { kind: 'x', sheet: { file: 'dummy', cols: 3, rows: 2, order: ['body', 'arm', 'ring', 'leg', '', 'plate'], scaleRef: 'body', torsoDisplayH: 20 }, parts: [] } }));
  // Synthetische Sheets: Zellen 300×300, weißer Hintergrund, farbige Teile (Ring mit weißem Inneren, graues Highlight)
  py(`
from PIL import Image, ImageDraw
W=Image.new('RGB',(900,600),(255,255,255)); d=ImageDraw.Draw(W)
def cell(i): c=i%3; r=i//3; return c*300, r*300
x,y=cell(0); d.rectangle((x+60,y+60,x+240,y+240),fill=(120,60,40),outline=(10,10,10),width=4)      # body 181x181
x,y=cell(1); d.rectangle((x+130,y+30,x+170,y+270),fill=(60,90,140),outline=(10,10,10),width=4)       # arm 41x241
x,y=cell(2); d.ellipse((x+80,y+80,x+220,y+220),fill=(200,160,40),outline=(10,10,10),width=5); d.ellipse((x+120,y+120,x+180,y+180),fill=(255,255,255),outline=(10,10,10),width=4) # ring: weißes Innenloch
x,y=cell(3); d.rectangle((x+100,y+100,x+130,y+200),fill=(40,120,60),outline=(10,10,10),width=3); d.rectangle((x+105,y+105,x+112,y+112),fill=(240,240,240))  # leg + helles Highlight
x,y=cell(5); d.rectangle((x+90,y+90,x+210,y+160),fill=(90,40,120),outline=(10,10,10),width=3)
W.save('${tmp}/src/rigs/dummy_parts.png')
P=Image.new('RGB',(600,600),(255,255,255)); d=ImageDraw.Draw(P)
for i,(c,r) in enumerate([(0,0),(1,0),(0,1),(1,1)]):
    d.ellipse((c*300+50+i*10,r*300+50,c*300+250-i*10,r*300+250),fill=(80,80,200),outline=(5,5,5),width=4)
P.save('${tmp}/src/poses/blobby_poses.png')
`);
  const run = (...a) => execFileSync('python3', [path.join(root, 'scripts/art-import.py'), '--src', path.join(tmp, 'src'), '--out', path.join(tmp, 'out'), '--rigs', path.join(tmp, 'rigs.json'), ...a], { encoding: 'utf8' });
  const o1 = run(); assert.ok(/✔ dummy: 5 Teile/.test(o1), o1); assert.ok(/✔ blobby: 4 Posen/.test(o1), o1);
  const info = JSON.parse(py(`
from PIL import Image; import json
o='${tmp}/out/rigs/dummy/'; r={}
for p in ['body','arm','ring','leg','plate']:
    im=Image.open(o+p+'.png'); px=im.load(); r[p]=[im.width,im.height,px[0,0][3],px[im.width-1,im.height-1][3]]
im=Image.open(o+'ring.png'); r['ringCenter']=im.getpixel((im.width//2, im.height//2))
im=Image.open(o+'leg.png'); r['legAlphaMin']=min(im.getpixel((x,y))[3] for x in range(im.width) for y in range(im.height) if im.getpixel((x,y))[3]>0)
r['meta']=json.load(open(o+'import.json'))
import os; r['files']=sorted(os.listdir(o)); r['poses']=sorted(os.listdir('${tmp}/out/poses'))
print(json.dumps(r))`));
  assert.deepStrictEqual(info.files, ['arm.png', 'body.png', 'import.json', 'leg.png', 'plate.png', 'ring.png']); // Zelle 5 war leer-benannt → übersprungen
  assert.strictEqual(info.body[1], 20, 'Referenzteil = Anzeigehöhe 20 px');
  const sc = info.meta.scale; assert.ok(Math.abs(info.arm[1] - Math.round(241 * sc)) <= 1, 'gemeinsamer Maßstab: arm ' + info.arm[1]);
  assert.strictEqual(info.ring[2], 0, 'Ring: Ecke oben-links transparent (Hintergrund entfernt)'); assert.strictEqual(info.ring[3], 0, 'Ring: Ecke unten-rechts transparent');
  assert.strictEqual(info.ringCenter[3], 255, 'eingeschlossenes Weiß (Loch im Ring) bleibt erhalten');
  assert.strictEqual(info.legAlphaMin, 255, 'kein halbtransparenter Rand');
  assert.deepStrictEqual(info.poses, ['blobby_1.png', 'blobby_2.png', 'blobby_3.png', 'blobby_4.png']);
  // Idempotenz + --force + --keep-cell
  assert.ok(/= dummy: unverändert/.test(run('dummy')), 'Zweiter Lauf überspringt');
  const mtime = fs.statSync(path.join(tmp, 'out/rigs/dummy/arm.png')).mtimeMs;
  run('dummy', '--force', '--keep-cell', '2'); assert.strictEqual(fs.statSync(path.join(tmp, 'out/rigs/dummy/arm.png')).mtimeMs, mtime, '--keep-cell lässt Zelle 2 unangetastet');
  // Echte Pilot-Sheets liegen importiert im Repo
  const rigsJson = JSON.parse(fs.readFileSync(path.join(root, 'src/data/rigs.json'), 'utf8')); // Anzeigehöhe kommt aus den Rig-Daten (nicht hartkodieren)
  for (const [id, parts] of [['krall', ['torso', 'claw', 'legF', 'legB', 'magnet', 'plate']], ['core_warden', ['torso', 'head', 'arm', 'fist', 'plateL', 'plateR']]]) {
    const h = rigsJson[id].sheet.torsoDisplayH * (rigsJson[id].sheet.pixelRatio ?? 1); // Teile liegen in Bildschirmauflösung vor
    for (const p of parts) assert.ok(fs.existsSync(path.join(root, 'public/art/rigs', id, p + '.png')), `${id}/${p}.png fehlt (npm run art:import)`);
    const m = JSON.parse(fs.readFileSync(path.join(root, 'public/art/rigs', id, 'import.json'), 'utf8')); assert.strictEqual(m.parts.torso.h, h);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('M11 PHASE0 OK');
};
