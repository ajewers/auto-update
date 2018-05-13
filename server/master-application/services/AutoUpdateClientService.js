// External modules
const fs = require('fs-extra');
const path = require('path');
const checksum = require('checksum');
const request = require('request');
const unzipper = require('unzipper');

// Application location
const appRoot = path.join(__dirname, '../');

// Manifest of master application
var localManifest = {};

var AutoUpdateClientService = {
  // Create the manifest file describing the master application
  createManifest : () => {
    return new Promise((resolve, reject) => {
      AutoUpdateClientService.checkFolder(appRoot)
      .then(data => {
        localManifest = data;
        resolve();
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Create the manifest entry for a folder and its contents (recursively)
  checkFolder : (folderPath) => {
    return new Promise((resolve, reject) => {
      var folder = {};

      fs.readdir(folderPath)
      .then(items => {
        var promises = [];

        items.forEach(item => {
          promises.push(AutoUpdateClientService.itemInfo(folderPath + "/" + item));
        });

        return Promise.all(promises);
      })
      .then(results => {
        var promises = [];

        results.forEach(item => {
          if (item.isDir == true) {
            promises.push(AutoUpdateClientService.checkFolder(folderPath + "/" + item.name)
                          .then(subfolder => {
                            folder[item.name] = subfolder;
                          }));
          } else {
            if (!item.name.endsWith(".asar")) {
              folder[item.name] = item.checksum;
            }
          }
        });

        return Promise.all(promises);
      })
      .then(() => {
        resolve(folder);
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Create the manifest entry for a single file or folder
  itemInfo : (itemPath) => {
    return new Promise((resolve, reject) => {
      var info = {
        name: path.basename(itemPath)
      };

      fs.lstat(itemPath)
      .then(stats => {
        info['isDir'] = stats.isDirectory();

        return AutoUpdateClientService.checksum(itemPath, info['isDir']);
      })
      .then(checksum => {
        if (checksum != null) {
          info['checksum'] = checksum;
        }

        resolve(info);
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Get the checksum for a file, or null if it is a directory
  checksum : (itemPath, isDir) => {
    return new Promise((resolve, reject) => {
      if (isDir) {
        resolve(null);
      } else {
        checksum.file(itemPath, function(err, sum) {
          if (err) {
            reject(err);
          } else {
            resolve(sum);
          }
        });
      }
    });
  },

  // Get the manifest file for the master application
  getLocalManifest : () => {
    return localManifest;
  },

  // Compare the local manifest to the master manifest
  compareToMasterManifest : () => {
    return new Promise((resolve, reject) => {
      var url = "http://127.0.0.1:4000/autoupdate/compare";
      var localManifest = AutoUpdateClientService.getLocalManifest();

      $.ajax({
        method: "POST",
        url: url,
        contentType: 'application/json',
        dataType: "json",
        data: JSON.stringify(localManifest),
        success: function(diff) {
          resolve(diff);
        }
      });
    });
  },

  // Get a zip file containing any files identified in the diff manifest
  getDiffZip : (diff) => {
    return new Promise((resolve, reject) => {
      var url = "http://127.0.0.1:4000/autoupdate/diffzip";
      var zipfile = path.join(__dirname, '../../update.zip');

      request.post({
        headers: {'content-type' : 'application/json'},
        url: url,
        body: JSON.stringify(diff)
      })
      .on('error', (err) => {
        reject(err);
      })
      .pipe(fs.createWriteStream(zipfile))
      .on('close',() => {
        resolve(zipfile);
      });
    });
  },

  // Decompress the zip and apply the updated files
  applyZip : (zip) => {
    return new Promise((resolve, reject) => {
      // The target folder is the root of the application
      var folder = path.join(__dirname, '../');

      // Create an extractor
      var extractor = unzipper.Extract({ path: folder });

      // When the extractor completes, return the path to the zip file, so it may be deleted
      extractor.on('close', () => {
        resolve(zip);
      });

      // Reject if errors occur
      extractor.on('error', err => {
        reject(err);
      });

      // Begin extracting
      fs.createReadStream(zip).pipe(extractor);
    });
  },

  // Delete a zip file that is no longer needed
  deleteZip : (zip) => {
    return new Promise((resolve, reject) => {
      fs.unlink(zip)
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      })
    });
  }
}

module.exports = AutoUpdateClientService;
