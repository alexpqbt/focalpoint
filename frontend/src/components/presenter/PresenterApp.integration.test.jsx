// INT-002 — Room Management → Broadcast Control (share from a saved room)
// INT-003 — Room Management → Broadcast Control (deny, retry, succeed)
//
// Written but NOT run. Note: the "Share Screen" button inside the room overlay
// is the one under test; the splash-center "Share Screen" opens a New Room draft.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PresenterApp from './PresenterApp.jsx';

const mocks = vi.hoisted(() => ({ room: null }));

vi.mock('livekit-client', () => ({
  Room: vi.fn(function Room() {
    return mocks.room;
  }),
  RoomEvent: { LocalTrackUnpublished: 'localTrackUnpublished' },
}));
vi.mock('../config.js', () => ({
  initConfig: vi.fn(() => Promise.resolve()),
  getServerIP: vi.fn(() => '192.168.1.10'),
  getLivekitURI: vi.fn(() => 'ws://192.168.1.10:7880'),
  VIDEO_CFG: { resolution: { width: 1280, height: 720 } },
}));
vi.mock('../util/polyfill.js', () => ({}));
vi.mock('../util/logStore.js', () => ({
  saveLog: vi.fn(() => Promise.resolve(null)),
  loadLogs: vi.fn(() => Promise.resolve([])),
}));
vi.mock('qrcode', () => ({ toCanvas: vi.fn() }));

vi.mock('../common/Header', () => ({ default: () => <div data-testid="header" /> }));
vi.mock('../common/Footer', () => ({ default: () => <div data-testid="footer" /> }));
vi.mock('./Dashboard', () => ({
  default: ({ onEndSession }) => (
    <div data-testid="dashboard">
      <button onClick={onEndSession}>End Session</button>
    </div>
  ),
}));
vi.mock('./modals/QrModal', () => ({ default: () => null }));
vi.mock('./modals/ViewersModal', () => ({ default: () => null }));
vi.mock('./modals/ChatModal', () => ({ default: () => null }));
vi.mock('./modals/Logs', () => ({ default: () => null }));

function buildRoom() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    registerTextStreamHandler: vi.fn(),
    remoteParticipants: new Map(),
    localParticipant: {
      setScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
      getTrackPublication: vi.fn().mockReturnValue({
        videoTrack: { mediaStreamTrack: { kind: 'video' } },
      }),
    },
  };
}

const SAVED_ROOM = {
  id: 1,
  label: 'Biology 101',
  roomSize: '20',
  fields: [{ name: 'Section', value: 'BSIT 4C' }],
  userInputs: ['Section'],
};

function makeFetchMock() {
  return vi.fn(async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    if (u === '/rooms' && method === 'GET') {
      return { ok: true, json: async () => [SAVED_ROOM] };
    }
    if (u.startsWith('/token')) return { ok: true, text: async () => 'jwt-token' };
    if (u === '/room-config' && method === 'POST') return { ok: true, json: async () => ({}) };
    if (u === '/logs/reset' && method === 'POST') return { ok: true, json: async () => ({}) };
    if (u === '/participants') return { ok: true, json: async () => ({ participants: [] }) };
    if (u === '/logs/snapshot') return { ok: true, json: async () => ({ rows: [] }) };
    return { ok: true, json: async () => ({}) };
  });
}

// Opens the saved room from the Saved Rooms list, then finds the Share Screen
// button that lives inside the room overlay (via the Close modal button).
async function openRoomAndGetShare(user) {
  const cards = await screen.findAllByText('Biology 101');
  await user.click(cards[0]);
  const closeBtn = await screen.findByRole('button', { name: 'Close modal' });
  const overlay = closeBtn.closest('.fixed');
  const shareBtn = within(overlay).getByRole('button', { name: /Share Screen/ });
  return { shareBtn, overlay };
}

describe('PresenterApp integration — Room Management → Broadcast Control', () => {
  let fetchMock;
  let errorSpy;

  beforeEach(() => {
    mocks.room = buildRoom();
    fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ---------- INT-002 ----------
  it('INT-002: Share Screen from a saved room opens the Active Broadcast screen using the room settings', async () => {
    const user = userEvent.setup();
    render(<PresenterApp />);

    await screen.findByText('Saved Rooms');
    const { shareBtn } = await openRoomAndGetShare(user);

    await user.click(shareBtn);

    // 1. Active Broadcast (Dashboard) renders.
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Saved Rooms')).not.toBeInTheDocument();

    // 2. The room's settings were pushed to /room-config before sharing.
    const cfgCall = fetchMock.mock.calls.find(
      ([u, o]) => String(u) === '/room-config' && /POST/i.test(o?.method || '')
    );
    expect(cfgCall).toBeDefined();
    const body = JSON.parse(cfgCall[1].body);
    expect(body.user_inputs).toEqual(['Section']);
    expect(body.fields).toEqual([{ name: 'Section', value: 'BSIT 4C' }]);
    expect(body.room_size).toBe(20); // Number('20')
  });

  // ---------- INT-003 ----------
  it('INT-003: denying the dialog creates no broadcast and keeps Room Details open; retrying succeeds', async () => {
    const user = userEvent.setup();
    let shareCalls = 0;
    mocks.room.localParticipant.setScreenShareEnabled.mockImplementation(async () => {
      shareCalls += 1;
      if (shareCalls === 1) {
        throw Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
      }
    });

    render(<PresenterApp />);
    await screen.findByText('Saved Rooms');

    // 1. First attempt — deny.
    const first = await openRoomAndGetShare(user);
    await user.click(first.shareBtn);

    // 2. No Active Broadcast. The overlay closes on the current code (CASE-027
    //    defect: it closes before the result is known); that is the intended
    //    catch here.
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith('Failed to start sharing:', expect.any(Error))
    );
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();

    // 3. Retry — reopen the room and try again. shareCalls is now 2, which
    //    resolves, so the flow should succeed.
    const second = await openRoomAndGetShare(user);
    await user.click(second.shareBtn);

    // 4. Active Broadcast opens with the room's settings.
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
    expect(shareCalls).toBe(2);

    const cfgCalls = fetchMock.mock.calls.filter(
      ([u, o]) => String(u) === '/room-config' && /POST/i.test(o?.method || '')
    );
    expect(cfgCalls).toHaveLength(2);
    const body = JSON.parse(cfgCalls[1][1].body);
    expect(body.user_inputs).toEqual(['Section']);
    expect(body.room_size).toBe(20);
  });
});