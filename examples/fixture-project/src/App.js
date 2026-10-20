import React, { useState } from 'react'
import Top from './components/Top'
import projects from './data/projects'

export default function App() {
  const [open, setOpen] = useState(false)
  return <Top items={projects} open={open} onToggle={() => setOpen(!open)} />
}
