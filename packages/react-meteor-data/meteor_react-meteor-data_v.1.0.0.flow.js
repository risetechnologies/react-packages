type TrackerHandle = {
  status: () => -1 | 0 | 1,
  stop: () => void,
  pause: () => void,
  resume: () => void,
};

declare module 'meteor/risetechnologies:react-meteor-data' {
  declare export function withTracker<InputProps, InjectedProps>(
      ((props: InputProps) => InjectedProps)
      | ({ getMeteorData: (props: InputProps, handle: TrackerHandle) => InjectedProps, pure?: boolean, deps?: Array<any> }),
  ): <Config: InputProps, Instance>(WrappedComponent: React$AbstractComponent<Config, Instance>)
    => React$AbstractComponent<$Diff<Config, InjectedProps>, Instance>;

  declare export function useTracker<OutputProps>((TrackerHandle) => OutputProps, deps?: Array<any>): OutputProps;

  declare export function useControlledTracker<OutputProps>((TrackerHandle) => OutputProps, deps?: Array<any>): [OutputProps, TrackerHandle];
}
