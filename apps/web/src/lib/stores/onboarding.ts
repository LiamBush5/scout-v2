'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  currentStep: number
  formData: {
    role?: 'engineer' | 'devops' | 'product' | 'other'
    companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'
  }
  integrations: {
    github: boolean
    slack: boolean
    datadog: boolean
  }
  selectedRepos: string[]
  slackChannel?: string

  // Actions
  setFormData: (data: Partial<OnboardingState['formData']>) => void
  setIntegration: (provider: 'github' | 'slack' | 'datadog', connected: boolean) => void
  setSelectedRepos: (repos: string[]) => void
  setSlackChannel: (channel: string) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      formData: {},
      integrations: {
        github: false,
        slack: false,
        datadog: false,
      },
      selectedRepos: [],
      slackChannel: undefined,

      setFormData: (data) =>
        set({ formData: { ...get().formData, ...data } }),

      setIntegration: (provider, connected) =>
        set({
          integrations: { ...get().integrations, [provider]: connected },
        }),

      setSelectedRepos: (repos) => set({ selectedRepos: repos }),

      setSlackChannel: (channel) => set({ slackChannel: channel }),

      nextStep: () => set({ currentStep: get().currentStep + 1 }),

      prevStep: () => set({ currentStep: Math.max(0, get().currentStep - 1) }),

      reset: () =>
        set({
          currentStep: 0,
          formData: {},
          integrations: { github: false, slack: false, datadog: false },
          selectedRepos: [],
          slackChannel: undefined,
        }),
    }),
    {
      name: 'sre-agent-onboarding',
      partialize: (state) => ({
        currentStep: state.currentStep,
        formData: state.formData,
        integrations: state.integrations,
        selectedRepos: state.selectedRepos,
        slackChannel: state.slackChannel,
      }),
    }
  )
)
