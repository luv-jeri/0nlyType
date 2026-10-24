# 0nlyType: dropzone

Extracted from DESIGN.md.

### ot-drop (dropzone)
- Underneath: a native file input, plus a hook.
- Anatomy: `<div class="ot-drop" data-variant="corners | ghost">` holding `<label class="ot-drop-zone ot-corners">` (the file input as `.ot-sr`, for ghost `.ot-drop-ghost` (`aria-hidden`), `.ot-drop-words` ending in `.ot-link` "choose", then an optional `.ot-drop-hint` that describes the input), then an `ot-attachments` list of what's held. `data-over` while files are carried over it, `data-disabled`.
- An area defined only by its corner marks (`ot-corners`, `--ot-corner` at `--ot-space-4`), after "the silence that heals": a frame that doesn't close. The sentence is the control: "Drop files here, or choose". The whole area is the input's label, so a click anywhere opens the picker; Tab reaches the real input, and focus draws the highlighter through "choose" (the link's own look) and sets the corners in the accent.
- Pointing sketches the corners in pencil. Carry files over it and the corners close in by `--ot-space-4` and ink, landing with spiccato, and the words ink; let go or leave and they spring back out. The corners' colour is a registered `--ot-drop-c`, so it crosses over rather than jumps.
- What's held is listed as attachment rows, each waiting (`idle`, the hairline ring of a file still to go) with its size and a bracket Remove. Each drop or choice adds to them, and the same file isn't held twice. A refused file is a crimson row that says what to fix: "This takes PDF, PNG or SVG. Choose another file." or "Choose one under 10 MB; this is 14.2 MB." The real input always holds exactly what's listed (through a `DataTransfer`), so a form sends what you see. Resetting the form clears the files and refused rows, and calls `onFilesChange` with no files, as removing the last file does. `list={false}` leaves the listing to you, for rows with upload progress.
- Ghost: after the huge ghost numerals behind "the silence that heals". The number of files you carry stands huge and faint behind the words (`--ot-fff` in the expression italic, ink at 8%, 14% while over), set against the area's foot and end and cropped by them, two figures as the poster's 14 and 08. Dropped, it stays as the number held. It turns over as the count moves, up as files come and down as they go.
- States: rest, hover, focus, files over it, holding, refused (the row), disabled (the corners at the rule, the words in pencil). Forced colours: the corners are `GrayText`, `Highlight` on focus, `CanvasText` while over; the ghost is dropped.
- Keyboard: Tab to the input; Enter or Space opens the picker (native). Remove is a button.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Dropzone (`dropzone`) | Close in | Files carried over close the corners in and ink them, landing with spiccato |
| Ghost dropzone (`dropzone`) | Count | The ghost number turns over as files come and go |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Dropzone (`dropzone`) | "the silence that heals" corners | The area is only its corner marks; files carried over close them in |
| Ghost dropzone (`dropzone`) | "the silence that heals" ghost numerals | The number of files carried stands huge and faint behind the words |
