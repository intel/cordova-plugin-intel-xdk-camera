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

/*global exports, describe, it, beforeEach, afterEach, expect, xit, xdescribe*/
/*global document, jasmine, intel, console*/

exports.defineAutoTests = function() {
    describe('The intel.xdk.camera plugin', function() {

        /**
         * packagedCall(obj, "foo") returns a function f such that f(x, y, z) returns 
         * a parameterless function g such that g() calls obj.foo(x, y, z).
         */
        var packagedCall = function(obj, method) {
            return function(/*args*/) {
                var args = arguments;
                return function() { obj[method].apply(obj, args); };
            };
        };

        var addEvent    = 'intel.xdk.camera.picture.add';
        var cancelEvent = 'intel.xdk.camera.picture.cancel';
        var busyEvent   = 'intel.xdk.camera.picture.busy';
        var removeEvent = 'intel.xdk.camera.picture.remove';
        var clearEvent  = 'intel.xdk.camera.picture.clear';
        var listeners   = [];

        var listen = function(event, listener) {
            document.addEventListener(event, listener);
            listeners.push([event, listener]);
        };

        var removeListeners = function() {
            listeners.forEach(function(l){
                document.removeEventListener(l[0], l[1]);
            });
            listeners = [];
        };

        var saveTimeout;

        beforeEach(function() {
            saveTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
            jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000;
        });

        afterEach(function(done) {
            intel.xdk.camera._setTestMode("off");
            jasmine.DEFAULT_TIMEOUT_INTERVAL = saveTimeout;
            removeListeners();
            listen(clearEvent, cleared);
            intel.xdk.camera.clearPictures();
            function cleared() {
                removeListeners();
                done();
            }
        });

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

        describe('has a takePicture method which', function() {

            var takePicture;
            
            beforeEach(function() {
                takePicture = packagedCall(intel.xdk.camera, "takePicture"); 
            });

            xit('checks that its quality parameter is between 1 and 100, unless it is omitted', function() {
                intel.xdk.camera._setTestMode("ignore");
                expect(takePicture()).not.toThrow();
                expect(takePicture(0)).toThrow();
                expect(takePicture(1)).not.toThrow();
                expect(takePicture(100)).not.toThrow();
                expect(takePicture(101)).toThrow();
            });

            xit('checks that its pictureType parameter is "jpg" or "png", unless it is omitted', function() {
                intel.xdk.camera._setTestMode("ignore");
                expect(takePicture()).not.toThrow();
                expect(takePicture(null, null, "jpg")).not.toThrow();
                expect(takePicture(null, null, "png")).not.toThrow();
                expect(takePicture(null, null, "JPG")).not.toThrow();
                expect(takePicture(null, null, "PNG")).not.toThrow();
                expect(takePicture(null, null, "gif")).toThrow();
                expect(takePicture(null, null, 123)).toThrow();
            });

            xit('fires a picture.add event when it is successful', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takePicture();
                function added(evt) {
                    expect(evt).toBeDefined();
                    expect(evt.success).toBeTruthy();
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    // Don't call done() ... continue waiting for expected event
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    // Don't call done() ... continue waiting for expected event
                }
            });

            xit('adds a file to the picture list', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                var numPictures = intel.xdk.camera.getPictureList().length;
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takePicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .jpg file if the picture type was omitted', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takePicture();
                function added(evt) {
                    expect(evt.filename).toMatch(/\.jpg$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .jpg file if the picture type was "jpg"', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takePicture(null, null, "jpg");
                function added(evt) {
                    expect(evt.filename).toMatch(/\.jpg$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .png file if the picture type was "png"', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takePicture(null, null, "png");
                function added(evt) {
                    expect(evt.filename).toMatch(/\.png$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.cancel event when it is cancelled', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("cancel", 200);
                intel.xdk.camera.takePicture();
                function added(evt) {
                    // Should not happen!
                    expect("added").toBe(false);
                    // Don't call done() ... continue waiting for expected event
                }
                function cancelled(evt) {
                    expect(evt).toBeDefined();
                    expect(evt.success).toBeFalsy();
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.busy event when a picture is already being taken', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
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
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
            });

        });

        describe('has a takeFrontPicture method which', function() {

            var takeFrontPicture;

            beforeEach(function() {
                takeFrontPicture = packagedCall(intel.xdk.camera, "takeFrontPicture");
            });

            xit('checks that its quality parameter is between 1 and 100, unless it is omitted', 
            function() {
                intel.xdk.camera._setTestMode("ignore");
                expect(takeFrontPicture()).not.toThrow();
                expect(takeFrontPicture(0)).toThrow();
                expect(takeFrontPicture(1)).not.toThrow();
                expect(takeFrontPicture(100)).not.toThrow();
                expect(takeFrontPicture(101)).toThrow();
            });

            xit('checks that its pictureType parameter is "jpg" or "png", unless it is omitted', 
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

            xit('fires a picture.add event when it is successful', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takeFrontPicture();
                function added(evt) {
                    expect(evt).toBeDefined();
                    expect(evt.success).toBeTruthy();
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('adds a file to the picture list', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                var numPictures = intel.xdk.camera.getPictureList().length;
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takeFrontPicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .jpg file if the picture type was omitted', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takeFrontPicture();
                function added(evt) {
                    expect(evt.filename).toMatch(/\.jpg$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .jpg file if the picture type was "jpg"', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takeFrontPicture(null, null, "jpg");
                function added(evt) {
                    expect(evt.filename).toMatch(/\.jpg$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .png file if the picture type was "png"', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.takeFrontPicture(null, null, "png");
                function added(evt) {
                    expect(evt.filename).toMatch(/\.png$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.cancel event when it is cancelled', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
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
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.busy event when a picture is already being taken', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
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
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
            });

        });

        describe('has an importPicture method which', function() {

            xit('fires a picture.add event when it is successful', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(evt).toBeDefined();
                    expect(evt.success).toBeTruthy();
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('adds a file to the picture list', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                var numPictures = intel.xdk.camera.getPictureList().length;
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(numPictures+1);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('returns a .png file', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(evt.filename).toMatch(/\.png$/i);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.cancel event when it is cancelled', function(done) {
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
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
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('fires a picture.busy event when a picture is already being taken', function(done) {
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
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
            });

        });

        describe('has a picture list which', function() {

            it('is an array of image filename strings', function() {
                expect(intel.xdk.camera.getPictureList() instanceof Array).toBe(true);
            });

            xit('can have pictures added to it', function(done) {
                var numPictures = intel.xdk.camera.getPictureList().length;
                var np = numPictures;
                listen(addEvent, added);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
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
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('can have pictures removed from it', function(done) {
                var numPictures = intel.xdk.camera.getPictureList().length;
                var np = numPictures;
                var picToRemove;
                listen(addEvent, added);
                listen(removeEvent, removed);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    if (numPictures == np + 3) {
                        removePicture();
                    }
                    else {
                        intel.xdk.camera.importPicture();
                    }
                }
                function removePicture() {
                    picToRemove = intel.xdk.camera.getPictureList()[0];
                    intel.xdk.camera.deletePicture(picToRemove);
                }
                function removed(evt) {
                    expect(evt.filename).toBe(picToRemove);
                    expect(intel.xdk.camera.getPictureList().length).toBe(--numPictures);
                    expect(intel.xdk.camera.getPictureList()).not.toContain(picToRemove);
                    if (numPictures === 0) {
                        done();
                    }
                    else {
                        removePicture();
                    }
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('can be emptied', function(done) {
                var numPictures = intel.xdk.camera.getPictureList().length;
                var np = numPictures;
                listen(addEvent, added);
                listen(clearEvent, cleared);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    if (numPictures == np + 3) {
                        intel.xdk.camera.clearPictures();
                    }
                    else {
                        intel.xdk.camera.importPicture();
                    }
                }
                function cleared(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(0);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

            xit('maintains state when the plugin data is reloaded', function(done) {
                // As far as the plugin is concerned, calling the getInfo() method is equivalent
                // to reloading the current page.
                var numPictures = intel.xdk.camera.getPictureList().length;
                var np = numPictures;
                var picToRemove;
                listen(addEvent, added);
                listen(removeEvent, removed);
                listen(clearEvent, cleared);
                listen(cancelEvent, cancelled);
                listen(busyEvent, busy);
                intel.xdk.camera._setTestMode("succeed", 200);
                intel.xdk.camera.importPicture();
                function added(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(++numPictures);
                    expect(intel.xdk.camera.getPictureList()).toContain(evt.filename);
                    if (numPictures == np + 3) {
                        intel.xdk.camera.getInfo(reloadedAfterAdd, getInfoFailed);
                    }
                    else {
                        intel.xdk.camera.importPicture();
                    }
                }
                function reloadedAfterAdd() {
                    expect(intel.xdk.camera.getPictureList().length).toBe(numPictures);
                    picToRemove = intel.xdk.camera.getPictureList()[0];
                    intel.xdk.camera.deletePicture(picToRemove);
                }
                function removed(evt) {
                    expect(evt.filename).toBe(picToRemove);
                    expect(intel.xdk.camera.getPictureList().length).toBe(--numPictures);
                    expect(intel.xdk.camera.getPictureList()).not.toContain(picToRemove);
                    intel.xdk.camera.getInfo(reloadedAfterRemove, getInfoFailed);
                }
                function reloadedAfterRemove() {
                    expect(intel.xdk.camera.getPictureList().length).toBe(numPictures);
                    intel.xdk.camera.clearPictures();
                }
                function cleared(evt) {
                    expect(intel.xdk.camera.getPictureList().length).toBe(0);
                    intel.xdk.camera.getInfo(reloadedAfterClear, getInfoFailed);
                }
                function reloadedAfterClear() {
                    expect(intel.xdk.camera.getPictureList().length).toBe(0);
                    done();
                }
                function getInfoFailed() {
                    // Should not happen!
                    expect(true).toBe(false);
                    done();
                }
                function cancelled(evt) {
                    // Should not happen!
                    expect("cancelled").toBe(false);
                    done();
                }
                function busy(evt) {
                    // Should not happen!
                    expect("busy").toBe(false);
                    done();
                }
            });

        });
    });
};

exports.defineManualTests = function(contentEl, createActionButton) {
    
  var logMessage = function (message, color) {
        var log = document.getElementById('info');
        var logLine = document.createElement('div');
        if (color) {
            logLine.style.color = color;
        }
        logLine.innerHTML = message;
        log.appendChild(logLine);
    };

    var clearLog = function () {
        var log = document.getElementById('info');
        log.innerHTML = '';
    };
    
    function testNotImplemented(testName){
        return function(){
            console.error(testName,'test not implemented');
        };
    }

    var $CameraTestSuite = 
        '<h3>Take a Picture</h3>' +
        '<div id="buttonTakePicture"></div>' +
        'Expected result: Take a picture' +
        
        '<h3>Take a Front Picture</h3>' +
        '<div id="buttonTakeFrontPicture"></div>' +
        'Expected result: Take a front picture' +
        
        '<h3>Import Picture</h3>' +
        '<div id="buttonImportPicture"></div>' +
        'Expected result: Import a Picture' +
        
        '<h3>Clear Picture</h3>' +
        '<div id="buttonClearPicture"></div>' +
        'Expected result: Clear Picture' +
        
        '<h3>Delete Picture</h3>' +
        '<div id="buttonDeletePicture"></div>' +
        'Expected result: Delete a picture' +

        '<h3>Show Picture List</h3>' +
        '<div id="buttonShowPictureList"></div>' +
        'Expected result: Show Picture List';
        
    contentEl.innerHTML = '<div id="info"></div>' + $CameraTestSuite;
    
    createActionButton('takePicture()', function () {
        console.log('executing::intel.xdk.camera.takePicture');
        intel.xdk.camera.takePicture(100, false, "png");
    }, 'buttonTakePicture');
    
    createActionButton('takeFrontPicture()', function () {
        console.log('executing::intel.xdk.camera.takeFrontPicture');
        intel.xdk.camera.takeFrontPicture(100, false, "png");
    }, 'buttonTakeFrontPicture');
    
    createActionButton('importPicture()', function () {
        console.log('executing::intel.xdk.camera.importPicture');
        intel.xdk.camera.importPicture();
    }, 'buttonImportPicture');
    
    createActionButton('clearPictures()', function () {
        console.log('executing::intel.xdk.camera.clearPictures');
        var arrPictureList = intel.xdk.camera.getPictureList();
        
        if (arrPictureList.length > 0) {
            intel.xdk.camera.clearPictures(arrPictureList[0]);
        }
    }, 'buttonClearPicture');
    
    createActionButton('deletePicture()', function () {
        console.log('executing::intel.xdk.camera.deletePicture()');
        var arrPictureList = intel.xdk.camera.getPictureList();

        if (arrPictureList.length > 0) {
            intel.xdk.camera.deletePicture(arrPictureList[0]);
        }
    }, 'buttonDeletePicture');
    
    createActionButton('getPictureList()', function () {
        console.log('executing::intel.xdk.camera.getPictureList');
        console.log('pictures:',intel.xdk.camera.getPictureList());
    }, 'buttonShowPictureList');
};