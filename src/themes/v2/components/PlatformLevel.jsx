import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlatformerControls } from '../hooks/usePlatformerControls'
import { useIsTouchDevice } from '../hooks/useIsTouchDevice'
import { LEVEL_WIDTH, LEVEL_HEIGHT, SPRITE_WIDTH, heroStart, platforms } from '../data/menuLevel'
import { asset } from '../../../utils/asset'
import content from '../../../data/content.json'
import ControlPad from './ControlPad'

// Fraction down the viewport the hero's foot should sit once the camera settles —
// biased below center (rather than exactly centered) so there's more headroom above
// for the jump arc and the arrival-note tooltip than below.
const AUTO_FOLLOW_BIAS = 0.62

// How far the castle backdrop slides (opposite the hero, as a fraction of their
// offset from level center) — full traversal moves it ~±33px, enough to read as
// depth without exposing the backdrop's edges.
const PARALLAX = 0.07

// Ambient embers drifting up from the dungeon floor. A fixed table (not
// Math.random at module eval) so re-renders and HMR don't reshuffle them;
// left is in level units, delay/duration in seconds, drift is the horizontal
// wander in px over one rise (see theme.css's emberRise).
const EMBERS = [
  { left: 60, delay: 0, dur: 11, drift: 26 },
  { left: 175, delay: 4.2, dur: 9, drift: -18 },
  { left: 310, delay: 7.5, dur: 12, drift: 22 },
  { left: 430, delay: 2.1, dur: 10, drift: -18 },
  { left: 525, delay: 9.3, dur: 11, drift: 30 },
  { left: 640, delay: 5.6, dur: 9.5, drift: -26 },
  { left: 760, delay: 1.4, dur: 12, drift: 18 },
  { left: 880, delay: 6.8, dur: 10, drift: -22 },
  { left: 950, delay: 3.3, dur: 11.5, drift: 14 },
]

const menuByKey = Object.fromEntries(content.menu.map((item) => [item.key, item]))

// Each section's own descriptive `title` (from its content.json block), shown in the
// arrival note instead of the short button label.
const noteTitleByKey = {
  profile: content.about.title,
  experience: content.questLog.title,
  projects: content.missions.title,
  skills: content.skills.title,
  education: content.credentials.title,
  terminal: content.terminal.title,
  contact: content.contactSection.title,
}

export default function PlatformLevel({ activeScreen, onOpen, onClose, visited, character, onChangeCharacter, mobileScroll = false }) {
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const [scale, setScale] = useState(1)
  // Whether the width-filling mobile scale makes the stage taller than the
  // viewport — only then is there anything to pan, so only then do we switch
  // the wrap to a scroll container and show the up/down buttons.
  const [canScroll, setCanScroll] = useState(false)
  const [stageRect, setStageRect] = useState({ left: 0, bottom: 0 })
  const paused = activeScreen != null

  const mobileScrollRef = useRef(mobileScroll)
  mobileScrollRef.current = mobileScroll

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      // Mobile fills the width (bigger platforms/character, scrollable if that
      // makes it taller than the screen); everyone else fits both dimensions
      // so the whole level is visible at once, same as before.
      const nextScale = mobileScrollRef.current
        ? width / LEVEL_WIDTH
        : Math.min(width / LEVEL_WIDTH, height / LEVEL_HEIGHT)
      setScale(nextScale)
      setCanScroll(mobileScrollRef.current && LEVEL_HEIGHT * nextScale > height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Re-measure the scaled stage's screen position whenever its scale changes (i.e. after
  // a resize-driven re-render), so the portaled arrival note (see below) can be anchored
  // to the right spot without living inside the stage's own transform stacking context.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setStageRect({ left: r.left, bottom: r.bottom })
  }, [scale])

  // Same re-measure, but on scroll — the note's screen position drifts as the
  // mobile wrap pans, and the resize-driven effect above only fires on scale change.
  useEffect(() => {
    if (!canScroll) return
    const wrapEl = wrapRef.current
    const stageEl = stageRef.current
    if (!wrapEl || !stageEl) return
    function onScroll() {
      const r = stageEl.getBoundingClientRect()
      setStageRect({ left: r.left, bottom: r.bottom })
    }
    wrapEl.addEventListener('scroll', onScroll, { passive: true })
    return () => wrapEl.removeEventListener('scroll', onScroll)
  }, [canScroll])

  const { x, y, facing, frame, activeKey, platformX, startMove, stopMove, jump } = usePlatformerControls({
    platforms,
    heroStart,
    paused,
    onEnterSection: onOpen,
    onClose,
    character,
  })
  const isTouch = useIsTouchDevice()

  // Auto-follow camera: every time the hero's y changes (jumping, falling,
  // landing on a different tier), re-center the scroll on them by adjusting
  // scrollTop directly (no state) so it keeps their foot at AUTO_FOLLOW_BIAS
  // down the viewport.
  useEffect(() => {
    if (!canScroll || paused) return
    const wrapEl = wrapRef.current
    if (!wrapEl) return
    const viewportH = wrapEl.clientHeight
    const maxScroll = Math.max(0, LEVEL_HEIGHT * scale - viewportH)
    const heroFootFromTop = (LEVEL_HEIGHT - y) * scale
    wrapEl.scrollTop = Math.min(Math.max(heroFootFromTop - viewportH * AUTO_FOLLOW_BIAS, 0), maxScroll)
  }, [canScroll, paused, scale, y])

  const activePlatform = activeKey ? platforms.find((p) => p.key === activeKey) : null
  const activePlatformLeft = activePlatform
    ? (activePlatform.patrol ? (platformX[activePlatform.key] ?? activePlatform.x) : activePlatform.x)
    : 0

  // Shared stage content (castle backdrop, torches, platforms, hero sprite) for
  // both scroll layouts below — they differ only in the outer wrapper that
  // sizes/positions this content, not in the content itself.
  function renderStageContent() {
    return (
      <>
        <img
          className="pixel-img absolute left-1/2 opacity-30 pointer-events-none"
          style={{
            top: -6,
            width: 300,
            filter: 'brightness(0.75) saturate(0.8)',
            // Faux parallax: slide opposite the hero's offset from level center,
            // riding the same per-frame x the sprite already re-renders on.
            transform: `translateX(calc(-50% + ${(LEVEL_WIDTH / 2 - (x + SPRITE_WIDTH / 2)) * PARALLAX}px))`,
          }}
          src={asset('assets/castle.png')}
          alt=""
          aria-hidden="true"
        />

        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="ember"
            style={{ left: e.left, '--ember-delay': `${e.delay}s`, '--ember-dur': `${e.dur}s`, '--ember-drift': `${e.drift}px` }}
            aria-hidden="true"
          />
        ))}
        <div className="torch-glow" style={{ left: 6, bottom: 40 }} aria-hidden="true" />
        <div className="torch-glow" style={{ right: 6, bottom: 40 }} aria-hidden="true" />
        <div className="torch" style={{ left: 6, bottom: 40 }} aria-hidden="true" />
        <div className="torch" style={{ right: 6, bottom: 40 }} aria-hidden="true" />

        {platforms.map((p, i) => {
          const item = p.key ? menuByKey[p.key] : null
          const materialClass = p.bedrock ? 'level-bedrock' : `level-platform level-platform--${p.material}`
          const left = p.patrol ? (platformX[p.key] ?? p.x) : p.x
          return (
            <div
              key={p.key ?? `deco-${i}`}
              className={`${materialClass} absolute`}
              style={{ left, width: p.width, bottom: p.y, height: p.bedrock ? 26 : 20 }}
            >
              {item && (
                <button
                  type="button"
                  className={`level-platform__btn absolute left-1/2 -translate-x-1/2 ${activeKey === p.key ? 'level-platform__btn--active -top-[6rem]' : '-top-[2.7rem]'}`}
                  onClick={() => onOpen(p.key)}
                  aria-label={item.label}
                >
                  <span>{item.label}</span>
                  {visited.has(p.key) && (
                    // Pixel-art check drawn on a 7×6 grid, one <rect> per row run.
                    <svg className="level-platform__check" viewBox="0 0 7 6" aria-hidden="true">
                      <rect x="6" y="0" width="1" height="1" />
                      <rect x="5" y="1" width="2" height="1" />
                      <rect x="0" y="2" width="1" height="1" />
                      <rect x="4" y="2" width="2" height="1" />
                      <rect x="0" y="3" width="2" height="1" />
                      <rect x="3" y="3" width="2" height="1" />
                      <rect x="1" y="4" width="3" height="1" />
                      <rect x="2" y="5" width="1" height="1" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )
        })}

        <img
          className="pixel-img absolute w-[68px] h-auto pointer-events-none drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]"
          src={frame}
          alt=""
          aria-hidden="true"
          style={{ left: x, bottom: y, transform: facing === 'left' ? 'scaleX(-1)' : 'none' }}
        />
      </>
    )
  }

  return (
    <div
      className={`absolute inset-0 level-dungeon transition-opacity duration-200 ${paused ? 'opacity-40 pointer-events-none' : ''}`}
      aria-hidden={paused ? 'true' : undefined}
    >
      <p className="stone-label absolute top-[clamp(3.6rem,7vh,4.6rem)] left-[clamp(1.1rem,4vw,3rem)] text-[0.78rem]">
        {content.site.brand} · v2.0
      </p>

      {character && !paused && (
        <button
          type="button"
          onClick={onChangeCharacter}
          className="absolute z-[40] top-[clamp(3.6rem,7vh,4.6rem)] right-[clamp(1.1rem,4vw,3rem)] inline-flex items-center gap-[0.5em] font-pixel text-[0.56rem] text-parchment/80 bg-black/30 border-2 border-parchment/25 rounded-[6px] pl-[0.4em] pr-[0.7em] py-[0.35em] transition-colors hover:text-gold hover:border-gold/50"
        >
          <img className="pixel-img w-[1.6em] h-auto" src={character.portrait} alt="" aria-hidden="true" />
          CHANGE
        </button>
      )}

      <div
        ref={wrapRef}
        className={
          canScroll
            ? 'absolute inset-x-0 top-[clamp(4.5rem,9vh,6rem)] bottom-0 flex items-start justify-center overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y scrollbar-hide'
            : `absolute inset-x-0 top-[clamp(4.5rem,9vh,6rem)] ${isTouch ? 'bottom-0' : 'bottom-[52px]'} flex items-end justify-center overflow-hidden`
        }
      >
        {canScroll ? (
          // A transformed element keeps its pre-transform (unscaled) box for layout/scroll
          // purposes — the wrap's native scrollHeight would be LEVEL_HEIGHT (520) instead of
          // the visually painted LEVEL_HEIGHT*scale, leaving the last bit of scroll travel
          // pointing at empty space below the actually-rendered bedrock. Sizing this wrapper
          // to the real (scaled) pixel dimensions and anchoring the transform at its top-left
          // makes the scrollable box's size match what's actually painted inside it.
          <div className="relative shrink-0" style={{ width: LEVEL_WIDTH * scale, height: LEVEL_HEIGHT * scale }}>
            <div
              ref={stageRef}
              className="absolute top-0 left-0"
              style={{ width: LEVEL_WIDTH, height: LEVEL_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            >
              {renderStageContent()}
            </div>
          </div>
        ) : (
          <div
            ref={stageRef}
            className="relative shrink-0"
            style={{ width: LEVEL_WIDTH, height: LEVEL_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'bottom' }}
          >
            {renderStageContent()}
          </div>
        )}
      </div>

      {!paused && activePlatform && createPortal(
        <div
          className="fixed pointer-events-none z-[55]"
          style={{
            left: stageRect.left + (activePlatformLeft + activePlatform.width / 2) * scale,
            top: stageRect.bottom - activePlatform.y * scale,
            transform: `scale(${scale})`,
            transformOrigin: 'bottom',
          }}
          aria-hidden="true"
        >
          <div className="absolute bottom-[8.15rem] left-1/2 -translate-x-1/2">
            <div className="level-note">
              <span className="level-note__title">{noteTitleByKey[activePlatform.key] ?? menuByKey[activePlatform.key].label}</span>
              <span className="level-note__label">{isTouch ? 'TAP' : 'ENTER'}</span>
              <span className="level-note__tail" />
            </div>
          </div>
        </div>,
        document.body
      )}

      {isTouch && !paused && (
        <ControlPad onMoveStart={startMove} onMoveEnd={stopMove} onJump={jump} />
      )}
    </div>
  )
}
