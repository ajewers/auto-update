// Electron
const ipcRenderer = require('electron').ipcRenderer;

// Services
const AutoUpdateClientService = require('./services/AutoUpdateClientService.js');

$(document).ready(() => {
  updateBarCheck();
});

$('#check-updates-button').on('click', updateBarCheck);

function updateBarCheck() {
  $('#update-bar').addClass('active');
  $('#update-bar-available').hide();
  $('#update-bar-progress').hide();
  $('#update-bar-checking').show();

  setUpdateProgress(0, "");

  checkForUpdates()
  .then((updates, diff) => {
    $('#update-bar-checking').hide();

    if (updates) {
      $('#update-bar-available').show();
    } else {
      $('#update-bar-progress').show();
      setUpdateProgress(100, "Up to date.");

      setTimeout(() => {
        $('#update-bar').removeClass('active');
      }, 3000);
    }
  })
  .catch(err => {
    $('#update-bar-available').hide();
    $('#update-bar-checking').hide();
    $('#update-bar-progress').show();
    setUpdateProgress(0, err);
  });
}

function checkForUpdates() {
  return new Promise((resolve, reject) => {
    AutoUpdateClientService.createManifest()                        // Create the local manifest
    .then(() => recalcMasterManifest())                             // Tell the server to recalculate the master manifest
    .then(() => AutoUpdateClientService.compareToMasterManifest())  // Compare manifests
    .then(diff => {
      resolve(Object.keys(diff).length > 0, diff);
    })
    .catch(err => {
      reject(err);
    });
  });
}

// Get updates button
$('#get-update-button').on('click', () => {
  $('#update-bar-available').hide();
  $('#update-bar-progress').show();

  // Start progress reporting
  setUpdateProgress(10, "Creating manifest...");

  AutoUpdateClientService.createManifest()                        // Create the local manifest
  .then(() => setUpdateProgress(25, "Retreiving master manifest..."))
  .then(() => recalcMasterManifest())                             // Tell the server to recalculate the master manifest
  .then(() => setUpdateProgress(50, "Creating diff.."))
  .then(() => AutoUpdateClientService.compareToMasterManifest())  // Compare manifests
  .then(diff => {
    // If the diff object has keys, there are files to update
    if (Object.keys(diff).length > 0) {
      setUpdateProgress(75, "Downloading files...");
      return AutoUpdateClientService.getDiffZip(diff);            // Download the diff zip
    } else {
      // No files to update
      return Promise.reject("Up to date.");
    }
  })
  .then(zip => AutoUpdateClientService.applyZip(zip))             // Apply the files in the zip
  .then(folder => {
    setUpdateProgress(100, "Restarting...");

    setTimeout(() => {
      ipcRenderer.send('reload');
    }, 1000);
  })
  .catch(err => {
    setUpdateProgress(0, err);
  })
});

function recalcMasterManifest() {
  return new Promise((resolve, reject) => {
    var url = "http://127.0.0.1:4000/autoupdate/recalcmastermanifest";

    $.ajax({
      method: "GET",
      url: url,
      success: function(data) {
        if (data.status == "OK") {
          resolve();
        } else {
          reject(data.err);
        }
      }
    });
  });
}

function setUpdateProgress(perc, text) {
  /*var width = (perc/100) * 250;
  $('.progress-bar-inner ').css('width', width);

  $('#progress-text').html(text);*/

  $('#progress-bar-inner').css('width', perc + "%");
  $('#progress-bar-text').html(text);
}//#
