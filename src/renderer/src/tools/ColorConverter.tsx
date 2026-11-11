import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button, IconButton } from '../components/ui/Button'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout, Panel } from '../components/ui/Panel'
import { useCopy } from '../hooks/useCopy'
import { usePersistentState } from '../hooks/usePersistentState'
import {
  parseColor,
  toHex,
  toHslString,
  toOklchString,
  toRgbString
} from '../lib/color'
import { getTool } from './registry'

const SAMPLE = '#7c5cff'

export default function ColorConverter(): ReactElement {
  const tool = getTool('color-converter')!
  const { copy } = useCopy()
  const [input, setInput] = usePersistentState('color-converter:input', SAMPLE)

  const parsed = useMemo(() => parseColor(input), [input])
  const color = parsed.ok ? parsed.color : null

  const outputs = color
    ? [
        { label: 'HEX', value: toHex(color) },
        { label: 'RGB', value: toRgbString(color) },
        { label: 'HSL', value: toHslString(color) },
        { label: 'OKLCH', value: toOklchString(color) }
      ]
    : []

  const pickerValue = color ? toHex({ ...color, a: 1 }) : '#000000'

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="sparkles" size={15} />}
          onClick={() => setInput(SAMPLE)}
        >
          Load example
        </Button>
      }
    >
      <div className="split">
        <Panel
          title="Color value"
          actions={<CopyButton value={color ? toHex(color) : ''} label="Copy HEX" />}
        >
          <div className="stack-sm">
            <div className="color-input-row">
              <input
                className="color-picker-input"
                type="color"
                value={pickerValue}
                onChange={(event) => setInput(event.target.value)}
                aria-label="Pick a color"
              />
              <input
                className={`text-input mono${parsed.ok ? '' : ' is-invalid'}`}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-label="Color value"
                placeholder="#7c5cff, rgb(124 92 255), hsl(252 100% 68%), oklch(0.63 0.23 290)"
                spellCheck={false}
              />
            </div>
            <span className="field-hint">
              Accepts HEX, RGB, HSL, and OKLCH, including alpha in <code>#rrggbbaa</code> or a
              fourth value.
            </span>
            {!parsed.ok && <span className="field-error">{parsed.error}</span>}

            <div className="color-preview" role="img" aria-label={`Color preview for ${input}`}>
              <div
                className="color-preview-fill"
                style={
                  color
                    ? {
                        backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
                      }
                    : undefined
                }
              />
              <span className="color-preview-label">{color ? toHex(color) : 'Invalid color'}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Conversions">
          {color ? (
            <div className="output-list">
              {outputs.map((item) => (
                <div className="output-row" key={item.label}>
                  <div className="output-info">
                    <span className="output-label">{item.label}</span>
                    <code className="output-value">{item.value}</code>
                  </div>
                  <IconButton
                    label={`Copy ${item.label}`}
                    onClick={() => {
                      void copy(item.value, `${item.label} copied`)
                    }}
                  >
                    <Icon name="copy" size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <span className="panel-placeholder">Enter a valid color to see conversions.</span>
          )}
        </Panel>
      </div>

      {parsed.ok && parsed.outOfGamut && (
        <Callout tone="warning" title="Outside the sRGB gamut">
          This OKLCH value is more saturated than sRGB can display. The preview, HEX, and RGB
          outputs are clamped to the nearest displayable color.
        </Callout>
      )}

      <Callout tone="info" title="Color spaces explained">
        HEX, RGB, and HSL describe the same sRGB display values. OKLCH is a perceptual space with
        lightness, chroma, and hue, so equal numeric steps look more even. Alpha is preserved across
        every format.
      </Callout>
    </ToolPage>
  )
}
