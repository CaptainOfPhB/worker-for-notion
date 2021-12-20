import config from './config.json';

const SLUG_TO_PAGE: Record<string, string> = {
  '': '1f9b6b0f36574becb4c1d75306e3f580',
  resume: '880d5b0cb93145d1b74696621e0ef56a',
};

const PAGE_TO_SLUG: Record<string, string> = {};
const slugs: string[] = [];
const pages: string[] = [];
Object.keys(SLUG_TO_PAGE).forEach(slug => {
  const page = SLUG_TO_PAGE[slug];
  slugs.push(slug);
  pages.push(page);
  PAGE_TO_SLUG[page] = slug;
});

function handleOptions(request: Request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS pre-flight request.
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
      },
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        'Allow': 'GET, HEAD, POST, PUT, OPTIONS',
      },
    });
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }

  const url = new URL(request.url);
  url.hostname = 'www.notion.so';
  let response: Response;

  if (url.pathname.startsWith('/app') && url.pathname.endsWith('js')) {
    response = await fetch(url.toString());
    const body = await response.text();
    response = new Response(body.replace(/www.notion.so/g, config.domain).replace(/notion.so/g, config.domain), response);
    response.headers.set('Content-Type', 'application/x-javascript');
    return response;
  }

  if (url.pathname.startsWith('/api')) {
    // Forward API
    response = await fetch(url.toString(), {
      body: url.pathname.startsWith('/api/v3/getPublicPageData') ? null : request.body,
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
      method: 'POST',
    });
    response = new Response(response.body, response);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  if (slugs.indexOf(url.pathname.slice(1)) > -1) {
    const pageId = SLUG_TO_PAGE[url.pathname.slice(1)];
    return Response.redirect('https://' + config.domain + '/' + pageId, 301);
  }

  response = await fetch(url.toString(), {
    body: request.body,
    headers: request.headers,
    method: request.method,
  });
  response = new Response(response.body, response);
  response.headers.delete('Content-Security-Policy');
  response.headers.delete('X-Content-Security-Policy');

  return handleHTML(response, SLUG_TO_PAGE);
}

class HeadRewriter {
  element(element: Element) {
    const fontLinks = config.googleFonts.map(font => (
      `
        <link
          rel='stylesheet'
          href='https://fonts.googleapis.com/css?family=${font.replace(' ', '+')}:Regular,Bold,Italic&display=swap'
        >
      `
    ));

    const fontFamily = config.googleFonts.map(font => `"${font}"`).join(',');

    element.append(
      fontLinks
        .concat(`<style>* { font-family: ${fontFamily}, monospace, sans-serif !important; }</style>`)
        .join('')
      ,
      { html: true },
    );

    element.append(
      `<style>
        div.notion-topbar > div > :not(div:first-child) { display: none !important; }
        div.notion-topbar-mobile > div[role="button"] { display: none !important; }
        div.notion-topbar-mobile > div[role="button"] { display: none !important; }
      </style>
      `,
      { html: true },
    );
  }
}

class BodyRewriter {
  SLUG_TO_PAGE: Record<string, string>;

  constructor(SLUG_TO_PAGE: Record<string, string>) {
    this.SLUG_TO_PAGE = SLUG_TO_PAGE;
  }

  element(element: Element) {
    element.append(`
      <script>
      // For fix 'Mismatch between origin and baseUrl (dev)' error 
      window.CONFIG.domainBaseUrl = "https://${config.domain}";
      
      const SLUG_TO_PAGE = ${JSON.stringify(this.SLUG_TO_PAGE)};
      const PAGE_TO_SLUG = {};
      const slugs = [];
      const pages = [];
      const el = document.createElement('div');
      let redirected = false;
      Object.keys(SLUG_TO_PAGE).forEach(slug => {
        const page = SLUG_TO_PAGE[slug];
        slugs.push(slug);
        pages.push(page);
        PAGE_TO_SLUG[page] = slug;
      });
      
      function getPage() {
        return location.pathname.slice(-32);
      }
      
      function getSlug() {
        return location.pathname.slice(1);
      }
      
      function updateSlug() {
        const slug = PAGE_TO_SLUG[getPage()];
        if (slug != null) {
          history.replaceState(history.state, '', '/' + slug);
        }
      }
      
      const observer = new MutationObserver(function() {
        if (redirected) return;
        const nav = document.querySelector('.notion-topbar');
        const mobileNav = document.querySelector('.notion-topbar-mobile');
        if (nav && nav.firstChild && nav.firstChild.firstChild || mobileNav && mobileNav.firstChild) {
          redirected = true;
          updateSlug();
          const onpopstate = window.onpopstate;
          window.onpopstate = function() {
            if (slugs.includes(getSlug())) {
              const page = SLUG_TO_PAGE[getSlug()];
              if (page) {
                history.replaceState(history.state, 'bypass', '/' + page);
              }
            }
            onpopstate.apply(this, [].slice.call(arguments));
            updateSlug();
          };
        }
      });
      
      observer.observe(document.querySelector('#notion-app'), {
        childList: true,
        subtree: true,
      });
      
      const replaceState = window.history.replaceState;
      window.history.replaceState = function(state) {
        if (arguments[1] !== 'bypass' && slugs.includes(getSlug())) return;
        return replaceState.apply(window.history, arguments);
      };
      
      const pushState = window.history.pushState;
      window.history.pushState = function(state) {
        const dest = new URL(location.protocol + location.host + arguments[2]);
        const id = dest.pathname.slice(-32);
        if (pages.includes(id)) {
          arguments[2] = '/' + PAGE_TO_SLUG[id];
        }
        return pushState.apply(window.history, arguments);
      };
      
      const open = window.XMLHttpRequest.prototype.open;
      window.XMLHttpRequest.prototype.open = function() {
        arguments[1] = arguments[1].replace('${config.domain}', 'www.notion.so');
        return open.apply(this, [].slice.call(arguments));
      };
      
      </script>
      `,
      { html: true },
    );
  }
}

async function handleHTML(response: Response, SLUG_TO_PAGE: Record<string, string>) {
  return new HTMLRewriter()
    .on('head', new HeadRewriter())
    .on('body', new BodyRewriter(SLUG_TO_PAGE))
    .transform(response);
}
