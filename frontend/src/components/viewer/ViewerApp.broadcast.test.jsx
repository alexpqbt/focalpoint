// CASE-048 to CASE-053 — Broadcast View
// Mounts the real ViewerApp -> ViewerRoom -> ViewerFeed / ViewerControls / ViewerChat.
// ViewerJoin is stubbed (covered by ViewerJoin.test.jsx, CASE-041 to 047) and only
// exposes a "Join Session" button that calls onConnect('Test Viewer', {}).
// LiveKit is mocked; track arrival / departure / disconnect are driven by calling the
// handlers ViewerApp registered on the mocked Room.

import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ViewerApp from './ViewerApp';

const h = vi.hoisted(() => ({
  rooms: [],
  mediaStreams: [],
  fetch: vi.fn(),
  RoomEvent: {
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    Disconnected: 'disconnected',
  },
}));

vi.mock('livekit-client', () => {
  class Room {
    constructor() {
      this.handlers = {};
      this.connect = vi.fn().mockResolvedValue(undefined);
      this.disconnect = vi.fn().mockResolvedValue(undefined);
      this.localParticipant = { sendText: vi.fn().mockResolvedValue(undefined) };
      h.rooms.push(this);
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
  }
  return { Room, RoomEvent: h.RoomEvent };
});

vi.mock('../config.js', () => ({
  initConfig: vi.fn().mockResolvedValue(undefined),
  getLivekitURI: vi.fn(() => 'ws://livekit.test'),
}));

vi.mock('../util/polyfill.js', () => ({}));

vi.mock('./ViewerJoin', async () => {
  const React = await import('react');
  return {
    default: function ViewerJoinStub({ onConnect }) {
      return React.createElement(
        'button',
        { type: 'button', onClick: () => onConnect('Test Viewer', {}) },
        'Join Session'
      );
    },
  };
});

let user;

async function renderAndJoin() {
  render(<ViewerApp />);
  await user.click(await screen.findByRole('button', { name: /join session/i }));
  await waitFor(() => expect(h.rooms).toHaveLength(1));
  await screen.findByRole('button', { name: /^chat$/i });
  return h.rooms[0];
}

beforeAll(() => {
  // jsdom has no real srcObject; mirror the property so `<video>.srcObject` works.
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get() {
      return this._srcObject ?? null;
    },
    set(value) {
      this._srcObject = value;
    },
  });
});

beforeEach(() => {
  user = userEvent.setup();
  h.rooms.length = 0;
  h.mediaStreams.length = 0;
  h.fetch.mockReset().mockResolvedValue({ text: async () => 'fake-token' });
  vi.stubGlobal('fetch', h.fetch);
  vi.stubGlobal(
    'MediaStream',
    class MediaStreamStub {
      constructor(tracks) {
        this.tracks = tracks;
        h.mediaStreams.push(this);
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ViewerApp – Broadcast View (CASE-048 to CASE-053)', () => {
  it('CASE-048: viewer joins an active session and the host screen is displayed', async () => {
    const room = await renderAndJoin();

    expect(h.fetch).toHaveBeenCalledTimes(1);
    const tokenUrl = h.fetch.mock.calls[0][0];
    expect(tokenUrl).toMatch(/^\/token\?role=student&identity=student-/);
    expect(tokenUrl).toContain(`name=${encodeURIComponent('Test Viewer')}`);
    expect(room.connect).toHaveBeenCalledWith('ws://livekit.test', 'fake-token');

    expect(room.handlers[h.RoomEvent.TrackSubscribed]).toBeTypeOf('function');
    expect(room.handlers[h.RoomEvent.TrackUnsubscribed]).toBeTypeOf('function');
    expect(room.handlers[h.RoomEvent.Disconnected]).toBeTypeOf('function');

    const video = document.querySelector('video');
    expect(video).not.toBeNull();

    const track = { kind: 'video', mediaStreamTrack: { id: 'track-1' } };
    act(() => {
      room.handlers[h.RoomEvent.TrackSubscribed](track);
    });

    await waitFor(() => expect(video.srcObject).not.toBeNull());
    expect(h.mediaStreams).toHaveLength(1);
    expect(h.mediaStreams[0].tracks).toEqual([track.mediaStreamTrack]);
    expect(video.srcObject).toBe(h.mediaStreams[0]);
  });

  it('CASE-049: viewer joins when no active session exists – blank screen', async () => {
    await renderAndJoin();

    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video.srcObject).toBeNull();
    expect(h.mediaStreams).toHaveLength(0);
  });

  it('CASE-050: viewer clicks "Chat" and the message panel appears', async () => {
    await renderAndJoin();

    expect(screen.queryByPlaceholderText('Send message...')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^chat$/i }));

    expect(await screen.findByPlaceholderText('Send message...')).toBeInTheDocument();
    // The code renders "Messages (<name>)"; the appendix calls it "Message to Host".
    expect(screen.getByText(/Messages \(Test Viewer\)/)).toBeInTheDocument();
  });

  it.fails(
    'CASE-051: viewer clicks "Stop Viewing (X)" – appendix expects a blank page',
    async () => {
      // Appendix: "Blank page, viewing session ends".
      // Current code: disconnect() -> setScreen('join'), so the join form is shown.
      // Fix: render a blank view (not ViewerJoin) after leaving; then flip to `it`.
      const room = await renderAndJoin();

      await user.click(screen.getByTitle('Leave Room'));

      // Current behaviour (passes), kept so the wait is not racy:
      await screen.findByRole('button', { name: /join session/i });
      expect(room.disconnect).toHaveBeenCalled();

      // Appendix expectation (fails today):
      expect(document.querySelector('video')).toBeNull();
      expect(screen.queryByRole('button', { name: /join session/i })).toBeNull();
    }
  );

  it.fails(
    'CASE-052: host ends the session while the viewer is watching – appendix expects a blank page',
    async () => {
      // Appendix: "Viewer's page immediately blank".
      // Current code: RoomEvent.Disconnected -> resetToJoin() -> join screen.
      // Fix: reset to a blank screen when the disconnect comes from the host; flip to `it`.
      const room = await renderAndJoin();

      act(() => {
        room.handlers[h.RoomEvent.Disconnected]();
      });

      await screen.findByRole('button', { name: /join session/i });
      expect(room.disconnect).toHaveBeenCalled();

      expect(document.querySelector('video')).toBeNull();
      expect(screen.queryByRole('button', { name: /join session/i })).toBeNull();
    }
  );

  it.fails(
    'CASE-053: host disconnects the viewer individually – appendix expects a blank page',
    async () => {
      // LiveKit delivers a per-viewer kick as the same RoomEvent.Disconnected, so this
      // is behaviourally identical to CASE-052 today. Kept separate for the appendix
      // mapping; if a distinct "removed by host" signal is added, give it its own test.
      const room = await renderAndJoin();

      act(() => {
        room.handlers[h.RoomEvent.Disconnected]();
      });

      await screen.findByRole('button', { name: /join session/i });

      expect(document.querySelector('video')).toBeNull();
      expect(screen.queryByRole('button', { name: /join session/i })).toBeNull();
    }
  );
});