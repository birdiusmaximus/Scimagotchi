import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Web-only root HTML (Expo Router static web). Loads the Adobe Fonts (Typekit)
 * kit `abe4vwg` — Neue Haas Grotesk (display + text) for a refined, designed feel,
 * plus Acumin Pro Extra Condensed for large numerals. The CSS variables those
 * fonts back live in src/global.css. Native falls back to the system face.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <link rel="stylesheet" href="https://use.typekit.net/abe4vwg.css" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
