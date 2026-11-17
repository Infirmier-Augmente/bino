import { describe, expect, it } from 'vitest';
import { createTestApp, EXAMPLE_A } from '../testing/test-app';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const body = JSON.stringify({
  unitId: 'rea',
  nurseId: 'martine',
  mode: 'transmission',
  inputMethod: 'keyboard',
  transcript: EXAMPLE_A,
});

describe('visiteuses du site public', () => {
  it('garde la note dans un navigateur et la cache aux autres', async () => {
    const { app } = createTestApp({ sessions: true });
    const created = await app.request('/transmissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bino-session': A },
      body,
    });
    expect(created.status).toBe(200);
    const note = (await created.json()) as { id: string };
    const mine = await app.request(`/transmissions/${note.id}`, {
      headers: { 'x-bino-session': A },
    });
    const other = await app.request(`/transmissions/${note.id}`, {
      headers: { 'x-bino-session': B },
    });
    const shared = await app.request(`/transmissions/${note.id}`);
    expect(mine.status).toBe(200);
    expect(other.status).toBe(404);
    expect(shared.status).toBe(404);
  });
});
