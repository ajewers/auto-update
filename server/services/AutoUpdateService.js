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

      // Read all the top level items in this directory
      fs.readdir(folderPath)
      .then(items => {
        var promises = [];

        // Create a promise to analyse each item
        items.forEach(item => {
          promises.push(AutoUpdateService.itemInfo(folderPath + "/" + item));
        });

        // Wait for all promises to complete
        return Promise.all(promises);
      })
      .then(results => {
        var promises = [];

        // Go through the info for each item
        results.forEach(item => {
          if (item.isDir == true) {
            // If the item is a directory, make a promise to analyse it recursively
            // and add the result to the folder object
            promises.push(AutoUpdateService.checkFolder(folderPath + "/" + item.name)
                          .then(subfolder => {
                            folder[item.name] = subfolder;
                          }));
          } else {
            // If the item is file, add its checksum to the folder object against
            // its name. Ignore .asar files.
            if (!item.name.endsWith(".asar")) {
              folder[item.name] = item.checksum;
            }
          }
        });

        // Wait for recursive anaylsis promises to complete
        return Promise.all(promises);
      })
      .then(() => {
        // Return the fully populated folder object
        resolve(folder);
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Create the base manifest entry for a single file or folder
  itemInfo : (itemPath) => {
    return new Promise((resolve, reject) => {
      // Stash the name of the file or folder
      var info = {
        name: path.basename(itemPath)
      };

      // Get the item stats
      fs.lstat(itemPath)
      .then(stats => {
        // Record if this is a directory or not
        info['isDir'] = stats.isDirectory();

        // Get the checksum of this item (returns null for directories)
        return AutoUpdateService.checksum(itemPath, info['isDir']);
      })
      .then(checksum => {
        // If this was a file, stash the checksum
        if (checksum != null) {
          info['checksum'] = checksum;
        }

        // Return the stashed info
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

  // Create and save a zip archive of all the files identified in a diff
  createDiffZip : (diff) => {
    return new Promise((resolve, reject) => {
      // Creat empty zip object
      var zip = new JSZip();

      // Recursively add files to the zip object
      AutoUpdateService.zipFolder(diff, zip, masterAppRoot)
      .then(() => {
        // Path to store the zip
        var zipSavePath = path.join(__dirname, '../zips/update.zip');

        // Save the zip through a write stream
        zip.generateNodeStream({type:'nodebuffer', streamFiles:true})
        .pipe(fs.createWriteStream(zipSavePath))
        .on('finish', () => {
          // Return the path to the zip
          resolve(zipSavePath);
        });
      })
      .catch(err => {
        reject(err);
      });
    });
  },

  // Adds all files and folders within a diff object to a zip archive, recursively
  zipFolder : (diff, zip, root) => {
    return new Promise((resolve, reject) => {
      var promises = [];

      // For each entry in the diff
      Object.keys(diff).forEach(key => {
        var item = diff[key];

        // If string type, the entry is a file checksum
        if (typeof item == "string") {
          // Make a promise to read the file and add it to the zip
          promises.push(fs.readFile(root + "/" + key)
                        .then(data => {
                          zip.file(key, data);
                        }));
        } else if (typeof item == "object") {
          // If object type, this entry is a folder, so create a folder within the zip
          var folder = zip.folder(key);

          // Make a promise to recursively add all files and folders within this folder to the zip
          promises.push(AutoUpdateService.zipFolder(item, folder, root + "/" + key))
        }
      });

      // Wait for all promises to complete
      Promise.all(promises)
      .then(() => {
        // Zip object is complete, return
        resolve();
      })
      .catch(err => {
        reject(err);
      });
    });
  }
}

module.exports = AutoUpdateService;
