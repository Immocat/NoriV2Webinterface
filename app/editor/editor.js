'use strict';
angular.module('myApp.editor')
//configure the $routeProvider, that if the /view1 url is called that View1Ctrl is the current controller
    .config(['$routeProvider', 'growlProvider', function ($routeProvider, growlProvider) {
        $routeProvider.when('/editor', {
            templateUrl: 'editor/editor.html',
            controller: 'editorCtrl'
        }).otherwise({redirectTo: '/login'});
        growlProvider.globalTimeToLive(3000);
    }])

    /**
     * @ngdoc controller
     * @name myApp.view3.controller:View3Ctrl

     * @requires $scope
     * @requires growl

     * @author Alexander Lelidis
     * @description
     * This controller does most of the computation.
     */
    .controller('editorCtrl', ["$scope", "growl", "communicationService", "$dragon", "ngDialog", "$http",
        function ($scope, growl, communicationService, $dragon, ngDialog, $http) {
            $scope.DOMVars = {
                showEditor: true,
                percentage: 0,
                rendering: false,
                heightSet: false,
                progressbarType: "",
                percentageMsg: "",
                finalUrl: "images/testImage.png",
                finished: false
            };

            $scope.uploadedFiles = [];
            function updateFileList(){
                var url = $scope.$parent.user.url + 'resource';
                $http.get(url).success(function(payload){
                    $scope.uploadedFiles = payload;
                });
            };
            
            updateFileList();

            $scope.loadmodelFkt = function(callback, model, transform, bsdf, emitter) {
             if(model != "" && model != "Nothing selected") {
                    var url = $scope.$parent.user.username + "/" + model;
                    $http.get(url).success(function(payload){
                        callback(payload, model, transform, bsdf, emitter);
                    });
                }                
            }
            $scope.updatesceneFkt = function(target) {
                if(target == "") {
                    return;
                }
                $http.get(target).success(function(response){
                    response["content"] = $scope.$parent.xmlInput;
                    $http.put(target, response).success(function() {
                        growl.success("Scene successfully updated!", {});
                    });
                });
            }
            $scope.savesceneFkt = function(callback, editor){
                ngDialog.openConfirm({
                    template: 'saveSceneDialog',
                    overlay: true
                }).then(function (title) {
                        var query = {
                            "title": title + ".xml",
                            "content": $scope.$parent.xmlInput,
                            "owner": $scope.$parent.user.url
                        }
                        var url = '../scenes/';
                        $http.post(url, query).success(function(response){
                            callback.call(editor, response.url);
                            growl.success("Scene successfully saved!", {});
                        })
                    }, function (reason) {
                    console.log('Modal promise rejected. Reason: ', reason);
                });
            }

            $scope.importobjFkt = function(callback) {
                ngDialog.openConfirm({
                    template: 'firstDialogId',
                    overlay: true,
                    data: {objFiles: $scope.uploadedFiles},
                    controller: ['$scope',  function($scope, $http) {
                        // controller logic
                        $scope.confirmValue = "Nothing selected";
                        $scope.select = function(objFile) {
                            $scope.confirmValue = objFile;
                        };                        
                    }]
                }).then(function (model) {
                        $scope.loadmodelFkt(callback, model, []);
                    }, function (reason) {
                    console.log('Modal promise rejected. Reason: ', reason);
                });            
            }
            // Create a dataURL from an img element 
            function getImageDataURL(img) {
                // Create an empty canvas element 
                var canvas = document.createElement("canvas");

                // Copy the image contents to the canvas 
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                var data = canvas.toDataURL("image/png");
                canvas.remove();
                return data;
            }
            $scope.download = function(type) {
                var anchor = angular.element('<a/>');
                anchor.css({display: 'none'}); // Make sure it's not visible
                angular.element(document.body).append(anchor); // Attach to document

                if(type === "png") {
                  var img = document.getElementById("renderedIMG");
                  anchor.attr({
                    href: getImageDataURL(img),
                    target: '_blank',
                    download: 'rendering.png'
                  })[0].click();
                } else {
                  anchor.attr({
                    href: 'data:attachment/csv;charset=utf-8,' + encodeURI($scope.$parent.xmlInput),
                    target: '_blank',
                    download: 'scene.xml'
                  })[0].click();
                }
                anchor.remove();
            }
            $scope.channel = 'update-msg';

            $dragon.onReady(function() {
                console.log("dragon ready");
            });
            $dragon.onChannelMessage(function(channels, message) {
                if (indexOf.call(channels, $scope.channel) > -1) {
                    $scope.$apply(function() {
                        $scope.DOMVars.progressbarType = "success";
                        $scope.DOMVars.percentage = message.data['percentage'];
                        $scope.DOMVars.percentageMsg = $scope.DOMVars.percentage.toString() + ' %';
                        var b64Data = message.data['data'];
                        var offsetX = message.data['x'];
                        var offsetY = message.data['y'];
                        var pWidth = message.data['patchHeight'];
                        var pHeight = message.data['patchWidth'];

                        if (!$scope.heightSet) {
                            var width = message.data['width'];
                            var height = message.data['height'];
                            $scope.setSize(width, height);
                            $scope.heightSet = true;
                        }

                        $scope.addPatch(offsetX, offsetY, pWidth, pHeight, b64Data);

                        if(message.data['finished'] == true) {
                            $dragon.unsubscribe('update-msg', $scope.channel, {}).then(function(response) {});
                            growl.success("Image successfully rendered!", {});
                            $scope.DOMVars.rendering = false;
                            $scope.DOMVars.finished = true;
                            $scope.DOMVars.finalUrl = message.data['url'];
                        }
                    });
                }
            });
            
            $scope.showresultFkt = function() {
                $scope.DOMVars.showEditor = false;
                $scope.$apply();
            }

            // set up a communication service
            var comServ = new communicationService('../render/');

            $scope.sendCancel = function() {
                swampdragon.callRouter('control', 'update-msg', {command: 'cancel', taskId: $scope.serverTaskId}, function (context, data) {
                    if(data['success']) {
                        growl.success("Rendering successfully canceled!", {});          
                    } else {
                        growl.error("An error occurred during the termination!", {});
                    }
                    $scope.DOMVars.rendering = false;
                });
            };
            $scope.loadScene = function(url, editor, callback) {
                if(url == "") {
                    return;
                }
                $http.get(url,
                {
                transformResponse: function (cnv) {
                    var jRes = JSON.parse(cnv);
                    var x2js = new X2JS();
                    var aftCnv = x2js.xml_str2json(jRes.content);
                    return aftCnv;
                }
                  }).success(function(response) {
                        callback.call(editor, response.scene, url)
                });
            }
            $scope.loadxmlFkt = function(callback, editor, url) {
                if(url !== undefined) {
                    $scope.loadScene(url, editor, callback);
                } else {
                    var sceneURL = "../scenes/";                    
                    $http.get(sceneURL).success(function(response){
                        var data = [response];
                        if(response.length != 0) {
                            data = response;
                        }
                        if(response.length == 0) {
                            growl.error("No scenes found, please save a scene!", {});
                            return;
                        }

                        ngDialog.openConfirm({
                            template: 'scenePickerDialog',
                            overlay: true,
                            data: {userScenes: data},
                            controller: ['$scope', '$http', function($scope) {
                                // controller logic
                                $scope.confirmValue = "";
                                $scope.select = function(scene) {
                                    $scope.confirmValue = scene.url;
                                }
                                $scope.deletescene = function(f){
                                
                                    $http.delete(f.url).
                                    then(function(r) {
                                        var i = $scope.ngDialogData.userScenes.indexOf(f);
                                        $scope.ngDialogData.userScenes.splice(i, 1);
                                        if($scope.confirmValue == f.url) {
                                            $scope.confirmValue = "";
                                        }                                
                                    }, function(r) {

                                    });
                                };
                            }]
                        }).then(function (url) {
                                $scope.loadScene(url, editor, callback);
                            }, function (reason) {
                                console.log('Modal promise rejected. Reason: ', reason);
                            });
                    });
                }     
            }





            $scope.changeFkt = function(name) {
                $scope.$parent.changeViewModel(name);
            };
            $scope.setxmlFkt = function(xml) {
                $scope.$parent.xmlInput = xml;
            };

            $scope.defaultobjFkt = function(callback, geometry) {
                // add the file to the user directory

                var url = '../defaultgeometry/';
                var query = {type: geometry};
                $http.post(url, query).success(function(){
                    var url = $scope.$parent.user.username + "/" + geometry + ".obj";
                    $http.get(url).success(function(payload){
                        callback(payload, geometry + ".obj");
                    });
                });
                               
            };

            $scope.renderFkt = function(xmlInput) {
                console.log(xmlInput);
                $scope.DOMVars.showEditor = false;               
                sendRequest(false, xmlInput, "text.xml", $scope.$parent.user.email)
            };
            function sendRequest(sendMail, xmlInput, fileName, mailAddr){

                var xmlQuery = {
                    fileName: fileName,
                    xmlData: xmlInput,
                    sendMail: sendMail,
                    email: mailAddr
                };
                $scope.$parent.xmlInput = xmlInput;
                $scope.DOMVars.progressbarType = "info";
                $scope.DOMVars.percentageMsg = "loading models ...";

                $scope.DOMVars.rendering = true;
                $scope.DOMVars.finished = false;
                $scope.heightSet = false;
                $scope.DOMVars.percentage = 100;
                $scope.reset();
                $scope.$apply();

                var promise = comServ.httpPostRequest(xmlQuery);
                promise.success(function updateLines(payload){
                    if(payload['finished'] == false) { // started running
                        $scope.channel = payload['channelname'];
                        $scope.serverTaskId = payload['taskId'];

                        $dragon.subscribe('update-msg', $scope.channel, {}).then(function(response) {});
                } else {
                    growl.error("An error occurred during the rendering!", {});
                }
                });
            };
        }
    ]
);




