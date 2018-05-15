var mongoose = require('mongoose');
const express = require('express');
var router = express.Router();

const fs = require('fs-extra');

// Services
const AutoUpdateService = require('../services/AutoUpdateService.js');

/**
 * Recalculate the master manifest
 *
 * {GET} /autoupdate/recalcmastermanifest/:appname
 */
router.get('/recalcmastermanifest/:appname', function(req, res) {
  var appname = req.params.appname;

  AutoUpdateService.createManifest(appname)
  .then(() => {
    res.json({"status": "OK"});
  })
  .catch(err => {
    res.json({"status": "error", "err": err});
  })
});

/**
 * Get the difference between a provided manifest and the master
 *
 * {POST} '/autoupdate/compare'
 */
router.post('/compare/:appname', function(req, res) {
  var manifest = req.body;
  var appname = req.params.appname;

  AutoUpdateService.compareManifest(manifest, appname)
  .then(diff => {
    res.json({"status": "OK", "diff": diff});
  })
  .catch(err => {
    res.json({"status": "error", "err": err});
  });
});

/**
 * Get a zip arachive of files based on a manifest diff
 *
 * {POST} '/autoupdate/diffzip'
 */
router.post('/diffzip/:appname', function(req, res) {
  var diff = req.body;
  var appname = req.params.appname;

  AutoUpdateService.createDiffZip(diff, appname)
  .then(path => fs.readFile(path)) // Read the zip file as a data stream
  .then(data => {
    // Respond to the request with the zip data
    res.set("Content-Disposition", "attachment;filename=update.zip");
    res.writeHead(200, {'Content-Type': 'application/octet-stream'});
    res.end(data);
  })
  .catch(err => {
    console.log(err);
    res.json({"status": "error", "err": err});
  });
});

module.exports = router;
