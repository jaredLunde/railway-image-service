# Railway Image Service demo

This is a demo of the Railway Image Service. It's a simple service that allows you to upload images and view them in a gallery.

## Where to look

- [pages/\[size\]/\[...path\].ts](pages/%5Bsize%5D/%5B...path%5D.ts) - An endpoint that resizes images on the fly
- [pages/upload/\[...path\].ts](pages/upload/%5B...path%5D.ts) - An endpoint that allows users to upload images with signed URLs
- [components/Uploader.tsx](components/Uploader.tsx) - A React component that allows users to upload images
