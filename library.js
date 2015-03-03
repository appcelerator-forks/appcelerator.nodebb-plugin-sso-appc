(function(module) {
  'use strict';

  var user = module.parent.require('./user'),
    db = module.parent.require('../src/database'),
    winston = module.parent.require('winston'),
    async = module.parent.require('async'),
    nconf = module.parent.require('nconf'),
    passport = module.parent.require('passport'),
    Strategy = require('passport-appc').Strategy;

  var Plugin = {};

  Plugin.getStrategy = function(strategies, callback) {

    passport.use(new Strategy({
      callbackURL: nconf.get('url') + '/auth/appc/callback',
      requireCallbackURL: true

    }, function verify(session, done) {

      Plugin.login(session, function(err, user) {

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
      icon: 'fa-key',
      scope: ''
    });

    callback(null, strategies);
  };

  Plugin.login = function(session, callback) {
    var appcID = session.user.user_id;
    var email = session.user.email;

    // must pass utils.isUserNameValid (https://github.com/NodeBB/NodeBB/blob/master/public/src/utils.js#L102)
    var username = (session.user.github || session.user.twitter || session.user.skype || session.user['irc-nickname'] || session.user.firstmame || session.username).replace(/['"\s\-.*0-9\u00BF-\u1FFF\u2C00-\uD7FF\w]+/, '');

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
        user.setUserField(uid, 'appcid', appcID);
        db.setObjectField('appcid:uid', appcID, uid);

        callback(null, {
          uid: uid
        });
      };

      // find NodeBB user by AppC email
      user.getUidByEmail(email, function(err, uid) {

        // found NodeBB user
        if (uid) {
          return success(uid);
        }

        // create NodeBB user
        user.create({
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

  Plugin.deleteUserData = function(uid, callback) {
    async.waterfall([
      async.apply(user.getUserField, uid, 'appcid'),
      function(appcIDToDelete, next) {
        db.deleteObjectField('appcid:uid', appcIDToDelete, next);
      }
    ], function(err) {
      if (err) {
        winston.error('[sso-appc] Could not remove Appc data for uid ' + uid + '. Error: ' + err);
        return callback(err);
      }
      callback(null, uid);
    });
  };

  module.exports = Plugin;
}(module));
