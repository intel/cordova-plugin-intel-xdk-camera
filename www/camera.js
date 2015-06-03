/*
Copyright 2015 Intel Corporation

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file 
except in compliance with the License. You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the 
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
either express or implied. See the License for the specific language governing permissions 
and limitations under the License
*/

var channel = require('cordova/channel'),
    utils = require('cordova/utils'),
    exec = require('cordova/exec');

module.exports = {
	pictureLocation: null,
	pictureList: [],

    getInfo: function (successCallback, errorCallback) {
        var me = this;
        exec(function(info) {
            me.pictureLocation = info.pictureLocation;
            me.pictureList = info.pictureList;
            successCallback();
        }, 
        errorCallback, "IntelXDKCamera", "getInfo", []);
    },

	takePicture: function(quality, saveToLib, picType) {
		if(quality == undefined || quality == null)
			quality = 70; // default
		else if((quality<1) || (quality>100))
			throw(new Error("Error: IntelXDK.camera.takePicture, quality must be between 1-100."));
		
		if(saveToLib == undefined || saveToLib == null) 
			saveToLib = true;
		
		if(typeof(picType) == "undefined" || picType == null) 
			picType = "jpg";
		else {
			if(typeof(picType) != "string")
				throw(new Error("Error: IntelXDK.camera.takePicture, picType must be a string."));
			if((picType.toLowerCase() != "jpg") && (picType.toLowerCase() != "png"))
				throw(new Error("Error: IntelXDK.camera.takePicture, picType must be 'jpg' or 'png'."));
		}
		//IntelXDKCamera.takePicture(quality, saveToLib, picType);
		exec(function(loc) {
			//alert('in return');			
		}, null, "IntelXDKCamera", "takePicture", [quality, saveToLib, picType]);
	},

	takeFrontPicture: function(quality, saveToLib, picType) {
		if(quality == undefined || quality == null)
			quality = 70; // default
		else if((quality<1) || (quality>100))
			throw(new Error("Error: IntelXDK.camera.takeFrontPicture, quality must be between 1-100."));

		if(saveToLib == undefined || saveToLib == null) 
			saveToLib = true;

		if(typeof(picType) == "undefined" || picType == null) 
			picType = "jpg";
		else {
			if(typeof(picType) != "string")
				throw(new Error("Error: IntelXDK.camera.takeFrontPicture, picType must be a string."));
			if((picType.toLowerCase() != "jpg") && (picType.toLowerCase() != "png"))
				throw(new Error("Error: IntelXDK.camera.takeFrontPicture, picType must be 'jpg' or 'png'."));
		}
		//IntelXDKCamera.takePicture(quality, saveToLib, picType);
		exec(function(loc) {
			//alert('in return');			
		}, null, "IntelXDKCamera", "takeFrontPicture", [quality, saveToLib, picType]);
	},

	importPicture: function() {
		//IntelXDKCamera.importPicture();
		exec(function(loc) {
			//alert('in return');			
		}, null, "IntelXDKCamera", "importPicture", []);
	},

	deletePicture: function(picURL) {
		if(picURL == undefined || picURL == null) 
			throw(new Error("Error: intel.xdk.camera.deletePicture, call with a picURL"));
		if(typeof(picURL) != "string")
			throw(new Error("Error: intel.xdk.camera.deletePicture, picURL must be a string."));

		//IntelXDKCamera.deletePicture(picURL);
		exec(function(loc) {
			//alert('in return');			
		}, null, "IntelXDKCamera", "deletePicture", [picURL]);
	},

	clearPictures: function() {
		//IntelXDKCamera.clearPictures();
		exec(function(loc) {
			//alert('in return');			
		}, null, "IntelXDKCamera", "clearPictures", []);
	},

	getPictureList: function() {
		var list = [];
		for(var picture in intel.xdk.camera.pictureList) {
			list.push(intel.xdk.camera.pictureList[picture]);
		}
		return list;
	},

	getPictureURL: function(filename) {
		var localURL = undefined;
		var	found = false;
		for(var picture in intel.xdk.camera.pictureList) {
			if(filename == intel.xdk.camera.pictureList[picture]) {
				found=true;
				break;
			}
		}
		if(found)
			localURL = intel.xdk.camera.pictureLocation+'/'+filename;
		return localURL;
	},
	
	// Private function to switch the plugin native-code object methods into a "testing" state.
	// Arguments:
	//      ("off") - Turn off testing mode.
	//      ("ignore") - Methods should do nothing.
	//      ("succeed", t) - Methods should exhibit success behavior after t milliseconds.
	//      ("fail", t) - Methods should exhibit failure behavior after t milliseconds.
	//      ("cancel", t) - Methods should exhibit cancellation behavior after t milliseconds.
	//
	_setTestMode: function(mode, delay) {
        exec(null, null, "IntelXDKCamera", "setTestMode", [mode || "off", delay || 0]);
	}
}

//pictureList maintenance

var me = module.exports;

document.addEventListener('intel.xdk.camera.internal.picture.add', function(e){
    me.pictureList.push(e.filename);
}, false);

document.addEventListener('intel.xdk.camera.internal.picture.remove', function(e){
    var index = me.pictureList.indexOf(e.filename);
    while (index > -1) {
        me.pictureList.splice(index, 1);
        index = me.pictureList.indexOf(e.filename);
    }
}, false);

document.addEventListener('intel.xdk.camera.internal.picture.clear', function(e){
    me.pictureList = [];
}, false);

channel.createSticky('IntelXDKCamera');
channel.waitForInitialization('IntelXDKCamera');
channel.onCordovaReady.subscribe(function() {
    me.getInfo(function() {
        channel.IntelXDKCamera.fire();
    },function(e) {
        utils.alert("[ERROR] Error initializing Intel XDK Camera: " + e);
    });
});
