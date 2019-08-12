/* global Package */ // Todo: Where to import this from?
Package.describe({
  name: 'risetechnologies:react-meteor-data',
  summary: 'React higher-order component for reactively tracking Meteor data',
  version: '1.1.0-beta.0',
  documentation: 'README.md',
  git: 'https://github.com/risetechnologies/react-packages',
});

Package.onUse(function onUse(api) {
  api.versionsFrom('1.3');
  api.use('tracker');
  api.use('ecmascript');

  api.mainModule('index.client.js', 'client');
  api.mainModule('index.server.js', 'server');
});

Package.onTest(function onTest(api) {
  api.use([
    'ecmascript',
    'reactive-dict',
    'reactive-var',
    'tracker',
    'tinytest',
    'underscore',
    'mongo',
  ]);
  api.use('test-helpers');
  api.mainModule('tests.js');
});
