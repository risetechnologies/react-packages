/* global Package */ // Todo: Where to import this from?
import React, { useReducer, useEffect, useRef } from 'react';
/* eslint-disable import/no-unresolved */
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
/* eslint-enable import/no-unresolved */

// Use React.warn() if available (should ship in React 16.9).
// eslint-disable-next-line no-console
const warn = React.warn || console.warn.bind(console);

// Warns if data is a Mongo.Cursor or a POJO containing a Mongo.Cursor.
function checkCursor(data) {
  let shouldWarn = false;
  if (
    Package.mongo &&
    Package.mongo.Mongo &&
    data &&
    typeof data === 'object'
  ) {
    if (data instanceof Package.mongo.Mongo.Cursor) {
      shouldWarn = true;
    } else if (Object.getPrototypeOf(data) === Object.prototype) {
      Object.keys(data).forEach((key) => {
        if (data[key] instanceof Package.mongo.Mongo.Cursor) {
          shouldWarn = true;
        }
      });
    }
  }
  if (shouldWarn) {
    warn(
      'Warning: your reactive function is returning a Mongo cursor. ' +
        'This value will not be reactive. You probably want to call ' +
        '`.fetch()` on the cursor before returning it.'
    );
  }
}

// taken from https://github.com/facebook/react/blob/
// 34ce57ae751e0952fd12ab532a3e5694445897ea/packages/shared/objectIs.js
function is(x, y) {
  return (
    (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y) // eslint-disable-line no-self-compare
  );
}

// taken from https://github.com/facebook/react/blob/
// a9b035b0c2b8235405835beca0c4db2cc37f18d0/packages/shared/shallowEqual.js
/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * Returns true when the values of all keys are strictly equal.
 */
function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

const areDepsValid = (deps) =>
  deps === null || deps === undefined || Array.isArray(deps);

// inspired by https://github.com/facebook/react/blob/
// 34ce57ae751e0952fd12ab532a3e5694445897ea/packages/
// react-reconciler/src/ReactFiberHooks.js#L307-L354
// used to replicate dep change behavior and stay consistent
// with React.useEffect()
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null || prevDeps === undefined || !Array.isArray(prevDeps)) {
    return false;
  }

  if (nextDeps === null || nextDeps === undefined || !Array.isArray(nextDeps)) {
    if (Meteor.isDevelopment && !areDepsValid(nextDeps)) {
      warn(
        'Warning: useTracker expected an dependency value of ' +
          `type array but got type of ${typeof nextDeps} instead.`
      );
    }
    return false;
  }

  const len = nextDeps.length;

  if (prevDeps.length !== len) {
    return false;
  }

  for (let i = 0; i < len; i++) {
    if (!shallowEqual(nextDeps[i], prevDeps[i])) {
      return false;
    }
  }

  return true;
}

// Used to create a forceUpdate from useReducer. Forces update by
// incrementing a number whenever the dispatch method is invoked.
const fur = (x) => x + 1;

export const useControlledTracker = (reactiveFn, deps) => {
  const { current: refs } = useRef({ status: 1 });

  const [, forceUpdate] = useReducer(fur, 0);

  const dispose = () => {
    if (refs.computation) {
      refs.computation.stop();
      refs.computation = null;
    }
  };

  /*
  Status can be
  -1: stopped, computation is stopped, dep change won't create a new computation
  0: paused, computation is stopped, dep change will create a new computation (which then will switch to 1, e.g. normal operation mode)
  1: running, computation is running, dep change will create a new computation
  */
  const handle = {
    status: () => refs.status,
    stop: () => {
      if (refs.status <= 1) {
        refs.status = -1;
        dispose();
      }
    },
    pause: () => {
      if (refs.status <= 1) {
        refs.status = 0;
        dispose();
      }
    },
    resume: () => {
      if (refs.status <= 1) {
        refs.status = 1;
        dispose();
        refs.previousDeps = null;
        forceUpdate();
      }
    },
  };

  // this is called like at componentWillMount and componentWillUpdate equally
  // in order to support render calls with synchronous data from the reactive computation
  // if prevDeps or deps are not set areHookInputsEqual always returns false
  // and the reactive functions is always called
  if (refs.status >= 0 && !areHookInputsEqual(deps, refs.previousDeps)) {
    // if we are re-creating the computation, we need to stop the old one.
    dispose();

    // store the deps for comparison on next render
    refs.previousDeps = deps;

    // Use Tracker.nonreactive in case we are inside a Tracker Computation.
    // This can happen if someone calls `ReactDOM.render` inside a Computation.
    // In that case, we want to opt out of the normal behavior of nested
    // Computations, where if the outer one is invalidated or stopped,
    // it stops the inner one.
    refs.computation = Tracker.nonreactive(() =>
      Tracker.autorun((c) => {
        const runReactiveFn = () => {
          const data = reactiveFn(handle);
          if (Meteor.isDevelopment) checkCursor(data);
          refs.trackerData = data;
        };

        if (c.firstRun) {
          refs.status = 1;
          // This will capture data synchronously on first run (and after deps change).
          // Additional cycles will follow the normal computation behavior.
          runReactiveFn();
        } else {
          // If deps are falsy, stop computation and let next render handle reactiveFn.
          if (!areDepsValid(deps)) {
            dispose();
          } else {
            runReactiveFn();
          }
          forceUpdate();
        }
      })
    );
  }

  // stop the computation on unmount only
  useEffect(() => {
    if (Meteor.isDevelopment && !areDepsValid(deps)) {
      warn(
        'Warning: useTracker expected an initial dependency value of ' +
          `type array but got type of ${typeof deps} instead.`
      );
    }

    return dispose;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [refs.trackerData, handle];
};

export default (reactiveFn, deps) => useControlledTracker(reactiveFn, deps)[0];
