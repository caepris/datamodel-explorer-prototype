import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DataModelProvider } from './state/DataModelContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataModelProvider>
      <App />
    </DataModelProvider>
  </StrictMode>,
)
