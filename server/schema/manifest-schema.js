var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ManifestSchema = new Schema({
    appname: String,
    manifest: String
});

module.exports = mongoose.model('manifest', ManifestSchema);
