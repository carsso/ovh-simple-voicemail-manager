var myApp = angular.module('app', ['ngRoute']);
myApp.config(function($routeProvider, $locationProvider, $httpProvider) {
    $routeProvider.when('/voicemail/', {
        controller:'LinesController',
        templateUrl:'views/lines.html',
    })
    .when('/voicemail/:billingAccount', {
        controller:'LinesController',
        templateUrl:'views/lines.html',
    })
    .when('/voicemail/:billingAccount/:serviceName', {
        controller:'VoicemailController',
        templateUrl:'views/voicemail.html',
    })
    .otherwise({
        redirectTo:'/voicemail/'
    });
    $locationProvider.html5Mode(true);
    $httpProvider.interceptors.push('HttpInterceptor');
})
.factory('HttpInterceptor', ['$rootScope', '$q', '$timeout', function ($rootScope, $q, $timeout) {
    return {
        'request': function (config) {
            $rootScope.isLoading = true;    // loading after 200ms
            return config || $q.when(config);   
        },
        'requestError': function (rejection) {
            $rootScope.isLoading = false;       // done loading
            return $q.reject(rejection);
        },
        'response': function (response) {       
            $rootScope.isLoading = false;       // done loading
            return response || $q.when(response);
        },
        'responseError': function (rejection) {
            $rootScope.isLoading = false;       // done loading
            return $q.reject(rejection);
        }
    };
}]);

