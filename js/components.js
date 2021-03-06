
myApp.directive('tabs', function() {
    return {
        restrict: 'E',
        transclude: true,
        scope: {},
        controller: function($scope, $element) {
            var panes = $scope.panes = [];

            $scope.select = function(pane) {
                angular.forEach(panes, function(pane) {
                    pane.selected = false;
                });
                pane.selected = true;
            }

            this.addPane = function(pane) {
                if (panes.length == 0) $scope.select(pane);
                panes.push(pane);
            }
        },
        template:
            '<div class="card">' +
            '<div class="card-header">' +
            '<ul class="nav nav-tabs card-header-tabs">' +
            '<li class="nav-item" ng-repeat="pane in panes | orderBy:\'title\'">'+
            '<a href="" class="nav-link" ng-class="{active:pane.selected}" ng-click="select(pane)">{{pane.title}}</a>' +
            '</li>' +
            '</ul>' +
            '</div>' +
            '<div class="card-body">'+
            '<div class="tab-content" ng-transclude></div>' +
            '</div>' +
            '</div>',
        replace: true
    };
})

.directive('pane', function() {
    return {
        require: '^tabs',
        restrict: 'E',
        transclude: true,
        scope: { title: '@' },
        link: function(scope, element, attrs, tabsController) {
            tabsController.addPane(scope);
        },
        template:
            '<div class="tab-pane" ng-class="{active: selected}" ng-transclude>' +
            '</div>',
        replace: true
    };
})

.filter('tel', function () {
    return function (tel) {
        if (!tel) { return ''; }
        tel = tel.toString().trim().replace(/^00/, '+');
        return tel;
    }
})

.filter('toArray', function () {
    return function (obj, addKey) {
        if (!angular.isObject(obj)) return obj;
        if ( addKey === false ) {
            return Object.keys(obj).map(function(key) {
                return obj[key];
            });
        } else {
            return Object.keys(obj).map(function (key) {
                var value = obj[key];
                return angular.isObject(value) ?
                    Object.defineProperty(value, '$key', { enumerable: false, value: key}) :
                    { $key: key, $value: value };
            });
        }
    };
});
