myApp.controller('VoicemailController', function($scope, $routeParams, $http) {
    $scope.service = {};
    $scope.count = 0;
    
    var billingAccount = $routeParams['billingAccount'];
    var serviceName = $routeParams['serviceName'];

    var audio = new Audio();
    
    function loadVoicemail(billingAccount, serviceName) {
        $http.get('/ovhapi/telephony/'+billingAccount).then(function successCallback(response) {
            var service = response.data;
            $scope.service = service;
            $scope.service['voicemails'] = {};
            $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceName).then(function successCallback(response) {
                var voicemail = response.data;
                $scope.service['voicemails'][serviceName] = voicemail;
                $scope.service['voicemails'][serviceName]['messages'] = {};
                loadMessages(billingAccount, serviceName);
            }, $scope.handleHttpError);
        }, $scope.handleHttpError);
    }

    function loadMessages(billingAccount, serviceName) {
        $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceName+'/directories').then(function successCallback(response) {
            var messageIds = response.data;
            $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceName+'/directories/'+messageIds.join(','), {headers:{'X-OVH-BATCH':','}}).then(function successCallback(response) {
                var messages = response.data;
                for (var i = 0; i < messages.length; i++) {
                    $scope.service['voicemails'][serviceName]['messages'][messages[i].key] = messages[i].value;
                    $scope.service['voicemails'][serviceName]['messages'][messages[i].key]['downloadCount'] = 10;
                }
            }, $scope.handleHttpError);
        }, $scope.handleHttpError);
    }
    
    $scope.playMessage = function(billingAccount, serviceName, messageId) {
        if(!$scope.service['voicemails'][serviceName]['messages'][messageId].download) {
            $scope.getMessageDownload(billingAccount, serviceName, messageId, 'play');
            return true;
        }
        var audio = $scope.service['voicemails'][serviceName]['messages'][messageId].download.audio;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        audio.play();
    }
    
    $scope.stopMessage = function(billingAccount, serviceName, messageId) {
        if(!$scope.service['voicemails'][serviceName]['messages'][messageId].download) {
            $scope.getMessageDownload(billingAccount, serviceName, messageId, 'stop');
            return true;
        }
        var audio = $scope.service['voicemails'][serviceName]['messages'][messageId].download.audio;
        audio.pause();
        audio.currentTime = 0;
    }

    $scope.downloadMessage = function(billingAccount, serviceName, messageId) {
        if(!$scope.service['voicemails'][serviceName]['messages'][messageId].download) {
            $scope.getMessageDownload(billingAccount, serviceName, messageId, 'download');
            return true;
        }
        window.open($scope.service['voicemails'][serviceName]['messages'][messageId].download.url);
        return true;
    }

    $scope.getMessageDownload = function(billingAccount, serviceName, messageId, action = null) {
        $scope.service['voicemails'][serviceName]['messages'][messageId]['download'] = {};
        $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceName+'/directories/'+messageId+'/download').then(function successCallback(response) {
            var messageDownload = response.data;
            if(messageDownload.status == 'done') {
                messageDownload.audio = new Audio();
                messageDownload.audio.src = messageDownload.url;
                messageDownload.audio.load();
                messageDownload.audio.addEventListener('ended', function(){
                    $scope.$apply();
                });
                $scope.service['voicemails'][serviceName]['messages'][messageId]['download'] = messageDownload;
                if(action == 'play') {
                    $scope.playMessage(billingAccount, serviceName, messageId);
                } else if(action == 'stop') {
                    $scope.stopMessage(billingAccount, serviceName, messageId);
                } else if(action == 'download') {
                    $scope.downloadMessage(billingAccount, serviceName, messageId);
                }
            } else if(messageDownload.status == 'todo' || messageDownload.status == 'doing') {
                $scope.service['voicemails'][serviceName]['messages'][messageId]['downloadCount']--;
                if($scope.service['voicemails'][serviceName]['messages'][messageId]['downloadCount'] > 0) {
                    setTimeout(function() {
                        console.log('Message '+messageId+' in '+messageDownload.status+', waiting a few and retrying');
                        $scope.getMessageDownload(billingAccount, serviceName, messageId, action);
                    }, 2000);
                } else {
                    $scope.service['voicemails'][serviceName]['messages'][messageId]['download'] = messageDownload;
                }
            } else {
                $scope.service['voicemails'][serviceName]['messages'][messageId]['download'] = messageDownload;
            }
        }, $scope.handleHttpError);
    }
    
    $scope.deleteMessage = function(billingAccount, serviceName, messageId) {
        if(!billingAccount || !serviceName || !messageId)
        {
            alert('Error : Missing parameter in deleteMessage');
        }
        else if(confirm('Are you sure you want to delete this message ?'))
        {
            $http.delete('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceName+'/directories/'+messageId).then(function successCallback(response) {
                delete $scope.service['voicemails'][serviceName]['messages'][messageId];
            }, $scope.handleHttpError);
        }
    }

    $scope.handleHttpError = function (response) {
        console.error(response);
        if(response) {
            if(response.data && response.data.message) {
                alert('Error : '+response.data.message);
            } else {
                alert('Error : '+response.status+' '+response.statusText);
            }
        }
    }

    loadVoicemail(billingAccount, serviceName);
});
