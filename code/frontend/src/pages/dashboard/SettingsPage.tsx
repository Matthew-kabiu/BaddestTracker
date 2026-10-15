import { Bell, Bot, Shield, SlidersHorizontal, UserRound } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/kit/tabs'
import { Page } from '@/components/layout/Page'
import { AiKeysCard } from '@/components/settings/AiKeysCard'
import { PasswordCard } from '@/components/settings/PasswordCard'
import { PreferencesCard } from '@/components/settings/PreferencesCard'
import { ProfileCard } from '@/components/settings/ProfileCard'
import { SessionsCard } from '@/components/settings/SessionsCard'
import { TelegramCard } from '@/components/settings/TelegramCard'

const SECTIONS = [
  { value: 'profile', label: 'Profile', icon: UserRound },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'ai', label: 'AI', icon: Bot },
] as const

/** Every account setting, one tab per area. */
export default function SettingsPage() {
  return (
    <Page title="Settings" description="Manage your account, security and preferences.">
      <Tabs defaultValue="profile" className="gap-6">
        <TabsList variant="line" className="h-auto! w-full! max-w-full flex-wrap justify-start gap-2 border-b border-line pb-3">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex-none px-4 py-2.5">
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile" className="flex flex-col gap-6">
          <ProfileCard />
        </TabsContent>
        <TabsContent value="security" className="flex flex-col gap-6">
          <PasswordCard />
          <SessionsCard />
        </TabsContent>
        <TabsContent value="preferences" className="flex flex-col gap-6">
          <PreferencesCard />
        </TabsContent>
        <TabsContent value="notifications" className="flex flex-col gap-6">
          <TelegramCard />
        </TabsContent>
        <TabsContent value="ai" className="flex flex-col gap-6">
          <AiKeysCard />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
