# 0nlyType: command

Extracted from DESIGN.md.

### ot-command (command)
- Underneath: cmdk; `CommandDialog` puts it in a Radix Dialog.
- Anatomy: `.ot-command[data-variant="headline | mesostic | index"]` holding `<input class="ot-command-input" role="combobox">`, `.ot-command-list` (`role="listbox"`) of `.ot-command-group` headings and `.ot-command-option` rows (`.ot-command-name`, split at the first match into `.ot-command-before` and `.ot-command-key`; `.ot-command-hint`; the arrow drawn after, with empty alt text), then `.ot-command-empty`. `defaultSearch` opens it on a query.
- What you type is set as large as a headline, in italic. Matches are marked with the highlighter; the chosen row steps forward and shows its arrow. Rows arrive in turn as the list changes.
- mesostic: John Cage's mesostics and the printed concordance (key word in context). Every row is set on one vertical axis at the place your words appear: the part before the match set flush against the axis from the left, the match and the rest from the right. The found letters stand on the axis in roman capitals at 600 in ink, with no highlighter, so the query reads straight down through the results; later matches in the same row aren't marked. The query itself is typed on the same axis above them, and the group headings and empty copy start there too. The axis is the middle of the rows less the arrow's column (`space-6`, `space-5` on a phone). Hints stand at the start of the row, as a concordance's locators do; on a phone they drop under the key. Nothing steps forward (that would break the axis): the chosen line inks and its arrow shows. In RTL the columns mirror, so the text before the match sits right of the axis, as it reads.
- index: a book's index, run in. Each group's name hangs in the margin (`7rem`) as the headword, and its rows run on after it as one paragraph at `mp`, sub-entries parted by semicolons and closed with a full stop, hints small after each name as locators. Matches are marked with the highlighter; the chosen entry is underlined with a hairline in ink. Rows that stop matching leave the sentence, which closes up; the entries fade in in turn. Below 40rem the headword sits over its paragraph.
- Keyboard: Down and Up move, Enter runs, in every variant (the index moves along the sentence in reading order). Empty copy names something to try.
- The chosen row is brought into view only while you're in the palette, so mounting one never scrolls the page.
- `CommandDialog`: the ⌘K palette; `variant` and `defaultSearch` pass through. A Radix Dialog holds the command over a dimmed page, with a visually hidden title. The page registers the shortcut; the item doesn't.

## Motion

| Component | Articulation | What moves |
|---|---|---|
| Command (`command`) | Arpeggio | The rows arrive; the chosen one steps forward |
| Mesostic command (`command`) | Ink | The rows arrive on the axis; the chosen line inks and its arrow draws in |
| Index command (`command`) | Arpeggio | The entries fade into the sentence in turn; the chosen one's underline inks |

## Where each move comes from

| Component | Reference | Move |
|---|---|---|
| Combobox, menu, command (`combobox`, `dropdown-menu`, `context-menu`, `command`) | Weingart letter | The highlighter marks what matches |
| Command (`command`) | "the uncreative" | What you type, set as a headline |
| Mesostic command (`command`) | John Cage's mesostics; the printed concordance | Every row set on one axis at its match, your query on the axis above |
| Index command (`command`) | A book's run-in index | Each group a headword with its rows run on as a sentence |
