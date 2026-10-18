import { useEffect } from 'react'
import { useApp } from './store/app'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/ui'
import NewVideo from './pages/NewVideo'
import Editor from './pages/Editor'
import Styles from './pages/Styles'
import Characters from './pages/Characters'
import Settings from './pages/Settings'

export default function App() {
  const { route, refresh, upsertProject } = useApp()

  useEffect(() => {
    refresh()
    const off = window.api.onProject(upsertProject)
    const t = setInterval(() => window.api.status().then((status) => useApp.setState({ status })), 30000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* An invisible strip along the top lets you drag the window (the editor uses its own header). */}
      {route.name !== 'editor' && <div className="drag fixed inset-x-0 top-0 z-40 h-10" />}
      <div className="flex min-h-0 flex-1">
      {route.name !== 'editor' && <Sidebar />}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {route.name === 'home' && <NewVideo />}
        {route.name === 'editor' && <Editor id={route.id} />}
        {route.name === 'styles' && <Styles initialTab={route.tab} />}
        {route.name === 'characters' && <Characters openId={route.id} />}
        {route.name === 'settings' && <Settings />}
      </main>
      </div>
      <Toast />
    </div>
  )
}
