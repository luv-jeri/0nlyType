"use client"

import * as React from "react"

import { roll } from "@/registry/0nlytype/lib/roll"
import { cn } from "@/registry/0nlytype/lib/utils"
import { Attachment, AttachmentList } from "@/registry/0nlytype/ui/attachment"

type DropzoneProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** The file input's accept: ".pdf,image/*". A file that doesn't match is refused and says why. */
  accept?: string
  /** Largest file, in bytes. */
  maxSize?: number
  multiple?: boolean
  disabled?: boolean
  /** Submits the files with a form: the real input holds exactly what's listed. */
  name?: string
  /** The words that start the sentence, before ", or choose". */
  prompt?: string
  /** What it takes, in pencil under the words: "PDF or PNG, up to 10 MB each." */
  hint?: React.ReactNode
  /** Files held from the start, such as a draft's. */
  defaultFiles?: File[]
  /** Called with every file held, after each drop, choice, removal or form reset. */
  onFilesChange?: (files: File[]) => void
  /** Lists the files held as attachment rows (the default). Turn it off to list them yourself, with their progress. */
  list?: boolean
  /** corners: the corner marks close in as files come over. ghost: the number of files you carry stands huge and faint behind the words. */
  variant?: "corners" | "ghost"
  /** Pins a state for documentation ("hover", "focus", "over"); set on the root. */
  "data-force"?: string
}

type Refused = { file: File; why: string }

const megabytes = (n: number) =>
  n < 1e3 ? `${n} B` : new Intl.NumberFormat("en", { style: "unit", unit: n < 1e6 ? "kilobyte" : "megabyte", maximumFractionDigits: 1 }).format(n < 1e6 ? n / 1e3 : n / 1e6)

/** Whether a file matches the input's accept list: extensions, exact types and type/* families. */
function accepts(file: File, accept?: string) {
  if (!accept?.trim()) return true
  return accept.split(",").some((rule) => {
    const r = rule.trim().toLowerCase()
    if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r)
    if (r.endsWith("/*")) return file.type.toLowerCase().startsWith(r.slice(0, -1))
    return file.type.toLowerCase() === r
  })
}

/** "PDF or PNG" from ".pdf,.png"; "image files" from "image/*". */
const kinds = (accept: string) => {
  const names = accept.split(",").map((r) => r.trim()).map((r) => (r.startsWith(".") ? r.slice(1).toUpperCase() : r.endsWith("/*") ? `${r.slice(0, -2)} files` : r))
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : names[0]
}

/**
 * Files, dropped or chosen. The area is only its corner marks; files carried over it close them in. The sentence
 * "Drop files here, or choose" is a real file input: Tab reaches it and Enter or Space opens the picker. What's held
 * is listed as attachments; a refused file says what to fix.
 */
function Dropzone({
  accept,
  maxSize,
  multiple = true,
  disabled,
  name,
  prompt = "Drop files here",
  hint,
  defaultFiles,
  onFilesChange,
  list = true,
  variant = "corners",
  className,
  "data-force": force,
  ...props
}: DropzoneProps) {
  const input = React.useRef<HTMLInputElement>(null)
  const ghost = React.useRef<HTMLSpanElement>(null)
  const depth = React.useRef(0)
  const id = React.useId()
  const [files, setFiles] = React.useState<File[]>(defaultFiles ?? [])
  const [refused, setRefused] = React.useState<Refused[]>([])
  const [carried, setCarried] = React.useState(0) // files over the area right now; 0 when none
  const [focused, setFocused] = React.useState(false)

  /** Keeps the real input holding exactly the listed files, so a form sends what you see. */
  const hold = React.useCallback((next: File[]) => {
    setFiles(next)
    onFilesChange?.(next)
    if (input.current && typeof DataTransfer !== "undefined") {
      const t = new DataTransfer()
      next.forEach((f) => t.items.add(f))
      input.current.files = t.files
    }
  }, [onFilesChange])

  // The real input starts out holding what's listed, too.
  React.useEffect(() => {
    if (defaultFiles?.length && input.current && typeof DataTransfer !== "undefined") {
      const t = new DataTransfer()
      defaultFiles.forEach((f) => t.items.add(f))
      input.current.files = t.files
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only the first files

  // Resetting the form empties what's listed as well as the real input.
  React.useEffect(() => {
    const form = input.current?.form
    if (!form) return
    const reset = () => {
      hold([])
      setRefused([])
      depth.current = 0
      setCarried(0)
    }
    form.addEventListener("reset", reset)
    return () => form.removeEventListener("reset", reset)
  }, [hold])

  const take = (incoming: File[]) => {
    const ok: File[] = []
    const no: Refused[] = []
    for (const file of multiple ? incoming : incoming.slice(0, 1)) {
      if (!accepts(file, accept)) no.push({ file, why: `This takes ${kinds(accept!)}. Choose another file.` })
      else if (maxSize !== undefined && file.size > maxSize) no.push({ file, why: `Choose one under ${megabytes(maxSize)}; this is ${megabytes(file.size)}.` })
      else ok.push(file)
    }
    const same = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified
    hold(multiple ? [...files.filter((f) => !ok.some((o) => same(o, f))), ...ok] : ok.length ? ok : files)
    setRefused(no)
  }

  // ghost: the count turns over as files arrive over the area, up as they come and down as they go.
  const shown = carried || files.length
  const [count, setCount] = React.useState(shown)
  const was = React.useRef(shown)
  React.useEffect(() => {
    const before = was.current
    was.current = shown
    if (before === shown || !ghost.current || variant !== "ghost") return setCount(shown)
    roll(ghost.current, () => setCount(shown), "0.2em", shown < before ? -1 : 1)
  }, [shown, variant])

  const over = carried > 0
  return (
    <div
      data-slot="dropzone"
      data-variant={variant}
      data-over={over ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-force={force}
      className={cn("ot-drop", className)}
      {...props}
    >
      <label
        className="ot-drop-zone ot-corners"
        onDragEnter={(e) => {
          if (disabled || !e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          depth.current++
          setCarried(e.dataTransfer.items.length || 1)
        }}
        onDragOver={(e) => {
          if (disabled || !e.dataTransfer.types.includes("Files")) return
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDragLeave={() => {
          if (--depth.current <= 0) {
            depth.current = 0
            setCarried(0)
          }
        }}
        onDrop={(e) => {
          if (disabled) return
          e.preventDefault()
          depth.current = 0
          setCarried(0)
          take(Array.from(e.dataTransfer.files))
        }}
      >
        <input
          ref={input}
          type="file"
          className="ot-sr"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          name={name}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onFocus={(e) => setFocused(e.currentTarget.matches(":focus-visible"))}
          onBlur={() => setFocused(false)}
          onChange={(e) => take(Array.from(e.currentTarget.files ?? []))}
        />
        {variant === "ghost" ? (
          <span ref={ghost} className="ot-drop-ghost" aria-hidden="true" data-none={count === 0 ? "" : undefined}>
            {String(count).padStart(2, "0")}
          </span>
        ) : null}
        <span className="ot-drop-words">
          {prompt}, or{" "}
          <span className="ot-link" data-state={focused || force?.includes("focus") ? "open" : undefined}>
            choose
          </span>
        </span>
        {hint ? (
          <span id={`${id}-hint`} className="ot-drop-hint">
            {hint}
          </span>
        ) : null}
      </label>
      {list && (files.length || refused.length) ? (
        <AttachmentList className="ot-drop-list" aria-live="polite">
          {files.map((f) => (
            <Attachment key={`${f.name}${f.size}${f.lastModified}`} name={f.name} size={megabytes(f.size)} state="idle" onRemove={() => hold(files.filter((x) => x !== f))} />
          ))}
          {refused.map((r) => (
            <Attachment
              key={`no${r.file.name}${r.file.size}`}
              name={r.file.name}
              status={r.why}
              state="error"
              onRemove={() => setRefused((all) => all.filter((x) => x !== r))}
            />
          ))}
        </AttachmentList>
      ) : null}
    </div>
  )
}

export { Dropzone, type DropzoneProps }
