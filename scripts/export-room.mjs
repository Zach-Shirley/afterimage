// Writes docs/room.svg: the room exactly as `?seed=11&round=12` shows it at the start of play.
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { makeRng } = await server.ssrLoadModule('/src/rng.ts');
  const { generateScene } = await server.ssrLoadModule('/src/room.ts');
  const { difficulty } = await server.ssrLoadModule('/src/scoring.ts');
  const { ambienceFor, renderItems, renderLighting, renderRoom } = await server.ssrLoadModule('/src/render.ts');
  const round = 12;
  const game = makeRng(11);
  const rng = makeRng(Math.floor(game.next() * 2 ** 31));
  const diff = difficulty(round);
  const scene = generateScene(rng, diff.itemCount, diff.closedSurfaces);
  const amb = ambienceFor(round);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800" width="1000" height="800">${renderRoom(amb)}${renderItems(scene)}${renderLighting(amb, scene)}</svg>\n`;
  writeFileSync('docs/room.svg', svg);
  console.log(`docs/room.svg: ${scene.items.length} items, ${svg.length} bytes`);
} finally {
  await server.close();
}
