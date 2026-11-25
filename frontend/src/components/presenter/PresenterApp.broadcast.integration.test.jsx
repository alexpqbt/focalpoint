// INT-007 — Broadcast Control → QR Code Preview
// INT-009 — Live Viewing Session → Broadcast Control (count goes up and down)
// INT-010 — Live Viewing Session → Check Viewers (names match count)
// INT-011 — Live Viewing Session → Check Viewers (one viewer leaves)
//
// Real Dashboard, Sidebar, QrModal, and ViewersModal are rendered. SplashScreen
// is stubbed only to make "start a broadcast" reachable from the test — the
// real SplashScreen "Share Screen" opens a New Room draft (INT-002 territory).
// ChatModal is out of scope here.
//
// Written but NOT run. Run:
//   pnpm vitest run src/components/presenter/PresenterApp.broadcast.integration.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PresenterApp from './PresenterApp.jsx';
import { toCanvas } from 'qrcode';

const mocks = vi.hoisted(() => ({ room: null }));

vi.mock('livekit-client', () => ({
  Room: vi.fn(function Room() { return mocks.room; }),
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

vi.mock('./SplashScreen', () => ({
  default: ({ onStartSharing }) => (
    <div data-testid="splash">
      <button onClick={onStartSharing}>Share Screen</button>
    </div>
  ),
}));

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

const VIEWER_URL = 'http://192.168.1.10:8080/view';
// The room's user_inputs label is "Name" so each viewer's identity lands in a
// single "Name" column in ViewersModal (the modal shows attributes[label],
// not viewer.name, when user_inputs are non-empty).
const ROOM_CONFIG = { user_inputs: ['Name'], fields: [], room_size: 30 };

describe('PresenterApp broadcast integration', () => {
  let participants;
  let fetchMock;
  let writeText;
  let setIntervalSpy;
  let clearIntervalSpy;

  const pollOnce = async () => {
    const entry = setIntervalSpy.mock.calls.find(([, delay]) => delay === 3500);
    expect(entry).toBeDefined();
    const [cb] = entry;
    await act(async () => { await cb(); });
  };

  const startBroadcast = async () => {
    const user = userEvent.setup();
    render(<PresenterApp />);
    await screen.findByTestId('splash');
    await user.click(screen.getByRole('button', { name: 'Share Screen' }));
    // Dashboard has rendered once its End Session button is in the tree.
    await screen.findByRole('button', { name: /End Session/ });
    return user;
  };

  beforeEach(() => {
    mocks.room = buildRoom();
    participants = [];

    fetchMock = vi.fn(async (url) => {
      const u = String(url);
      if (u.startsWith('/token')) return { ok: true, text: async () => 'jwt-token' };
      if (u === '/participants') return { ok: true, json: async () => ({ participants }) };
      if (u === '/logs/reset') return { ok: true, json: async () => ({}) };
      if (u === '/room-config') return { ok: true, json: async () => ROOM_CONFIG };
      if (u === '/logs/snapshot') return { ok: true, json: async () => ({ rows: [] }) };
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ---------- INT-007 ----------
  it('INT-007: enlarged QR code and session URL belong to the active broadcast, and Copy copies the same URL', async () => {
    const user = await startBroadcast();

    // userEvent.setup() (inside startBroadcast) replaced navigator.clipboard
    // with its own stub. Re-install ours so QrModal.copyLink hits writeText.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await user.click(await screen.findByText('[QR CODE]'));
    expect(await screen.findByText(VIEWER_URL)).toBeInTheDocument();

    await waitFor(() => expect(toCanvas).toHaveBeenCalled());
    const [canvasArg, urlArg, , callback] = toCanvas.mock.calls[0];
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement);
    expect(urlArg).toBe(VIEWER_URL);
    expect(typeof callback).toBe('function');

    // Now either user.click or fireEvent.click works — the component reads
    // our writeText.
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith(VIEWER_URL);
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  // ---------- INT-009 ----------
  it('INT-009: viewer count increases with joins and decreases when a viewer closes the browser, in real time', async () => {
    await startBroadcast();

    // Initial poll returns [] — count is 0.
    await waitFor(() => expect(screen.getByText('Viewers: 0')).toBeInTheDocument());

    // Two viewers join.
    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
      { identity: 's2', name: 'Ben Diaz', attributes: { Name: 'Ben Diaz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 2')).toBeInTheDocument());

    // One viewer closes the browser.
    participants = [participants[0]];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 1')).toBeInTheDocument());

    // Everyone leaves.
    participants = [];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 0')).toBeInTheDocument());
  });

  // ---------- INT-010 ----------
  it("INT-010: each viewer's name appears in the open Viewer List and the modal count matches the Sidebar count", async () => {
    const user = await startBroadcast();

    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
      { identity: 's2', name: 'Ben Diaz', attributes: { Name: 'Ben Diaz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 2')).toBeInTheDocument());

    // Host opens the Viewer List from the Sidebar count.
    await user.click(screen.getByText('Viewers: 2'));

    // Both viewers are identifiable in the modal by their attributes.
    await waitFor(() => {
      expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Ben Diaz').length).toBeGreaterThanOrEqual(1);
    });

    // "Viewers: 2" appears in both Sidebar and the modal header — two matches.
    const countTexts = screen.getAllByText('Viewers: 2');
    expect(countTexts.length).toBeGreaterThanOrEqual(2);
  });

  // ---------- INT-011 ----------
  it('INT-011: when a viewer stops viewing while the Viewer List is open, they disappear from the list and the count decreases by one', async () => {
    const user = await startBroadcast();

    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
      { identity: 's2', name: 'Ben Diaz', attributes: { Name: 'Ben Diaz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 2')).toBeInTheDocument());

    // Host opens the Viewer List while both viewers are connected.
    await user.click(screen.getByText('Viewers: 2'));
    await waitFor(() => {
      expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Ben Diaz').length).toBeGreaterThanOrEqual(1);
    });

    // One viewer clicks "Stop Viewing" on their side (their own action —
    // viewer-side blank page is covered by the viewer unit tests). The server
    // then reports one fewer participant on the next poll.
    participants = [participants[0]]; // only Ana remains
    await pollOnce();

    // Sidebar and modal header both drop to "Viewers: 1".
    await waitFor(() => {
      const countTexts = screen.getAllByText('Viewers: 1');
      expect(countTexts.length).toBeGreaterThanOrEqual(2);
    });

    // The removed viewer's name is gone from the open list.
    await waitFor(() => {
      expect(screen.queryByText('Ben Diaz')).not.toBeInTheDocument();
    });

    // The remaining viewer is still visible.
    expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);
  });

  // ---------- INT-012 ----------
  it('INT-012: disconnecting one viewer drops the count by one, keeps others connected, and does not interrupt the broadcast', async () => {
    const user = await startBroadcast();

    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
      { identity: 's2', name: 'Ben Diaz', attributes: { Name: 'Ben Diaz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 2')).toBeInTheDocument());

    // Open the Viewer List while both are watching.
    await user.click(screen.getByText('Viewers: 2'));
    await waitFor(() => {
      expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Ben Diaz').length).toBeGreaterThanOrEqual(1);
    });

    // Simulate the server-side removal so the next GET /participants returns one.
    participants = [participants[0]];

    // Click Remove on Ben Diaz's row.
    // NOTE: the source labels this button "Remove", not "Disconnect" — the
    // appendix says "Disconnect" but the code renders "Remove" (CASE-032/033
    // discrepancy noted in the handoff). Test asserts the actual label.
    const benRow = screen.getAllByText('Ben Diaz')[0].closest('.grid');
    fireEvent.click(within(benRow).getByRole('button', { name: 'Remove' }));

    // 1. POST hit the right identity with the presenter token.
    await waitFor(() => {
      const removeCall = fetchMock.mock.calls.find(
        ([u, o]) =>
          String(u) === '/participants/s2/remove' && /POST/i.test(o?.method || '')
      );
      expect(removeCall).toBeDefined();
      expect(removeCall[1].headers).toEqual({ Authorization: 'Bearer jwt-token' });
    });

    // 2. handleRemoveViewer refreshes; modal and Sidebar both show one fewer.
    await waitFor(() => {
      const countTexts = screen.getAllByText('Viewers: 1');
      expect(countTexts.length).toBeGreaterThanOrEqual(2);
    });

    // 3. Ben is gone from the open list; Ana is still there.
    await waitFor(() => expect(screen.queryByText('Ben Diaz')).not.toBeInTheDocument());
    expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);

    // 4. Broadcast not interrupted: no disconnect, no setScreenShareEnabled(false),
    //    End Session button still on screen (dashboard still mounted).
    expect(mocks.room.disconnect).not.toHaveBeenCalled();
    expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /End Session/ })).toBeInTheDocument();
  });

  // ---------- INT-013 ----------
  it('INT-013: dismissing the Viewer List leaves the Active Broadcast screen intact and does not interrupt the broadcast', async () => {
    const user = await startBroadcast();

    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 1')).toBeInTheDocument());

    // Open the Viewer List.
    await user.click(screen.getByText('Viewers: 1'));

    // Two "Viewers: 1" texts exist while the modal is open — Sidebar and modal header.
    await waitFor(() => {
      expect(screen.getAllByText('Viewers: 1').length).toBe(2);
    });

    // Dismiss via the X button (there's one per modal; the last rendered is the
    // Viewer List's because it renders after Sidebar in PresenterApp's tree).
    const closeButtons = screen.getAllByRole('button', { name: 'Close modal' });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // 1. Modal gone: only Sidebar's "Viewers: 1" remains.
    await waitFor(() => {
      expect(screen.getAllByText('Viewers: 1').length).toBe(1);
    });

    // 2. Active Broadcast screen still visible (Sidebar + BroadcastScreen intact).
    expect(screen.getByRole('button', { name: /End Session/ })).toBeInTheDocument();
    expect(screen.getByText('[QR CODE]')).toBeInTheDocument();
    expect(screen.getByText(/Click to Expand/)).toBeInTheDocument();

    // 3. Broadcast not interrupted: no disconnect, no screen-share toggle.
    expect(mocks.room.disconnect).not.toHaveBeenCalled();
    expect(mocks.room.localParticipant.setScreenShareEnabled).toHaveBeenCalledTimes(1);

    // 4. Viewer state preserved: reopening shows Ana Cruz still connected — the
    //    viewer's session was untouched by the Host opening/closing the modal.
    await user.click(screen.getByText('Viewers: 1'));
    await waitFor(() => {
      expect(screen.getAllByText('Ana Cruz').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------- INT-014 ----------
  it("INT-014: a viewer's message appears in the Host Chat Preview with the viewer's name", async () => {
    const user = await startBroadcast();

    // One viewer connected — their /token registered them with a display name
    // in LiveKit, which /participants returns as `name`.
    participants = [
      { identity: 's1', name: 'Ana Cruz', attributes: { Name: 'Ana Cruz' } },
    ];
    await pollOnce();
    await waitFor(() => expect(screen.getByText('Viewers: 1')).toBeInTheDocument());

    // Register the participant on the mocked LiveKit room so the handler can
    // look up the sender's display name (PresenterApp.receiveMessages).
    mocks.room.remoteParticipants.set('s1', { name: 'Ana Cruz' });

    // Drive the registered 'student-message' handler — this is what fires when
    // a viewer calls room.localParticipant.sendText(text, { topic: 'student-message' }).
    const [, handler] = mocks.room.registerTextStreamHandler.mock.calls[0];
    await act(async () => {
      await handler({ readAll: async () => 'Please zoom in' }, { identity: 's1' });
    });

    // 1. Sidebar Chat Preview shows the sender and the text.
    expect(await screen.findByText('Please zoom in')).toBeInTheDocument();
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument();

    // 2. The real ChatModal shows the same message with the viewer's name.
    await user.click(screen.getByRole('button', { name: 'Expand Chat' }));

    const chatHeading = await screen.findByRole('heading', { name: 'Chat' });
    const chatModal = chatHeading.closest('.fixed');
    expect(within(chatModal).getByText('Ana Cruz')).toBeInTheDocument();
    expect(within(chatModal).getByText('Please zoom in')).toBeInTheDocument();

    // 3. Closing the modal returns to the dashboard; broadcast untouched.
    fireEvent.click(within(chatModal).getByRole('button', { name: 'Close modal' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Chat' })).not.toBeInTheDocument()
    );
    expect(mocks.room.disconnect).not.toHaveBeenCalled();
  });

  // ---------- INT-015 ----------
  it('INT-015: when more than 20 messages arrive the Chat Preview keeps only the 20 most recent and drops the oldest', async () => {
    const user = await startBroadcast();

    // Register a sender so the handler can resolve a display name.
    mocks.room.remoteParticipants.set('s1', { name: 'Ana Cruz' });
    const [, handler] = mocks.room.registerTextStreamHandler.mock.calls[0];

    // Send 22 messages — messages 1 and 2 should be dropped once the cap is reached.
    for (let i = 1; i <= 22; i++) {
      await act(async () => {
        await handler({ readAll: async () => `Message ${i}` }, { identity: 's1' });
      });
    }

    // Open the full chat modal to see all retained messages.
    await user.click(screen.getByRole('button', { name: 'Expand Chat' }));
    const chatHeading = await screen.findByRole('heading', { name: 'Chat' });
    const chatModal = chatHeading.closest('.fixed');

    // The two oldest messages (1 and 2) are gone.
    expect(within(chatModal).queryByText('Message 1')).not.toBeInTheDocument();
    expect(within(chatModal).queryByText('Message 2')).not.toBeInTheDocument();

    // The most recent message is present.
    expect(within(chatModal).getByText('Message 22')).toBeInTheDocument();
  });
});