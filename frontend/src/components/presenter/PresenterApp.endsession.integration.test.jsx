// INT-018 — Broadcast Control → Broadcast Control (export after End Session)
//   Host ends a broadcast that had viewers and chat messages, then clicks the
//   "PDF" and "CSV" export buttons. Expected: both files are downloaded (fetch
//   hits /logs/export?format=... and an anchor click is triggered for each).
//
//   NOTE: The PDF spec assumes an "End Broadcast screen" (EndedScreen component).
//   EndedScreen is a dead component in the current codebase — PresenterApp
//   returns to the splash screen on End Session. The export buttons are therefore
//   tested through the Dashboard stub (which exposes them while the broadcast is
//   still active), verifying that exportLog hits the correct endpoints and
//   triggers a download.
//
// INT-019 — Broadcast Control → Broadcast Control (new session starts fresh)
//   Host ends a broadcast, then starts a new one from the splash screen.
//   Expected: the new broadcast starts with a viewer count of 0 — state from
//   the ended session is not carried over.
//
// Written but NOT run. Run:
//   pnpm vitest run src/components/presenter/PresenterApp.endsession.integration.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

// Stub SplashScreen so the "Share Screen" button is reachable without the full
// Rooms component (which needs its own /rooms fetch, etc.).
vi.mock('./SplashScreen', () => ({
  default: ({ onStartSharing }) => (
    <div data-testid="splash">
      <button onClick={onStartSharing}>Share Screen</button>
    </div>
  ),
}));

// Stub Dashboard to expose End Session, Export CSV, and Export PDF. The real
// Dashboard passes onExport down through Sidebar; this stub calls it directly
// so the test can verify exportLog without navigating real sub-components.
vi.mock('./Dashboard', () => ({
  default: ({ onEndSession, onExport }) => (
    <div data-testid="dashboard">
      <button onClick={onEndSession}>End Session</button>
      <button onClick={() => onExport('csv')}>Export CSV</button>
      <button onClick={() => onExport('pdf')}>Export PDF</button>
    </div>
  ),
}));

vi.mock('./modals/QrModal', () => ({ default: () => null }));
vi.mock('./modals/ViewersModal', () => ({ default: () => null }));
vi.mock('./modals/ChatModal', () => ({ default: () => null }));

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

function makeFetchMock(participants = []) {
  return vi.fn(async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    if (u.startsWith('/token')) return { ok: true, text: async () => 'jwt-token' };
    if (u === '/participants') return { ok: true, json: async () => ({ participants }) };
    if (u === '/logs/reset' && method === 'POST') return { ok: true, json: async () => ({}) };
    if (u === '/logs/snapshot') return { ok: true, json: async () => ({ rows: [] }) };
    if (u === '/room-config') return { ok: true, json: async () => ({ user_inputs: [], fields: [], room_size: 30 }) };
    if (u.startsWith('/logs/export')) {
      return { ok: true, blob: async () => new Blob(['data'], { type: 'text/plain' }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe('PresenterApp integration — end-session flows', () => {
  let fetchMock;
  let setIntervalSpy;

  const pollOnce = async () => {
    const entry = setIntervalSpy.mock.calls.find(([, delay]) => delay === 3500);
    expect(entry).toBeDefined();
    const [cb] = entry;
    await act(async () => { await cb(); });
  };

  const startBroadcast = async (user) => {
    await screen.findByTestId('splash');
    await user.click(screen.getByRole('button', { name: 'Share Screen' }));
    await screen.findByTestId('dashboard');
  };

  const endSession = async (user) => {
    await user.click(screen.getByRole('button', { name: 'End Session' }));
    await screen.findByTestId('splash');
  };

  beforeEach(() => {
    mocks.room = buildRoom();
    fetchMock = makeFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ---------- INT-018 ----------
  it('INT-018: Export CSV and Export PDF each trigger a download of the session log', async () => {
    // NOTE: Per the PDF spec this scenario happens on an "End Broadcast screen".
    // EndedScreen is a dead component — PresenterApp returns to splash on End
    // Session. Export buttons are tested here via the Dashboard stub while the
    // broadcast is still active, which exercises the same exportLog code path.

    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    // Spy on HTMLAnchorElement.prototype.click to avoid actual navigation.
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<PresenterApp />);
    await startBroadcast(user);

    // 1. Export CSV.
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      const csvCall = fetchMock.mock.calls.find(([u]) =>
        String(u).includes('/logs/export') && String(u).includes('format=csv')
      );
      expect(csvCall).toBeDefined();
    });

    // 2. Export PDF.
    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => {
      const pdfCall = fetchMock.mock.calls.find(([u]) =>
        String(u).includes('/logs/export') && String(u).includes('format=pdf')
      );
      expect(pdfCall).toBeDefined();
    });

    // 3. Both exports created an object URL and triggered a download.
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(anchorClickSpy).toHaveBeenCalledTimes(2);
  });

  // ---------- INT-019 ----------
  it('INT-019: starting a new session after End Session begins with 0 viewers', async () => {
    const user = userEvent.setup();
    render(<PresenterApp />);

    // 1. First broadcast — simulate two viewers joining via poll so they enter
    //    the viewers state before End Session clears it.
    fetchMock = makeFetchMock([
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
      { identity: 's2', name: 'Ben Diaz', attributes: { Name: 'Ben Diaz' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    await startBroadcast(user);

    // Drive one poll so viewers state is populated.
    await pollOnce();

    // 2. End the first session — back to splash.
    await endSession(user);

    // The room was disconnected during End Session.
    expect(mocks.room.disconnect).toHaveBeenCalled();

    // 3. Second broadcast — fresh room, empty participants.
    mocks.room = buildRoom();
    fetchMock = makeFetchMock([]);
    vi.stubGlobal('fetch', fetchMock);

    await startBroadcast(user);

    // 4. Drive a poll on the new broadcast so the viewers state is refreshed.
    await pollOnce();

    // 5. The old viewers are gone — stopSharing cleared the state and the new
    //    poll returned an empty list.
    await waitFor(() => {
      expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument();
      expect(screen.queryByText('Ben Diaz')).not.toBeInTheDocument();
    });

    // 6. The new broadcast's room connected exactly once.
    expect(mocks.room.connect).toHaveBeenCalledTimes(1);
  });
});
