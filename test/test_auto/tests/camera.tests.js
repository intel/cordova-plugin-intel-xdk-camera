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

// packagedCall(obj, "foo") returns a function f such that f(x, y, z) returns 
// a parameterless function g such that g() calls obj.foo(x, y, z).
// 
var packagedCall = function(obj, method) {
    return function(/*args*/) {
        var args = arguments;
        return function() { obj[method].apply(obj, args); }
    }
}


describe('The intel.xdk.camera plugin', function() {

    it('is defined', function () {
        expect(intel.xdk.camera).toBeDefined();
    });
    
    it('has a takePicture method', function() {
        expect(intel.xdk.camera.takePicture).toBeDefined();
    });

    it('has a takeFrontPicture method', function() {
        expect(intel.xdk.camera.takeFrontPicture).toBeDefined();
    });

    it('has an importPicture method', function() {
        expect(intel.xdk.camera.importPicture).toBeDefined();
    });

    it('has a clearPictures method', function() {
        expect(intel.xdk.camera.clearPictures).toBeDefined();
    });

    it('has a getPictureList method', function() {
        expect(intel.xdk.camera.getPictureList).toBeDefined();
    });

    it('has a getPictureURL method', function() {
        expect(intel.xdk.camera.getPictureURL).toBeDefined();
    });

});


describe('The takePicture method', function() {

    var takePicture;
    var saveTimeout;
    var addEvent    = 'intel.xdk.camera.picture.add';
    var cancelEvent = 'intel.xdk.camera.picture.cancel';
    var busyEvent   = 'intel.xdk.camera.picture.busy';
    var listeners   = [];
    
    var listen = function(event, listener) {
        document.addEventListener(event, listener);
        listeners.push([event, listener]);
    }
    
    beforeEach(function() {
        takePicture = packagedCall(intel.xdk.camera, "takePicture");
        saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });
    
    afterEach(function() {
        intel.xdk.camera._setTestMode("off");
        jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
        var l;
        while (l = listeners.pop()) {
            document.removeEventListener(l[0], l[1]);
        }
    });
    
    it('checks that its quality parameter is between 1 and 100, unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takePicture()).not.toThrow();
        expect(takePicture(0)).toThrow();
        expect(takePicture(1)).not.toThrow();
        expect(takePicture(100)).not.toThrow();
        expect(takePicture(101)).toThrow();
    });

    it('checks that its pictureType parameter is "jpg" or "png", unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takePicture()).not.toThrow();
        expect(takePicture(null, null, "jpg")).not.toThrow();
        expect(takePicture(null, null, "png")).not.toThrow();
        expect(takePicture(null, null, "JPG")).not.toThrow();
        expect(takePicture(null, null, "PNG")).not.toThrow();
        expect(takePicture(null, null, "gif")).toThrow();
        expect(takePicture(null, null, 123)).toThrow();
    });
    
    it('fires a picture.add event when it is successful', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takePicture();
        function added(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
        function cancelled(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
    });

    it('adds a file to the picture list', function(done) {
        listen(addEvent, added);
        var numPictures = intel.xdk.camera.getPictureList().length;
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takePicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            done();
        }
    });

    it('returns a .jpg file if the picture type was omitted', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takePicture();
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .jpg file if the picture type was "jpg"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takePicture(null, null, "jpg");
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .png file if the picture type was "png"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takePicture(null, null, "png");
        function added(evt) {
            expect(evt.filename).toMatch(/\.png$/i);
            done();
        }
    });
    
    it('fires a picture.cancel event when it is cancelled', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("cancel", 200);
        intel.xdk.camera.takePicture();
        function added(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
        function cancelled(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
            done();
        }
    });
    
    it('fires a picture.busy event when a picture is already being taken', function(done) {
        listen(addEvent, added);
        listen(busyEvent, busy);
        intel.xdk.camera._setTestMode("succeed", 200);
        var state = 0;
        intel.xdk.camera.takePicture(); // this one should succeed
        intel.xdk.camera.takePicture(); // this one should get 'busy'
        function busy(evt) {
            expect(state).toBe(0);  // first event
            state = 1;
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
        }
        function added(evt) {
            expect(state).toBe(1); // second event
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
    });

});

describe('The takeFrontPicture method', function() {

    var takeFrontPicture;
    var saveTimeout;
    var addEvent    = 'intel.xdk.camera.picture.add';
    var cancelEvent = 'intel.xdk.camera.picture.cancel';
    var busyEvent   = 'intel.xdk.camera.picture.busy';
    var listeners   = [];
    
    var listen = function(event, listener) {
        document.addEventListener(event, listener);
        listeners.push([event, listener]);
    }
    
    beforeEach(function() {
        takeFrontPicture = packagedCall(intel.xdk.camera, "takeFrontPicture");
        saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });
    
    afterEach(function() {
        intel.xdk.camera._setTestMode("off");
        jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
        var l;
        while (l = listeners.pop()) {
            document.removeEventListener(l[0], l[1]);
        }
    });
    
    it('checks that its quality parameter is between 1 and 100, unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takeFrontPicture()).not.toThrow();
        expect(takeFrontPicture(0)).toThrow();
        expect(takeFrontPicture(1)).not.toThrow();
        expect(takeFrontPicture(100)).not.toThrow();
        expect(takeFrontPicture(101)).toThrow();
    });

    it('checks that its pictureType parameter is "jpg" or "png", unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takeFrontPicture()).not.toThrow();
        expect(takeFrontPicture(null, null, "jpg")).not.toThrow();
        expect(takeFrontPicture(null, null, "png")).not.toThrow();
        expect(takeFrontPicture(null, null, "JPG")).not.toThrow();
        expect(takeFrontPicture(null, null, "PNG")).not.toThrow();
        expect(takeFrontPicture(null, null, "gif")).toThrow();
        expect(takeFrontPicture(null, null, 123)).toThrow();
    });
    
    it('fires a picture.add event when it is successful', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
        function cancelled(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
    });

    it('adds a file to the picture list', function(done) {
        listen(addEvent, added);
        var numPictures = intel.xdk.camera.getPictureList().length;
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            done();
        }
    });

    it('returns a .jpg file if the picture type was omitted', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .jpg file if the picture type was "jpg"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture(null, null, "jpg");
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .png file if the picture type was "png"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture(null, null, "png");
        function added(evt) {
            expect(evt.filename).toMatch(/\.png$/i);
            done();
        }
    });
    
    it('fires a picture.cancel event when it is cancelled', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("cancel", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
        function cancelled(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
            done();
        }
    });
    
    it('fires a picture.busy event when a picture is already being taken', function(done) {
        listen(addEvent, added);
        listen(busyEvent, busy);
        intel.xdk.camera._setTestMode("succeed", 200);
        var state = 0;
        intel.xdk.camera.takePicture(); // this one should succeed
        intel.xdk.camera.takeFrontPicture(); // this one should get 'busy'
        function busy(evt) {
            expect(state).toBe(0);  // first event
            state = 1;
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
        }
        function added(evt) {
            expect(state).toBe(1); // second event
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
    });

});

describe('The takeFrontPicture method', function() {

    var takeFrontPicture;
    var saveTimeout;
    var addEvent    = 'intel.xdk.camera.picture.add';
    var cancelEvent = 'intel.xdk.camera.picture.cancel';
    var busyEvent   = 'intel.xdk.camera.picture.busy';
    var listeners   = [];
    
    var listen = function(event, listener) {
        document.addEventListener(event, listener);
        listeners.push([event, listener]);
    }
    
    beforeEach(function() {
        takeFrontPicture = packagedCall(intel.xdk.camera, "takeFrontPicture");
        saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });
    
    afterEach(function() {
        intel.xdk.camera._setTestMode("off");
        jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
        var l;
        while (l = listeners.pop()) {
            document.removeEventListener(l[0], l[1]);
        }
    });
    
    it('checks that its quality parameter is between 1 and 100, unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takeFrontPicture()).not.toThrow();
        expect(takeFrontPicture(0)).toThrow();
        expect(takeFrontPicture(1)).not.toThrow();
        expect(takeFrontPicture(100)).not.toThrow();
        expect(takeFrontPicture(101)).toThrow();
    });

    it('checks that its pictureType parameter is "jpg" or "png", unless it is omitted', 
    function() {
        intel.xdk.camera._setTestMode("ignore");
        expect(takeFrontPicture()).not.toThrow();
        expect(takeFrontPicture(null, null, "jpg")).not.toThrow();
        expect(takeFrontPicture(null, null, "png")).not.toThrow();
        expect(takeFrontPicture(null, null, "JPG")).not.toThrow();
        expect(takeFrontPicture(null, null, "PNG")).not.toThrow();
        expect(takeFrontPicture(null, null, "gif")).toThrow();
        expect(takeFrontPicture(null, null, 123)).toThrow();
    });
    
    it('fires a picture.add event when it is successful', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
        function cancelled(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
    });

    it('adds a file to the picture list', function(done) {
        listen(addEvent, added);
        var numPictures = intel.xdk.camera.getPictureList().length;
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            done();
        }
    });

    it('returns a .jpg file if the picture type was omitted', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .jpg file if the picture type was "jpg"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture(null, null, "jpg");
        function added(evt) {
            expect(evt.filename).toMatch(/\.jpg$/i);
            done();
        }
    });

    it('returns a .png file if the picture type was "png"', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.takeFrontPicture(null, null, "png");
        function added(evt) {
            expect(evt.filename).toMatch(/\.png$/i);
            done();
        }
    });
    
    it('fires a picture.cancel event when it is cancelled', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("cancel", 200);
        intel.xdk.camera.takeFrontPicture();
        function added(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
        function cancelled(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
            done();
        }
    });
    
    it('fires a picture.busy event when a picture is already being taken', function(done) {
        listen(addEvent, added);
        listen(busyEvent, busy);
        intel.xdk.camera._setTestMode("succeed", 200);
        var state = 0;
        intel.xdk.camera.takePicture(); // this one should succeed
        intel.xdk.camera.takeFrontPicture(); // this one should get 'busy'
        function busy(evt) {
            expect(state).toBe(0);  // first event
            state = 1;
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
        }
        function added(evt) {
            expect(state).toBe(1); // second event
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
    });

});

describe('The importPicture method', function() {

    var importPicture;
    var saveTimeout;
    var addEvent    = 'intel.xdk.camera.picture.add';
    var cancelEvent = 'intel.xdk.camera.picture.cancel';
    var busyEvent   = 'intel.xdk.camera.picture.busy';
    var listeners   = [];
    
    var listen = function(event, listener) {
        document.addEventListener(event, listener);
        listeners.push([event, listener]);
    }
    
    beforeEach(function() {
        saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });
    
    afterEach(function() {
        intel.xdk.camera._setTestMode("off");
        jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
        var l;
        while (l = listeners.pop()) {
            document.removeEventListener(l[0], l[1]);
        }
    });
    
    it('fires a picture.add event when it is successful', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
        function cancelled(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
    });

    it('adds a file to the picture list', function(done) {
        listen(addEvent, added);
        var numPictures = intel.xdk.camera.getPictureList().length;
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            done();
        }
    });

    it('returns a .png file', function(done) {
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(evt.filename).toMatch(/\.png$/i);
            done();
        }
    });
    
    it('fires a picture.cancel event when it is cancelled', function(done) {
        listen(addEvent, added);
        listen(cancelEvent, cancelled);
        intel.xdk.camera._setTestMode("cancel", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            // Should not happen!
            expect(true).toBe(false);
            // Don't call done() ... continue waiting for expected event
        }
        function cancelled(evt) {
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
            done();
        }
    });
    
    it('fires a picture.busy event when a picture is already being taken', function(done) {
        listen(addEvent, added);
        listen(busyEvent, busy);
        intel.xdk.camera._setTestMode("succeed", 200);
        var state = 0;
        intel.xdk.camera.takeFrontPicture(); // this one should succeed
        intel.xdk.camera.importPicture(); // this one should get 'busy'
        function busy(evt) {
            expect(state).toBe(0);  // first event
            state = 1;
            expect(evt).toBeDefined();
            expect(evt.success).toBeFalsy();
        }
        function added(evt) {
            expect(state).toBe(1); // second event
            expect(evt).toBeDefined();
            expect(evt.success).toBeTruthy();
            done();
        }
    });

});


describe('The picture list', function() {

    var addEvent    = 'intel.xdk.camera.picture.add';
    var cancelEvent = 'intel.xdk.camera.picture.cancel';
    var busyEvent   = 'intel.xdk.camera.picture.busy';
    var listeners   = [];
    
    var listen = function(event, listener) {
        document.addEventListener(event, listener);
        listeners.push([event, listener]);
    }
    
    beforeEach(function() {
        saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
    });
    
    afterEach(function() {
        intel.xdk.camera._setTestMode("off");
        jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
        var l;
        while (l = listeners.pop()) {
            document.removeEventListener(l[0], l[1]);
        }
    });
    
    it('is an array of image filename strings', function() {
        expect(intel.xdk.camera.getPictureList() instanceof Array).toBe(true);
    });
    
    it('can have pictures added to it', function() {
        var numPictures = intel.xdk.camera.getPictureList().length;
        var np = numPictures;
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            if (numPictures == np + 3) {
                done();
            }
            else {
                intel.xdk.camera.importPicture();
            }
        }
    });
    
    it('can have pictures removed from it', function() {
        var numPictures = intel.xdk.camera.getPictureList().length;
        var np = numPictures;
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            if (numPictures == np + 3) {
                removePictures();
                done();
            }
            else {
                intel.xdk.camera.importPicture();
            }
        }
        function removePictures() {
            for (var i = 0; i != 3; ++i) {
                var picture = intel.xdk.getPictureList()[0];
                intel.xdk.camera.deletePicture(picture);
                expect(intel.xdk.camera.getPictureList().length).toBe(--numPictures);
                expect(intel.xdk.camera.getPictureList()).not.toContain(picture);
            }
        }
    });
        
    it('can be emptied', function() {
        var numPictures = intel.xdk.camera.getPictureList().length;
        var np = numPictures;
        listen(addEvent, added);
        intel.xdk.camera._setTestMode("succeed", 200);
        intel.xdk.camera.importPicture();
        function added(evt) {
            expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
            expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
            if (numPictures == np + 3) {
                intel.xdk.camera.clearPictures();
                expect(intel.xdk.camera.getPictureList().length).toBe(0);
                done();
            }
            else {
                intel.xdk.camera.importPicture();
            }
        }
    });
    
});

