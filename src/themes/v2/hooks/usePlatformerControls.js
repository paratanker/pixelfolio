import { useEffect, useRef, useState } from 'react'
import { CHARACTERS } from '../data/characters'
import { GRAVITY, HITBOX_INSET, JUMP_VELOCITY, LEVEL_WIDTH, MOVE_SPEED, SPRITE_WIDTH } from '../data/menuLevel'
import { JUMP_KEYS, LEFT_KEYS, matchesKey, RIGHT_KEYS } from '../utils/keyboard'
import { playSfx } from '../utils/sound'

const FRAME_INTERVAL = 140 // ms
const MAX_DT = 0.05 // clamp large frame gaps (tab switches, etc.)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// Current x of a platform at a given rAF timestamp — static platforms just return
// their fixed x, patrol ones swing sinusoidally around it.
function liveXOf(p, timeMs) {
  if (!p.patrol) return p.x
  return p.x + Math.sin((timeMs / 1000) * (2 * Math.PI / p.patrol.period)) * p.patrol.amplitude
}

// Fills `out[i]` with each platform's live x at `time` (index-aligned with
// `platforms`) and returns it, reusing the array instead of allocating one
// per rAF frame.
function fillLiveX(platforms, time, out) {
  for (let i = 0; i < platforms.length; i++) {
    out[i] = liveXOf(platforms[i], time)
  }
  return out
}

// The hero's foot span for collision — the sprite box inset per side to match
// the visible body, not the transparent image margins (see HITBOX_INSET).
function overlapsPlatform(xPos, px, platformWidth) {
  return xPos + SPRITE_WIDTH - HITBOX_INSET > px && xPos + HITBOX_INSET < px + platformWidth
}

// The platform (if any) the hero at (xPos, yPos) is standing on, given the
// index-aligned live x's computed this frame by fillLiveX.
function findSupport(platforms, liveX, xPos, yPos) {
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i]
    if (Math.abs(p.y - yPos) >= 0.01) continue
    if (overlapsPlatform(xPos, liveX[i], p.width)) return p
  }
  return null
}

function isJumpKey(e) {
  return matchesKey(e, JUMP_KEYS)
}
function isLeftKey(e) {
  return matchesKey(e, LEFT_KEYS)
}
function isRightKey(e) {
  return matchesKey(e, RIGHT_KEYS)
}
const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'])
function isInteractiveFocus() {
  return INTERACTIVE_TAGS.has(document.activeElement?.tagName)
}

// One-way platform collision over a fixed set of platforms (see
// src/data/menuLevel.js): gravity pulls the hero down each frame; landing is
// only checked while descending, snapping to the highest platform surface
// the hero's foot crossed this frame. Walking off a platform's x-span while
// grounded (or off the world edge) drops it back into freefall.
export function usePlatformerControls({ platforms, heroStart, paused, onEnterSection, onClose, character = CHARACTERS.hero }) {
  const idleFrame = character.idle
  const walkFrames = character.walk

  const [x, setX] = useState(heroStart.x)
  const [y, setY] = useState(heroStart.y)
  const [facing, setFacing] = useState('right')
  const [frame, setFrame] = useState(idleFrame)
  const [activeKey, setActiveKey] = useState(null)
  const [platformX, setPlatformX] = useState({})

  const platformsRef = useRef(platforms)
  platformsRef.current = platforms
  // Two reused buffers for this/last frame's live platform x's (index-aligned
  // with platformsRef.current), swapped each tick instead of allocated fresh.
  const liveXBuffersRef = useRef([[], []])
  const liveXBufferIndexRef = useRef(0)

  const xRef = useRef(heroStart.x)
  const yRef = useRef(heroStart.y)
  const velocityRef = useRef(0)
  const groundedRef = useRef(true)
  const activeKeyRef = useRef(null)
  const directionRef = useRef(0) // -1 left, 0 idle, 1 right
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const frameTimerRef = useRef(null)
  const frameIndexRef = useRef(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const setDirection = (dir) => {
    directionRef.current = dir
    if (dir !== 0) setFacing(dir < 0 ? 'left' : 'right')
  }

  const jump = () => {
    if (!groundedRef.current) return
    groundedRef.current = false
    velocityRef.current = JUMP_VELOCITY
    playSfx('jump')
  }

  // Touch-control equivalents of onKeyDown/onKeyUp's left/right handling — a button
  // press starts moving that direction, and release only stops it if that direction
  // is still current (so a fast left-then-right drag across both buttons doesn't
  // leave the hero stuck idle from the first button's delayed release).
  const startMove = (dir) => setDirection(dir)
  const stopMove = (dir) => {
    if (directionRef.current === dir) setDirection(0)
  }

  useEffect(() => {
    function tick(time) {
      if (lastTimeRef.current == null) lastTimeRef.current = time
      const dt = Math.min((time - lastTimeRef.current) / 1000, MAX_DT)
      lastTimeRef.current = time

      if (!pausedRef.current) {
        const platformsNow = platformsRef.current
        const bufIndex = liveXBufferIndexRef.current
        const liveX = fillLiveX(platformsNow, time, liveXBuffersRef.current[bufIndex])
        const prevLiveX = liveXBuffersRef.current[1 - bufIndex]

        // Ride along with whatever moving platform the hero is currently standing on,
        // before applying their own input/gravity this frame.
        if (groundedRef.current) {
          const riddenIndex = platformsNow.findIndex((p) => p.key === activeKeyRef.current)
          const ridden = riddenIndex === -1 ? null : platformsNow[riddenIndex]
          if (ridden?.patrol) {
            const prevX = prevLiveX[riddenIndex] ?? liveX[riddenIndex]
            xRef.current += liveX[riddenIndex] - prevX
          }
        }

        if (directionRef.current !== 0) {
          xRef.current = clamp(xRef.current + directionRef.current * MOVE_SPEED * dt, 0, LEVEL_WIDTH - SPRITE_WIDTH)
        }

        if (groundedRef.current && !findSupport(platformsNow, liveX, xRef.current, yRef.current)) {
          groundedRef.current = false
          velocityRef.current = 0
        }

        if (!groundedRef.current) {
          const prevY = yRef.current
          velocityRef.current -= GRAVITY * dt
          yRef.current += velocityRef.current * dt

          if (velocityRef.current <= 0) {
            let landOn = null
            for (let i = 0; i < platformsNow.length; i++) {
              const p = platformsNow[i]
              if (!overlapsPlatform(xRef.current, liveX[i], p.width)) continue
              if (prevY >= p.y && yRef.current <= p.y && (landOn == null || p.y > landOn.y)) {
                landOn = p
              }
            }
            if (landOn) {
              yRef.current = landOn.y
              velocityRef.current = 0
              groundedRef.current = true
              playSfx('land')
            }
          }
        }

        const support = groundedRef.current ? findSupport(platformsNow, liveX, xRef.current, yRef.current) : null
        const nextActiveKey = support?.key ?? null
        if (nextActiveKey !== activeKeyRef.current) {
          activeKeyRef.current = nextActiveKey
          setActiveKey(nextActiveKey)
        }

        liveXBufferIndexRef.current = 1 - bufIndex

        setX(xRef.current)
        setY(yRef.current)
        setPlatformX((prev) => {
          const next = {}
          let changed = false
          for (let i = 0; i < platformsNow.length; i++) {
            const p = platformsNow[i]
            if (!p.patrol) continue
            const lx = liveX[i]
            next[p.key] = lx
            if (prev[p.key] !== lx) changed = true
          }
          return changed ? next : prev
        })
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    function onKeyDown(e) {
      if (pausedRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose?.()
        }
        return
      }
      // A Tab-focused button/link handles its own Enter/Space natively (opens
      // exactly the focused section) — don't also let the hero's position
      // hijack the same keypress to open a different, possibly unrelated section.
      if (isInteractiveFocus()) return
      if (isLeftKey(e)) setDirection(-1)
      else if (isRightKey(e)) setDirection(1)
      else if (isJumpKey(e)) {
        e.preventDefault()
        jump()
      } else if (e.key === 'Enter') {
        if (activeKeyRef.current) onEnterSection?.(activeKeyRef.current)
      }
    }
    function onKeyUp(e) {
      if (isLeftKey(e) && directionRef.current === -1) setDirection(0)
      else if (isRightKey(e) && directionRef.current === 1) setDirection(0)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onEnterSection, onClose])

  useEffect(() => {
    frameTimerRef.current = setInterval(() => {
      if (!groundedRef.current) return // hold takeoff pose while airborne
      if (directionRef.current !== 0) {
        frameIndexRef.current = (frameIndexRef.current + 1) % walkFrames.length
        setFrame(walkFrames[frameIndexRef.current])
      } else {
        setFrame(idleFrame)
      }
    }, FRAME_INTERVAL)
    return () => clearInterval(frameTimerRef.current)
  }, [idleFrame, walkFrames])

  return { x, y, facing, frame, activeKey, platformX, startMove, stopMove, jump }
}
