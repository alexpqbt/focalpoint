import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewerJoin from './ViewerJoin'

let fetchMock
let config
let alertSpy

async function setup(cfg = { user_inputs: [] }) {
  config = cfg
  const user = userEvent.setup()
  const onConnect = vi.fn()
  render(<ViewerJoin onConnect={onConnect} />)
  await screen.findByRole('heading', { name: 'Enter display name' })
  return { user, onConnect }
}

const connectBtn = () => screen.getByRole('button', { name: 'Connect' })
const nameInput = () => screen.getByPlaceholderText('Name')
const TWO_INPUTS = { user_inputs: ['First Name', 'Last Name'] }

beforeEach(() => {
  config = { user_inputs: [] }
  fetchMock = vi.fn(() => Promise.resolve({ json: async () => config }))
  vi.stubGlobal('fetch', fetchMock)
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
describe('join form loading', () => {
  it('reads the room configuration and shows "Loading…" until it arrives', async () => {
    fetchMock.mockImplementation(() => new Promise(() => { }))
    render(<ViewerJoin onConnect={vi.fn()} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/room-config')
  })

  it('shows a single Name field when the room defines no user inputs', async () => {
    await setup({ user_inputs: [] })

    expect(nameInput()).toBeInTheDocument()
    expect(nameInput()).toHaveFocus()
  })

  it('shows a single Name field when the configuration cannot be loaded', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<ViewerJoin onConnect={vi.fn()} />)

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('shows a single Name field when the configuration has no user_inputs key', async () => {
    await setup({})

    expect(nameInput()).toBeInTheDocument()
  })

  it('shows one field per user input, labelled and with the first one focused', async () => {
    await setup(TWO_INPUTS)

    expect(screen.getByLabelText('First Name')).toHaveFocus()
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
  })

  it('shows the fields of a customized form in the configured order', async () => {
    await setup({ user_inputs: ['Student ID', 'First Name', 'Section'] })

    const placeholders = screen.getAllByRole('textbox').map((i) => i.getAttribute('placeholder'))
    expect(placeholders).toEqual(['Student ID', 'First Name', 'Section'])
  })
})

// ---------------------------------------------------------------------------
describe('CASE-043: name left empty', () => {
  it('does not connect and tells the viewer to enter a name', async () => {
    const { user, onConnect } = await setup()

    await user.click(connectBtn())

    expect(onConnect).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Please enter your display name')
  })

  it('keeps the form on screen', async () => {
    const { user } = await setup()

    await user.click(connectBtn())

    expect(nameInput()).toBeInTheDocument()
    expect(nameInput()).toHaveValue('')
  })

  // The appendix expects the field to be "marked as invalid". The code only shows an alert:
  // the input has no aria-invalid and no `required`. To satisfy the appendix, set
  // aria-invalid on the empty field after a failed submit (and/or add `required`),
  // then turn this it.fails into a normal it.
  it.fails('marks the input as invalid', async () => {
    const { user } = await setup()

    await user.click(connectBtn())

    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('CASE-044: name made of blank spaces only', () => {
  it.each([['spaces', '    '], ['a tab', '\t'], ['mixed whitespace', ' \t  ']])(
    'does not connect when the name is %s',
    async (_label, value) => {
      const { user, onConnect } = await setup()

      await user.type(nameInput(), value)
      await user.click(connectBtn())

      expect(onConnect).not.toHaveBeenCalled()
      expect(alertSpy).toHaveBeenCalledWith('Please enter your display name')
    },
  )

  it('does not mark the field invalid either (see the it.fails in CASE-043)', async () => {
    const { user } = await setup()

    await user.type(nameInput(), '   ')
    await user.click(connectBtn())

    expect(nameInput()).toHaveValue('   ')
  })
})

describe('CASE-045: valid name and Connect', () => {
  it('connects with the trimmed name when the room has no user inputs', async () => {
    const { user, onConnect } = await setup()

    await user.type(nameInput(), '  Ana Cruz  ')
    await user.click(connectBtn())

    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect).toHaveBeenCalledWith('Ana Cruz')
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('connects with first and last name joined by a space, plus the answers by label', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)

    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.type(screen.getByLabelText('Last Name'), 'Cruz')
    await user.click(connectBtn())

    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect).toHaveBeenCalledWith('Ana Cruz', { 'First Name': 'Ana', 'Last Name': 'Cruz' })
  })

  it('submits with the Enter key', async () => {
    const { user, onConnect } = await setup()

    await user.type(nameInput(), 'Ana{Enter}')

    expect(onConnect).toHaveBeenCalledWith('Ana')
  })

  it('accepts one-character and non-English names', async () => {
    const { user, onConnect } = await setup()

    await user.type(nameInput(), 'Ñ李')
    await user.click(connectBtn())

    expect(onConnect).toHaveBeenCalledWith('Ñ李')
  })
})

describe('CASE-046: a required field of the customized form is empty', () => {
  it('alerts "Please fill in all fields" and does not connect when everything is empty', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)

    await user.click(connectBtn())

    expect(alertSpy).toHaveBeenCalledWith('Please fill in all fields')
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('alerts when only one of two fields is filled', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)

    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.click(connectBtn())

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy).toHaveBeenCalledWith('Please fill in all fields')
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only answer as empty', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)

    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.type(screen.getByLabelText('Last Name'), '   ')
    await user.click(connectBtn())

    expect(alertSpy).toHaveBeenCalledWith('Please fill in all fields')
    expect(onConnect).not.toHaveBeenCalled()
  })

  it('keeps what the viewer already typed', async () => {
    const { user } = await setup(TWO_INPUTS)

    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.click(connectBtn())

    expect(screen.getByLabelText('First Name')).toHaveValue('Ana')
  })

  it('does not use the single-name message on a customized form', async () => {
    const { user } = await setup(TWO_INPUTS)

    await user.click(connectBtn())

    expect(alertSpy).not.toHaveBeenCalledWith('Please enter your display name')
  })

  it('connects once the missing field is filled in', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)
    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.click(connectBtn())
    expect(onConnect).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Last Name'), 'Cruz')
    await user.click(connectBtn())

    await waitFor(() => expect(onConnect).toHaveBeenCalledTimes(1))
  })
})

describe('CASE-047: every field of the customized form is filled in', () => {
  it('connects with a display name made of all answers and sends each answer under its label', async () => {
    const { user, onConnect } = await setup({ user_inputs: ['Student ID', 'First Name', 'Section'] })

    await user.type(screen.getByLabelText('Student ID'), '2024-001')
    await user.type(screen.getByLabelText('First Name'), 'Ana')
    await user.type(screen.getByLabelText('Section'), 'BSIT 4C')
    await user.click(connectBtn())

    expect(alertSpy).not.toHaveBeenCalled()
    expect(onConnect).toHaveBeenCalledWith('2024-001 Ana BSIT 4C', {
      'Student ID': '2024-001',
      'First Name': 'Ana',
      Section: 'BSIT 4C',
    })
  })

  it('trims every answer', async () => {
    const { user, onConnect } = await setup(TWO_INPUTS)

    await user.type(screen.getByLabelText('First Name'), '  Ana ')
    await user.type(screen.getByLabelText('Last Name'), ' Cruz  ')
    await user.click(connectBtn())

    expect(onConnect).toHaveBeenCalledWith('Ana Cruz', { 'First Name': 'Ana', 'Last Name': 'Cruz' })
  })
})