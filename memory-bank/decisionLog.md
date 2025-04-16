# Decision Log

This file records architectural and implementation decisions using a list format.

[2025-03-23 21:23:01] - Adding a dedicated presentations page to the website

## Decision

Create a dedicated presentations page to showcase PowerPoint presentations separately from blog posts.

## Rationale 

A dedicated presentations page will provide a centralized location for users to browse and access all presentations, complementing the PowerPoint embedding functionality in blog posts. This enhances content organization and improves user experience for those specifically looking for presentation content.

## Implementation Details

1. Create a new top-level route at /presentations
2. Implement a presentations listing page with featured presentations
3. Create individual presentation detail pages with the PowerPoint viewer
4. Reuse the PowerPoint embedding component from the blog system
5. Add presentations link to the main navigation


[2025-03-23 20:56:25] - Adding PowerPoint presentation embedding functionality to blog system

## Decision

Add support for embedding PowerPoint presentations in blog posts.

## Rationale 

The ability to embed PowerPoint presentations will enhance the blog's functionality, allowing for richer content sharing and better integration with professional presentations.

## Implementation Details

1. Use Microsoft's Office Online embedding approach
2. Create a custom Markdown extension for PowerPoint embeds
3. Add UI components for presentation display
4. Implement responsive design for embedded presentations

[2025-04-16 01:20:09] - Adding meta refresh redirect to helloemily.dev

## Decision

Add a meta refresh tag to the site's layout to immediately redirect all traffic from emscapeforge.com to https://helloemily.dev/.

## Rationale

The user wants to redirect the old domain (emscapeforge.com) to their new primary domain (helloemily.dev) as a simple solution instead of maintaining the emscapeforge site.

## Implementation Details

1. Added `<meta http-equiv="refresh" content="0; url=https://helloemily.dev/" />` to the `<head>` section of `website/src/layouts/Layout.astro`.
2. This change will take effect after the next site build and deployment.
