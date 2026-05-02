import { callAction } from './api'

export type SeedResult = {
  organizationId: string
  groupChatIds: string[]
  memberIds: string[]
  rowsCreated: number
}

export async function seedDemoData(reset = false): Promise<SeedResult> {
  return callAction<{ orgName: string; reset: boolean }, SeedResult>('seedDemoData', {
    orgName: 'Acme Inc.',
    reset,
  })
}
