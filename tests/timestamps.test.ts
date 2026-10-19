import { expect, mock, test } from 'claude-code/testing'

import { clock, elapsed } from '../hooks/register'

const T0 = new Date(2026, 9, 19, 14, 32, 7).getTime()

const texts = (node: unknown): string[] =>
  typeof node === 'string'
    ? [node]
    : node && typeof node === 'object' && 'children' in node
      ? [(node as any).children].flat().flatMap(texts)
      : []

test('formats clock and elapsed', () => {
  expect(clock(T0)).toBe('14:32:07')
  expect(elapsed(12_000)).toBe('+12s')
  expect(elapsed(185_000)).toBe('+3m05s')
  expect(elapsed(3_720_000)).toBe('+1h02m')
})

test('stamps rows drawn during a turn, with time since the previous', async ($, on) => {
  const time = mock.clock(on, { now: T0 })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.render', ($, e) => ($.ui.resolve(e) as any).Text({ children: 'row' }))

  await $.prompt.submit({ text: 'hi' } as any)
  const first = await $.ui.render({
    surface: 'terminal', component: 'UserMessage', requestId: 'u1',
    props: { text: 'hi', origin: { kind: 'prompt' }, isExpanded: false },
  } as any)
  expect(texts(first).join('')).toContain('14:32:07')

  await time.advance(12_000)
  const second = await $.ui.render({
    surface: 'terminal', component: 'AssistantMessage', requestId: 'a1',
    props: { text: 'hello', isFirstOfReply: true },
  } as any)
  expect(texts(second).join('')).toContain('14:32:19 +12s')

  // a redraw keeps the first stamp
  await time.advance(60_000)
  const again = await $.ui.render({
    surface: 'terminal', component: 'UserMessage', requestId: 'u1',
    props: { text: 'hi', origin: { kind: 'prompt' }, isExpanded: false },
  } as any)
  expect(texts(again).join('')).toContain('14:32:07')
})

test('leaves rows first drawn outside a turn unstamped', async ($, on) => {
  mock.clock(on, { now: T0 })
  on('ui.render', ($, e) => ($.ui.resolve(e) as any).Text({ children: 'row' }))

  const row = await $.ui.render({
    surface: 'terminal', component: 'AssistantMessage', requestId: 'old',
    props: { text: 'from before', isFirstOfReply: true },
  } as any)
  expect(texts(row)).toEqual(['row'])
})
