import { defineCollection, z, image } from 'astro:content'; // Import image helper

// Define the schema for the blog collection
const blogCollection = defineCollection({
  type: 'content', // 'content' for Markdown/MDX, 'data' for JSON/YAML
  schema: ({ image }) => z.object({ // Use schema context to access image()
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    featuredImage: image().optional(), // Use image() helper, make it optional
    tags: z.array(z.string()),
    author: z.string().optional(), // Optional author field
    draft: z.boolean().optional(), // Optional draft status
    // Add other fields as needed, e.g., layout, category
  }),
});

// Define the schema for the presentations collection
const presentationsCollection = defineCollection({
  type: 'content', // Assuming Markdown for descriptions, etc.
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.date(),
    tags: z.array(z.string()),
    // thumbnailImage: image().optional(), // Optional thumbnail - Temporarily removed
    filePath: z.string(), // Path to the PPTX file (relative to public or absolute URL)
    pdfPath: z.string().optional(), // Optional path to the PDF file
    slideCount: z.number().optional(), // Optional slide count
    author: z.string().optional(), // Optional author
    featured: z.boolean().optional(), // Optional featured status
  }),
});

// Export a single `collections` object to register your collection(s)
export const collections = {
  'blog': blogCollection,
  'presentations': presentationsCollection, // Register the new collection
};