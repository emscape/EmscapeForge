# Images Directory

This directory is for storing images used in your personal website.

## Recommended Image Types

1. **Profile Photo**: 
   - Dimensions: 400-600px square
   - Format: JPG or PNG
   - Filename suggestion: `profile.jpg` or `profile.png`

2. **Project Screenshots**:
   - Dimensions: 800-1200px wide
   - Format: JPG, PNG, or WebP
   - Filename suggestion: `project-name.jpg`

3. **Background Images**:
   - Dimensions: 1920px wide (for full-width sections)
   - Format: JPG or WebP (for better compression)
   - Filename suggestion: `background-section-name.jpg`

4. **Icons or Logos**:
   - Format: SVG preferred (for scalability)
   - PNG as alternative
   - Filename suggestion: `icon-name.svg`

## Image Optimization

Before adding images to this directory, please optimize them:

1. Resize to appropriate dimensions (see above)
2. Compress using a tool like:
   - [TinyPNG](https://tinypng.com/)
   - [Squoosh](https://squoosh.app/)
   - [ImageOptim](https://imageoptim.com/) (Mac app)

This will ensure your website loads quickly and uses less bandwidth.

## How to Reference Images in HTML

Use relative paths to reference images in your HTML:

```html
<!-- For profile image -->
<img src="images/profile.jpg" alt="Emily's profile photo">

<!-- For project screenshots -->
<img src="images/project-weather-app.jpg" alt="Weather App Screenshot">
```

## How to Reference Images in CSS

Use relative paths to reference images in your CSS:

```css
/* For background images */
#hero {
    background-image: url('../images/background-hero.jpg');
}

/* For smaller decorative elements */
.feature-item::before {
    content: '';
    background-image: url('../images/icon-feature.svg');
}