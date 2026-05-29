import React from 'react'
import type { Preview } from '@storybook/nextjs-vite'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '../src/app/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      test: 'todo'
    }
  },
  decorators: [
    (Story) => (
      <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <Story />
      </div>
    ),
  ],
};

export default preview;