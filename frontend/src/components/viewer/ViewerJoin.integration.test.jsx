// INT-004 — Room Management → Live Viewing Session
// Host starts a broadcast from a room with User Inputs; a viewer opens the
// session and tries to connect with one input left empty.
// Expected: the entry form shows the room's User Inputs and the viewer is
// not connected until every input is filled.
//
// The presenter → server half of this chain (room saved, Share Screen POSTs to
// /room-config, /room-config echoes user_inputs back) is covered by INT-002 and
// the Rooms.customize.test.jsx unit suite. This test picks up at /room-config
// and drives ViewerJoin, whose onConnect is the boundary the parent (ViewerApp)
// uses to actually fetch /token and room.connect. Asserting onConnect is not
// called = the viewer is not connected.
//
// Written but NOT run.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ViewerJoin from './ViewerJoin.jsx';

function roomConfigResponse(user_inputs) {
  return {
    ok: true,
    json: async () => ({
      user_inputs,
      fields: [],
      room_size: 30,
    }),
  };
}

describe('INT-004 — Room Management → Live Viewing Session', () => {
  let fetchMock;
  let alertSpy;

  beforeEach(() => {
    // State as left by Room Management + Share Screen from INT-002:
    // /room-config holds the room's user_inputs.
    fetchMock = vi.fn(async (url) => {
      if (String(url) === '/room-config') {
        return roomConfigResponse(['Section', 'Student No.']);
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('INT-004: viewer entry form shows the room User Inputs and blocks connection until every input is filled', async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();

    render(<ViewerJoin onConnect={onConnect} />);

    // 1. Form fields render with the labels the host saved in Room Management.
    expect(await screen.findByLabelText('Section')).toBeInTheDocument();
    expect(screen.getByLabelText('Student No.')).toBeInTheDocument();
    // The empty "Name" fallback does NOT render — user inputs override it.
    expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument();

    // 2. Fill one input, leave the other empty, try to connect → blocked.
    await user.type(screen.getByLabelText('Section'), 'BSIT-4C');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(alertSpy).toHaveBeenCalledWith('Please fill in all fields');
    expect(onConnect).not.toHaveBeenCalled();

    // 3. Whitespace-only does not count as filled.
    await user.type(screen.getByLabelText('Student No.'), '   ');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(alertSpy).toHaveBeenLastCalledWith('Please fill in all fields');
    expect(onConnect).not.toHaveBeenCalled();

    // 4. Fill the missing input → connection proceeds.
    await user.clear(screen.getByLabelText('Student No.'));
    await user.type(screen.getByLabelText('Student No.'), '2021-00123');
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(onConnect).toHaveBeenCalledTimes(1);
    // The display name is the values joined with a space, per ViewerJoin.
    expect(onConnect).toHaveBeenCalledWith('BSIT-4C 2021-00123', {
      Section: 'BSIT-4C',
      'Student No.': '2021-00123',
    });
  });

  it('INT-004 (control): with no user inputs the form falls back to the single Name field', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url) === '/room-config' ? roomConfigResponse([]) : { ok: true, json: async () => ({}) }
    );
    const user = userEvent.setup();
    const onConnect = vi.fn();

    render(<ViewerJoin onConnect={onConnect} />);

    const nameField = await screen.findByPlaceholderText('Name');
    expect(screen.queryByLabelText('Section')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(alertSpy).toHaveBeenCalledWith('Please enter your display name');
    expect(onConnect).not.toHaveBeenCalled();

    await user.type(nameField, 'Ana Cruz');
    await user.click(screen.getByRole('button', { name: 'Connect' }));
    expect(onConnect).toHaveBeenCalledWith('Ana Cruz');
  });
});

describe('INT-006 — Room Management → Live Viewing Session (Max Size)', () => {
  // Host saves a room with a set Max Size and viewers join until the limit is
  // reached; one more viewer tries to join. Expected: the extra viewer is not
  // connected and the viewer count does not exceed the Max Size.
  //
  // Nothing in the source enforces this today:
  //   - main.py stores room_config["room_size"] but /token (line 36) does not
  //     compare the current participant count against it before issuing a JWT.
  //   - /participants (line 158) lists whatever LiveKit reports; no count check.
  //   - PresenterApp.startSharing connects a bare `new Room()`; no
  //     max_participants is passed to any LiveKit room-creation call.
  //   - ViewerJoin and ViewerApp have no client-side gate.
  //
  // Turn this into a real test once a server-side gate exists (natural place:
  // /token — reject with 409 / 403 when the participant count already equals
  // room_config["room_size"]). That test would be a server-side pytest in
  // server/tests/test_token_endpoint.py, not a viewer-side unit test.
  it.todo('INT-006: extra viewer is rejected once the Max Size is reached (no enforcement in source)');
});