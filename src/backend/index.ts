/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

declare global {
  interface Window {
    __ATOMIC_DEVTOOLS_EXTENSION__: any;
    __REACT_DEVTOOLS_GLOBAL_HOOK__: any;
  }
}

export function fiberHelper(target: Window) {

  const isHTMLElement = function (el: any) {
    if ('HTMLElement' in window) {
      return el instanceof HTMLElement;
    } else {
      return (
        typeof el === 'object' &&
        el.nodeType === 1 &&
        typeof el.nodeName === 'string'
      );
    }
  };

  const parseData = (data: any) => {
    let atomsUsed = [];
    while (data !== null) {
      if (
        data.memoizedState instanceof Array &&
        data.memoizedState[1] instanceof Array &&
        data.memoizedState[1].length > 0 &&
        data.memoizedState[1][0].debugLabel &&
        !atomsUsed.includes(data.memoizedState[1][0].debugLabel)
      ) {
        atomsUsed.push(data.memoizedState[1][0].debugLabel);
      }

      data = data.next;
      // debugger;
    }
    return atomsUsed;
  };

  //One liner helper functions from resq.js
  function isFunction(type) {
    return typeof type === 'function';
  }

  function isHTMLOrText(node) {
    return node instanceof HTMLElement || node instanceof Text;
  }

  function getElementName(type) {
    return isFunction(type) ? type.name : type;
  }

  function isFragmentInstance(element) {
    return element.children.length > 1;
  }

  function findStateNode(element) {
    if (isHTMLOrText(element.stateNode)) {
      return element.stateNode;
    }
    if (element.child && isHTMLOrText(element.child.stateNode)) {
      return element.child.stateNode;
    }
    return null;
  }

  /**
   * @name removeChildrenFromProps
   * @param {Object | String}
   * @return {Object | String}
   * @description Remove the `children` property from the props since they will be available
   *              in the node
   */
  function removeChildrenFromProps(props) {
    // if the props is a string, we can assume that it's just the text inside a html element
    if (!props || typeof props === 'string') {
      return props;
    }
    const returnProps = { ...props };
    delete returnProps.children;
    return returnProps;
  }

  /**
   * @name getElementState
   * @param {Object}
   * @return {Object} | undefined
   * @description Class components store the state in `memoizedState`, but functional components
   *              using hooks store them in `memoizedState.baseState`
   */
  function getElementState(elementState: any) {
    if (!elementState?.next) return undefined;
    return parseData(elementState);
  }

  /**
   * @name buildFragmentNodeArray
   * @param {Object}
   * @return {Array<HTMLElement | empty>}
   * @description Creates an array of the tree's children HTML nodes
   */
  function buildFragmentNodeArray(tree) {
    return tree.children.map(child => child.node).filter(child => !!child);
  }

  /**
 * @name buildNodeTree
 * @param {Object}
 * @return {Object}
 * @description Build a node tree based on React virtual dom
 * @example
 {
      name: 'MyComponent',
      children: [],
      props: { hello: 'world' },
      state: { init: true },
      isFragment: false,
    }
 */
  function buildNodeTree(element) {
    let tree = { children: [] };

    if (!element) {
      return tree;
    }

    tree.name = getElementName(element.type?.$$typeof || element.type);

    // tree.props = removeChildrenFromProps(element.memoizedProps);
    let { child } = element;

    // tree.children.push(memoizedProps?.children);

    tree.usedAtoms = getElementState(element.memoizedState);

    if (child) {
      tree.children.push(child);

      while (child.sibling) {
        tree.children.push(child.sibling);
        child = child.sibling;
      }
    }

    tree.children = tree.children.map(child => buildNodeTree(child));

    // if (isFunction(element.type) && isFragmentInstance(tree)) {
    //   tree.node = buildFragmentNodeArray(tree);
    //   tree.isFragment = true;
    // } else {
    //   tree.node = findStateNode(element);
    // }

    // debugger;
    return tree;
  }


   /**
   * @name liftedOnCommitFiberRoot
   * @description Wraps __REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot function, extracting and sending current fiber to Atomic Devtools
   */
  const liftedOnCommitFiberRoot = (): (() => void) => {
    return () => {
      const devTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

      let fiberRoot = devTools.getFiberRoots(1).values().next().value;
      const reactInstance = devTools ? devTools.renderers.get(1) : null;

      // const throttledUpdatefiber = throttle(
      //   () => updateFiberTree(tree, mode),
      //   70
      // );

      if (reactInstance && reactInstance.version) {
        devTools.onCommitFiberRoot = (function (original) {
          return function (...args: any[]) {

            fiberRoot = args[1];

            // if (doWork) {
            //   throttledUpdateSnapshot();
            // }



            let parseFiber = buildNodeTree(fiberRoot.current);
            let fiberToDevTool = JSON.stringify(parseFiber);

            window.postMessage(
              {
                action: 'FIBER_FROM_APP',
                payload: { componentTree: fiberToDevTool },
              },
              '*'
            );

            return original(...args);
          };
        })(devTools.onCommitFiberRoot);
      }
      // throttledUpdatefiber();
      // return fiberRoot;
    };
  };

  //Testing sending messages to content scripts via our __ATOMIC_DEVTOOLS_EXTENSION__ global hook
  const sendMessageToContentScripts = (message: any) => {
    //This message goes from inspected application to content-scripts
    //target is window in inspected application scope.
    //Say we want access to data scoped in this environment. We can use this as a middleware in the window messaging.

    target.postMessage(message, '*');
  };

  setTimeout(liftedOnCommitFiberRoot(), 500);

  target.__ATOMIC_DEVTOOLS_EXTENSION__.getFiber = liftedOnCommitFiberRoot();
  target.__ATOMIC_DEVTOOLS_EXTENSION__.sendMessageToContentScripts = sendMessageToContentScripts;
}
