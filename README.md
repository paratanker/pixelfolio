# 🎮 Pixelfolio

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-Fast-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind-4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/license-MIT-lightgrey?style=for-the-badge" alt="License" />
</p>

A pixel/RPG-themed portfolio template. Your career shown as a quest log 📜, your projects as cleared missions 🗺️, your skills as a skill tree 🌳.

---

## 🕹️ Quick Start

Requires Node.js (with npm).

```bash
npm install
npm run dev
```

▶️ Starts the Vite dev server (default `http://localhost:5173`) with hot reload.

<details>
<summary>⚙️ Other commands</summary>

```bash
npm run build      # 📦 production build to dist/
npm run preview    # 👀 preview the production build locally
npm run lint        # 🧹 run oxlint
```

</details>

## 🗂️ Project Structure

```
src/
  data/content.json   # 📝 all site copy/content (see below)
  components/         # 🧩 React components (Hero, About, QuestLog, Missions, SkillTree, Trophies, Contact, ...)
  hooks/               # 🎣 animation/scroll/character-control hooks
  App.jsx, main.jsx, index.css
public/
  characters/          # 👾 sprite images used by the character animation
  assets/              # 🖼️ other static assets
```

## ✍️ Putting in Your Content

All page copy lives in a single file: **`src/data/content.json`**, currently filled with placeholder text. Replace the placeholders with your own info — components read from this file directly, so you don't need to touch any component code.

Also update:

- 📦 `package.json` — `name` field

### 📋 Sections in `content.json`

| Key | Icon | What it controls |
| --- | :---: | --- |
| `site` | 🏷️ | browser tab title, meta description, brand name, footer copyright |
| `nav` | 🧭 | header nav links |
| `social` | 🔗 | LinkedIn/GitHub URLs |
| `contact` | 📬 | base64-encoded email/phone (`emailB64`, `phoneB64`) and the WhatsApp prefill message — encode your own with `echo -n "value" \| base64` |
| `hero` | 🦸 | landing section: eyebrow, name, subtitle, description, stats, tech stack chips, location |
| `about` | 💬 | "About Me" section copy (story + what I care about) |
| `questLog` / `quests` | 📜 | work experience timeline (each entry: `status` of `active` or `complete`, title, employer, duration, objectives) |
| `missions` / `missionGroups` | 🎯 | projects shipped, grouped by company (each project supports `name`, `org`, optional `href`, optional `screenshot`) |
| `skills` / `skillGroups` | 🌳 | skill tree, grouped into labeled chip lists |
| `credentials` | 🏆 | education, languages, trophies/achievements |
| `contactSection` | ✉️ | closing CTA copy |

> 💡 The `{{missionsShipped}}` token in `hero.stats` is a placeholder substituted at render time with the total project count across `missionGroups` (see `Hero.jsx`) — leave the token in place, don't hardcode a number.

### ➕ Adding a New Project or Job

- **New job** 💼 — add an entry to the top of `quests` (list is newest-first) with a unique `title`/`duration`.
- **New project** 🚀 — add an entry to the relevant company's `projects` array in `missionGroups`, or add a new company group.
- **New sprite/character image** 👾 — drop it in `public/characters/` and reference it from the relevant component/hook.

### 🔒 Gated Links

External links that should be gated behind a simple bot-check (e.g. resume/project links) use the `GatedLink` component instead of a plain `<a>`.

---

<p align="center">Made for adventurers who ship code. 🗡️✨</p>
