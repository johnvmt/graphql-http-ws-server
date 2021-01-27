"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  GraphQLHTTPWSServer: true
};
Object.defineProperty(exports, "GraphQLHTTPWSServer", {
  enumerable: true,
  get: function () {
    return _GraphQLHTTPWSServer.default;
  }
});
exports.default = void 0;

var _GraphQLHTTPWSServer = _interopRequireDefault(require("./GraphQLHTTPWSServer.js"));

var _apolloServerExpress = require("apollo-server-express");

Object.keys(_apolloServerExpress).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _apolloServerExpress[key]) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _apolloServerExpress[key];
    }
  });
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = _GraphQLHTTPWSServer.default;
exports.default = _default;