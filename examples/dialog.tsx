import { Button } from "@/registry/0nlytype/ui/button"
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogMeta,
  DialogTitle,
  DialogTrigger,
} from "@/registry/0nlytype/ui/dialog"
import { State } from "@/components/site/state"

function Frame() {
  return (
    <>
      <DialogMeta>
        <span>Delete a note</span>
        <hr />
        <span>14 attachments</span>
      </DialogMeta>
      <DialogTitle>
        Delete <span className="ot-yours">Spring notes</span>?
      </DialogTitle>
      <DialogDescription>The notes and their 14 attachments go for good. This can&apos;t be undone.</DialogDescription>
      <DialogActions>
        <DialogClose asChild>
          <Button variant="bracket" data-autofocus>Keep it</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button variant="statement">Delete</Button>
        </DialogClose>
      </DialogActions>
    </>
  )
}

// Under reply the answers are bare DialogClose buttons: the dialog sets them in the italic.
function Reply() {
  return (
    <>
      <DialogMeta>
        <span>Unsaved changes</span>
        <hr />
        <span>3 edits</span>
      </DialogMeta>
      <DialogTitle>
        Discard your changes to <span className="ot-yours">Halden</span>?
      </DialogTitle>
      <DialogDescription>Your last three edits haven&apos;t been saved. Discarded, they can&apos;t be brought back.</DialogDescription>
      <DialogActions>
        <DialogClose data-autofocus>Keep editing</DialogClose>
        <DialogClose>Discard</DialogClose>
      </DialogActions>
    </>
  )
}

function Ruled() {
  return (
    <>
      <DialogMeta>
        <span>Archive a note</span>
        <hr />
        <span>Last opened 12 September</span>
      </DialogMeta>
      <DialogTitle>
        Archive <span className="ot-yours">Spring notes</span>?
      </DialogTitle>
      <DialogDescription>It leaves your notes and waits in the archive. Bring it back whenever you like.</DialogDescription>
      <DialogActions>
        <DialogClose asChild>
          <Button variant="bracket" data-autofocus>Keep it</Button>
        </DialogClose>
        <DialogClose asChild>
          <Button variant="statement">Archive</Button>
        </DialogClose>
      </DialogActions>
    </>
  )
}

const variants = [
  { variant: "frame", open: "Delete Spring notes", Body: Frame, alert: true },
  { variant: "reply", open: "Discard changes", Body: Reply, alert: true },
  { variant: "ruled", open: "Archive Spring notes", Body: Ruled, alert: false },
] as const

export default function Example() {
  return (
    <div className="grid justify-items-start gap-x-10 gap-y-7 sm:grid-cols-3">
      {variants.map(({ variant, open, Body, alert }) => (
        <div key={variant} className="grid justify-items-start gap-4">
          <span className="ot-label">{variant}</span>
          <Dialog alert={alert}>
            <DialogTrigger asChild>
              <Button variant="bracket">{open}</Button>
            </DialogTrigger>
            <DialogContent variant={variant}>
              <Body />
            </DialogContent>
          </Dialog>
        </div>
      ))}
    </div>
  )
}

// Pinned open in place: a plain, non-modal <dialog open>, so the row can show each surface without a click.
export function States() {
  return (
    <>
      {variants.map(({ variant, Body }) => (
        <State key={variant} label={`${variant}, open`}>
          <Dialog>
            <dialog open className="ot-dialog" data-variant={variant === "frame" ? undefined : variant} style={{ position: "static", maxWidth: "100%" }}>
              <Body />
            </dialog>
          </Dialog>
        </State>
      ))}
    </>
  )
}
