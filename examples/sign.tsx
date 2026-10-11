import { Button } from "@/registry/0nlytype/ui/button"
import { SignSearchDots } from "@/registry/0nlytype/signs/sign-search-dots"
import { SignSearchWords } from "@/registry/0nlytype/signs/sign-search-words"
import { SignSearchFill } from "@/registry/0nlytype/signs/sign-search-fill"
import { SignHomeDots } from "@/registry/0nlytype/signs/sign-home-dots"
import { SignMailDots } from "@/registry/0nlytype/signs/sign-mail-dots"
import { SignArrowRightDots } from "@/registry/0nlytype/signs/sign-arrow-right-dots"
import { SignMailFill } from "@/registry/0nlytype/signs/sign-mail-fill"
import { SignCloseDots } from "@/registry/0nlytype/signs/sign-close-dots"
import { State } from "@/components/site/state"

export default function Example() {
  return (
    <div className="grid justify-items-center gap-16">
      <div className="grid grid-cols-[minmax(0,1fr)] justify-items-center gap-x-20 gap-y-14 sm:grid-cols-3">
        <figure className="grid justify-items-center gap-6">
          <SignSearchDots size={168} />
          <figcaption className="ot-label">Dots</figcaption>
        </figure>
        <figure className="grid justify-items-center gap-6">
          <SignSearchWords size={168} />
          <figcaption className="ot-label">Words</figcaption>
        </figure>
        <figure className="grid justify-items-center gap-6">
          <SignSearchFill size={168} />
          <figcaption className="ot-label">Fill</figcaption>
        </figure>
      </div>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
        <Button variant="quiet" className="gap-2.5"><SignHomeDots label="" />Home</Button>
        <Button variant="quiet" className="gap-2.5"><SignMailDots face="italic" label="" />Your mail</Button>
        <Button variant="quiet" className="gap-2.5">Next<SignArrowRightDots label="" /></Button>
      </div>
    </div>
  )
}

export function States() {
  return (
    <>
      <State label="Dots"><SignSearchDots size={48} /></State>
      <State label="Dots, said"><SignSearchDots size={48} data-force="hover" /></State>
      <State label="Words"><SignSearchWords size={48} /></State>
      <State label="Words, said"><SignSearchWords size={48} data-force="hover" /></State>
      <State label="Fill"><SignSearchFill size={48} /></State>
      <State label="Fill, said"><SignSearchFill size={48} data-force="hover" /></State>
      <State label="Italic"><SignMailFill size={48} face="italic" /></State>
      <State label="Italic, said"><SignMailFill size={48} face="italic" data-force="hover" /></State>
      <State label="At 24"><SignCloseDots size={24} /></State>
      <State label="At 24, said"><SignCloseDots size={24} data-force="hover" /></State>
    </>
  )
}
