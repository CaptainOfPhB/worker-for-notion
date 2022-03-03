import config from './config.json';
import mapping from './mapping.json';
import generateHTML from './domWriter';

const slugs = Object.keys(mapping);

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

  const slug = url.pathname.slice(1) || 'default';
  if (slugs.includes(slug)) {
    const pageId = mapping[slug as keyof typeof mapping];
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

  return generateHTML(response, mapping);
}
