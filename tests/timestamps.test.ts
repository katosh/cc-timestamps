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

const assistant = (id: string, text = 'hello') => ({
  surface: 'terminal', component: 'AssistantMessage', requestId: id,
  props: { text, isFirstOfReply: true },
}) as any

const prompt = (id: string, isExpanded = false) => ({
  surface: 'terminal', component: 'UserMessage', requestId: id,
  props: { text: 'hi', origin: { kind: 'composer' }, isExpanded },
}) as any

const live = async ($: any, on: any) => {
  mock.clock(on, { now: T0 })
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }))
  on('ui.render', ($: any, e: any) => ($.ui.resolve(e) as any).Text({ children: 'row' }))
  await $.prompt.submit({ text: 'hi' } as any)
}

test('spacer layout (default) paints the stamp over the row, full width, no extra line', async ($, on) => {
  await live($, on)
  const json = JSON.stringify(await $.ui.render(assistant('a1', '| a | b |')))
  expect(json).toContain('"position":"absolute"')
  expect(json).not.toContain('"width":16')
  expect(json.indexOf('row')).toBeLessThan(json.indexOf('14:32:07'))
})

test('spacer layout falls back to its own line in the expanded view', async ($, on) => {
  await live($, on)
  await $.ui.render(prompt('u1', true))
  const row = await $.ui.render(assistant('a1'))
  const json = JSON.stringify(row)
  expect(json).not.toContain('"position":"absolute"')
  expect(texts(row)[1]).toBe('row')

  // back in the normal view the spacer placement returns
  await $.ui.render(prompt('u1', false))
  expect(JSON.stringify(await $.ui.render(assistant('a1')))).toContain('"position":"absolute"')
})

test('the composer placeholder row is not stamped', async ($, on) => {
  await live($, on)
  expect(texts(await $.ui.render(prompt('placeholder')))).toEqual(['row'])
  expect(texts(await $.ui.render(prompt('u1')))).toContain('14:32:07')
})

test('line layout puts the stamp on its own line above the row', { options: { layout: 'line' } }, async ($, on) => {
  await live($, on)
  const row = await $.ui.render(assistant('a1'))
  expect(JSON.stringify(row)).not.toContain('"position":"absolute"')
  expect(texts(row)).toEqual(['14:32:07', 'row'])
})

test('gutter layout keeps the old left column', { options: { layout: 'gutter' } }, async ($, on) => {
  await live($, on)
  const row = await $.ui.render(assistant('a1'))
  expect(JSON.stringify(row)).toContain('"width":16')
  expect(texts(row)).toEqual(['14:32:07', 'row'])
})
