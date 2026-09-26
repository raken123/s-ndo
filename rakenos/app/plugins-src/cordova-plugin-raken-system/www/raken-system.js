// JavaScript bridge for the RakenSystem plugin. Every method takes (…args, success, error).
var exec = require('cordova/exec');
function call(action) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var error = args.pop(); var success = args.pop();
    exec(success, error, 'RakenSystem', action, args);
  };
}
module.exports = {
  getCapabilities: call('getCapabilities'),
  getBattery: call('getBattery'),
  setBrightness: call('setBrightness'),
  setTorch: call('setTorch'),
  vibrate: call('vibrate'),
  requestPermission: call('requestPermission'),
  openSystemSettings: call('openSystemSettings'),
  openExternal: call('openExternal'),
  canRequestPackageInstalls: call('canRequestPackageInstalls'),
  installPackage: call('installPackage'),
};
