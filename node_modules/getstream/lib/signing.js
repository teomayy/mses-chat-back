"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JWTScopeToken = JWTScopeToken;
exports.JWTUserSessionToken = JWTUserSessionToken;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2.default)(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
// for a claim in jwt
function joinClaimValue(items) {
  var values = Array.isArray(items) ? items : [items];
  var claims = [];
  for (var i = 0; i < values.length; i += 1) {
    var s = values[i].trim();
    if (s === '*') return s;
    claims.push(s);
  }
  return claims.join(',');
}

/**
 * Creates the JWT token for feedId, resource and action using the apiSecret
 * @method JWTScopeToken
 * @memberof signing
 * @private
 * @param {string} apiSecret - API Secret key
 * @param {string | string[]} resource - JWT payload resource
 * @param {string | string[]} action - JWT payload action
 * @param {object} [options] - Optional additional options
 * @param {string | string[]} [options.feedId] - JWT payload feed identifier
 * @param {string} [options.userId] - JWT payload user identifier
 * @param {boolean} [options.expireTokens] - JWT noTimestamp
 * @return {string} JWT Token
 */
function JWTScopeToken(apiSecret, resource, action) {
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var noTimestamp = options.expireTokens ? !options.expireTokens : true;
  var payload = {
    resource: joinClaimValue(resource),
    action: joinClaimValue(action)
  };
  if (options.feedId) payload.feed_id = joinClaimValue(options.feedId);
  if (options.userId) payload.user_id = options.userId;
  return _jsonwebtoken.default.sign(payload, apiSecret, {
    algorithm: 'HS256',
    noTimestamp: noTimestamp
  });
}

/**
 * Creates the JWT token that can be used for a UserSession
 * @method JWTUserSessionToken
 * @memberof signing
 * @private
 * @param {string} apiSecret - API Secret key
 * @param {string} userId - The user_id key in the JWT payload
 * @param {object} [extraData] - Extra that should be part of the JWT token
 * @param {object} [jwtOptions] - Options that can be past to jwt.sign
 * @return {string} JWT Token
 */
function JWTUserSessionToken(apiSecret, userId) {
  var extraData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var jwtOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  if (typeof userId !== 'string') {
    throw new TypeError('userId should be a string');
  }
  var payload = _objectSpread({
    user_id: userId
  }, extraData);
  var opts = _objectSpread({
    algorithm: 'HS256',
    noTimestamp: true
  }, jwtOptions);
  return _jsonwebtoken.default.sign(payload, apiSecret, opts);
}