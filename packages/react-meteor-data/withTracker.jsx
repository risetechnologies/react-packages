import React, { forwardRef, memo } from 'react';
import useTracker from './useTracker';

export default function withTracker(options) {
  return (Component) => {
    const expandedOptions =
      typeof options === 'function' ? { getMeteorData: options } : options;
    const { getMeteorData, pure = true, deps = null } = expandedOptions;

    const WithTracker = forwardRef((props, ref) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const data = useTracker(() => getMeteorData(props) || {}, deps);
      return <Component ref={ref} {...props} {...data} />;
    });

    return pure ? memo(WithTracker) : WithTracker;
  };
}
