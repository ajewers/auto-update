var mongoose = require('mongoose');
const express = require('express');
var router = express.Router();

const fs = require('fs-extra');

// Services
const AutoUpdateService = require('../services/AutoUpdateService.js')

router.get('/', function(req, res) {
  res.send("Success");
});

/**
 * Get the checksum of the master manifest file for quick comparison
 *
 * {GET} /autoupdate/masterchecksum
 */
router.get('/masterchecksum', function(req, res) {
  AutoUpdateService.getMasterManifestChecksum()
  .then(masterCS => {
    res.json({"status": "OK", "checksum": masterCS});
  })
  .catch(err => {
    res.json({"status": "error", "err": err});
  });
});

/**
 * Recalculate the master manifest
 *
 * {GET} /autoupdate/recalcmastermanifest
 */
router.get('/recalcmastermanifest', function(req, res) {
  AutoUpdateService.createManifest()
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
router.post('/compare', function(req, res) {
  var manifest = req.body;

  var diff = AutoUpdateService.compareManifest(manifest);

  res.json(diff);
});

/**
 * Get a zip arachive of files based on a manifest diff
 *
 * {POST} '/autoupdate/diffzip'
 */
router.post('/diffzip', function(req, res) {
  var diff = req.body;

  AutoUpdateService.createDiffZip(diff)
  .then(path => fs.readFile(path)) // Read the zip file as a data stream
  .then(data => {
    // Respond to the request with the zip data
    res.set("Content-Disposition", "attachment;filename=test.zip");
    res.writeHead(200, {'Content-Type': 'application/octet-stream'});
    res.end(data);
  })
  .catch(err => {
    console.log(err);
    res.json({"status": "error", "err": err});
  });
});

module.exports = router;
