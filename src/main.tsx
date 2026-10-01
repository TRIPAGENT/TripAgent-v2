import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { Splash } from '@/components/Splash'
import { ChatRuntimeProvider } from '@/context/chatRuntime'
import { StoreProvider } from '@/context/store'
import { registerPwa } from '@/lib/pwa'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ChatRuntimeProvider>
      <BrowserRouter>
        <Splash />
        <App />
      </BrowserRouter>
      </ChatRuntimeProvider>
    </StoreProvider>
  </StrictMode>,
)

// The link is the product until there is an app store listing: install it,
// keep it current, and let it open offline.
registerPwa()
