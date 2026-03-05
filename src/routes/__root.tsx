import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Certigen — Talentease Certificate Platform" },
      {
        name: "description",
        content:
          "Generate and verify certificates of completion for Talentease workshops.",
      },
      { property: "og:title", content: "Certigen — Talentease" },
      {
        property: "og:description",
        content: "Certificate generation platform for Talentease workshops.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
