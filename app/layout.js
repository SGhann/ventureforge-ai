export const metadata = {
  title: "VentureForge AI — From Ideation to IPO",
  description: "11 specialist AI agents guide your business from idea to IPO. Market research, financial modeling, legal, fundraising, marketing — all institutional quality.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0e17" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', system-ui, sans-serif; background: #0a0e17; color: #e2e8f0; -webkit-font-smoothing: antialiased; overflow: hidden; }
          html, body, #__next { height: 100%; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
          input, textarea, button { font-family: inherit; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
