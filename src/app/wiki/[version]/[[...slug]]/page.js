import { notFound } from 'next/navigation'
import { Article } from '@/tools/wiki/components/Article'
import {
  WIKI_VERSIONS,
  getWikiVersion,
  isLatestWikiVersion,
  resolveWikiData,
} from '@/tools/wiki/versions'
import { WIKI_PAGES } from '@/tools/wiki/versions/pages'

export const dynamicParams = false

export function generateStaticParams() {
  return WIKI_VERSIONS.flatMap((version) =>
    WIKI_PAGES[version.id]
      .listPagePaths(resolveWikiData(version))
      .map((path) => ({
        version: version.id,
        slug: path ? path.split('/') : [],
      })),
  )
}

function resolve(params) {
  const version = getWikiVersion(params.version)
  if (!version) return null
  const data = resolveWikiData(version)
  const page = WIKI_PAGES[version.id].resolvePage(params.slug ?? [], data)
  return page ? { version, data, page } : null
}

export function generateMetadata({ params }) {
  const resolved = resolve(params)
  if (!resolved) return {}
  const { page, version } = resolved
  return {
    title: `${page.title} (${version.id})`,
    description: page.summary,
  }
}

export default function WikiPage({ params }) {
  const resolved = resolve(params)
  if (!resolved) notFound()

  const { version, data, page } = resolved
  const { Component } = page

  return (
    <Article title={page.title} lead={page.summary}>
      <Component
        data={data}
        version={version.id}
        id={page.id}
        isLatest={isLatestWikiVersion(version)}
      />
    </Article>
  )
}
