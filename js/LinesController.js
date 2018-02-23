myApp.controller('LinesController', function($scope, $routeParams, $http) {
    $scope.services = {};
    
    var forcedBillingAccount = $routeParams['billingAccount'];
    var forcedServiceName = $routeParams['serviceName'];

    function loadAccounts() {
        if(forcedBillingAccount) {
            $scope.services[forcedBillingAccount] = {};
            loadAccount(forcedBillingAccount);
        } else {
            $http.get('/ovhapi/telephony').then(function successCallback(response) {
                var billingAccounts = response.data;
                for (var i = 0; i < billingAccounts.length; i++) {
                    var billingAccount = billingAccounts[i];
                    $scope.services[billingAccount] = {};
                    loadAccount(billingAccount);
                }
            }, function errorCallback(response) {
                console.error(response);
            });
        }
    }
    function loadAccount(billingAccount) {
        $http.get('/ovhapi/telephony/'+billingAccount).then(function successCallback(response) {
            var service = response.data;
            $scope.services[billingAccount] = service;
            $scope.services[billingAccount]['voicemails'] = {};
            loadVoicemails(billingAccount);
        }, function errorCallback(response) {
            console.error(response);
        });
    }
    function loadVoicemails(billingAccount) {
        if(forcedBillingAccount && forcedServiceName && forcedBillingAccount == billingAccount) {
            $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+forcedServiceName).then(function successCallback(response) {
                var voicemail = response.data;
                $scope.services[billingAccount]['voicemails'][forcedServiceName] = voicemail;
            }, function errorCallback(response) {
                console.error(response);
            });
        } else {
            $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail').then(function successCallback(response) {
                var serviceNames = response.data;
                $http.get('/ovhapi/telephony/'+billingAccount+'/voicemail/'+serviceNames.join(','), {headers:{'X-OVH-BATCH':','}}).then(function successCallback(response) {
                    var voicemails = response.data;
                    for (var i = 0; i < voicemails.length; i++) {
                        $scope.services[billingAccount]['voicemails'][voicemails[i].key] = voicemails[i].value;
                    }
                }, function errorCallback(response) {
                    console.error(response);
                });
            }, function errorCallback(response) {
                console.error(response);
            });
        }
    }

    loadAccounts();
});
