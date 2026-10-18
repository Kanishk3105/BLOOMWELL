import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BloomWell',
    short_name: 'BloomWell',
    description: 'A calm women’s health companion for cycle tracking and nutrition.',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#f8f3f6',
    theme_color: '#7b5cc8',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
