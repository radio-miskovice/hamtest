import * as express from 'express' ;
import { Request, Response } from 'express';
import * as session from 'express-session' ;
import { dbRouter } from './apiqueries' ;
// import * as jwt from 'express-jwt' ;

// const pool = new Pool(dbConfig);
/*
const jwtCheck = jwt({ 
  secret: Buffer.from('GnwX)TfpV0I?B5Q2jL@|[V{G06gqO*','base64'),
  audience: 'hamtest',
  algorithms: ['HS256']
});
*/
const app = express();
app.use(session({
  secret: 'GnwX)TfpV0I?B5Q2jL@|[V{G06gqO*',
  saveUninitialized: false ,
  resave: false
}))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/api', dbRouter );
app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(
    () => { res.json({ status: 'OK', result: 'logged out'})}
  )
})
app.post('/login', (req: Request, res: Response) => {
  if (req.body.user == 'ok4rm' && req.body.password == 'ok4rm') {
    // TODO: OK
    // @ts-ignore
    req.session.loggedIn = true ;
    // @ts-ignore
    req.session.user = req.body.user ;
    res.status(200).json({ status: 'OK' , result: 'Logged in'});
  }
  else {
    // AUTH ERROR
    res.status(401).json({ error: 'Invalid user ID or password '});
  }
  console.log( 'POST: ')
  console.log( req.body )
})
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to API!')
});
app.listen('8888', () => console.log('\x1b[33;1mAPI server started\x1b[0m'));




/*
const server = createServer(processRequest);
const pool = new Pool(dbConfig);
pool.connect().then(
  () => { server.listen(8888, () => console.log('Server started')) }
).catch( (err) => { 
  console.log("Could not connect to database, server not started.");
  console.log(err);
})

async function processRequest( req: IncomingMessage, res: ServerResponse ) {
  console.log(req.url);
  const urlArray = req.url.replace(/\?.*$/, '').split('/');
  const params = req.url.replace(/^.*?\?/, '').split('&');
  console.log(req.headers);
  switch( urlArray[0] ) {
    case 'contest':  getContestList( req, res ); break ;
    case 'logs': getLogsList( req, res ); break ;
    default:
      res.statusCode = 404;
      res.setHeader('Content-type', 'text/plain');
      res.end(`Cannot find URI ${req.url} at this site`);
  }
}

async function getContestList(req: IncomingMessage, res: ServerResponse ) {
  if( req.method == 'GET' ) {
    try {
      const result = await pool.query('select * from contest');
      res.setHeader('Content-Encoding', 'UTF-8');
      res.writeHead(200, 'Content-Type: application/json');
      res.end( JSON.stringify({ result: result.rows }) );
    }
    catch( err ) {
      res.writeHead(500, 'Content-Type: application/json');
      res.end( JSON.stringify(err));
    }
  }
  else badRequest( req, res );
}

async function getLogsList(req: IncomingMessage, res: ServerResponse) {
  if (req.method == 'GET') {
    try {

      const result = await pool.query('select * from logfile');
      res.setHeader('Content-Encoding', 'UTF-8');
      res.writeHead(200, 'Content-Type: application/json');
      res.end(JSON.stringify({ result: result.rows }));
    }
    catch (err) {
      res.writeHead(500, 'Content-Type: application/json');
      res.end(JSON.stringify(err));
    }
  }
  else badRequest(req, res);
}

function badRequest( req: IncomingMessage, res: ServerResponse ) {
  res.writeHead(400, 'Content-Type: application/json');
  res.end( JSON.stringify( { err: 'The request uses wrong format or method.', url: req.url, method: req.method}))
}
*/