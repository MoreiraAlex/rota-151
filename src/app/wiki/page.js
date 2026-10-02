import { redirect } from 'next/navigation'
import { LATEST_WIKI_VERSION } from '@/tools/wiki/versions'

/** `/wiki` abre a versão mais nova da wiki. */
export default function WikiIndexPage() {
  redirect(`/wiki/${LATEST_WIKI_VERSION.id}`)
}
