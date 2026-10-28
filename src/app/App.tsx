import { Route, Routes } from 'react-router'
import { Scaffold } from '@/app/Scaffold'

// Register planned URLs now; product scenes are implemented in later phases.
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Scaffold scene="home" />} />
      <Route path="/play" element={<Scaffold scene="library" />} />
      <Route path="/play/:game/:n" element={<Scaffold scene="game" />} />
      <Route path="/about" element={<Scaffold scene="about" />} />
      <Route path="*" element={<Scaffold scene="not-found" />} />
    </Routes>
  )
}
