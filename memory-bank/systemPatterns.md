# System Patterns

## Design Patterns
- Component-based architecture for UI elements
- Container/Presenter pattern for data fetching components
- Theme provider pattern for light/dark mode
- Responsive design patterns with mobile-first approach
- Lazy loading for images and non-critical resources
- Adaptive content display based on device capabilities
- Fallback patterns for embedded content

## Architectural Patterns
- Static site generation with Astro
- API integration for GitHub projects
- Markdown-based content management with custom extensions
- File-based routing
- Environment-aware configuration
- External service integration (Microsoft Office Online, PDF viewers)
- Progressive enhancement for rich content

## Coding Standards
- Consistent file and folder naming (kebab-case for files, PascalCase for components)
- CSS/SCSS with BEM methodology
- Responsive breakpoints using standard device sizes
- Accessibility compliance (WCAG AA)
- Performance optimization (Core Web Vitals targets)
- Custom Markdown syntax for specialized content types

[2025-03-23 21:23:24] - Added patterns for presentations page and integration with PowerPoint embedding

[2025-03-23 20:58:08] - Added patterns for PowerPoint presentation embedding
[2025-03-23 20:52:24] - Initial system patterns defined

## Content Creation Patterns

### Adding a New Blog Post
[2025-04-14 11:51:00]
1.  **Create Markdown File:** Add a new `.md` file in `website/src/content/blog/`. Use kebab-case for the filename (e.g., `my-awesome-post.md`).
2.  **Add Frontmatter:** Include the required frontmatter fields defined in `website/src/content/config.ts` for the `blog` collection. See sample below.
3.  **Add Content:** Write the blog post content using Markdown.
4.  **Add Images (Optional):**
    *   Place image files directly in `website/src/content/blog/` alongside the markdown file.
    *   Reference the image in the `featuredImage` frontmatter field using a relative path (e.g., `./my-image.png`).
5.  **Test Locally:** Run `npm run dev` (inside the `website` directory) and check the post renders correctly.

### Sample Blog Post Frontmatter (`.md`)
```markdown
---
title: "Your Amazing Blog Post Title"
pubDate: YYYY-MM-DD # e.g., 2025-10-26
description: "A brief but engaging description of your post."
author: "Your Name" # Optional
tags: ["tag1", "tag2", "relevant-tag"]
featuredImage: "./your-featured-image.jpg" # Optional, relative path to image in same folder
draft: false # Optional, set to true to hide from production
---

Your blog post content starts here...
```
