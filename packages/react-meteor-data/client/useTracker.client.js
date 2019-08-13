/* global Package */ // Todo: Where to import this from?
import React, { useReducer, useEffect, useRef, useMemo } from 'react';
/* eslint-disable import/no-unresolved */
import { Tracker } from 'meteor/tracker';
import { Meteor } from 'meteor/meteor';
/* eslint-enable import/no-unresolved */

// Use React.warn() if available (should ship in React 16.9).
// eslint-disable-next-line no-console
const warn = React.warn || console.warn.bind(console);

let defaultTransform;
// taken from https://github.com/facebook/react/blob/
// 34ce57ae751e0952fd12ab532a3e5694445897ea/packages/shared/objectIs.js
let defaultIsEqual = (x, y) =>
  // eslint-disable-next-line no-self-compare
  (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);

export const setDefaultOptions = (options) => {
  if (options && options.transform) {
    if (typeof options.transform === 'function') {
      defaultTransform = options.transform;
    } else {
      warn(
        'Warning: useTracker.setDefaultOptions expected a function as ' +
          `transform, but got type of ${typeof options.transform}.`
      );
    }
  }

  if (options && options.isEqual) {
    if (typeof options.isEqual === 'function') {
      defaultIsEqual = options.isEqual;
    } else {
      warn(
        'Warning: useTracker.setDefaultOptions expected a function as ' +
          `isEqual, but got type of ${typeof options.isEqual}.`
      );
    }
  }
};

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

// Used to create a forceUpdate from useReducer. Forces update by
// incrementing a number whenever the dispatch method is invoked.
const fur = (x) => x + 1;

// The follow functions were hoisted out of the closure to reduce allocations.
// Since they no longer have access to the local vars, we pass them in and mutate here.
const dispose = (refs) => {
  if (refs.computationCleanup) {
    refs.computationCleanup();
    // eslint-disable-next-line no-param-reassign
    delete refs.computationCleanup;
  }
  if (refs.computation) {
    refs.computation.stop();
    // eslint-disable-next-line no-param-reassign
    refs.computation = null;
  }
};

const runReactiveFn = (refs, func) => {
  let data = func(refs.handle);
  if (Meteor.isDevelopment) checkCursor(data);
  if (refs.transform) data = refs.transform(refs.trackerData, data);
  return data;
};

export const useControlledTracker = (
  reactiveFn,
  deps,
  computationHandler,
  options
) => {
  if (Meteor.isDevelopment) {
    if (typeof reactiveFn !== 'function') {
      warn(
        "Warning: useTracker expected a function in it's first argument " +
          `(reactiveFn), but got type of ${typeof reactiveFn}.`
      );
    }
    if (deps && !Array.isArray(deps)) {
      warn(
        "Warning: useTracker expected an array in it's second argument " +
          `(dependency), but got type of ${typeof deps}.`
      );
    }
    if (computationHandler && typeof computationHandler !== 'function') {
      warn(
        "Warning: useTracker expected a function in it's third argument" +
          `(computationHandler), but got type of ${typeof computationHandler}.`
      );
    }
    if (
      options &&
      options.transform &&
      typeof options.transform !== 'function'
    ) {
      warn(
        "Warning: useTracker expected a function in it's fourth argument" +
          `(transform), but got type of ${typeof options.transform}.`
      );
    }
    if (options && options.isEqual && typeof options.isEqual !== 'function') {
      warn(
        "Warning: useTracker expected a function in it's fourth argument" +
          `(options), but got type of ${typeof options.isEqual}.`
      );
    }
  }
  const [, forceUpdate] = useReducer(fur, 0);

  /*
  Status can be
  -1: stopped, computation is stopped, dep change won't create a new computation
  0: paused, computation is stopped, dep change will create a new computation (which then will switch to 1, e.g. normal operation mode)
  1: running, computation is running, dep change will create a new computation
  */
  const { current: refs } = useRef({
    status: 1,
    isEqual: (options && options.isEqual) || defaultIsEqual,
    transform: (options && options.transform) || defaultTransform,
    handle: {
      computation: () => refs.computation,
      status: () => refs.status,
      stop: () => {
        if (refs.status <= 1) {
          refs.status = -1;
          dispose(refs);
        }
      },
      pause: () => {
        if (refs.status <= 1) {
          refs.status = 0;
          dispose(refs);
        }
      },
      resume: () => {
        if (refs.status <= 1) {
          refs.status = 1;
          dispose(refs);
          if (Array.isArray(deps)) {
            refs.computation = Tracker.nonreactive(() =>
              // eslint-disable-next-line no-use-before-define
              Tracker.autorun(tracked)
            );
          }
          forceUpdate();
        }
      },
    },
  });

  const tracked = (c) => {
    if (c.firstRun) {
      refs.status = 1;
      // If there is a computationHandler, pass it the computation, and store the
      // result, which may be a cleanup method.
      if (computationHandler) {
        const cleanupHandler = computationHandler(c);
        if (cleanupHandler) {
          if (Meteor.isDevelopment && typeof cleanupHandler !== 'function') {
            warn(
              'Warning: Computation handler should return a function ' +
                'to be used for cleanup or return nothing.'
            );
          }
          refs.computationCleanup = cleanupHandler;
        }
      }

      // This will capture data synchronously on first run (and after deps change).
      // Don't run if refs.isMounted === false. Do run if === undefined, because
      // that's the first render.
      if (refs.isMounted === false) return;

      // If isMounted is undefined, we set it to false, to indicate first run is finished.
      if (refs.isMounted === undefined) refs.isMounted = false;

      refs.trackerData = runReactiveFn(refs, reactiveFn);
    } else {
      // If deps are anything other than an array, stop computation and let next render
      // handle reactiveFn. These null and undefined checks are optimizations to avoid
      // calling Array.isArray in these cases.
      // eslint-disable-next-line no-lonely-if
      if (deps === null || deps === undefined || !Array.isArray(deps)) {
        dispose(refs);
        forceUpdate();
      } else if (refs.isMounted) {
        // Only run the reactiveFn if the component is mounted.
        const d = runReactiveFn(refs, reactiveFn);
        const hasChanged = !refs.isEqual(refs.trackerData, d);
        if (hasChanged) {
          refs.trackerData = d;
          forceUpdate();
        }
      } else {
        // If not mounted, defer render until mounted.
        refs.doDeferredRender = true;
      }
    }
  };

  // We are abusing useMemo a little bit, using it for it's deps
  // compare, but not for it's memoization.
  useMemo(() => {
    if (refs.status === -1) return;
    // if we are re-creating the computation, we need to stop the old one.
    dispose(refs);

    // Use Tracker.nonreactive in case we are inside a Tracker Computation.
    // This can happen if someone calls `ReactDOM.render` inside a Computation.
    // In that case, we want to opt out of the normal behavior of nested
    // Computations, where if the outer one is invalidated or stopped,
    // it stops the inner one.
    refs.computation = Tracker.nonreactive(() => Tracker.autorun(tracked));

    // We are creating a side effect in render, which can be problematic in some cases, such as
    // Suspense or concurrent rendering or if an error is thrown and handled by an error boundary.
    // We still want synchronous rendering for a number of reason (see readme), so we work around
    // possible memory/resource leaks by setting a time out to automatically clean everything up,
    // and watching a set of references to make sure everything is choreographed correctly.
    if (!refs.isMounted) {
      // Components yield to allow the DOM to update and the browser to paint before useEffect
      // is run. In concurrent mode this can take quite a long time, so we set a 1000ms timeout
      // to allow for that.
      refs.disposeId = setTimeout(() => {
        if (!refs.isMounted) {
          dispose(refs);
        }
      }, 1000);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Now that we are mounted, we can set the flag, and cancel the timeout
    refs.isMounted = true;

    clearTimeout(refs.disposeId);
    delete refs.disposeId;

    // If it took longer than 1000ms to get to useEffect, we might need to restart the
    // computation. Alternatively, we might have a queued render from a reactive update
    // which happened before useEffect.
    if (refs.doDeferredRender) {
      delete refs.doDeferredRender;

      const d = runReactiveFn(refs, reactiveFn);
      const hasChanged = !refs.isEqual(refs.trackerData, d);
      refs.trackerData = d;
      if (hasChanged) forceUpdate();
    }

    // stop the computation on unmount
    return () => dispose(refs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [refs.trackerData, refs.handle];
};

export default (reactiveFn, deps, computationHandler, options) =>
  useControlledTracker(reactiveFn, deps, computationHandler, options)[0];
