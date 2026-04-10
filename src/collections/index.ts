export { Users } from './Users'
export { Media } from './Media'

import { Users } from './Users'
import { Media } from './Media'
import { Accounts } from './Accounts'
import { People } from './People'
import { Categories } from './Categories'
import { Tags } from './Tags'
import { Transactions } from './Transactions'
import { Reminders } from './Reminders'
import { UserSettings } from './UserSettings'
import { AIUsages } from './AIUsages'
import { OAuthAccounts } from './OAuthAccounts'
import { TransactionLinks } from './TransactionLinks'
import { Pages } from './Pages'

export const collections = [
  Users,
  Media,
  Pages,
  Accounts,
  People,
  Categories,
  Tags,
  Transactions,
  TransactionLinks,
  Reminders,
  UserSettings,
  AIUsages,
  OAuthAccounts,
]
