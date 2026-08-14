import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';

import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
    meta: [
      { charSet: 'utf-8' },
      {
        content: 'A daily geography mystery, solved one clue at a time.',
        name: 'description',
      },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { content: '#0d1924', name: 'theme-color' },
      { title: 'Whereabouts — Daily geography mystery' },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
