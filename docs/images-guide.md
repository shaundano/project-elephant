# How to Add Images in MkDocs

MkDocs makes it easy to add images to your documentation. Here's how:

## Basic Image Syntax

Use standard Markdown image syntax:

```markdown
![Alt text](path/to/image.png)
```

Or with a title:

```markdown
![Alt text](path/to/image.png "Image title")
```

## Image Organization

### Recommended Structure

Create an `images` folder in your `docs` directory:

```
docs/
  ├── index.md
  ├── images/
  │   ├── screenshot1.png
  │   ├── diagram.svg
  │   └── logo.jpg
  └── Introduction/
      └── overview.md
```

### Paths

**From the same directory:**
```markdown
![Screenshot](images/screenshot.png)
```

**From a subdirectory:**
```markdown
![Diagram](../images/diagram.png)
```

**From the root docs folder:**
```markdown
![Logo](/images/logo.png)
```

## Examples

### Basic Image
```markdown
![Architecture Diagram](images/architecture.png)
```

### Image with Link
```markdown
[![Click me](images/thumbnail.png)](images/full-size.png)
```

### Centered Image (using HTML)
```markdown
<p align="center">
  <img src="images/logo.png" alt="Logo" width="200">
</p>
```

### Image with Caption (using HTML)
```markdown
<figure>
  <img src="images/diagram.png" alt="System Architecture">
  <figcaption>Figure 1: System Architecture Overview</figcaption>
</figure>
```

## Supported Formats

MkDocs supports all standard web image formats:
- **PNG** - Best for screenshots, diagrams with text
- **JPG/JPEG** - Best for photos
- **SVG** - Best for scalable diagrams and logos
- **GIF** - For animated images
- **WebP** - Modern format with good compression

## Best Practices

1. **Use descriptive alt text** - Important for accessibility
2. **Optimize images** - Compress large images before adding them
3. **Use relative paths** - Makes your docs portable
4. **Organize in folders** - Keep images organized by topic
5. **Use SVG when possible** - Scales perfectly at any size

## Example: Adding an Image to Your Docs

1. Create the images folder:
   ```bash
   mkdir docs/images
   ```

2. Add your image file (e.g., `docs/images/architecture.png`)

3. Reference it in your markdown:
   ```markdown
   ![System Architecture](images/architecture.png)
   ```

4. The image will appear when you build or serve your docs!

## Troubleshooting

**Image not showing?**
- Check the path is correct (relative to the markdown file)
- Make sure the image file exists
- Check for typos in the filename
- Use `/images/` (with leading slash) for paths from root

**Image too large?**
- Use HTML to resize: `<img src="images/photo.jpg" width="500">`
- Or compress the image file itself

