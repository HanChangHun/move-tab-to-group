'use strict';
// Move Tab to Group
// Sends the active tab into the neighboring tab group in one keypress. When no group exists
// on that side, a new one is created there with the tab. Relies on undocumented workspace internals (parent.children,
// removeChild, insertChild, selectTab, splitLeaf); verified on Obsidian 1.13.7.

const { Plugin, WorkspaceTabs, WorkspaceSplit } = require('obsidian');

class MoveTabToGroup extends Plugin {
	onload() {
		this.addCommand({
			id: 'left',
			name: 'Move tab to left group',
			callback: () => this.move(-1),
		});
		this.addCommand({
			id: 'right',
			name: 'Move tab to right group',
			callback: () => this.move(1),
		});
	}

	move(dir) {
		const ws = this.app.workspace;
		// Most recently active leaf in the main area or a popout window; sidebars are excluded.
		const leaf = ws.getMostRecentLeaf();
		if (!leaf) return;
		const group = leaf.parent;
		if (!(group instanceof WorkspaceTabs) || !Array.isArray(group.children)) return;

		const target = findNeighbourGroup(group, dir);
		if (target) {
			group.removeChild(leaf);
			leaf.setDimension?.(null);
			target.insertChild(dir < 0 ? target.children.length : 0, leaf);
			target.selectTab?.(leaf);
		} else {
			// A lone tab moved into a fresh group on the same side would only recreate the current layout.
			if (group.children.length < 2 || typeof ws.splitLeaf !== 'function') return;
			group.removeChild(leaf);
			leaf.setDimension?.(null);
			// splitLeaf wraps the detached leaf in a new tab group next to `group`; `before` selects the left side.
			ws.splitLeaf(group, leaf, 'vertical', dir < 0);
		}
		ws.setActiveLeaf(leaf, { focus: true });
		ws.requestResize?.();
	}
}

// Walk up the split tree until a side-by-side split has a sibling in the requested direction,
// then descend into that sibling to the tab group nearest to where we came from.
function findNeighbourGroup(group, dir) {
	const root = group.getRoot();
	let node = group;
	let parent = node.parent;
	while (parent instanceof WorkspaceSplit && Array.isArray(parent.children)) {
		if (parent.direction !== 'horizontal') {
			const sibling = parent.children[parent.children.indexOf(node) + dir];
			if (sibling) return edgeGroup(sibling, dir);
		}
		if (parent === root) break;
		node = parent;
		parent = node.parent;
	}
	return null;
}

function edgeGroup(node, dir) {
	while (node && !(node instanceof WorkspaceTabs)) {
		const children = node.children;
		if (!Array.isArray(children) || children.length === 0) return null;
		const sideBySide = node.direction !== 'horizontal';
		node = sideBySide && dir > 0 ? children[0]
			: sideBySide ? children[children.length - 1]
			: children[0];
	}
	return node || null;
}

module.exports = MoveTabToGroup;
