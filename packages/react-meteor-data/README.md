## `react-meteor-data`

This package provides an integration between React and [`Tracker`](https://atmospherejs.com/meteor/tracker), Meteor's reactive data system.

### Install

To install the package, use `meteor add`:

```bash
meteor add react-meteor-data
```

You'll also need to install `react` if you have not already:

```bash
npm install --save react
```

### Usage

This package provides two ways to use Tracker reactive data in your React components:
- a hook: `useTracker` (v2 only, requires React `^16.8`)
- a higher-order component (HOC): `withTracker` (v1 and v2).

The `useTracker` hook, introduced in version 2.0.0, embraces the [benefits of hooks](https://reactjs.org/docs/hooks-faq.html). Like all React hooks, it can only be used in function components, not in class components.

The `withTracker` HOC can be used with all components, function or class based.

It is not necessary to rewrite existing applications to use the `useTracker` hook instead of the existing `withTracker` HOC.

#### `useTracker(reactiveFn, deps)` hook

You can use the `useTracker` hook to get the value of a Tracker reactive function in your (function) components. The reactive function will get re-run whenever its reactive inputs change, and the component will re-render with the new value.

Arguments:
- `reactiveFn`: A Tracker reactive function (with no parameters).
- `deps`: An optional array of "dependencies" of the reactive function. This is very similar to how the `deps` argument for [React's built-in `useEffect`, `useCallback` or `useMemo` hooks](https://reactjs.org/docs/hooks-reference.html) work. If omitted, the Tracker computation will be recreated on every render (Note: `withTracker` has always done this). If provided, the computation will be retained, and reactive updates after the first run will run asynchronously from the react render cycle. This array typically includes all variables from the outer scope "captured" in the closure passed as the 1st argument. For example, the value of a prop used in a subscription or a Minimongo query; see example below.

```js
import { useTracker } from 'meteor/react-meteor-data';

// React function component.
function Foo({ listId }) {
  // This computation uses no value from the outer scope,
  // and thus does not needs to pass a 'deps' argument.
  // However, we can optimize the use of the computation
  // by providing an empty deps array. With it, the
  // computation will be retained instead of torn down and
  // rebuilt on every render. useTracker will produce the
  // same results either way.
  const currentUser = useTracker(() => Meteor.user(), []);

  // The following two computations both depend on the
  // listId prop. When deps are specified, the computation
  // will be retained.
  const listLoading = useTracker(() => {
    // Note that this subscription will get cleaned up
    // when your component is unmounted or deps change.
    const handle = Meteor.subscribe('todoList', listId);
    return !handle.ready();
  }, [listId]);
  const tasks = useTracker(() => Tasks.find({ listId }).fetch(), [listId]);

  return (
    <h1>Hello {currentUser.username}</h1>
    {listLoading ?
      <div>Loading</div> :
      <div>
        Here is the Todo list {listId}:
        <ul>{tasks.map(task => <li key={task._id}>{task.label}</li>)}</ul>
      </div}
  );
}
```

**Note:** the [eslint-plugin-react-hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks) package provides ESLint hints to help detect missing values in the `deps` argument of React built-in hooks. It can be configured to also validate the `deps` argument of the `useTracker` hook or some other hooks, with the following `eslintrc` config:

```
"react-hooks/exhaustive-deps": ["warn", { "additionalHooks": "useTracker|useSomeOtherHook|..." }]
```

#### `withTracker(reactiveFn)` higher-order component

You can use the `withTracker` HOC to wrap your components and pass them additional props values from a Tracker reactive function. The reactive function will get re-run whenever its reactive inputs change, and the wrapped component will re-render with the new values for the additional props.

Arguments:
- `reactiveFn`: a Tracker reactive function, getting the props as a parameter, and returning an object of additional props to pass to the wrapped component.

```js
import { withTracker } from 'meteor/react-meteor-data';

// React component (function or class).
function Foo({ listId, currentUser, listLoading, tasks }) {
  return (
    <h1>Hello {currentUser.username}</h1>
    {listLoading ?
      <div>Loading</div> :
      <div>
        Here is the Todo list {listId}:
        <ul>{tasks.map(task => <li key={task._id}>{task.label}</li>)}</ul>
      </div}
  );
}

export default withTracker(({ listId }) => {
  // Do all your reactive data access in this function.
  // Note that this subscription will get cleaned up when your component is unmounted
  const handle = Meteor.subscribe('todoList', listId);

  return {
    currentUser: Meteor.user(),
    listLoading: !handle.ready(),
    tasks: Tasks.find({ listId }).fetch(),
  };
})(Foo);
```

The returned component will, when rendered, render `Foo` (the "lower-order" component) with its provided props in addition to the result of the reactive function. So `Foo` will receive `{ listId }` (provided by its parent) as well as `{ currentUser, listLoading, tasks }` (added by the `withTracker` HOC).

For more information, see the [React article](http://guide.meteor.com/react.html) in the Meteor Guide.

### Version compatibility notes

- `react-meteor-data` v2.x :
  - `useTracker` hook + `withTracker` HOC
  - Requires React `^16.8`.
  - Implementation is compatible with the forthcoming "React Suspense" features.
  - The `withTracker` HOC is strictly backwards-compatible with the one provided in v1.x, the major version number is only motivated by the bump of React version requirement. Provided a compatible React version, existing Meteor apps leveraging the `withTracker` HOC can freely upgrade from v1.x to v2.x, and gain compatibility with future React versions.
  - The previously deprecated `createContainer` has been removed.

- `react-meteor-data` v1.x / v0.x :
  - `withTracker` HOC (+ `createContainer`, kept for backwards compatibility with early v0.x releases)
  - Requires React `^15.3` or `^16.0`.
  - Implementation relies on React lifecycle methods (`componentWillMount` / `componentWillUpdate`) that are [marked for deprecation in future React versions](https://reactjs.org/blog/2018/03/29/react-v-16-3.html#component-lifecycle-changes) ("React Suspense").
