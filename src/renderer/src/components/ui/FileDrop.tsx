import { useRef, useState, type DragEvent, type ReactElement, type ReactNode } from 'react'
import { formatBytes } from '../../lib/format'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export interface FileDropApi {
  open: () => void
}

interface FileDropProps {
  accept: string
  onText?: (text: string, file: File) => void
  onFile?: (file: File) => void
  onError: (message: string) => void
  children: (api: FileDropApi) => ReactNode
  maxBytes?: number
}

export function FileDrop({
  accept,
  onText,
  onFile,
  onError,
  children,
  maxBytes = MAX_FILE_BYTES
}: FileDropProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const readFile = async (file: File): Promise<void> => {
    if (file.size > maxBytes) {
      onError(`${file.name} is too large. Files must be ${formatBytes(maxBytes)} or smaller.`)
      return
    }

    if (onFile) {
      onFile(file)
      return
    }

    if (!onText) return

    try {
      onText(await file.text(), file)
    } catch {
      onError(`Could not read ${file.name}.`)
    }
  }

  const hasFiles = (event: DragEvent<HTMLDivElement>): boolean =>
    Array.from(event.dataTransfer.types).includes('Files')

  const handleDragEnter = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) void readFile(file)
  }

  return (
    <div
      className={`file-drop${dragging ? ' is-dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        aria-label="Choose a file to load"
        className="file-input-hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void readFile(file)
        }}
      />
      {children({ open: () => inputRef.current?.click() })}
      {dragging && (
        <div className="file-drop-overlay" aria-hidden="true">
          <span className="file-drop-badge">Drop to load file</span>
        </div>
      )}
    </div>
  )
}
