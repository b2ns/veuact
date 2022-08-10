import { createServer, STATUS_CODES } from 'http';
import { isObject, isUndef } from '../utils.js';
import preprocessMiddleware from './middlewares/preprocess.js';
import staticAssets from './middlewares/staticAssets.js';

const HOST = 'localhost';
const PORT = 8080;

export default class PackServer {
  constructor(config = {}) {
    this.config = config;
    this.middlewares = [];
    this.httpServer = createServer();

    this.origin = '';

    this.init();
  }

  static createServer(config) {
    return new this(config);
  }

  init() {
    const { root = process.cwd(), dev = false } = this.config;

    this.use(preprocessMiddleware()).use(staticAssets(root, { dev }));

    this.httpServer.on('request', createRequestListener(this.middlewares));

    this.httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.listen(err.port + 1);
        return;
      }
      console.error(err);
    });

    this.httpServer.once('listening', () => {
      console.log(`
listening ...
  ${this.origin}
`);
    });
  }

  use(route, handler) {
    if (isUndef(handler)) {
      handler = route;
      route = '/';
    }
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    this.middlewares.push({ route, handler });
    return this;
  }

  listen(port = PORT, host = HOST) {
    this.origin = `http://${host}:${port}`;
    this.httpServer.listen(port, host);
    return this;
  }
}

// use express/connect middleware form
function createRequestListener(middlewares) {
  return (req, res) => {
    let index = 0;

    const next = (err) => {
      const middleware = middlewares[index++];
      if (!middleware) {
        setImmediate(() => done(err, req, res));
        return;
      }

      const path = req.path || '/';
      const { route, handler } = middleware;
      const routeRE = new RegExp(`^${route}([/].*)?$`);

      // skip unmatched route
      if (!routeRE.test(path)) {
        return next(err);
      }

      try {
        if (err && handler.length === 4) {
          handler(err, req, res, next);
          return;
        } else if (!err && handler.length < 4) {
          handler(req, res, next);
          return;
        }
      } catch (error) {
        err = error;
      }
      next(err);
    };

    next();
  };
}

function done(err, req, res) {
  let headers = null;
  let status = '';
  let msg = '';

  if (res.headersSent) {
    req.socket.destroy();
    return;
  }

  if (err) {
    headers = err.headers;
    status = err.status || err.statusCode || res.statusCode;
    msg = err.msg || STATUS_CODES[status] || status;
  } else {
    status = 404;
    msg = STATUS_CODES[status] || status;
  }

  const body = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error</title>
  </head>
  <body>
    <pre>${msg}</pre>
  </body>
</html>`;

  if (isObject(headers)) {
    for (const key in headers) {
      res.setHeader(key, headers[key]);
    }
  }

  res
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('Content-Length', Buffer.byteLength(body, 'utf8'))
    .writeHead(status, msg);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(body, 'utf8');
}