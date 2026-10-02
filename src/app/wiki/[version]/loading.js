import { PageSkeleton } from '@/tools/wiki/components/PageSkeleton'

/** Placeholder do Next enquanto a página da wiki carrega (usado em produção). */
export default function WikiLoading() {
  return <PageSkeleton />
}
