# EmscapeForge: Instructions for Adding a New Blog Post

This document outlines the steps and format required to add a new blog post to the EmscapeForge website using the Astro content collection setup.

## Steps

1.  **Create Markdown File:** Add a new `.md` file in `website/src/content/blog/`. Use kebab-case for the filename (e.g., `my-awesome-post.md`).
2.  **Add Frontmatter:** Include the required frontmatter fields defined in `website/src/content/config.ts` for the `blog` collection. See the sample below.
3.  **Add Content:** Write the blog post content using Markdown.
4.  **Add Images (Optional):**
    *   Place image files directly in `website/src/content/blog/` alongside the markdown file.
    *   Reference the image in the `featuredImage` frontmatter field using a relative path (e.g., `./my-image.png`). This allows Astro to process and optimize the image.
5.  **Test Locally:** Run `npm run dev` (inside the `website` directory) and check the post renders correctly at its URL (e.g., `http://localhost:3000/blog/my-awesome-post/`).

## Sample Blog Post Frontmatter (`.md`)

Ensure your frontmatter matches this structure and includes all required fields (`title`, `pubDate`, `description`, `tags`).

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

## Notes

*   The `pubDate` should be in `YYYY-MM-DD` format.
*   `tags` must be a YAML array of strings.
*   `featuredImage` path is relative to the markdown file.
*   Refer to `website/src/content/config.ts` for the definitive schema if needed.