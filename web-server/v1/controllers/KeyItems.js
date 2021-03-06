/*
KeyItemsController uses routes use to KeyItems and GET resources from the Mongo DB
*/
const moment = require('moment');
const njwt = require('njwt');
const mongoose = require('mongoose');
const settings = require('../../server-settings');

var KeyItemsModel = require('./models/KeyItemsModel');
var KeyItemsController = {};

var validateUserKeyItem = async function (userId, keyitem) {
  var result = false;
  var p = KeyItemsModel.findOne({userId: userId, name: keyitem}).exec();
  await p.then((Item) => {
    if(Item == null) {
      result = true;
    }
  });
  return result;
}

// POST API_IP/VERSION/keyitems/
// Create a NEW KeyItem
// AddKeyItem
KeyItemsController.AddKeyItem = async function(req, res) {
  // Users creating key items for their servers act as a namespace 
  // for all the other key items of the same name
  var userId = req.user.userId;

  var Item = {
    userId: userId,
    name: req.body.name || "",
    description: req.body.description || "",  
    owners: req.body.owners || [],
    servers: req.body.servers || []
  };

  // Force name to fit char limit
  if(Item.name.length > settings.preferences.maxKeyItemNameLength) {
    Item.name = Item.name.substring(0, settings.preferences.maxKeyItemNameLength);
  }

  if(await validateUserKeyItem(userId, Item.name) == false) {
    return res.status(500).json({error: "You already have a key item registered with the same name"});
  }

  // Execute a query
  var model = new KeyItemsModel(Item);
  var promise = model.save();

  promise.then(function(Item) {
    res.json({data: Item});
  }).catch(function(err) {
    res.status(500).json({error: err});
  });
}

// GET API_IP/VERSION/keyitems/:id
// Get a key item
// GetKeyItemByID
KeyItemsController.GetKeyItemByID = function(req, res) {
  var query = KeyItemsModel.findOne({_id: req.params.id});
  var promise = query.exec();

  promise.then(function(Item) {
    if(Item == null) {
      return res.status(500).json({error: "Item not found with ID " + req.params.id});
    }

    res.json({data: Item});
  }).catch(function(err) {
    res.status(500).json({error: err});
  });
}

// GET API_IP/VERSION/keyitems/
// Get ALL key items created by the requesting user
// GetKeyItemsList
KeyItemsController.GetKeyItemsList = function(req, res) {  
  var query = KeyItemsModel.find({userId: req.user.userId});
  var promise = query.exec();

  promise.then(function(Items) {
    res.json({data: Items});
  }).catch(function(err) {
    res.status(500).json({error: err});
  });
}

// GET API_IP/VERSION/keyitems/owned
// Get ALL key items owned by the requesting user
// GetOwnedKeyItemsList
KeyItemsController.GetOwnedKeyItemsList = function(req, res) {  
    var query = KeyItemsModel.find({owners: req.user.userId});
    var promise = query.exec();
  
    promise.then(function(Items) {

      let outItems = [];

      Items.forEach(item => {
        let out = {};
        out.itemId = item._id;
        out.name = item.name;
        out.description = item.description;

        outItems.push(out);
      });

      res.json({data: outItems});
    }).catch(function(err) {
      res.status(500).json({error: err});
    });
  }

// GET API_IP/VERSION/keyitems/inspect/:jwt
// inspect anonymous user behind a jwt token for their key items
// InspectUserKeyItems
KeyItemsController.InspectUserKeyItems = async function(req, res) {
  njwt.verify(req.params.jwt, settings.server.signingKey, function(err, token) {
    if(err) {
      return res.status(500).json({error: "Invalid token"});
    } else {
      let otherUserId = token.body.sub;

      var query = KeyItemsModel.find({owners: mongoose.Types.ObjectId(otherUserId)});
      var promise = query.exec();
    
      promise.then(function(Items) {
  
        let outItems = [];
  
        Items.forEach(item => {
          let out = {};
          out.itemId = item._id;
          out.name = item.name;
          out.description = item.description;
  
          outItems.push(out);
        });
  
        res.json({data: outItems});
      }).catch(function(err) {
        res.status(500).json({error: err});
      });
    }
  });
}

// PUT API_IP/VERSION/keyitems/:id
// Update a key item
// UpdateKeyItem
KeyItemsController.UpdateKeyItem = function(req, res) {
  var query = KeyItemsModel.findOne({userId: req.user.userId, _id: req.params.id});
  var promise = query.exec();

  promise.then(async function(Item) {    
    if(Item == null) {
      throw "No Key Item with that ID to update";
    }

    var nameBefore = Item.name;

    Item.name = req.body.name || Item.name;
    Item.owners = req.body.owners || Item.owners;
    Item.description = req.body.description || Item.description;
    
    // Force name to fit char limit
    if(Item.name.length > settings.preferences.maxKeyItemNameLength) {
      Item.name = Item.name.substring(0, settings.preferences.maxKeyItemNameLength);
    }

    if(Item.name != nameBefore) {
      if(await validateUserKeyItem(req.user.userId, Item.name) == false) {
        throw "You already have a key item registered with the same name";
      }
    }

    return await Item.save();
  }).then(function(Item){
    res.json({data: Item});
  }).catch(function(err) {
    console.log("error: " + err);
    res.status(500).json({error: err});
  });
}

// DELETE API_IP/VERSION/keyitems/:id
// Delete a Key Item permanently
// DeleteKeyItem
KeyItemsController.DeleteKeyItem = function(req, res) {
  var query = KeyItemsModel.findOne({userId: req.user.userId, _id: req.params.id});

  var promise = query.exec();
  var name;

  promise.then(function(Item) {
    if(Item !== null) {
      name = Item.name;

      if(Item.owners.length == 0) {
        return Item.deleteOne();
      } else {
        throw "Cannot remove. This Key Item is owned by players.";
      }
    }

    throw "Could not find a key item with that ID";
  }).then(function(){
    res.status(200).json({data: {message: "Key Item " + name + " removed"}});
  }).catch(function(err) {
    res.status(500).json({error: err});
  });
}

// GET API_IP/VERSION/keyitems/since/:time
// Get an array of key items after the time (in seconds)
// GetKeyItemsAfterDate
KeyItemsController.GetKeyItemsAfterDate = function(req, res) {
  var query = KeyItemsModel.find({userId: req.user.userId, updated: { $gte : moment.unix(req.params.time) }}).exec();
  
  query.then(function(Item) {
    res.json({data: Item});
  }).catch(function(err) {
    res.status(500).json({error: err});
  });
}

module.exports = KeyItemsController;
