import config from './config.json';

class HeadRewriter {
  element(element: Element) {
    element.append(
     `
        <style>
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

function generateHTML(response: Response, mapping: Record<string, string>) {
  return new HTMLRewriter()
    .on('head', new HeadRewriter())
    .on('body', new BodyRewriter(mapping))
    .transform(response);
}

export default generateHTML;
