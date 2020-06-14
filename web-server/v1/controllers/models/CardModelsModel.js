var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var Schema = mongoose.Schema;

var CardModelsModel = Schema({
  name: {type: String, required: true, unique: true},
  damage: {type: Number, required: true},
  element: {type: String, required: true},
  secondaryElement: {type: String, default: "None"},
  description: {type: String, required: true}, // char limit
  verboseDescription: {type: String, required: true}, // char limit
  image: {type: String, required: true},       // URL location
  icon:  {type: String, required: true},       // URL location
  created: {type: Date, default: Date.now},
  updated: {type: Date, default: Date.now},
  codes: {type: Array, default: ['*']}
});

// Execute before each .save() call
CardModelsModel.pre('save', function(callback) {
  var self = this;
  self.updated = Date.now();
  callback();
});

// Export function to create CardModels model class
module.exports = mongoose.model('CardModels', CardModelsModel);
