'use client'

import { useEffect, useState } from 'react'
import { HomeHeader } from '@/components/features/home/HomeHeader'
import { QuickNav } from '@/components/features/home/QuickNav'
import { EnergyPicker } from '@/components/features/energy/EnergyPicker'
import { EnergyGraph } from '@/components/features/energy/EnergyGraph'
import { QuestionOfDay } from '@/components/features/energy/QuestionOfDay'
import { EnergyLog } from '@/types/app.types'
import { useSpaceStore } from '@/store/space.store'

export function HomeContent() {
  const [logs, setLogs] = useState<EnergyLog[]>([])
  const [hour, setHour] = useState<number>(new Date().getHours())
  const isLoaded = useSpaceStore((state) => state.isLoaded)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/energy?days=7')
        if (res.ok) {
          const data = await res.json()
          setLogs(data.logs || [])
        }
      } catch (err) {
        console.error(err)
      }
    }
    
    if (isLoaded) {
      fetchLogs()
    }
    
    const interval = setInterval(() => {
      setHour(new Date().getHours())
    }, 60000)
    
    return () => clearInterval(interval)
  }, [isLoaded])

  const showMorning = hour >= 6 && hour < 14
  const showNight = hour >= 18 && hour < 24

  const handleEnergySubmit = () => {
    fetch('/api/energy?days=7')
      .then(res => res.json())
      .then(data => setLogs(data.logs || []))
      .catch(console.error)
  }

  return (
    <div className="relative min-h-screen bg-black pb-24">
      {/* Ambient background glow — purely decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-900/20 blur-[100px]" />
        <div className="absolute right-0 top-1/3 h-48 w-48 rounded-full bg-emerald-900/10 blur-[80px]" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <HomeHeader />
        <QuickNav />
        
        <div className="px-4 mt-6 flex flex-col gap-6 max-w-lg mx-auto">
          {showMorning && <EnergyPicker period="morning" onSubmit={handleEnergySubmit} />}
          {showNight && <EnergyPicker period="night" onSubmit={handleEnergySubmit} />}
          
          <QuestionOfDay />
          
          <EnergyGraph logs={logs} />
        </div>
      </div>
    </div>
  )
}
