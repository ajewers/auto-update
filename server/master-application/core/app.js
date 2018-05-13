// Electron
const ipcRenderer = require('electron').ipcRenderer;

// Services
const AutoUpdateClientService = require('./services/AutoUpdateClientService.js');

// Application startup
$(document).ready(() => {
  // Check for updates
  updateBarCheck();
});

$('#check-updates-button').on('click', updateBarCheck);

function updateBarCheck() {
  // Show the update bar and checking message
  $('#update-bar').addClass('active');
  $('#update-bar-available').hide();
  $('#update-bar-progress').hide();
  $('#update-bar-checking').show();

  // Revert to zero progress
  setUpdateProgress(0, "");

  // Perform the update check
  checkForUpdates()
  .then((updates) => {
    // Hide the checking message
    $('#update-bar-checking').hide();

    // If there are updates, show the update button
    if (updates) {
      $('#update-bar-available').show();
    } else {
      // No updates, show the progress indicator and jump to 100%
      $('#update-bar-progress').show();
      setUpdateProgress(100, "Up to date.");

      // Wait three seconds then hide the update bar
      setTimeout(() => {
        $('#update-bar').removeClass('active');
      }, 3000);
    }
  })
  .catch(err => {
    // If an error occurs, show the error and revert to zero progress
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
      resolve(Object.keys(diff).length > 0);                        // Resolve with a boolean indicating whether updates exist
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
  .then(zip => AutoUpdateClientService.deleteZip(zip))            // Delete the used zip archive
  .then(() => {
    setUpdateProgress(100, "Restarting...");

    // Wait 1 second for restarting message to be seen, then send command to main thread to restart
    setTimeout(() => {
      ipcRenderer.send('restart');
    }, 1000);
  })
  .catch(err => {
    // If an error occurs revert to zero progress and show the error message
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
  $('#progress-bar-inner').css('width', perc + "%");
  $('#progress-bar-text').html(text);
}
