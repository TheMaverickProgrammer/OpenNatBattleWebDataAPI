/*******************************************
File name: server.js
Author: Maverick Peppers
Date: 12/16/2019
Description:
  The main script acts as a RESTful API
  server. Handles HTTP requests. Uses
  Passport for user registration and
  authentication. This script is
  a Web API on top of the Open NetBattle Web API.
********************************************/

/*******************************************
LOAD REQUIRED PACKAGES
*******************************************/
// Require the logger module
var logger = require('morgan');

// Require the express module
var express = require('express');

// Requires express-sessions
var session = require('express-session')

// Require the cookie parser module
var cookieParser = require('cookie-parser');

// Mongoose database & ORM
var mongoose = require('mongoose');
mongoose.Promise = Promise;

// Connect middleware for mongoose-passport sessions
var MongoStore = require('connect-mongo')(session);

// Require the passport module for authentication
var passport = require('passport');

// Require the body-parser module
var bodyParser = require('body-parser');

// Require the url module
var url = require('url');

// Require Cross Origin Resource Sharing
var cors = require('cors')

// Require tunnel-ssh
var tunnel = require('tunnel-ssh');

// Read in the settings json that configures our server
var settings = require('./server-settings');
const { token } = require('morgan');

// Create the express application
var app = express();

// Use environment defined port or 3000
var port = process.env.PORT || settings.server.port || 3000;

// Configure app with CORS
/*app.use(cors({
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  credentials: true,
  origin: true,
  optionsSuccessStatus: 204
}));*/

// http OPTIONS verb hack
app.use(function(req, res, next) {
    console.log("req ip: " + req.headers.origin);

    let fromOrigin = req.headers.origin.includes("http://localhost");

    console.log("fromOrigin: " + fromOrigin)

    const origin = fromOrigin ? req.headers.origin : 'http://battlenetwork.io'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-JSON')
    res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Auth-Token,X-Requested-With,Content-Type,Authorization')
    res.setHeader('Access-Control-Allow-Credentials', true)

    // stop the request here
  if(req.method == "OPTIONS") {
    res.status(200).send();
    return;
  }

  next();
});

function startServer(db, dbConnectString) {
  // Use the json parser in our application
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(cookieParser(settings.server.name + " SessionSecret"));

  // Create an express session cookie to use with passport
  app.use(session({  
    store: new MongoStore({ url: dbConnectString } ),
    name: settings.server.name + ' Cookie',
    secret: settings.server.name + ' SessionSecret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge : settings.server.sessionDurationSeconds * 1000}
  }));

  // Use the Passport middleware in our routes
  app.use(passport.initialize());
  app.use(passport.session());

  // Use the logger module in our development application
  var env = process.env.NODE_ENV || 'dev';

  if(env === 'dev') {
    app.use(logger('dev'));
  }

  app.use(function(req, res, next) {
    var session = req.session;

    if(!session) {
      session = req.session = {};
    }

    next();
  });

  // Now that the client has connected to the database,
  // add it as middleware giving the request object
  // a variable named 'database' that all routes
  // can use to execute queries.

  app.use(function(req, res, next) {
    req.database = db;

    next(); // Move onto the next middleware
  });

  /******************************************
  CONFIG SERVER
  *******************************************/

  var cleanup = function() {
      db.close();
      process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  /******************************************
  CREATE ROUTES
  *******************************************/

  app.get('/heartbeat', (req, res) => res.sendStatus(200));

  // Create our express router
  var v1Router = require('./v1/router')(db, settings);

  // Register ALL routes with /v1
  app.use('/v1', v1Router);

  // Catch 404 routing error
  app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;

    res.json(err);

    next(err);
  });

  // Dev error handler -- to print stack trace
  if(app.get('env') == 'development') {
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.json({message: err.message, error:err});
    });
  }

  // Production error handler -- no stack traces
  // leaked to user
  app.use(function(err, req, res, next) {
    res.status(err.status || 404);
    res.send();
  });

  /*****************************************
  START THE SERVER
  ******************************************/
  app.listen(port);

  console.log(settings.server.name + ' is listening on'
  + ' port ' + port + '...');
}

function startDB(config, next) {
  /*******************************************
  CONFIGURE THE DATABASE
  *******************************************/

  // Create a mongoose connection
  var mongooseConnection = mongoose.createConnection();

  // Connect to mongo
  var url = config.db.url,
      port = config.db.port,
      collection = settings.database.collection,
      user = settings.database.user,
      pass = settings.database.password;

  var connectString = 'mongodb://'+user+":"+pass+"@"+url+':'+port+'/'+collection+"?authSource=admin";
  mongoose.set('useCreateIndex', true);
  mongoose.connect(connectString, { useNewUrlParser: true, useUnifiedTopology: true} );

  // Check the state of the pending transactions
  var db = mongoose.connection;

  db.on('error', function(err) {
    // Print the error and close
    console.log(err.stack);
    db.close();
    process.exit(1);
  });

  db.once('open', function() {
    console.log("Connected to database on " + connectString);
    next(db,connectString);
  }); // end db once
}

if(settings.server.ssh.enabled) {
  let config = {
    username: settings.server.ssh.user,
    password: settings.server.ssh.password,
    host: settings.database.url,
    port: 22,
    dstHost: "localhost",
    dstPort: settings.database.port,
    tryKeyboard: true
  };

  let tnl = tunnel(config, function(error, server) {
    if(error) {
      console.error("SSH connection error: ", error);
      return;
    }

    startDB(
      {db: {url: "localhost", port: config.dstPort}},
      startServer
    );
  });
  
  tnl.on('error', function(err) {
    console.error("An error occured when running the server =>", err);
    tnl.close();
    process.exit(1);
  });

  tnl.on('keyboard-interactive', function (name, descr, lang, prompts, finish) {
      // For illustration purposes only! It's not safe to do this!
      // You can read it from process.stdin or whatever else...
      var password = config.password;
      return finish([password]);
  
      // And remember, server may trigger this event multiple times
      // and for different purposes (not only auth)
  });

} else {
  startDB(
    {db: {url: settings.database.url, port: settings.database.port}},
    startServer
  );
}