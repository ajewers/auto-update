// External modules
const fs = require('fs-extra');
const path = require('path');
const checksum = require('checksum');

// Master application location
const masterAppRoot = path.join(__dirname, '../master-application');
const masterAppManifest = path.join(__dirname, '../../master-application-manifest.json');

// External modules
const JSZip = require('jszip');

// Manifest of master application
var masterManifest = {};

var AutoUpdateService = {
  init : () => {
    return new Promise((resolve, reject) => {
      AutoUpdateService.createManifest()
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Create the manifest file describing the master application
  createManifest : () => {
    return new Promise((resolve, reject) => {
      AutoUpdateService.checkFolder(masterAppRoot)
      .then(data => {
        masterManifest = data;

        return fs.writeFile(masterAppManifest, JSON.stringify(masterManifest, null, 2));
      })
      .then(() => {
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
          promises.push(AutoUpdateService.itemInfo(folderPath + "/" + item));
        });

        return Promise.all(promises);
      })
      .then(results => {
        var promises = [];

        results.forEach(item => {
          if (item.isDir == true) {
            promises.push(AutoUpdateService.checkFolder(folderPath + "/" + item.name)
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

        return AutoUpdateService.checksum(itemPath, info['isDir']);
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
  getMasterManifest : () => {
    return masterManifest;
  },

  // Get the checksum of the master manifest file
  getMasterManifestChecksum : () => {
    return new Promise((resolve, reject) => {
      checksum.file(masterAppManifest, function(err, sum) {
        if (err) {
          reject(err);
        } else {
          resolve(sum);
        }
      });
    })
  },

  // Compare a manifest file against the master, returning an object containing the differing files/folders
  compareManifest : (manifest) => {
    return AutoUpdateService.compareFolders(masterManifest, manifest);
  },

  // Compare two folders within two manifests
  compareFolders : (base, comp) => {
    var diff = {};

    Object.keys(base).forEach(key => {
      // Check if each item in the master is present in the comparitor
      if (comp.hasOwnProperty(key)) {
        var masterItem = base[key];
        var item = comp[key];

        // If both are strings, they are file checksums
        if (typeof masterItem == "string" && typeof item == "string") {
          // If checksums do not match, add file to diff
          if (masterItem != item) {
            diff[key] = masterItem;
          }
        } else if (typeof masterItem == "object" && typeof item == "object") {
          // If both are objects, they are folders, so compare recursively
          var subDiff = AutoUpdateService.compareFolders(masterItem, item);

          // If the folders are equal, an empty object is returned
          if (Object.keys(subDiff).length > 0 ) {
            diff[key] = subDiff;
          }
        } else {
          // If types differ, the whole object needs updating, so add master copy to diff
          diff[key] = masterItem;
        }
      } else {
        // Not present in comparitor, so add to the diff
        diff[key] = base[key];
      }
    });

    return diff;
  },

  createDiffZip : (diff) => {
    return new Promise((resolve, reject) => {
      var zip = new JSZip();

      AutoUpdateService.zipFolder(diff, zip, masterAppRoot)
      .then(() => {
        var zipSavePath = path.join(__dirname, '../zips/temp.zip');

        zip.generateNodeStream({type:'nodebuffer', streamFiles:true})
        .pipe(fs.createWriteStream(zipSavePath))
        .on('finish', () => {
          resolve(zipSavePath);
        });
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  zipFolder : (diff, zip, root) => {
    return new Promise((resolve, reject) => {
      var promises = [];

      Object.keys(diff).forEach(key => {
        var item = diff[key];

        if (typeof item == "string") {
          // File
          promises.push(fs.readFile(root + "/" + key)
                        .then(data => {
                          zip.file(key, data);
                        }));
        } else if (typeof item == "object") {
          var folder = zip.folder(key);
          promises.push(AutoUpdateService.zipFolder(item, folder, root + "/" + key))
        }
      });

      Promise.all(promises)
      .then(() => {
        resolve();
      })
      .catch(err => {
        reject(err);
      });
    });
  }
}

module.exports = AutoUpdateService;
