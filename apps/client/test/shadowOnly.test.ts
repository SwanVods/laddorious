import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { addStandIns, standInsInShadowsOnly } from '../src/assets/shadowOnly';

// The models' Shadow stand-ins draw only into the shadow map (2026-10-15): the main pass builds its draw list
// before the shadow pass runs, so a stand-in hidden then and shown for the shadow pass costs no main-pass call.

describe('shadow-only stand-ins', () => {
  it('shows the stand-ins for the shadow pass alone, and lets go when undone', () => {
    const seen: boolean[] = [];
    const standIn = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    standIn.visible = false;
    const renderer = { shadowMap: { render: () => void seen.push(standIn.visible) } };
    const undo = standInsInShadowsOnly(renderer);
    const remove = addStandIns([standIn]);
    renderer.shadowMap.render();
    expect(seen).toEqual([true]);
    expect(standIn.visible).toBe(false);
    remove();
    renderer.shadowMap.render();
    expect(seen).toEqual([true, false]);
    undo();
    addStandIns([standIn]);
    renderer.shadowMap.render();
    expect(seen).toEqual([true, false, false]);
  });
});
