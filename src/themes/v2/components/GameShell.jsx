import { useCallback, useEffect, useState } from 'react'
import { useMenuNavigation } from '../hooks/useMenuNavigation'
import { useIsTouchDevice } from '../hooks/useIsTouchDevice'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { CHARACTERS } from '../data/characters'
import { playSfx, startMusic } from '../utils/sound'
import CharacterSelect from './CharacterSelect'
import Hud from './Hud'
import MainMenu from './MainMenu'
import PlatformLevel from './PlatformLevel'
import Screen from './Screen'
import ControlHints from './ControlHints'
import ProfileScreen from './screens/ProfileScreen'
import ExperienceScreen from './screens/ExperienceScreen'
import ProjectsScreen from './screens/ProjectsScreen'
import SkillsScreen from './screens/SkillsScreen'
import EducationScreen from './screens/EducationScreen'
import TerminalScreen from './screens/TerminalScreen'
import ContactScreen from './screens/ContactScreen'
import content from '../../../data/content.json'

const { menu } = content

const DESKTOP_QUERY = '(min-width: 860px) and (pointer: fine)'
// Below the desktop breakpoint, a touch device held sideways still has enough
// width to run the platformer (it's the level's own scale-to-fit that keeps
// jump distances/tap targets usable) — only true portrait phones fall back to
// the flat MainMenu list.
const TOUCH_LANDSCAPE_QUERY = '(any-pointer: coarse) and (orientation: landscape)'

const SCREENS = {
  profile: { title: content.hero.name, eyebrow: content.hero.eyebrow, accent: 'hero', Component: ProfileScreen },
  experience: { title: content.questLog.title, eyebrow: content.questLog.eyebrow, accent: 'quests', Component: ExperienceScreen },
  projects: { title: content.missions.title, eyebrow: content.missions.eyebrow, accent: 'missions', Component: ProjectsScreen },
  skills: { title: content.skills.title, eyebrow: content.skills.eyebrow, accent: 'skills', Component: SkillsScreen },
  education: { title: content.credentials.title, eyebrow: content.credentials.eyebrow, accent: 'trophy', Component: EducationScreen },
  terminal: { title: content.terminal.title, eyebrow: content.terminal.eyebrow, accent: 'about', Component: TerminalScreen },
  contact: { title: content.contactSection.title, eyebrow: content.contactSection.eyebrow, accent: 'contact', Component: ContactScreen },
}

export default function GameShell() {
  const [characterKey, setCharacterKey] = useState(null)
  const [activeScreen, setActiveScreen] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [visited, setVisited] = useState(() => new Set())
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const isTouchLandscape = useMediaQuery(TOUCH_LANDSCAPE_QUERY)
  const isTouch = useIsTouchDevice()
  const showPlatformer = isDesktop || isTouchLandscape
  // isDesktop now requires a fine pointer, so any touch device in landscape
  // (including wide phones) gets the level scaled up + made scrollable — see
  // PlatformLevel's mobileScroll prop.
  const mobileScroll = isTouchLandscape && !isDesktop

  // The character-select click is the user gesture that unlocks audio for the
  // whole session (see sound.js), so the music must start here and not sooner.
  const selectCharacter = useCallback((key) => {
    setCharacterKey(key)
    playSfx('select')
    startMusic()
  }, [])

  const openScreen = useCallback((key) => {
    const index = menu.findIndex((item) => item.key === key)
    if (index >= 0) setSelectedIndex(index)
    setActiveScreen(key)
    setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    playSfx('open')
  }, [])

  // Every closeScreen caller (Screen's button, the Esc handlers) only fires
  // while a screen is open, so the close blip can't play spuriously.
  const closeScreen = useCallback(() => {
    setActiveScreen(null)
    playSfx('close')
  }, [])

  // Music keeps playing back at character select — it belongs to the whole
  // shell, not just the level (CharacterSelect restarts it on fresh loads).
  const changeCharacter = useCallback(() => {
    closeScreen()
    setCharacterKey(null)
  }, [closeScreen])

  // Esc already closes an open Screen (handled by useMenuNavigation /
  // usePlatformerControls); once back at the menu/level with nothing open,
  // a second Esc backs out one more level to character select.
  useEffect(() => {
    if (!characterKey) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && activeScreen == null) {
        e.preventDefault()
        changeCharacter()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [characterKey, activeScreen, changeCharacter])

  useMenuNavigation({
    menu,
    activeScreen,
    selectedIndex,
    setSelectedIndex,
    openScreen,
    closeScreen,
    disabled: showPlatformer || !characterKey,
  })

  if (!characterKey) {
    return (
      <>
        <CharacterSelect onSelect={selectCharacter} />
        <ControlHints mode="select" touch={isTouch} />
      </>
    )
  }

  const character = CHARACTERS[characterKey]
  const active = activeScreen ? SCREENS[activeScreen] : null

  return (
    <>
      <Hud visitedCount={visited.size} totalCount={menu.length} />

      {showPlatformer ? (
        <PlatformLevel activeScreen={activeScreen} onOpen={openScreen} onClose={closeScreen} visited={visited} character={character} onChangeCharacter={changeCharacter} mobileScroll={mobileScroll} />
      ) : (
        <MainMenu
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onOpen={openScreen}
          visited={visited}
          covered={activeScreen != null}
          character={character}
          onChangeCharacter={changeCharacter}
        />
      )}

      {active && (
        <Screen title={active.title} eyebrow={active.eyebrow} accent={active.accent} onClose={closeScreen}>
          <active.Component />
        </Screen>
      )}

      <ControlHints mode={activeScreen ? 'screen' : showPlatformer ? 'platformer' : 'menu'} touch={isTouch} />
    </>
  )
}
