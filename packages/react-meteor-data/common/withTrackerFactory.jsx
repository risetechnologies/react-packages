import React, { forwardRef, memo } from 'react';

const withTrackerFactory = (useHookFunction) => (options) => (Component) => {
  const expandedOptions =
    typeof options === 'function' ? { getMeteorData: options } : options;
  const { getMeteorData, pure = true, deps = null } = expandedOptions;

  const WithTracker = forwardRef((props, ref) => {
    const data = useHookFunction((handle) => getMeteorData(props, handle) || {}, deps);
    return <Component ref={ref} {...props} {...data} />;
  });

  return pure ? memo(WithTracker) : WithTracker;
};

export default withTrackerFactory;
