import { AppLayout } from '@/components/layout/AppLayout'

interface Props { params: Promise<{ chatId: string }> }

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params
  return <AppLayout initialChatId={chatId} />
}
