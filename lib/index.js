"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSelectedBlocksMap = getSelectedBlocksMap;
exports.getWrappedBlocksAfter = getWrappedBlocksAfter;
exports.getWrappedBlocksBefore = getWrappedBlocksBefore;
exports.getBlockMapText = getBlockMapText;
exports.getContiguousBlocks = getContiguousBlocks;
exports.removeStyleForBlockType = exports.hasInlineStyle = exports.removeInlineStyle = exports.indentBackward = exports.indentForward = exports.selectBlock = exports.isCursorBetweenLink = exports.addNewBlockAt = exports.updateDataOfBlock = exports.resetBlockWithType = exports.addNewBlock = exports.getCurrentBlock = exports.getDefaultBlockData = exports.adjustBlockDepth = exports.insertText = void 0;

var _immutable = require("immutable");

var _draftJs = require("draft-js");

var _adjustBlockDepthForContentState = _interopRequireDefault(require("draft-js/lib/adjustBlockDepthForContentState"));

var _constants = require("./constants");

var _leftIndent = require("left-indent");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// source: https://github.com/sugarshin/draft-js-modifiers/blob/master/src/insertText.js
var insertText = function insertText(editorState, text, entity) {
  var selection = editorState.getSelection();
  var content = editorState.getCurrentContent();

  var newContent = _draftJs.Modifier[selection.isCollapsed() ? 'insertText' : 'replaceText'](content, selection, text, editorState.getCurrentInlineStyle(), entity);

  return _draftJs.EditorState.push(editorState, newContent, 'insert-fragment');
}; // source: https://github.com/jpuri/draftjs-utils/blob/master/js/block.js


exports.insertText = insertText;

function getSelectedBlocksMap(editorState) {
  var selectionState = editorState.getSelection();
  var contentState = editorState.getCurrentContent();
  var startKey = selectionState.getStartKey();
  var endKey = selectionState.getEndKey();
  var blockMap = contentState.getBlockMap();
  return blockMap.toSeq().skipUntil(function (_, k) {
    return k === startKey;
  }).takeUntil(function (_, k) {
    return k === endKey;
  }).concat([[endKey, blockMap.get(endKey)]]);
} // source: https://github.com/sugarshin/draft-js-modifiers/blob/master/src/adjustBlockDepth.js


var adjustBlockDepth = function adjustBlockDepth(editorState, adjustment, maxDepth) {
  var content = (0, _adjustBlockDepthForContentState.default)(editorState.getCurrentContent(), editorState.getSelection(), adjustment, maxDepth);
  return _draftJs.EditorState.push(editorState, content, 'adjust-depth');
}; // Copied verbatum from https://github.com/brijeshb42/medium-draft/blob/master/src/model/index.js

/*
Returns default block-level metadata for various block type. Empty object otherwise.
*/


exports.adjustBlockDepth = adjustBlockDepth;

var getDefaultBlockData = function getDefaultBlockData(blockType) {
  var initialData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  switch (blockType) {
    case _constants.Block.TODO:
      return {
        checked: false
      };

    default:
      return initialData;
  }
};
/*
Get currentBlock in the editorState.
*/


exports.getDefaultBlockData = getDefaultBlockData;

var getCurrentBlock = function getCurrentBlock(editorState) {
  var selectionState = editorState.getSelection();
  var contentState = editorState.getCurrentContent();
  var block = contentState.getBlockForKey(selectionState.getStartKey());
  return block;
};
/*
Adds a new block (currently replaces an empty block) at the current cursor position
of the given `newType`.
*/


exports.getCurrentBlock = getCurrentBlock;

var addNewBlock = function addNewBlock(editorState) {
  var newType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _constants.Block.UNSTYLED;
  var initialData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var selectionState = editorState.getSelection();

  if (!selectionState.isCollapsed()) {
    return editorState;
  }

  var contentState = editorState.getCurrentContent();
  var key = selectionState.getStartKey();
  var blockMap = contentState.getBlockMap();
  var currentBlock = getCurrentBlock(editorState);

  if (!currentBlock) {
    return editorState;
  }

  if (currentBlock.getLength() === 0) {
    if (currentBlock.getType() === newType) {
      return editorState;
    }

    var newBlock = currentBlock.merge({
      type: newType,
      data: getDefaultBlockData(newType, initialData)
    });
    var newContentState = contentState.merge({
      blockMap: blockMap.set(key, newBlock),
      selectionAfter: selectionState
    });
    return _draftJs.EditorState.push(editorState, newContentState, 'change-block-type');
  }

  return editorState;
};
/*
Changes the block type of the current block.
*/


exports.addNewBlock = addNewBlock;

var resetBlockWithType = function resetBlockWithType(editorState) {
  var newType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _constants.Block.UNSTYLED;
  var overrides = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var contentState = editorState.getCurrentContent();
  var selectionState = editorState.getSelection();
  var key = selectionState.getStartKey();
  var blockMap = contentState.getBlockMap();
  var block = blockMap.get(key);
  var newBlock = block.mergeDeep(overrides, {
    type: newType,
    data: getDefaultBlockData(newType)
  });
  var newContentState = contentState.merge({
    blockMap: blockMap.set(key, newBlock),
    selectionAfter: selectionState.merge({
      anchorOffset: 0,
      focusOffset: 0
    })
  });
  return _draftJs.EditorState.push(editorState, newContentState, 'change-block-type');
};
/*
Update block-level metadata of the given `block` to the `newData`/
*/


exports.resetBlockWithType = resetBlockWithType;

var updateDataOfBlock = function updateDataOfBlock(editorState, block, newData) {
  var contentState = editorState.getCurrentContent();
  var newBlock = block.merge({
    data: newData
  });
  var newContentState = contentState.merge({
    blockMap: contentState.getBlockMap().set(block.getKey(), newBlock)
  });
  return _draftJs.EditorState.push(editorState, newContentState, 'change-block-data');
}; // const BEFORE = -1;
// const AFTER = 1;

/*
Used from [react-rte](https://github.com/sstur/react-rte/blob/master/src/lib/insertBlockAfter.js)
by [sstur](https://github.com/sstur)
*/


exports.updateDataOfBlock = updateDataOfBlock;

var addNewBlockAt = function addNewBlockAt(editorState, pivotBlockKey) {
  var newBlockType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _constants.Block.UNSTYLED;
  var initialData = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var content = editorState.getCurrentContent();
  var blockMap = content.getBlockMap();
  var block = blockMap.get(pivotBlockKey);

  if (!block) {
    throw new Error("The pivot key - ".concat(pivotBlockKey, " is not present in blockMap."));
  }

  var blocksBefore = blockMap.toSeq().takeUntil(function (v) {
    return v === block;
  });
  var blocksAfter = blockMap.toSeq().skipUntil(function (v) {
    return v === block;
  }).rest();
  var newBlockKey = (0, _draftJs.genKey)();
  var newBlock = new _draftJs.ContentBlock({
    key: newBlockKey,
    type: newBlockType,
    text: '',
    characterList: (0, _immutable.List)(),
    depth: 0,
    data: (0, _immutable.Map)(getDefaultBlockData(newBlockType, initialData))
  });
  var newBlockMap = blocksBefore.concat([[pivotBlockKey, block], [newBlockKey, newBlock]], blocksAfter).toOrderedMap();
  var selection = editorState.getSelection();
  var newContent = content.merge({
    blockMap: newBlockMap,
    selectionBefore: selection,
    selectionAfter: selection.merge({
      anchorKey: newBlockKey,
      anchorOffset: 0,
      focusKey: newBlockKey,
      focusOffset: 0,
      isBackward: false
    })
  });
  return _draftJs.EditorState.push(editorState, newContent, 'split-block');
};
/**
 * Check whether the cursor is between entity of type LINK
 */


exports.addNewBlockAt = addNewBlockAt;

var isCursorBetweenLink = function isCursorBetweenLink(editorState) {
  var ret = null;
  var selection = editorState.getSelection();
  var content = editorState.getCurrentContent();
  var currentBlock = getCurrentBlock(editorState);

  if (!currentBlock) {
    return ret;
  }

  var entityKey = null;
  var blockKey = null;

  if (currentBlock.getType() !== _constants.Block.ATOMIC && selection.isCollapsed()) {
    if (currentBlock.getLength() > 0) {
      if (selection.getAnchorOffset() > 0) {
        entityKey = currentBlock.getEntityAt(selection.getAnchorOffset() - 1);
        blockKey = currentBlock.getKey();

        if (entityKey !== null) {
          var entity = content.getEntity(entityKey);

          if (entity.getType() === _constants.Entity.LINK) {
            ret = {
              entityKey: entityKey,
              blockKey: blockKey,
              url: entity.getData().url
            };
          }
        }
      }
    }
  }

  return ret;
};

exports.isCursorBetweenLink = isCursorBetweenLink;

var selectBlock = function selectBlock(block) {
  var selection = _draftJs.SelectionState.createEmpty(block.getKey()).merge({
    anchorOffset: 0,
    focusOffset: block.getLength()
  });

  return selection;
};

exports.selectBlock = selectBlock;

var indentForward = function indentForward(editorState) {
  var tabSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
  var selectedBlockMap = getSelectedBlocksMap(editorState);
  var endBlockSelection = selectBlock(selectedBlockMap.last());
  var newContentState = selectedBlockMap.reduce(function (acc, val) {
    return _draftJs.Modifier.replaceText(acc, selectBlock(val), (0, _leftIndent.leftIndent)(val.getText(), 'forward', tabSize));
  }, editorState.getCurrentContent());

  var newEditorState = _draftJs.EditorState.push(editorState, newContentState, 'insert-characters');

  var nextFocusOffset = endBlockSelection.getFocusOffset() + tabSize;
  newEditorState = _draftJs.EditorState.forceSelection(newEditorState, _draftJs.SelectionState.createEmpty().merge({
    anchorKey: selectedBlockMap.first().getKey(),
    focusKey: selectedBlockMap.last().getKey(),
    focusOffset: nextFocusOffset,
    anchorOffset: 0
  }));
  return newEditorState;
};

exports.indentForward = indentForward;

var indentBackward = function indentBackward(editorState) {
  var tabSize = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 2;
  var newEditorState = editorState;
  var block = getCurrentBlock(editorState);
  var text = block.getText();
  var nextText = (0, _leftIndent.leftIndent)(text, 'backward', tabSize);
  var diff = nextText.length - nextText.trim().length;

  var newContentState = _draftJs.Modifier.replaceText(newEditorState.getCurrentContent(), newEditorState.getSelection().merge({
    anchorOffset: 0
  }), (0, _leftIndent.pad)(diff));

  newEditorState = _draftJs.EditorState.push(newEditorState, newContentState, 'remove-range');
  return newEditorState;
};

exports.indentBackward = indentBackward;

function getWrappedBlocksAfter(editorState, block) {
  var contentState = editorState.getCurrentContent();
  var blockMap = contentState.getBlockMap();
  return blockMap.toSeq().skipUntil(function (b, k) {
    return k === block.getKey();
  }).rest().takeUntil(function (b, k) {
    return b.getType() !== block.getType();
  });
}

function getWrappedBlocksBefore(editorState, block) {
  var contentState = editorState.getCurrentContent();
  var blockMap = contentState.getBlockMap();
  return blockMap.toSeq().reverse().skipUntil(function (b, k) {
    return k === block.getKey();
  }).takeUntil(function (b, k) {
    return b.getType() !== block.getType();
  }).reverse().butLast();
}

function getBlockMapText(blockMap) {
  var blocks = _immutable.OrderedMap.isOrderedMap(blockMap) ? blockMap.toSeq() : blockMap;
  return blocks.reduce(function (acc, val) {
    return acc + val.getText() + '\n';
  }, '');
}

function getContiguousBlocks(editorState) {
  var block = getCurrentBlock(editorState);
  var blocksBefore = getWrappedBlocksBefore(editorState, block);
  var blocksAfter = getWrappedBlocksAfter(editorState, block);
  var newBlockMap = blocksBefore.concat([[block.getKey(), block]], blocksAfter).toOrderedMap();
  return newBlockMap;
}

var removeInlineStyle = function removeInlineStyle(editorState, style, blockMap) {
  var currentContent = editorState.getCurrentContent();
  var blocks = blockMap || currentContent.getBlockMap();
  var selection = editorState.getSelection();
  var newContentState = blocks.reduce(function (acc, block) {
    var _acc = acc;
    block.findStyleRanges(function (char) {
      return char.getStyle() !== null;
    }, function (start, end) {
      _acc = _draftJs.Modifier.removeInlineStyle(_acc, _draftJs.SelectionState.createEmpty(block.getKey()).merge({
        focusOffset: end,
        anchorOffset: start
      }), style);
    });
    return _acc;
  }, currentContent);
  return _draftJs.EditorState.forceSelection(_draftJs.EditorState.push(editorState, newContentState, 'change-inline-style'), selection);
};

exports.removeInlineStyle = removeInlineStyle;

var hasInlineStyle = function hasInlineStyle(editorState, style, blockMap) {
  return (blockMap || editorState.getCurrentContent().getBlockMap()).toSeq().find(function (block) {
    return !!block.getCharacterList().toSeq().find(function (char) {
      return char.hasStyle(style);
    });
  });
};

exports.hasInlineStyle = hasInlineStyle;

var removeStyleForBlockType = function removeStyleForBlockType(editorState, style) {
  var wrappedBlocks = getContiguousBlocks(editorState);
  return removeInlineStyle(editorState, style, wrappedBlocks);
};

exports.removeStyleForBlockType = removeStyleForBlockType;