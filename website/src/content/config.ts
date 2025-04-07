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

// Export a single `collections` object to register your collection(s)
export const collections = {
  'blog': blogCollection,
};