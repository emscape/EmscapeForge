# Plan: Add Profile and Hero Images

**1. Goal:**
    *   Display the profile picture on the About page.
    *   Display the hero image on the Homepage hero section.

**2. Prerequisites:**
    *   Profile picture located at `website/public/images/profile.jpg`.
    *   Hero image located at `website/public/images/background-hero.*` (e.g., `background-hero.jpg`).

**3. Profile Picture Implementation (`website/src/pages/about.astro`):**
    *   **Locate:** Find the `div` with class `profile-image` (around line 14).
    *   **Replace:** Remove the inner `div` with class `image-placeholder` (lines 15-20).
    *   **Add:** Insert an Astro `<Image>` component within the `profile-image` div.
        *   Import the image at the top: `import profilePic from '/public/images/profile.jpg';` (adjust path if needed).
        *   Use the imported image in the `src`: `src={profilePic}`.
        *   Set appropriate `alt` text, e.g., `alt="Profile picture of Emily"`.
        *   Set `width` and `height` attributes (e.g., `width={150}` `height={150}`) to match the CSS styling.

**4. Hero Image Implementation (`website/src/components/home/HeroSection.astro`):**
    *   **Locate:** Find the `div` with class `hero-image` (around line 20).
    *   **Replace:** Remove the inner `div` with class `image-placeholder` (lines 22-29).
    *   **Add:** Insert an Astro `<Image>` component within the `hero-image` div.
        *   Import the image at the top: `import heroImage from '/public/images/background-hero.jpg';` (adjust filename/path as needed).
        *   Use the imported image in the `src`: `src={heroImage}`.
        *   Set appropriate `alt` text, e.g., `alt="Abstract background image"`.
        *   Define `width` and `height` attributes based on the desired display size (e.g., `width={300}` `height={300}` to match the placeholder, or adjust as needed).
    *   **Consider Responsiveness:** The current CSS hides the `.hero-image` div on small screens (lines 195-197). Implementation should maintain this behavior unless specified otherwise.