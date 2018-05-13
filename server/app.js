// MongoDB
var mongoose = require('mongoose');

// Express server
const express = require('express')
const app = express();
const http = require('http').Server(app);
const bodyParser = require('body-parser');

const serverPort = 4000;

// Services
const AutoUpdateService = require('./services/AutoUpdateService.js');

// Routers
const AutoUpdateRouter = require('./routes/AutoUpdateRouter.js');

// Get Mongoose to use the global promise library
mongoose.Promise = global.Promise;

// Connect to mongo database
mongoose.connect('mongodb://127.0.0.1/AutoUpdate')
.then(() => {
  // Get the default connection & bind connection to error event (to get notification of connection errors)
  var db = mongoose.connection;
  db.on('error', console.error.bind(console, 'MongoDB connection error:'));

  // Set up express server
  app.use(express.json({limit: '50mb'}));            // JSON parsing
  app.use(express.static('public'));                 // Serve public static files
  app.use(bodyParser.json({limit: '50mb'}));         // Parse post request json bodies
  app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

  app.use('/autoupdate', AutoUpdateRouter); // Auto update router

  // Start express server
  http.listen(serverPort, () => {
    console.log('Server started on port ' + serverPort);
  });
});
