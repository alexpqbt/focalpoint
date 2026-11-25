// INT-005 — Room Management → Check Viewers
// Host starts a broadcast from a room with User Inputs; a viewer fills in every
// input and connects; Host opens the Viewer List.
// Expected: the details the viewer entered appear for that viewer in the Viewer
// List.
//
// Chain being integrated:
//   Room Management (INT-002)  → POST /room-config { user_inputs }
//   Live Viewing Session (INT-004) → viewer connects, /token sets
//                                     token.with_attributes({ <label>: value })
//   GET /participants        → returns participant.attributes
//   PresenterApp poll        → viewers prop
//   ViewersModal             → fetches /room-config, renders columns from
//                              user_inputs, cell value = attributes[label].
//
// This test picks up at the ViewersModal boundary: /room-config returns the
// room's saved user_inputs, viewers arrive with attributes (the shape /token
// produced from the viewer's answers), and the modal must render them.
// The PresenterApp → Sidebar "Open Viewers" button wiring is covered by the
// Sidebar unit tests, not here.
//
// Written but NOT run.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ViewersModal from './ViewersModal.jsx';

describe('INT-005 — Room Management → Check Viewers', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async (url) => {
      if (String(url) === '/room-config') {
        return {
          ok: true,
          json: async () => ({
            user_inputs: ['Section', 'Student No.'],
            fields: [],
            room_size: 30,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('INT-005: viewer-entered details appear in the Viewer List under the room user-input columns', async () => {
    // The shape /participants returns after /token set attributes from the
    // viewer's answers (main.py, get_token): only labels from
    // room_config["user_inputs"] are included, values trimmed to 50 chars.
    const viewers = [
      {
        identity: 'student-abc1234',
        name: 'BSIT-4C 2021-00123', // set by ViewerJoin: values.join(' ')
        attributes: {
          Section: 'BSIT-4C',
          'Student No.': '2021-00123',
        },
      },
    ];

    render(<ViewersModal viewers={viewers} onClose={vi.fn()} />);

    // 1. Modal loads and /room-config resolves.
    expect(await screen.findByText('Viewers: 1')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Action')).toBeInTheDocument());

    // 2. Columns come from the room's user_inputs.
    const headers = screen
      .getAllByRole('heading', { level: 3 })
      .flatMap((h) => [h.textContent]);
    expect(headers).toContain('Viewers: 1');
    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Student No.')).toBeInTheDocument();

    // 3. Values come from the viewer's attributes, one per column.
    expect(screen.getByText('BSIT-4C')).toBeInTheDocument();
    expect(screen.getByText('2021-00123')).toBeInTheDocument();

    // 4. The joined display name is NOT what shows in the columns — the
    //    per-label attributes are. This distinguishes the new attribute-based
    //    layout from the earlier name-only fallback.
    expect(screen.queryByText('BSIT-4C 2021-00123')).not.toBeInTheDocument();
  });

  it('INT-005 (control): with no user inputs the modal falls back to a single Name column', async () => {
    fetchMock.mockImplementation(async (url) =>
      String(url) === '/room-config'
        ? { ok: true, json: async () => ({ user_inputs: [], fields: [], room_size: 30 }) }
        : { ok: true, json: async () => ({}) }
    );

    const viewers = [
      { identity: 'student-abc', name: 'Ana Cruz', attributes: {} },
    ];
    render(<ViewersModal viewers={viewers} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Action')).toBeInTheDocument());

    // Column header is "Name", value is viewer.name.
    const nameHeaders = screen.getAllByText('Name');
    expect(nameHeaders.length).toBeGreaterThan(0);
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument();

    // The per-label columns are absent.
    expect(screen.queryByText('Section')).not.toBeInTheDocument();
  });

  it('INT-005 (missing attribute): a participant without one label renders an empty cell', async () => {
    // Possible when /token ran while room_config was edited between the viewer's
    // join and the host's viewer-list open — the label is in user_inputs but
    // was not in the participant's attributes.
    fetchMock.mockImplementation(async (url) =>
      String(url) === '/room-config'
        ? {
            ok: true,
            json: async () => ({
              user_inputs: ['Section', 'Student No.'],
              fields: [],
              room_size: 30,
            }),
          }
        : { ok: true, json: async () => ({}) }
    );

    const viewers = [
      {
        identity: 'student-xyz',
        name: 'Ana Cruz',
        attributes: { Section: 'BSIT-4C' }, // Student No. missing
      },
    ];
    render(<ViewersModal viewers={viewers} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Action')).toBeInTheDocument());

    expect(screen.getByText('BSIT-4C')).toBeInTheDocument();
    // The missing-value cell resolves to '' — no stale value leaks in.
    expect(screen.queryByText('2021-00123')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});