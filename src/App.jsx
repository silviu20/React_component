import { useState } from 'react'
import './App.css'
import BayBEDashboard from '@/components/BayBEDashboard'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <BayBEDashboard />
      </div>
    </div>
  )
}

export default App