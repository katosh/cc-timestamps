import type { Register } from 'claude-code'

// Rows carry no time of their own, so a row is stamped when it is first drawn.
// Only rows first drawn while a turn is live get one: after a reload or a
// resume the older rows redraw, and stamping them then would be a lie.
const GRACE_MS = 3000

// Where the stamp goes. The engine lays out tables and code against the
// transcript's full width, so anything drawn beside a row makes those lines wrap.
// - `spacer` (default): painted into the blank line the engine puts above each
//   row. Costs no width and no height. The expanded view (ctrl+o, --verbose)
//   draws some rows without that blank line, so there it falls back to `line`.
// - `line`: a dim line of its own above the row. Costs one line per row.
// - `gutter`: the original 16 column left column. Wraps wide tables.
export type Layout = 'spacer' | 'line' | 'gutter'
const LAYOUTS: Layout[] = ['spacer', 'line', 'gutter']
const GUTTER = 16

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

// What a row says about the view it is drawn in: true for the expanded view,
// false for the normal one, undefined when the row does not tell. A composer
// prompt is the reliable witness among user rows (another agent's message can
// be expanded in the normal view); tool rows and the turn's closing line say it.
export const viewOf = (component: string, props: any): boolean | undefined => {
  if (component === 'UserMessage') return props?.origin?.kind === 'composer' ? props.isExpanded : undefined
  if (component === 'ToolUse' || component === 'TurnDuration') return props?.isExpanded
  return undefined
}

export const register: Register = (on, options) => {
  const layout: Layout = LAYOUTS.includes(options?.layout as Layout) ? (options.layout as Layout) : 'spacer'
  const stamps = new Map<string, number>()
  const times: number[] = []
  let liveUntil = 0
  let expanded = false

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

  on(
    'ui.render',
    { component: ['UserMessage', 'AssistantMessage', 'ToolUse', 'TurnDuration'] },
    async ($, e, next) => {
      const own = await next(e)

      // Follow the view, and redraw every row when it changes, so no row keeps a
      // placement chosen for the other view, whichever row reports it first.
      const view = viewOf(e.component, e.props)
      if (view !== undefined && view !== expanded) {
        expanded = view
        if (layout === 'spacer') $.ui.invalidate('ui.render')
      }

      if (e.component === 'TurnDuration') return own
      // The composer's pending row is drawn under a placeholder id just before
      // the real prompt row; stamping it too gave the first prompt a false +0s.
      if (e.requestId === 'placeholder') return own

      const at = stamp(`${e.component}:${e.requestId}`, await $.clock.now())
      if (at === undefined) return own

      const before = times.filter(t => t < at)
      const previous = before.length ? Math.max(...before) : undefined
      const label = previous === undefined ? clock(at) : `${clock(at)} ${elapsed(at - previous)}`

      const { Box, Text } = $.ui.resolve(e)
      const here = layout === 'spacer' && expanded ? 'line' : layout

      if (here === 'spacer') {
        // Drawn after the row so it paints over the row's first line, its blank spacer.
        return (
          <Box flexDirection="column">
            {own}
            <Box position="absolute" top={0} left={0}>
              <Text dimColor>{label}</Text>
            </Box>
          </Box>
        )
      }
      if (here === 'line') {
        return (
          <Box flexDirection="column">
            <Text dimColor>{label}</Text>
            {own}
          </Box>
        )
      }
      return (
        <Box flexDirection="row">
          <Box width={GUTTER} flexShrink={0}>
            <Text dimColor>{label}</Text>
          </Box>
          <Box flexGrow={1} flexDirection="column">
            {own}
          </Box>
        </Box>
      )
    },
  )
}
