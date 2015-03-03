(function(module) {
  "use strict";

  var User = module.parent.require('./user'),
    db = module.parent.require('../src/database'),
    meta = module.parent.require('./meta'),
    passport = module.parent.require('passport'),
    Strategy = require('passport-appc').Strategy,
    fs = module.parent.require('fs'),
    path = module.parent.require('path'),
    winston = module.parent.require('winston');

  var Plugin = {};

  Plugin.getStrategy = function(strategies, callback) {

    passport.use(new Strategy(function verify(session, done) {
      Plugin.login(session.user, function(err, user) {
        if (err) {
          return done(err);
        }
        done(null, user);
      });
    }));

    strategies.push({
      name: 'appc',
      url: '/auth/appc',
      callbackURL: '/auth/appc/callback',
      icon: 'fa-key'
    });

    callback(null, strategies);
  };

  Plugin.login = function(user, callback) {
    var appcID = user.user_id;
    var email = user.email;
    var username = user.user_id;

    // find NodeBB user by AppC ID
    Plugin.getUidByAppcID(appcID, function(err, uid) {

      if (err) {
        return callback(err);
      }

      // found NodeBB user
      if (uid) {

        return callback(null, {
          uid: uid
        });
      }

      // link NodeBB user to AppC ID
      var success = function(uid) {
        User.setUserField(uid, 'appcid', appcID);
        db.setObjectField('appcid:uid', appcID, uid);

        callback(null, {
          uid: uid
        });
      };

      // find NodeBB user by AppC email
      User.getUidByEmail(email, function(err, uid) {

        // found NodeBB user
        if (uid) {
          return success(uid);
        }

        // create NodeBB user
        User.create({
          username: username,
          email: email

        }, function(err, uid) {

          if (err !== null) {
            callback(err);
          } else {
            success(uid);
          }

        });
      });
    });
  };

  Plugin.getUidByAppcID = function(appcID, callback) {
    db.getObjectField('appcid:uid', appcID, function(err, uid) {
      if (err) {
        callback(err);
      } else {
        callback(null, uid);
      }
    });
  };

  module.exports = Plugin;
}(module));
