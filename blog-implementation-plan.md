# Blog Implementation Plan

**Goal:** Implement a functional blog system within the Astro website, including an index page displaying post previews in a gallery format and individual pages for full post content with social sharing.

**Plan:**

1.  **Configure Astro Content Collections:**
    *   **Action:** Create or update `website/src/content/config.ts` (or `.js`).
    *   **Details:** Define a `blog` collection schema specifying required frontmatter fields:
        *   `title`: string
        *   `pubDate`: date
        *   `description`: string
        *   `featuredImage`: string (path to image)
        *   `tags`: array of strings
        *   *(Optional but recommended: `author`: string)*
    *   **Purpose:** Enforce structure for blog posts and enable type-safe data fetching.

2.  **Create Blog Index Page:**
    *   **Action:** Create the file `website/src/pages/blog/index.astro`.
    *   **Details:**
        *   Import `getCollection` from `astro:content`.
        *   Fetch all posts: `const posts = await getCollection('blog', ({ data }) => !data.draft);` (assuming a `draft` field for unpublished posts).
        *   Sort posts by `pubDate` descending.
        *   Use a CSS Grid or Flexbox layout to create the gallery view.
        *   Iterate over `posts` and render a `BlogPostPreview` component for each.
        *   Wrap the page content in the main `Layout.astro` (or a specific blog index layout if needed).
    *   **Purpose:** Display a list of all published blog posts.

3.  **Create Blog Post Preview Component:**
    *   **Action:** Create the file `website/src/components/BlogPostPreview.astro`.
    *   **Details:**
        *   Accept a single `post` object (from the collection) as a prop.
        *   Display the `post.data.featuredImage` (using Astro's `<Image>` component for optimization is recommended).
        *   Display `post.data.title`.
        *   Display formatted `post.data.pubDate`.
        *   Display `post.data.tags` (e.g., as styled badges).
        *   Include a "See More" link pointing to `/blog/${post.slug}/`.
    *   **Purpose:** Provide a consistent preview card for each post on the index page.

4.  **Create Dynamic Blog Post Page:**
    *   **Action:** Create the file `website/src/pages/blog/[...slug].astro`.
    *   **Details:**
        *   Implement `getStaticPaths` using `getCollection('blog')` to generate a page for each post slug.
        *   Retrieve the specific `post` data for the current slug.
        *   Render the Markdown content using `<post.render() />` which gives access to the `<Content />` component.
        *   Display metadata: `post.data.title`, `post.data.pubDate`, `post.data.tags`.
        *   Integrate social sharing buttons (e.g., using a library like `astro-social-share` or custom links).
        *   Wrap the content in a `BlogPostLayout.astro`.
    *   **Purpose:** Display the full content of individual blog posts.

5.  **Create Blog Post Layout:**
    *   **Action:** Create the file `website/src/layouts/BlogPostLayout.astro`.
    *   **Details:**
        *   Define the common structure for blog posts (header, footer, main content area with appropriate width/styling).
        *   Accept `frontmatter` (or individual fields like `title`, `description`) as props to set `<title>` tags and meta descriptions dynamically.
        *   Use Astro slots (`<slot />`) to inject the main content from `[...slug].astro`.
    *   **Purpose:** Ensure consistent layout and styling across all blog posts.

6.  **Update Content Files:**
    *   **Action:** Review and update existing/new Markdown files in `website/src/content/blog/`.
    *   **Details:** Ensure all `.md` files include the frontmatter fields defined in the content collection schema (`title`, `pubDate`, `description`, `featuredImage`, `tags`). Add placeholder images if necessary.
    *   **Purpose:** Provide the actual content and metadata for the blog.

**Visual Flow (Mermaid Diagram):**

```mermaid
graph TD
    A[User visits /blog] --> B(website/src/pages/blog/index.astro);
    B -- Fetches --> C{Blog Content Collection};
    B -- Renders --> D[Gallery of BlogPostPreview Components];
    D -- User clicks 'See More' --> E{Navigates to /blog/[slug]};
    E --> F(website/src/pages/blog/[...slug].astro);
    F -- Fetches specific post from --> C;
    F -- Renders content via --> G(website/src/layouts/BlogPostLayout.astro);
    G -- Displays --> H[Full Post Content & Social Share Buttons];
```

**Future Considerations:**

*   **Pagination:** Add pagination to the `/blog` index page if the number of posts becomes large.
*   **PowerPoint Embedding:** Integrate the previously planned PowerPoint embedding feature into the rendering process within `[...slug].astro`.
*   **Tag Pages:** Create pages to list all posts associated with a specific tag (`/blog/tags/[tag-name]`).
*   **RSS Feed:** Generate an RSS feed for the blog.