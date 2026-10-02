import Link from 'next/link'

export function wikiHref(version, slug = '') {
  return slug ? `/wiki/${version}/${slug}` : `/wiki/${version}`
}

/** Link pra outra página da MESMA versão da wiki. */
export function WikiLink({ version, to, children }) {
  return (
    <Link
      href={wikiHref(version, to)}
      className="font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  )
}
