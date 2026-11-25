// INT-016 — Broadcast Control → Live Viewing Session
//   Host ends the session while a viewer has the chat dialog open and an unsent
//   message typed. The LiveKit room fires RoomEvent.Disconnected on the viewer's
//   client → ViewerApp.resetToJoin runs → viewer returns to the join screen,
//   chat closes, and the unsent message is never sent.
//
// INT-017 — Broadcast Control → Live Viewing Session (blank screen after end)
//   Host ends the broadcast; a viewer then opens the session URL. ViewerApp
//   connects successfully but no TrackSubscribed event ever fires. Expected:
//   viewer is on the room screen but the video element has no srcObject (blank).
//
// Written but NOT run. Run:
//   pnpm vitest run src/components/viewer/ViewerApp.integration.test.jsx

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ViewerApp from './ViewerApp.jsx';

const mocks = vi.hoisted(() => ({ room: null }));

vi.mock('livekit-client', () => ({
  Room: vi.fn(function Room() {
    return mocks.room;
  }),
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    Disconnected: 'disconnected',
  },
}));
vi.mock('../config.js', () => ({
  initConfig: vi.fn(() => Promise.resolve()),
  getLivekitURI: vi.fn(() => 'ws://192.168.1.10:7880'),
}));
vi.mock('../util/polyfill.js', () => ({}));

// buildRoom returns a LiveKit Room stub whose `on` captures handlers by event
// name so tests can fire them manually via fireEvent(eventName, ...args).
function buildRoom() {
  const handlers = {};
  return {
    handlers,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    localParticipant: {
      sendText: vi.fn().mockResolvedValue(undefined),
    },
    remoteParticipants: new Map(),
  };
}

function makeFetchMock() {
  return vi.fn(async (url) => {
    const u = String(url);
    if (u === '/room-config') {
      return { ok: true, json: async () => ({ user_inputs: ['Name'], fields: [], room_size: 30 }) };
    }
    if (u.startsWith('/token')) return { ok: true, text: async () => 'jwt-token' };
    return { ok: true, json: async () => ({}) };
  });
}

// Renders ViewerApp, waits for the join form, fills Name, and clicks Connect.
// Returns userEvent instance so callers can continue interacting.
async function connectViewer() {
  const user = userEvent.setup();
  render(<ViewerApp />);

  // Wait for initConfig to resolve and the join form to appear.
  const nameField = await screen.findByPlaceholderText('Name');
  await user.type(nameField, 'Ana Cruz');
  await user.click(screen.getByRole('button', { name: 'Connect' }));

  // Wait until the room screen is shown (ViewerControls Chat button is a reliable landmark).
  await screen.findByRole('button', { name: 'Chat' });

  return user;
}

describe('ViewerApp integration', () => {
  beforeEach(() => {
    mocks.room = buildRoom();
    vi.stubGlobal('fetch', makeFetchMock());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ---------- INT-016 ----------
  it('INT-016: when the host ends the session the viewer returns to the join screen and the open chat panel closes', async () => {
    const user = await connectViewer();

    // 1. Open the chat panel via the Chat button in ViewerControls.
    await user.click(screen.getByRole('button', { name: 'Chat' }));

    // Chat panel is now open — the "Messages (Ana Cruz)" header is visible and
    // the input placeholder "Send message..." is in the DOM.
    expect(await screen.findByPlaceholderText('Send message...')).toBeInTheDocument();

    // 2. Viewer types an unsent message.
    await user.type(screen.getByPlaceholderText('Send message...'), 'Hello host');

    // Confirm the message is typed but not yet sent.
    expect(screen.getByDisplayValue('Hello host')).toBeInTheDocument();
    expect(mocks.room.localParticipant.sendText).not.toHaveBeenCalled();

    // 3. Host ends the session — LiveKit fires Disconnected on the viewer's room.
    await act(async () => {
      mocks.room.handlers['disconnected']();
    });

    // 4. Viewer is back on the join screen.
    expect(await screen.findByText('Enter display name')).toBeInTheDocument();

    // 5. Chat panel is closed (ViewerChat is not rendered).
    expect(screen.queryByPlaceholderText('Send message...')).not.toBeInTheDocument();

    // 6. The unsent message was never sent.
    expect(mocks.room.localParticipant.sendText).not.toHaveBeenCalled();
  });

  // ---------- INT-017 ----------
  it('INT-017: when the viewer connects after the broadcast ended no shared screen is displayed', async () => {
    // The host has already ended the broadcast — no presenter track will ever
    // be published. room.connect resolves, but TrackSubscribed never fires.
    // ViewerApp.stream stays null, so the video element's srcObject is never set.

    await connectViewer();

    // 1. Viewer is on the room screen (connected).
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();

    // 2. No TrackSubscribed fired — stream is null — video has no source.
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      // srcObject is set by a useEffect; since no track arrived it stays null/undefined.
      expect(video.srcObject == null).toBe(true);
    });

    // 3. The room connection itself succeeded (connect was called once).
    expect(mocks.room.connect).toHaveBeenCalledTimes(1);

    // 4. No track-related disconnect happened — viewer is simply waiting.
    expect(mocks.room.disconnect).not.toHaveBeenCalled();
  });
});
