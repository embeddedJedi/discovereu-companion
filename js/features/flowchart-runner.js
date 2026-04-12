// js/features/flowchart-runner.js
// DOM-free DAG walker for crisis flowcharts.
// The runner holds navigation state only — the UI layer consumes `onEnter(node, state)`
// and is solely responsible for any rendering. No DOM APIs are touched here.
//
// Keyboard contract (handled by the UI panel, documented here for reference):
//   - Tab / Shift+Tab: natural focus traversal over option buttons.
//   - Enter / Space on an option: UI calls `runner.choose(idx)`.
//   - Enter on an `action` node's primary control: UI calls `runner.choose()` (auto-advance).
//   - Backspace or Alt+ArrowLeft: UI calls `runner.back()` when `canGoBack()`.
//   - Escape: UI closes the overlay (no runner call).

/**
 * Flowchart node shape (see data/crisis-flowcharts.json):
 *   { kind: "question", text, options: [{ labelKey, next }, ...] }
 *   { kind: "action",   text, actions?: [...], next }
 *   { kind: "terminal", text, sourceUrl }
 *
 * Flowchart shape:
 *   { title, description, startNode, nodes: { [id]: node } }
 */

/**
 * Create a flowchart runner bound to a flowchart DAG.
 *
 * @param {object} flowchart - Flowchart with `startNode` and `nodes` map.
 * @param {object} [opts]
 * @param {(node: object, state: object) => void} [opts.onEnter]
 *        Fires after every successful transition with the newly-entered node
 *        and a snapshot of the runner's state.
 * @returns {{
 *   readonly current: object,
 *   readonly history: string[],
 *   readonly state: { currentId: string, path: string[], chosen: number[] },
 *   choose: (optionIdx?: number) => boolean,
 *   goto: (nodeId: string) => boolean,
 *   back: () => boolean,
 *   restart: () => void,
 *   canGoBack: () => boolean,
 * }}
 */
export function createRunner(flowchart, opts = {}) {
  if (!flowchart || !flowchart.nodes || !flowchart.startNode) {
    throw new Error("flowchart-runner: invalid flowchart (missing startNode/nodes)");
  }
  if (!flowchart.nodes[flowchart.startNode]) {
    throw new Error(`flowchart-runner: startNode "${flowchart.startNode}" not in nodes`);
  }

  const onEnter = typeof opts.onEnter === "function" ? opts.onEnter : null;

  /** @type {{ currentId: string, path: string[], chosen: number[] }} */
  const state = {
    currentId: flowchart.startNode,
    path: [flowchart.startNode],
    chosen: [],
  };

  const getNode = (id) => {
    const node = flowchart.nodes[id];
    if (!node) throw new Error(`flowchart-runner: node "${id}" missing`);
    return node;
  };

  const snapshot = () => ({
    currentId: state.currentId,
    path: state.path.slice(),
    chosen: state.chosen.slice(),
  });

  const fireEnter = () => {
    if (onEnter) onEnter(getNode(state.currentId), snapshot());
  };

  const api = {
    get current() {
      return getNode(state.currentId);
    },
    get history() {
      return state.path.slice();
    },
    get state() {
      return snapshot();
    },

    /**
     * Advance from the current node.
     * - For `question` nodes: requires a numeric `optionIdx` into `options[]`.
     * - For `action` nodes: call with no args to follow `node.next`.
     * - For `terminal` nodes: no-op, returns false.
     * @param {number} [optionIdx]
     * @returns {boolean} true when a transition occurred.
     */
    choose(optionIdx) {
      const node = getNode(state.currentId);
      let nextId = null;
      let chosenIdx = -1;

      if (node.kind === "question") {
        if (!Array.isArray(node.options) || node.options.length === 0) {
          throw new Error(`flowchart-runner: question node "${state.currentId}" has no options`);
        }
        if (typeof optionIdx !== "number" || optionIdx < 0 || optionIdx >= node.options.length) {
          throw new Error(`flowchart-runner: invalid optionIdx "${optionIdx}" for node "${state.currentId}"`);
        }
        nextId = node.options[optionIdx].next;
        chosenIdx = optionIdx;
      } else if (node.kind === "action") {
        if (!node.next) {
          throw new Error(`flowchart-runner: action node "${state.currentId}" has no "next"`);
        }
        nextId = node.next;
      } else {
        // terminal
        return false;
      }

      if (!flowchart.nodes[nextId]) {
        throw new Error(`flowchart-runner: dangling next "${nextId}" from "${state.currentId}"`);
      }

      state.currentId = nextId;
      state.path.push(nextId);
      state.chosen.push(chosenIdx);
      fireEnter();
      return true;
    },

    /**
     * Jump to a specific node id. Appends to path so `back()` can return.
     * @param {string} nodeId
     * @returns {boolean}
     */
    goto(nodeId) {
      if (!flowchart.nodes[nodeId]) {
        throw new Error(`flowchart-runner: goto unknown node "${nodeId}"`);
      }
      state.currentId = nodeId;
      state.path.push(nodeId);
      state.chosen.push(-1);
      fireEnter();
      return true;
    },

    /**
     * Pop the last path entry. No-op at start.
     * @returns {boolean}
     */
    back() {
      if (state.path.length <= 1) return false;
      state.path.pop();
      state.chosen.pop();
      state.currentId = state.path[state.path.length - 1];
      fireEnter();
      return true;
    },

    /** Reset to the flowchart's start node. */
    restart() {
      state.currentId = flowchart.startNode;
      state.path = [flowchart.startNode];
      state.chosen = [];
      fireEnter();
    },

    /** @returns {boolean} true when `back()` would do something. */
    canGoBack() {
      return state.path.length > 1;
    },
  };

  return api;
}

/**
 * Validate a flowchart DAG.
 *
 * Checks:
 *   - `startNode` exists in `nodes`.
 *   - Every `next` / `options[].next` points to an existing node.
 *   - Every `question` has ≥1 option.
 *   - Every `terminal` has a `sourceUrl`.
 *   - No orphan nodes (all reachable from `startNode`).
 *
 * @param {object} flowchart
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFlowchart(flowchart) {
  const errors = [];

  if (!flowchart || typeof flowchart !== "object") {
    return { valid: false, errors: ["flowchart is not an object"] };
  }
  if (!flowchart.nodes || typeof flowchart.nodes !== "object") {
    return { valid: false, errors: ["flowchart.nodes missing"] };
  }
  if (!flowchart.startNode) {
    errors.push("startNode missing");
  } else if (!flowchart.nodes[flowchart.startNode]) {
    errors.push(`startNode "${flowchart.startNode}" not in nodes`);
  }

  const ids = Object.keys(flowchart.nodes);

  for (const id of ids) {
    const node = flowchart.nodes[id];
    if (!node || typeof node !== "object") {
      errors.push(`node "${id}" is not an object`);
      continue;
    }
    switch (node.kind) {
      case "question": {
        if (!Array.isArray(node.options) || node.options.length === 0) {
          errors.push(`question node "${id}" has no options`);
          break;
        }
        node.options.forEach((opt, i) => {
          if (!opt || !opt.next) {
            errors.push(`question node "${id}" option ${i} missing "next"`);
          } else if (!flowchart.nodes[opt.next]) {
            errors.push(`question node "${id}" option ${i} points to missing node "${opt.next}"`);
          }
        });
        break;
      }
      case "action": {
        if (!node.next) {
          errors.push(`action node "${id}" missing "next"`);
        } else if (!flowchart.nodes[node.next]) {
          errors.push(`action node "${id}" points to missing node "${node.next}"`);
        }
        break;
      }
      case "terminal": {
        if (!node.sourceUrl) {
          errors.push(`terminal node "${id}" missing sourceUrl`);
        }
        break;
      }
      default:
        errors.push(`node "${id}" has unknown kind "${node.kind}"`);
    }
  }

  // Reachability from startNode.
  if (flowchart.startNode && flowchart.nodes[flowchart.startNode]) {
    const reachable = new Set();
    const stack = [flowchart.startNode];
    while (stack.length) {
      const cur = stack.pop();
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      const node = flowchart.nodes[cur];
      if (!node) continue;
      if (node.kind === "question" && Array.isArray(node.options)) {
        for (const opt of node.options) {
          if (opt && opt.next && flowchart.nodes[opt.next]) stack.push(opt.next);
        }
      } else if (node.kind === "action" && node.next && flowchart.nodes[node.next]) {
        stack.push(node.next);
      }
    }
    for (const id of ids) {
      if (!reachable.has(id)) errors.push(`orphan node "${id}" unreachable from startNode`);
    }
  }

  return { valid: errors.length === 0, errors };
}
