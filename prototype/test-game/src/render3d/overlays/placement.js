/**
 * src/render3d/overlays/placement.js — the placement ghost (plan v2.2 §6.9) [MM-task_mv9s9lvj_1].
 *
 * A translucent block over the hovered cell at structure height with an outline: green when the sim's
 * validatePlacement accepts it, red when it refuses. It never decides validity itself — input.js already
 * keeps ui.hoverValid from validatePlacement every frame (main.js refreshHover), and a refused tap shows the
 * sim's reason. Drawn last, no depth write, so it reads over units and terrain.
 *
 * THREE is passed in (no import) — see index.js.
 */
import { cellToWorld } from '../camera.js';

const OK = 0x5dff8f, BAD = 0xff4040;

export function createPlacementGhost(THREE, scene) {
  // Same block as a placeholder structure (markers.js): 0.86 wide, 1 cell tall, standing on the ground.
  const geo = new THREE.BoxGeometry(0.86, 1, 0.86);
  geo.translate(0, 0.5, 0);
  const fillMat = new THREE.MeshBasicMaterial({ color: OK, transparent: true, opacity: 0.5, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: OK, transparent: true, opacity: 0.95, depthTest: false });
  const fill = new THREE.Mesh(geo, fillMat);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
  const group = new THREE.Group();
  group.add(fill, edges);
  group.renderOrder = 10;
  fill.renderOrder = 10;
  edges.renderOrder = 11;
  group.visible = false;
  scene.add(group);

  return {
    /** Show the ghost for the armed build tool at ui.hoverCell; hide it otherwise. */
    sync(ui) {
      const cell = ui && ui.buildSelection && ui.hoverCell;
      group.visible = !!cell;
      if (!cell) return false;
      group.position.set(cellToWorld(cell.x), 0, cellToWorld(cell.y));
      const c = ui.hoverValid ? OK : BAD;
      fillMat.color.setHex(c);
      edgeMat.color.setHex(c);
      return true;
    },
    dispose() {
      scene.remove(group);
      geo.dispose(); edges.geometry.dispose(); fillMat.dispose(); edgeMat.dispose();
    },
  };
}
