import { useRevealOnScroll } from './hooks/useReveal'
import { useDocumentMeta } from './hooks/useDocumentMeta'
import XpBar from './components/XpBar'
import Header from './components/Header'
import Hero from './components/Hero'
import About from './components/About'
import QuestLog from './components/QuestLog'
import Missions from './components/Missions'
import SkillTree from './components/SkillTree'
import Trophies from './components/Trophies'
import Contact from './components/Contact'
import Footer from './components/Footer'
import Character from './components/Character'

function App() {
  useRevealOnScroll()
  useDocumentMeta()

  return (
    <>
      <XpBar />

      <a className="absolute -left-[999px] top-auto bg-white text-ink px-5 py-3 font-mono text-[0.85rem] z-[100] rounded-br-md focus:left-0 focus:top-[5px]" href="#main">Skip to content</a>

      <Header />

      <main id="main">
        <Hero />
        <About />
        <QuestLog />
        <Missions />
        <SkillTree />
        <Trophies />
        <Contact />
      </main>

      <Footer />

      <Character />
    </>
  )
}

export default App
