/* global Meteor */
import React from 'react';

if (Meteor.isDevelopment) {
  const v = React.version.split('.');
  if (v[0] < 16 || v[1] < 8) {
    // eslint-disable-next-line no-console
    console.warn('react-meteor-data 2.x requires React version >= 16.8.');
  }
}

export { default as withTracker } from './withTracker';
export { default as useTracker } from './useTracker';
