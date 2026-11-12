import type { ReactElement } from 'react'
import { Icon } from '../../icons'
import { canSaveToHistory, saveToHistory, useHistory } from '../../lib/history'
import { Button } from './Button'
import { useToast } from './Toast'

interface SaveToHistoryProps {
  toolId: string
  label: string
  value: string
  disabled?: boolean
}

export function SaveToHistory({
  toolId,
  label,
  value,
  disabled = false
}: SaveToHistoryProps): ReactElement | null {
  const history = useHistory()
  const toast = useToast()

  if (!canSaveToHistory(toolId)) return null

  const saved = history.some((entry) => entry.toolId === toolId && entry.value === value)

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={disabled || !value}
      icon={<Icon name={saved ? 'check' : 'bookmark'} size={14} />}
      title="Save this output to the working set"
      onClick={() => {
        const ok = saveToHistory(toolId, label, value)
        toast.show(ok ? 'Saved to the working set.' : 'This output cannot be saved.', ok ? 'success' : 'error')
      }}
    >
      {saved ? 'Saved' : 'Save'}
    </Button>
  )
}
