(function (module) {
	'use strict';

	var user = module.parent.require('./user'),
		db = module.parent.require('../src/database'),
		winston = module.parent.require('winston'),
		async = module.parent.require('async'),
		nconf = module.parent.require('nconf'),
		passport = module.parent.require('passport'),
		Strategy = require('passport-appc').Strategy;

	var Plugin = {};

	/**
	 * Hook for `filter:auth.init` as set in `plugin.json`.
	 * @param  {Array}    strategies Existing strategies
	 * @param  {Function} callback   Callback (err, strategies)
	 */
	Plugin.getStrategy = function getStrategy(strategies, callback) {

		passport.use(new Strategy({
			callbackURL: nconf.get('url') + '/auth/appc/callback',
			requireCallbackURL: true
		}, function (session, done) {

			Plugin.login(session, function (err, user) {

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
			scope: 'user:email'
		});

		callback(null, strategies);
	};

	/**
	 * Used in Plugin.getStrategy to create or update user based for session.
	 * @param  {Object}   session  Session data
	 * @param  {Function} callback Callback (err, user)
	 */
	Plugin.login = function login(session, callback) {
		var appcID = session.user.user_id; // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
		var email = session.user.email;

		// must pass utils.isUserNameValid (https://github.com/NodeBB/NodeBB/blob/master/public/src/utils.js#L102)
		var username = (session.user.github || session.user.twitter || session.user.skype || session.user['irc-nickname'] || session.user.firstmame || session.username).replace(/[^'"\s\-.*0-9\u00BF-\u1FFF\u2C00-\uD7FF\w]+/, '');

		// find NodeBB user by AppC ID
		Plugin.getUidByAppcID(appcID, function (err, uid) {

			if (err) {
				return callback(err);
			}

			// found NodeBB user
			if (uid) {
				return callback(null, {
					uid: uid
				});
			}

			/**
			 * Links NodeBB user to AppC ID
			 * @param  {Integer} uid NodeBB user ID to link
			 */
			var success = function (uid) {
				user.setUserField(uid, 'appcid', appcID);
				db.setObjectField('appcid:uid', appcID, uid);

				callback(null, {
					uid: uid
				});
			};

			// find NodeBB user by AppC email
			user.getUidByEmail(email, function (err, uid) {

				// found NodeBB user
				if (uid) {
					return success(uid);
				}

				// create NodeBB user
				user.create({
					username: username,
					email: email

				}, function (err, uid) {

					if (err !== null) {
						callback(err);
					} else {
						success(uid);
					}

				});
			});
		});
	};

	/**
	 * Gets a NodeBB UID for an AppC ID.
	 * @param  {Integer}   appcID   Appcelerator ID
	 * @param  {Function}  callback Callback (err, uid)
	 */
	Plugin.getUidByAppcID = function getUidByAppcID(appcID, callback) {
		db.getObjectField('appcid:uid', appcID, function (err, uid) {
			if (err) {
				callback(err);
			} else {
				callback(null, uid);
			}
		});
	};

	/**
	 * Deletes object fields for a user, set by this plugin.
	 * @param  {Integer}   uid      NodeBB user ID
	 * @param  {Function}  callback Callback (err, uid)
	 */
	Plugin.deleteUserData = function deleteUserData(uid, callback) {
		async.waterfall([
			async.apply(user.getUserField, uid, 'appcid'),
			function (appcID, next) {
				if (appcID) {
					async.waterfall([
						async.apply(db.deleteObjectField, 'user:' + uid, 'appcid'),
						async.apply(db.deleteObjectField, 'appcid:uid', appcID)
					], next);
				} else {
					next(null);
				}
			}
		], function (err) {
			if (err) {
				winston.error('[sso-appc] Could not remove Appc data for uid ' + uid + '. Error: ' + err);
				return callback(err);
			}
			callback(null, uid);
		});
	};

	/**
	 * Deletes object fields for an AppC ID, set by this plugin.
	 * @param  {Integer}   appcID    Appcelerator ID
	 * @param  {Function}  callback  Callback (err, uid)
	 */
	Plugin.deleteAppcData = function deleteAppcData(appcID, callback) {

		Plugin.getUidByAppcID(appcID, function (err, uid) {
			if (err) {
				winston.error('[sso-appc] Could not find data to remove for AppcID ' + appcID + '. Error: ' + err);
				return callback(err);
			}
			async.waterfall([
				async.apply(db.deleteObjectField, 'user:' + uid, 'appcid'),
				async.apply(db.deleteObjectField, 'appcid:uid', appcID)
			], function (err) {
				if (err) {
					winston.error('[sso-appc] Could not remove Appc data for AppcID ' + appcID + '. Error: ' + err);
					return callback(err);
				}
				callback(null, appcID);
			});
		});
	};

	module.exports = Plugin;
}(module));
