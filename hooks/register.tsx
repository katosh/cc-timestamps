import type { Register } from 'claude-code'

// Rows carry no time of their own, so a row is stamped when it is first drawn.
// Only rows first drawn while a turn is live get one: after a reload or a
// resume the older rows redraw, and stamping them then would be a lie.
const GRACE_MS = 3000

const pad = (n: number) => String(n).padStart(2, '0')

export const clock = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const elapsed = (ms: number) => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `+${s}s`
  if (s < 3600) return `+${Math.floor(s / 60)}m${pad(s % 60)}s`
  return `+${Math.floor(s / 3600)}h${pad(Math.floor((s % 3600) / 60))}m`
}

export const register: Register = on => {
  const stamps = new Map<string, number>()
  const times: number[] = []
  let liveUntil = 0

  const stamp = (id: string, now: number) => {
    const seen = stamps.get(id)
    if (seen !== undefined) return seen
    if (now > liveUntil) return undefined
    stamps.set(id, now)
    times.push(now)
    return now
  }

  on('prompt.submit', ($, e, next) => {
    liveUntil = Infinity
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    liveUntil = (await $.clock.now()) + GRACE_MS
    return next(e)
  })

  on('ui.render', { component: ['UserMessage', 'AssistantMessage', 'ToolUse'] }, async ($, e, next) => {
    const own = await next(e)
    const at = stamp(`${e.component}:${e.requestId}`, await $.clock.now())
    if (at === undefined) return own

    const before = times.filter(t => t < at)
    const previous = before.length ? Math.max(...before) : undefined
    const label = previous === undefined ? clock(at) : `${clock(at)} ${elapsed(at - previous)}`

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row">
        <Box width={16} flexShrink={0}>
          <Text dimColor>{label}</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          {own}
        </Box>
      </Box>
    )
  })
}
