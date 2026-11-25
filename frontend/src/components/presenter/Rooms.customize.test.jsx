import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Rooms from './Rooms'
import { loadLogs } from '../util/logStore.js'

vi.mock('../util/logStore.js', () => ({ loadLogs: vi.fn() }))
vi.mock('./Logs', () => ({ default: () => null }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let fetchMock
let postOverride
let putOverride
let existingRooms

const roomFromBody = (id, body) => ({
  id,
  label: `Room ${id}`,
  roomSize: String(body.room_size),
  fields: body.fields,
  userInputs: body.user_inputs,
})

const isRoomPost = ([url, opts]) => url === '/rooms' && opts?.method === 'POST'
const posts = () => fetchMock.mock.calls.filter(isRoomPost)
const lastPostBody = () => JSON.parse(posts().at(-1)[1].body)

async function openNewRoomForm() {
  const user = userEvent.setup()
  render(<Rooms />)
  await screen.findByText(/No saved rooms yet/)
  await user.click(screen.getByRole('button', { name: /^Add Room/ }))
  await screen.findByText('Customize New Room')
  return { user }
}

const roomSizeInput = () =>
  screen.getByText(/Room size \(Max 50\)/).parentElement.querySelector('input')

async function setRoomSize(user, value) {
  const input = roomSizeInput()
  await user.clear(input)
  if (value !== '') await user.type(input, value)
}

const puts = () => fetchMock.mock.calls.filter(([, o]) => o?.method === 'PUT')

const fieldCard = (i) => screen.getAllByPlaceholderText('Field Name')[i].parentElement
const inputCard = (i) => screen.getAllByPlaceholderText('Input Name')[i].parentElement.parentElement
const fieldNames = () => screen.queryAllByPlaceholderText('Field Name').map((i) => i.value)
const inputNames = () => screen.queryAllByPlaceholderText('Input Name').map((i) => i.value)

const SAVED_ROOM = {
  id: 1,
  label: 'Room 1',
  roomSize: '30',
  fields: [{ name: 'Section', value: 'BSIT 4C' }],
  userInputs: ['First Name', 'Last Name'],
}

const clickSave = (user) => user.click(screen.getByRole('button', { name: 'Save Customization' }))

// ---------------------------------------------------------------------------
describe('Rooms: Customize New Room', () => {
  beforeEach(() => {
    postOverride = null
    putOverride = null
    existingRooms = []
    loadLogs.mockResolvedValue([])
    fetchMock = vi.fn(async (url, opts = {}) => {
      if (isRoomPost([url, opts])) {
        if (postOverride) return postOverride
        return { ok: true, json: async () => roomFromBody(1, JSON.parse(opts.body)) }
      }
      if (opts.method === 'PUT') {
        if (putOverride) return putOverride
        const id = Number(url.split('/').pop())
        return { ok: true, json: async () => roomFromBody(id, JSON.parse(opts.body)) }
      }
      if (url === '/rooms') return { ok: true, json: async () => existingRooms }
      return { ok: true, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('opens a draft room with the default room size, fields and user inputs', async () => {
    await openNewRoomForm()

    expect(roomSizeInput()).toHaveValue('50')
    expect(screen.getAllByPlaceholderText('Field Name').map((i) => i.value)).toEqual([
      'Section',
      'Subject',
      'EDP Code',
    ])
    expect(screen.getAllByPlaceholderText('Input Name').map((i) => i.value)).toEqual([
      'First Name',
      'Last Name',
    ])
    expect(posts()).toHaveLength(0)
  })

  // CASE-012
  describe('CASE-012: valid room size', () => {
    it.each(['1', '30', '50'])('accepts %s and posts it to /rooms', async (size) => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, size)
      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      const [url, opts] = posts()[0]
      expect(url).toBe('/rooms')
      expect(opts.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(lastPostBody()).toEqual({
        room_size: size,
        fields: [
          { name: 'Section', value: '' },
          { name: 'Subject', value: '' },
          { name: 'EDP Code', value: '' },
        ],
        user_inputs: ['First Name', 'Last Name'],
      })
    })

    it('trims surrounding whitespace before validating and sending', async () => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, ' 25 ')
      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().room_size).toBe('25')
    })

    it('shows the saved room as read-only details and adds it to Saved Rooms', async () => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, '30')
      await clickSave(user)

      expect(await screen.findByText('Max Size:')).toBeInTheDocument()
      expect(screen.getByText('30')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save Customization' })).not.toBeInTheDocument()
      expect(screen.queryByText(/No saved rooms yet/)).not.toBeInTheDocument()
      expect(screen.getAllByText('Room 1').length).toBeGreaterThanOrEqual(1)
    })

    it('clears an earlier validation error once a valid size is saved', async () => {
      const { user } = await openNewRoomForm()
      await setRoomSize(user, '99')
      await clickSave(user)
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await setRoomSize(user, '20')
      await clickSave(user)

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
      expect(posts()).toHaveLength(1)
    })
  })

  // CASE-013
  describe('CASE-013: room size above the limit', () => {
    it.each(['51', '100', '999999', '0'])(
      'rejects %s and does not save the room',
      async (size) => {
        const { user } = await openNewRoomForm()

        await setRoomSize(user, size)
        await clickSave(user)

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Room size must be a number from 1 to 50.',
        )
        expect(posts()).toHaveLength(0)
        expect(screen.getByRole('button', { name: 'Save Customization' })).toBeInTheDocument()
      },
    )
  })

  // CASE-014
  describe('CASE-014: non-numeric room size', () => {
    it.each(['abc', '12abc', '-5', '3.5', '1e2', '5 0', '٣'])(
      'rejects "%s" and does not save the room',
      async (size) => {
        const { user } = await openNewRoomForm()

        await setRoomSize(user, size)
        await clickSave(user)

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Room size must be a number from 1 to 50.',
        )
        expect(posts()).toHaveLength(0)
      },
    )
  })

  // CASE-015
  describe('CASE-015: empty room size', () => {
    it('does not show a client-side validation error; the default size (50) is submitted', async () => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, '')
      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(screen.queryByText(/Room size must be a number/)).not.toBeInTheDocument()
      expect(String(lastPostBody().room_size)).toBe('50')
    })

    it('treats a whitespace-only size the same as empty', async () => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, '   ')
      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(String(lastPostBody().room_size)).toBe('50')
    })

    it('keeps the form open and shows an error when the server rejects the request', async () => {
      postOverride = {
        ok: false,
        status: 422,
        json: async () => ({ detail: [{ msg: 'Input should be a valid string' }] }),
      }
      const { user } = await openNewRoomForm()

      await setRoomSize(user, '')
      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the room.')
      expect(screen.getByRole('button', { name: 'Save Customization' })).toBeInTheDocument()
      expect(screen.getByText(/No saved rooms yet/)).toBeInTheDocument()
    })

    // KNOWN DEFECT: when the size is empty, Rooms.jsx falls back to the number 50
    // (`String(...).trim() || ROOM_SIZE`), so the JSON body carries room_size: 50.
    // The server model declares `room_size: str`, so Pydantic v2 answers 422 and the
    // room is not saved. This test describes the intended behaviour and is expected
    // to fail until the fallback is changed to String(ROOM_SIZE).
    it.fails('sends the default room size as a string', async () => {
      const { user } = await openNewRoomForm()

      await setRoomSize(user, '')
      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(typeof lastPostBody().room_size).toBe('string')
    })
  })

  // CASE-016
  describe('CASE-016: Add Field', () => {
    it('adds an empty Field Name / Value pair', async () => {
      const { user } = await openNewRoomForm()
      expect(screen.getAllByPlaceholderText('Field Name')).toHaveLength(3)
      expect(screen.getAllByPlaceholderText('Value')).toHaveLength(3)

      await user.click(screen.getByRole('button', { name: 'Add Field' }))

      const names = screen.getAllByPlaceholderText('Field Name')
      const values = screen.getAllByPlaceholderText('Value')
      expect(names).toHaveLength(4)
      expect(values).toHaveLength(4)
      expect(names.at(-1)).toHaveValue('')
      expect(values.at(-1)).toHaveValue('')
    })

    it('adds one pair per click and keeps existing fields unchanged', async () => {
      const { user } = await openNewRoomForm()

      await user.click(screen.getByRole('button', { name: 'Add Field' }))
      await user.click(screen.getByRole('button', { name: 'Add Field' }))

      const names = screen.getAllByPlaceholderText('Field Name').map((i) => i.value)
      expect(names).toEqual(['Section', 'Subject', 'EDP Code', '', ''])
    })

    it('limits field names to 30 characters and values to 50', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'Add Field' }))

      const name = screen.getAllByPlaceholderText('Field Name').at(-1)
      const value = screen.getAllByPlaceholderText('Value').at(-1)
      await user.type(name, 'n'.repeat(40))
      await user.type(value, 'v'.repeat(60))

      expect(name.value).toHaveLength(30)
      expect(value.value).toHaveLength(50)
    })

    it('includes a named new field when the room is saved', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'Add Field' }))
      await user.type(screen.getAllByPlaceholderText('Field Name').at(-1), 'Instructor')
      await user.type(screen.getAllByPlaceholderText('Value').at(-1), 'Mr. Reyes')

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().fields).toContainEqual({ name: 'Instructor', value: 'Mr. Reyes' })
      expect(lastPostBody().fields).toHaveLength(4)
    })

    it('drops a new field that is left without a name when saving', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'Add Field' }))

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().fields).toHaveLength(3)
    })

    it('rejects more than 6 named fields', async () => {
      const { user } = await openNewRoomForm()
      for (let i = 0; i < 4; i += 1) {
        await user.click(screen.getByRole('button', { name: 'Add Field' }))
      }
      const names = screen.getAllByPlaceholderText('Field Name')
      expect(names).toHaveLength(7)
      for (const [i, input] of names.slice(3).entries()) {
        await user.type(input, `Extra ${i + 1}`)
      }

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('Fields allow at most 6 entries.')
      expect(posts()).toHaveLength(0)
    })

    it('rejects a duplicate field name regardless of case', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'Add Field' }))
      await user.type(screen.getAllByPlaceholderText('Field Name').at(-1), 'section')

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '"section" is used more than once in Fields.',
      )
      expect(posts()).toHaveLength(0)
    })
  })

  // CASE-017
  describe('CASE-017: empty Field Value', () => {
    it('accepts a field whose value is empty and sends an empty string', async () => {
      const { user } = await openNewRoomForm()

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().fields).toEqual([
        { name: 'Section', value: '' },
        { name: 'Subject', value: '' },
        { name: 'EDP Code', value: '' },
      ])
    })

    it('shows an empty value as an em dash on the Room Details screen', async () => {
      const { user } = await openNewRoomForm()
      await user.type(screen.getAllByPlaceholderText('Value')[0], 'BSIT 4C')

      await clickSave(user)

      expect(
        await screen.findByText('Section: BSIT 4C, Subject: —, EDP Code: —'),
      ).toBeInTheDocument()
    })

    it('lists a room with only empty values as "No details set"', async () => {
      const { user } = await openNewRoomForm()

      await clickSave(user)

      expect(await screen.findByText('No details set')).toBeInTheDocument()
    })
  })

  // CASE-018
  describe('CASE-018: Remove a field', () => {
    it('removes only that field immediately', async () => {
      const { user } = await openNewRoomForm()

      await user.click(within(fieldCard(1)).getByRole('button', { name: 'Remove' }))

      expect(fieldNames()).toEqual(['Section', 'EDP Code'])
      expect(screen.getAllByPlaceholderText('Value')).toHaveLength(2)
    })

    it('can remove every field', async () => {
      const { user } = await openNewRoomForm()

      for (let i = 0; i < 3; i += 1) {
        await user.click(within(fieldCard(0)).getByRole('button', { name: 'Remove' }))
      }

      expect(fieldNames()).toEqual([])
    })

    it('leaves the user inputs untouched', async () => {
      const { user } = await openNewRoomForm()

      await user.click(within(fieldCard(0)).getByRole('button', { name: 'Remove' }))

      expect(inputNames()).toEqual(['First Name', 'Last Name'])
    })

    it('does not send a removed field when the room is saved', async () => {
      const { user } = await openNewRoomForm()
      await user.click(within(fieldCard(1)).getByRole('button', { name: 'Remove' }))

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().fields.map((f) => f.name)).toEqual(['Section', 'EDP Code'])
    })

    it('shows "Not Set (Default logs)" in the details when all fields were removed', async () => {
      const { user } = await openNewRoomForm()
      for (let i = 0; i < 3; i += 1) {
        await user.click(within(fieldCard(0)).getByRole('button', { name: 'Remove' }))
      }

      await clickSave(user)

      expect(await screen.findByText('Not Set (Default logs)')).toBeInTheDocument()
    })
  })

  // CASE-019
  describe('CASE-019: "User Inputs +" button', () => {
    it('adds a new empty Input Name field', async () => {
      const { user } = await openNewRoomForm()
      expect(inputNames()).toEqual(['First Name', 'Last Name'])

      await user.click(screen.getByRole('button', { name: 'User Inputs' }))

      expect(inputNames()).toEqual(['First Name', 'Last Name', ''])
    })

    it('does not send a new input that was left blank', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'User Inputs' }))

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().user_inputs).toEqual(['First Name', 'Last Name'])
    })

    it('sends a named new input, trimmed', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'User Inputs' }))
      await user.type(screen.getAllByPlaceholderText('Input Name').at(-1), '  Student No.  ')

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().user_inputs).toEqual(['First Name', 'Last Name', 'Student No.'])
    })

    it('rejects more than 5 user inputs', async () => {
      const { user } = await openNewRoomForm()
      for (const name of ['A', 'B', 'C', 'D']) {
        await user.click(screen.getByRole('button', { name: 'User Inputs' }))
        await user.type(screen.getAllByPlaceholderText('Input Name').at(-1), name)
      }

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'User Inputs allow at most 5 entries.',
      )
      expect(posts()).toHaveLength(0)
    })

    it('rejects a duplicate input name regardless of case', async () => {
      const { user } = await openNewRoomForm()
      await user.click(screen.getByRole('button', { name: 'User Inputs' }))
      await user.type(screen.getAllByPlaceholderText('Input Name').at(-1), 'first name')

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '"first name" is used more than once in User Inputs.',
      )
      expect(posts()).toHaveLength(0)
    })
  })

  // CASE-020 (behaviour follows the code, not the appendix wording)
  describe('CASE-020: "x" inside an Input Name field', () => {
    // Rooms.jsx wires the "x" to handleRemoveUserInput, so it removes the whole input
    // instead of clearing its text and keeping the field.
    it('removes that input field entirely', async () => {
      const { user } = await openNewRoomForm()
      const x = within(screen.getAllByPlaceholderText('Input Name')[0].parentElement).getByRole(
        'button',
      )

      await user.click(x)

      expect(inputNames()).toEqual(['Last Name'])
    })

    it('does not leave an empty field behind', async () => {
      const { user } = await openNewRoomForm()

      await user.click(
        within(screen.getAllByPlaceholderText('Input Name')[1].parentElement).getByRole('button'),
      )

      expect(inputNames()).toEqual(['First Name'])
      expect(inputNames()).not.toContain('')
    })

    it('behaves the same as the "Remove" link above the input', async () => {
      const { user } = await openNewRoomForm()

      await user.click(within(inputCard(0)).getByRole('button', { name: 'Remove' }))

      expect(inputNames()).toEqual(['Last Name'])
    })

    it('leaves the fields section untouched', async () => {
      const { user } = await openNewRoomForm()

      await user.click(
        within(screen.getAllByPlaceholderText('Input Name')[0].parentElement).getByRole('button'),
      )

      expect(fieldNames()).toEqual(['Section', 'Subject', 'EDP Code'])
    })

    it('saves with no user inputs once all are removed', async () => {
      const { user } = await openNewRoomForm()
      for (let i = 0; i < 2; i += 1) {
        await user.click(
          within(screen.getAllByPlaceholderText('Input Name')[0].parentElement).getByRole('button'),
        )
      }

      await clickSave(user)

      await waitFor(() => expect(posts()).toHaveLength(1))
      expect(lastPostBody().user_inputs).toEqual([])
      expect(await screen.findByText('Not Set (Default Enter Name)')).toBeInTheDocument()
    })
  })

  // CASE-021 (behaviour follows the code: the overlay stays open on the details view)
  describe('CASE-021: Save Customization with valid settings', () => {
    it('saves the room, switches the overlay to the read-only details and lists the room', async () => {
      const { user } = await openNewRoomForm()

      await clickSave(user)

      expect(await screen.findByText('Max Size:')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Room 1' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save Customization' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Customize' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      expect(screen.queryByText(/No saved rooms yet/)).not.toBeInTheDocument()
    })

    it('shows the saved user inputs in the details', async () => {
      const { user } = await openNewRoomForm()

      await clickSave(user)

      expect(await screen.findByText('First Name, Last Name')).toBeInTheDocument()
    })

    it('shows the server detail message when the room is rejected', async () => {
      postOverride = {
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Duplicate field names' }),
      }
      const { user } = await openNewRoomForm()

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('Duplicate field names')
      expect(screen.getByRole('button', { name: 'Save Customization' })).toBeInTheDocument()
    })

    it('shows a generic message when the error body is not readable', async () => {
      postOverride = {
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json')
        },
      }
      const { user } = await openNewRoomForm()

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the room.')
    })

    it('shows a connection message when the server cannot be reached', async () => {
      const { user } = await openNewRoomForm()
      fetchMock.mockRejectedValueOnce(new Error('offline'))

      await clickSave(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.')
      expect(screen.getByRole('button', { name: 'Save Customization' })).toBeInTheDocument()
    })

    it('ignores a second click while the first save is still pending', async () => {
      let release
      postOverride = new Promise((r) => (release = r))
      const { user } = await openNewRoomForm()

      await clickSave(user)
      await clickSave(user)
      expect(posts()).toHaveLength(1)

      release({ ok: true, json: async () => roomFromBody(1, lastPostBody()) })
      expect(await screen.findByText('Max Size:')).toBeInTheDocument()
      expect(posts()).toHaveLength(1)
    })

    it('updates an existing room with PUT /rooms/:id', async () => {
      existingRooms = [SAVED_ROOM]
      const user = userEvent.setup()
      render(<Rooms />)
      await user.click(await screen.findByText('Room 1'))
      await user.click(screen.getByRole('button', { name: 'Customize' }))
      expect(roomSizeInput()).toHaveValue('30')

      await setRoomSize(user, '40')
      await clickSave(user)

      await waitFor(() => expect(puts()).toHaveLength(1))
      const [url, opts] = puts()[0]
      expect(url).toBe('/rooms/1')
      expect(JSON.parse(opts.body).room_size).toBe('40')
      expect(posts()).toHaveLength(0)
      expect(await screen.findByText('40')).toBeInTheDocument()
    })
  })

  // CASE-022
  describe('CASE-022: close icon', () => {
    it('closes the overlay without saving', async () => {
      const { user } = await openNewRoomForm()

      await user.click(screen.getByRole('button', { name: 'Close modal' }))

      expect(screen.queryByText('Customize New Room')).not.toBeInTheDocument()
      expect(posts()).toHaveLength(0)
      expect(screen.getByText(/No saved rooms yet/)).toBeInTheDocument()
    })

    it('discards the unsaved draft: a new draft starts from the defaults', async () => {
      const { user } = await openNewRoomForm()
      await setRoomSize(user, '10')
      await user.click(screen.getByRole('button', { name: 'User Inputs' }))
      await user.click(screen.getByRole('button', { name: 'Close modal' }))

      await user.click(screen.getByRole('button', { name: /^Add Room/ }))

      expect(roomSizeInput()).toHaveValue('50')
      expect(inputNames()).toEqual(['First Name', 'Last Name'])
    })

    it('clears a visible validation error', async () => {
      const { user } = await openNewRoomForm()
      await setRoomSize(user, '99')
      await clickSave(user)
      expect(await screen.findByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Close modal' }))
      await user.click(screen.getByRole('button', { name: /^Add Room/ }))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('closes when the backdrop is clicked but not when the card is clicked', async () => {
      const { user } = await openNewRoomForm()
      const heading = screen.getByText('Customize New Room')

      await user.click(heading)
      expect(screen.getByText('Customize New Room')).toBeInTheDocument()

      await user.click(heading.closest('.fixed'))
      expect(screen.queryByText('Customize New Room')).not.toBeInTheDocument()
      expect(posts()).toHaveLength(0)
    })

    it('closes an existing room without changing it', async () => {
      existingRooms = [SAVED_ROOM]
      const user = userEvent.setup()
      render(<Rooms />)
      await user.click(await screen.findByText('Room 1'))
      await user.click(screen.getByRole('button', { name: 'Customize' }))
      await setRoomSize(user, '5')

      await user.click(screen.getByRole('button', { name: 'Close modal' }))

      expect(puts()).toHaveLength(0)
      await user.click(screen.getByText('Room 1'))
      expect(screen.getByText('30')).toBeInTheDocument()
    })
  })
})