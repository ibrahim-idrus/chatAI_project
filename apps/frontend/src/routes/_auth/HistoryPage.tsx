import { createFileRoute } from '@tanstack/react-router'
import { HistoryPage } from '../../pages/HistoryPage'

export const Route = createFileRoute('/_auth/HistoryPage')({
  component: HistoryPage,
})
