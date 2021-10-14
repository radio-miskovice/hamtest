import express from 'express' ;
import { Request, Response } from 'express';
import fileUpload from 'express-fileupload';
import session from 'express-session' ;
import { dbRouter } from './apiqueries' ;
import path from 'path' ;

const staticDir = path.resolve(__dirname, '..', 'sample', 'ignore');

const app = express();
app.use(session({
  secret: 'GnwX)TfpV0I?B5Q2jL@|[V{G06gqO*',
  saveUninitialized: false ,
  resave: false
}))
app.use(express.static("C:\\Users\\jvavruska\\dev\\@DB\\hamtest-web\\public"))
app.use( fileUpload() );
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Allow", "GET, POST, OPTIONS, PUT, DELETE");
  next();
});
app.use('/api', dbRouter );
app.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(
    () => { res.json({ status: 'OK', result: 'logged out'})}
  )
});

app.post('/login', (req: Request, res: Response) => {
  let loginSuccess = false ;
  if (req.body.user == 'ok4rm' && req.body.password == 'ok4rm') {
    loginSuccess = true ;
    // @ts-ignore
    req.session.loggedIn = true ;
    // @ts-ignore
    req.session.user = req.body.user ;
    res.status(200).json({ status: 'OK' , code: 100, result: 'Logged in'});
  }
  else {
    // AUTH ERROR
    res.status(200).json({ status: 'error', code: 400, error: 'Invalid user ID or password '});
  }
  console.log( {loginSuccess} )
})
app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to API!')
});
app.listen('8888', () => console.log(`\x1b[33;1mAPI server started\x1b[0m (${__dirname})`));
