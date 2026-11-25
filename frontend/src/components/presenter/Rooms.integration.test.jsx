// INT-001 — Room Management ↔ Room Management
// Customize a saved room (size + new field), save, reopen:
// Details show updated Max Size and Fields (read-only);
// Customize opens pre-filled with the updated settings.
//
// Written but NOT run.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Rooms from './Rooms.jsx';

vi.mock('../util/logStore.js', () => ({
  loadLogs: vi.fn(() => Promise.resolve([])),
  saveLog: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('./Logs', () => ({ default: () => null }));

function roomSizeInput() {
  return screen.getByText(/Room size \(Max 50\)/).parentElement.querySelector('input');
}

describe('INT-001 — Room Management: customize → save → reopen', () => {
  let storedRoom;
  let fetchMock;

  beforeEach(() => {
    storedRoom = {
      id: 1,
      label: 'Biology 101',
      roomSize: '20',
      fields: [{ name: 'Section', value: 'BSIT 4C' }],
      userInputs: ['First Name', 'Last Name'],
    };

    fetchMock = vi.fn(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET' && /\/rooms\/?$/.test(String(url))) {
        return { ok: true, json: async () => [storedRoom] };
      }
      if (method === 'PUT' && /\/rooms\/1$/.test(String(url))) {
        const body = JSON.parse(opts.body);
        storedRoom = {
          ...storedRoom,
          roomSize: String(body.room_size),
          fields: body.fields,
          userInputs: body.user_inputs,
        };
        return { ok: true, json: async () => storedRoom };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('INT-001: updated Max Size and Fields persist and are shown on Details and pre-filled Customize', async () => {
    const user = userEvent.setup();
    render(<Rooms onShareScreen={vi.fn()} />);

    // 1. Open the saved room from the Saved Rooms list.
    const initialCards = await screen.findAllByText('Biology 101');
    await user.click(initialCards[0]);

    // 2. Click Customize.
    await user.click(screen.getByRole('button', { name: /^Customize$/ }));

    // 3. Change Max Size 20 → 30.
    const sizeInput = roomSizeInput();
    await user.clear(sizeInput);
    await user.type(sizeInput, '30');

    // 4. Add a field named "Student ID".
    await user.click(screen.getByRole('button', { name: 'Add Field' }));
    const fieldNames = screen.getAllByPlaceholderText('Field Name');
    await user.type(fieldNames[fieldNames.length - 1], 'Student ID');

    // 5. Save.
    await user.click(screen.getByRole('button', { name: 'Save Customization' }));

    // 6. Server received the update with the new size and field.
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([u, o]) => /\/rooms\/1$/.test(String(u)) && /PUT/i.test(o?.method || '')
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body);
      expect(String(body.room_size)).toBe('30');
      expect(body.fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Student ID' })])
      );
    });

    // 7. Details view shows the updated Max Size and Field (read-only).
    expect(await screen.findByText('Max Size:')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText(/Student ID: —/)).toBeInTheDocument();

    // 8. Close the overlay (CASE-021: it currently stays open on the details
    //    view after saving — the X exists either way).
    await user.click(screen.getByRole('button', { name: 'Close modal' }));

    // 9. Reopen from Saved Rooms — the card shows the room label, clicking it
    //    uses the locally-updated rooms state (no extra GET).
    const reopenCards = await screen.findAllByText('Biology 101');
    await user.click(reopenCards[0]);

    // 10. Details reflect the update again.
    expect(await screen.findByText('Max Size:')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText(/Student ID: —/)).toBeInTheDocument();

    // 11. Customize opens pre-filled.
    await user.click(screen.getByRole('button', { name: /^Customize$/ }));
    expect(roomSizeInput()).toHaveValue('30');
    expect(screen.getByDisplayValue('Student ID')).toBeInTheDocument();
  });
});