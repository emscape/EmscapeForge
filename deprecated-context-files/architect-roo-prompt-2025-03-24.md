Absolutely. Here’s the **streamlined, no-nonsense Architect Roo prompt**—fully loaded, token-efficient, and focused on exactly what Roo needs to know to build **emscapeforge.com** right the first time.

---

### ✅ **Architect Roo Prompt: Build **`emscapeforge.com`**

**Repo:** [https://github.com/emscape/EmscapeForge](https://github.com/emscape/EmscapeForge)**Deployment:** GitHub Pages**Framework:** Astro (preferred), React, or another fast, static-friendly framework

---

### 1. **Site Identity & Theme**

- Site title: *Emscape Forge*
- Aesthetic: Sleek, modern tech meets fiber arts
  - Teal and aqua palette, with orange accents
  - Rounded corners, soft shadows
  - Subtle Celtic or Nordic accents
- Responsive design, light/dark mode toggle
- Accessible and fast-loading

---

### 2. **Pages & Content Structure**

#### `/` Home

- Intro paragraph
- Visual links to other sections
- Hero section loads with animation

#### `/projects`

- Pull pinned repos from [https://github.com/emscape](https://github.com/emscape) using GitHub API
- Each project card:
  - Name, description, primary language, last updated, GitHub link
  - Manual entries allowed for non-GitHub projects
- Tag support for future filtering

#### `/blog`

- Uploads via Markdown, HTML, or plain text in `posts/` folder
- Blog post includes:
  - Title, date, tags, excerpt, featured image, author, additional images when provided
- Images accepted in any format, auto-renamed as `slug-1.png`, etc.
- Auto-share on publish:
  - ✅ Facebook
  - ✅ Bluesky
  - 🔘 Prompt: Share to LinkedIn? [Yes/No]

#### `/about`

- Bio + headshot
- Skills organized by:
  - Languages, Tools, Architecture, Industry Domains
- Resume download (PDF)
- Optional experience timeline, with an expandable section to show jobs prior to tech shift

---

### 3. **Site Features & Framework Hooks**

#### Animations & Transitions

- Use **Framer Motion** or **AOS** for:
  - Scroll-based animations (fade-in, slide-up)
  - Page transitions (`<AnimatePresence>`)
  - Sticky nav shrink/fade on scroll
  - Hover/active states for buttons and cards

#### Blog Metadata

- Structured with frontmatter (title, tags, image, excerpt, date, author)
- Slugs = kebab-case filenames
- Store images in `/images/blog/`
- Posts stored in `/posts/`

#### GitHub Pages Deployment

- Build output to `/dist` or `/docs`
- Use relative paths for assets
- Add `sitemap.xml` and `robots.txt`
- Include 404 page

---

### 4. **Optional Features (Scaffold Now, Use Later)**

- RSS feed for `/blog`
- Email newsletter integration (leave space)
- Firebase Hosting/Functions (commented for later use)
- Dynamic routing support (e.g., `/blog/tag/foo`)
- Search (leave index stub)
- Commenting system block (Disqus, Giscus ready)
- Author support (name, avatar, bio in frontmatter)
- API hooks file for future tools/integrations
- Localization-ready folder structure
- PWA manifest + service worker placeholder
- Respect `prefers-reduced-motion` media query

#### Ad Support (Optional, Hidden by Default)

- Scaffold ad slots with a reusable `<AdBlock />` component:
  - Blog post sidebar or footer
  - Top-of-page banner (toggleable)
  - Sponsored project highlight
- Components should support easy integration with:
  - Google AdSense
  - EthicalAds or Carbon Ads
  - Custom HTML embed code
- All ads should respect user privacy and load lazily
- Default state = hidden (feature-flagged via config)

---

### 5. **Content Editing & Management**

- Emily will edit posts and pages locally in VS Code
- No drag-and-drop builders or third-party CMS
- All content managed via Markdown and pushed to GitHub
- File structure:
  ```
  /posts/
    my-first-post.md
  /images/blog/
    my-first-post-1.png
  /components/
  /pages/
  /public/
  /styles/
  ```

---

### Final Notes

- No hosting extras right now—**GitHub Pages only**
- Use environment-aware config for social shares
- Keep things modular, so Emily can evolve it as needed

---
