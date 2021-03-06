import React, { useState } from 'react';
import ReactDOM from 'react-dom';
/* eslint-disable import/no-unresolved */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { _ } from 'meteor/underscore';
import { ReactiveVar } from 'meteor/reactive-var';
import { Tinytest } from 'meteor/tinytest';
import { canonicalizeHtml, testAsyncMulti } from 'meteor/test-helpers';
import { Tracker } from 'meteor/tracker';
/* eslint-enable import/no-unresolved */

import withTrackerClient from '../client/withTracker.client';
import withTrackerServer from '../server/withTracker.server';

const withTracker = Meteor.isServer ? withTrackerServer : withTrackerClient;

/* eslint-disable */
const getInnerHtml = function (elem) {
  // clean up elem.innerHTML and strip data-reactid attributes too
  return canonicalizeHtml(elem.innerHTML).replace(/ data-reactroot=".*?"/g, '');
};

if (Meteor.isClient) {
  Tinytest.add('withTracker - basic track', function (test) {
    var div = document.createElement("DIV");

    var x = new ReactiveVar('aaa');

    var Foo = withTracker(() => {
      return {
        x: x.get()
      };
    })((props) => {
      return <span>{props.x}</span>;
    });

    ReactDOM.render(<Foo/>, div);
    test.equal(getInnerHtml(div), '<span>aaa</span>');

    x.set('bbb');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>bbb</span>');

    test.equal(x._numListeners(), 1);

    ReactDOM.unmountComponentAtNode(div);

    test.equal(x._numListeners(), 0);
  });

  // Make sure that calling ReactDOM.render() from an autorun doesn't
  // associate that autorun with the mixin's autorun.  When autoruns are
  // nested, invalidating the outer one stops the inner one, unless
  // Tracker.nonreactive is used.  This test tests for the use of
  // Tracker.nonreactive around the mixin's autorun.
  Tinytest.add('withTracker - render in autorun', function (test) {
    var div = document.createElement("DIV");

    var x = new ReactiveVar('aaa');

    var Foo = withTracker(() => {
      return {
        x: x.get()
      };
    })((props) => {
      return <span>{props.x}</span>;
    });

    Tracker.autorun(function (c) {
      ReactDOM.render(<Foo/>, div);
      // Stopping this autorun should not affect the mixin's autorun.
      c.stop();
    });
    test.equal(getInnerHtml(div), '<span>aaa</span>');

    x.set('bbb');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>bbb</span>');

    ReactDOM.unmountComponentAtNode(div);
  });

  Tinytest.add('withTracker - track based on props and state', function (test) {
    var div = document.createElement("DIV");

    var xs = [new ReactiveVar('aaa'),
      new ReactiveVar('bbb'),
      new ReactiveVar('ccc')];

    let setState;
    var Foo = (props) => {
      const [state, _setState] = useState({ m: 0 });
      setState = _setState;
      const Component = withTracker((props) => {
        return {
          x: xs[state.m + props.n].get()
        };
      })((props) => {
        return <span>{props.x}</span>;
      });
      return <Component {...props} />
    };

    var comp = ReactDOM.render(<Foo n={0}/>, div);

    test.equal(getInnerHtml(div), '<span>aaa</span>');
    xs[0].set('AAA');
    test.equal(getInnerHtml(div), '<span>aaa</span>');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>AAA</span>');

    {
      let comp2 = ReactDOM.render(<Foo n={1}/>, div);
      test.isTrue(comp === comp2);
    }

    test.equal(getInnerHtml(div), '<span>bbb</span>');
    xs[1].set('BBB');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>BBB</span>');

    setState({m: 1});
    test.equal(getInnerHtml(div), '<span>ccc</span>');
    xs[2].set('CCC');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>CCC</span>');

    ReactDOM.render(<Foo n={0}/>, div);
    setState({m: 0});
    test.equal(getInnerHtml(div), '<span>AAA</span>');

    ReactDOM.unmountComponentAtNode(div);
  });

  Tinytest.add('withTracker - track based on props and state (with deps)', function (test) {
    var div = document.createElement("DIV");

    var xs = [new ReactiveVar('aaa'),
      new ReactiveVar('bbb'),
      new ReactiveVar('ccc')];

    let setState;
    var Foo = (props) => {
      const [state, _setState] = useState({ m: 0 });
      setState = _setState;
      const Component = withTracker({
        getMeteorData () {
          return {
            x: xs[state.m + props.n].get()
          };
        },
        deps: [state.m, props.n]
      })((props) => {
        return <span>{props.x}</span>;
      });
      return <Component {...props} />
    };

    var comp = ReactDOM.render(<Foo n={0}/>, div);

    test.equal(getInnerHtml(div), '<span>aaa</span>');
    xs[0].set('AAA');
    test.equal(getInnerHtml(div), '<span>aaa</span>');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>AAA</span>');

    {
      let comp2 = ReactDOM.render(<Foo n={1}/>, div);
      test.isTrue(comp === comp2);
    }

    test.equal(getInnerHtml(div), '<span>bbb</span>');
    xs[1].set('BBB');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>BBB</span>');

    setState({m: 1});
    test.equal(getInnerHtml(div), '<span>ccc</span>');
    xs[2].set('CCC');
    Tracker.flush({_throwFirstError: true});
    test.equal(getInnerHtml(div), '<span>CCC</span>');

    ReactDOM.render(<Foo n={0}/>, div);
    setState({m: 0});
    test.equal(getInnerHtml(div), '<span>AAA</span>');

    ReactDOM.unmountComponentAtNode(div);
  });

  function waitFor(func, callback) {
    Tracker.autorun(function (c) {
      if (func()) {
        c.stop();
        callback();
      }
    });
  };

  testAsyncMulti('withTracker - resubscribe', [
    function (test, expect) {
      var self = this;
      self.div = document.createElement("DIV");
      self.collection = new Mongo.Collection("withTracker-mixin-coll");
      self.num = new ReactiveVar(1);
      self.someOtherVar = new ReactiveVar('foo');
      self.Foo = withTracker(() => {
        self.handle =
          Meteor.subscribe("withTracker-mixin-sub",
            self.num.get());

        return {
          v: self.someOtherVar.get(),
          docs: self.collection.find().fetch()
        };
      })((props) => {
        self.data = props;
        return <div>{
          _.map(props.docs, (doc) => <span key={doc._id}>{doc._id}</span>)
        }</div>;
      });

      self.component = ReactDOM.render(<self.Foo/>, self.div);
      test.equal(getInnerHtml(self.div), '<div></div>');

      var handle = self.handle;
      test.isFalse(handle.ready());

      waitFor(() => handle.ready(),
        expect());
    },
    function (test, expect) {
      var self = this;
      test.isTrue(self.handle.ready());
      test.equal(getInnerHtml(self.div), '<div><span>id1</span></div>');

      self.someOtherVar.set('bar');
      self.oldHandle1 = self.handle;

      // can't call Tracker.flush() here (we are in a Tracker.flush already)
      Tracker.afterFlush(expect());
    },
    function (test, expect) {
      var self = this;
      var oldHandle = self.oldHandle1;
      var newHandle = self.handle;
      test.notEqual(oldHandle, newHandle); // new handle
      test.equal(newHandle.subscriptionId, oldHandle.subscriptionId); // same sub
      test.isTrue(newHandle.ready()); // doesn't become unready
      // no change to the content
      test.equal(getInnerHtml(self.div), '<div><span>id1</span></div>');

      // ok, now change the `num` argument to the subscription
      self.num.set(2);
      self.oldHandle2 = newHandle;
      Tracker.afterFlush(expect());
    },
    function (test, expect) {
      var self = this;
      // data is still there
      test.equal(getInnerHtml(self.div), '<div><span>id1</span></div>');
      // handle is no longer ready
      var handle = self.handle;
      test.isFalse(handle.ready());
      // different sub ID
      test.isTrue(self.oldHandle2.subscriptionId);
      test.isTrue(handle.subscriptionId);
      test.notEqual(handle.subscriptionId, self.oldHandle2.subscriptionId);

      waitFor(() => handle.ready(),
        expect());
    },
    function (test, expect) {
      var self = this;
      // now we see the new data! (and maybe the old data, because
      // when a subscription goes away, its data doesn't disappear right
      // away; the server has to tell the client which documents or which
      // properties to remove, and this is not easy to wait for either; see
      // https://github.com/meteor/meteor/issues/2440)
      test.equal(getInnerHtml(self.div).replace('<span>id1</span>', ''),
        '<div><span>id2</span></div>');

      self.someOtherVar.set('baz');
      self.oldHandle3 = self.handle;

      Tracker.afterFlush(expect());
    },
    function (test, expect) {
      var self = this;
      test.equal(self.data.v, 'baz');
      test.notEqual(self.oldHandle3, self.handle);
      test.equal(self.oldHandle3.subscriptionId,
        self.handle.subscriptionId);
      test.isTrue(self.handle.ready());
    },
    function (test, expect) {
      ReactDOM.unmountComponentAtNode(this.div);
      // break out of flush time, so we don't call the test's
      // onComplete from within Tracker.flush
      Meteor.defer(expect());
    }
  ]);

  // Tinytest.add(
  //   "withTracker - print warning if return cursor from withTracker",
  //   function (test) {
  //     var coll = new Mongo.Collection(null);
  //     var ComponentWithCursor = () => {
  //       withTracker(() => {
  //         return {
  //           theCursor: coll.find()
  //         };
  //       });
  //       return <span></span>;
  //     };

  //     // Check if we print a warning to console about props
  //     // You can be sure this test is correct because we have an identical one in
  //     // react-runtime-dev
  //     let warning;
  //     try {
  //       var oldWarn = console.warn;
  //       console.warn = function specialWarn(message) {
  //         warning = message;
  //       };

  //       var div = document.createElement("DIV");
  //       ReactDOM.render(<ComponentWithCursor />, div);

  //       test.matches(warning, /cursor before returning it/);
  //     } finally {
  //       console.warn = oldWarn;
  //     }
  //   });

} else {
  Meteor.publish("withTracker-mixin-sub", function (num) {
    Meteor.defer(() => {  // because subs are blocking
      this.added("withTracker-mixin-coll", 'id'+num, {});
      this.ready();
    });
  });
}
/* eslint-enable */
