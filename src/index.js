import { Map, List, OrderedMap } from 'immutable'

import { EditorState, ContentBlock, SelectionState, genKey, Modifier } from 'draft-js'
import adjustBlockDepthForContentState from 'draft-js/lib/adjustBlockDepthForContentState'
import DraftOffsetKey from 'draft-js/lib/DraftOffsetKey'

import { Block, Entity } from './constants'
import { leftIndent, pad, LEFT_INDENT_RE, getDelta } from 'left-indent'

// source: https://github.com/sugarshin/draft-js-modifiers/blob/master/src/insertText.js

export const insertText = (editorState, text, entity) => {
  const selection = editorState.getSelection()
  const content = editorState.getCurrentContent()
  const newContent = Modifier[selection.isCollapsed() ? 'insertText' : 'replaceText'](
    content,
    selection,
    text,
    editorState.getCurrentInlineStyle(),
    entity
  )

  return EditorState.push(
    editorState,
    newContent,
    'insert-fragment'
  )
}

// source: https://github.com/jpuri/draftjs-utils/blob/master/js/block.js

export function getSelectedBlocksMap (editorState) {
  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()
  const startKey = selectionState.getStartKey()
  const endKey = selectionState.getEndKey()
  const blockMap = contentState.getBlockMap()
  return blockMap
    .toSeq()
    .skipUntil((_, k) => k === startKey)
    .takeUntil((_, k) => k === endKey)
    .concat([[endKey, blockMap.get(endKey)]])
}

// source: https://github.com/sugarshin/draft-js-modifiers/blob/master/src/adjustBlockDepth.js

export const adjustBlockDepth = (
  editorState,
  adjustment,
  maxDepth
) => {
  const content = adjustBlockDepthForContentState(
    editorState.getCurrentContent(),
    editorState.getSelection(),
    adjustment,
    maxDepth
  )

  return EditorState.push(editorState, content, 'adjust-depth')
}

// Copied verbatum from https://github.com/brijeshb42/medium-draft/blob/master/src/model/index.js

/*
Returns default block-level metadata for various block type. Empty object otherwise.
*/
export const getDefaultBlockData = (blockType, initialData = {}) => {
  switch (blockType) {
    case Block.TODO: return { checked: false }
    default: return initialData
  }
}

/*
Get currentBlock in the editorState.
*/
export const getCurrentBlock = (editorState) => {
  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()
  const block = contentState.getBlockForKey(selectionState.getStartKey())
  return block
}

/*
Adds a new block (currently replaces an empty block) at the current cursor position
of the given `newType`.
*/
export const addNewBlock = (editorState, newType = Block.UNSTYLED, initialData = {}) => {
  const selectionState = editorState.getSelection()
  if (!selectionState.isCollapsed()) {
    return editorState
  }
  const contentState = editorState.getCurrentContent()
  const key = selectionState.getStartKey()
  const blockMap = contentState.getBlockMap()
  const currentBlock = getCurrentBlock(editorState)
  if (!currentBlock) {
    return editorState
  }
  if (currentBlock.getLength() === 0) {
    if (currentBlock.getType() === newType) {
      return editorState
    }
    const newBlock = currentBlock.merge({
      type: newType,
      data: getDefaultBlockData(newType, initialData)
    })
    const newContentState = contentState.merge({
      blockMap: blockMap.set(key, newBlock),
      selectionAfter: selectionState
    })
    return EditorState.push(editorState, newContentState, 'change-block-type')
  }
  return editorState
}

/*
Changes the block type of the current block.
*/
export const resetBlockWithType = (editorState, newType = Block.UNSTYLED, overrides = {}) => {
  const contentState = editorState.getCurrentContent()
  const selectionState = editorState.getSelection()
  const key = selectionState.getStartKey()
  const blockMap = contentState.getBlockMap()
  const block = blockMap.get(key)
  const newBlock = block.mergeDeep(overrides, {
    type: newType,
    data: getDefaultBlockData(newType)
  })
  const newContentState = contentState.merge({
    blockMap: blockMap.set(key, newBlock),
    selectionAfter: selectionState.merge({
      anchorOffset: 0,
      focusOffset: 0
    })
  })
  return EditorState.push(editorState, newContentState, 'change-block-type')
}

/*
Update block-level metadata of the given `block` to the `newData`/
*/
export const updateDataOfBlock = (editorState, block, newData) => {
  const contentState = editorState.getCurrentContent()
  const newBlock = block.merge({
    data: newData
  })
  const newContentState = contentState.merge({
    blockMap: contentState.getBlockMap().set(block.getKey(), newBlock)
  })
  return EditorState.push(editorState, newContentState, 'change-block-data')
}

// const BEFORE = -1;
// const AFTER = 1;

/*
Used from [react-rte](https://github.com/sstur/react-rte/blob/master/src/lib/insertBlockAfter.js)
by [sstur](https://github.com/sstur)
*/
export const addNewBlockAt = (
  editorState,
  pivotBlockKey,
  newBlockType = Block.UNSTYLED,
  initialData = {}
) => {
  const content = editorState.getCurrentContent()
  const blockMap = content.getBlockMap()
  const block = blockMap.get(pivotBlockKey)
  if (!block) {
    throw new Error(`The pivot key - ${pivotBlockKey} is not present in blockMap.`)
  }
  const blocksBefore = blockMap.toSeq().takeUntil((v) => (v === block))
  const blocksAfter = blockMap.toSeq().skipUntil((v) => (v === block)).rest()
  const newBlockKey = genKey()

  const newBlock = new ContentBlock({
    key: newBlockKey,
    type: newBlockType,
    text: '',
    characterList: List(),
    depth: 0,
    data: Map(getDefaultBlockData(newBlockType, initialData))
  })

  const newBlockMap = blocksBefore.concat(
    [[pivotBlockKey, block], [newBlockKey, newBlock]],
    blocksAfter
  ).toOrderedMap()

  const selection = editorState.getSelection()

  const newContent = content.merge({
    blockMap: newBlockMap,
    selectionBefore: selection,
    selectionAfter: selection.merge({
      anchorKey: newBlockKey,
      anchorOffset: 0,
      focusKey: newBlockKey,
      focusOffset: 0,
      isBackward: false
    })
  })
  return EditorState.push(editorState, newContent, 'split-block')
}

/**
 * Check whether the cursor is between entity of type LINK
 */
export const isCursorBetweenLink = (editorState) => {
  let ret = null
  const selection = editorState.getSelection()
  const content = editorState.getCurrentContent()
  const currentBlock = getCurrentBlock(editorState)
  if (!currentBlock) {
    return ret
  }
  let entityKey = null
  let blockKey = null
  if (currentBlock.getType() !== Block.ATOMIC && selection.isCollapsed()) {
    if (currentBlock.getLength() > 0) {
      if (selection.getAnchorOffset() > 0) {
        entityKey = currentBlock.getEntityAt(selection.getAnchorOffset() - 1)
        blockKey = currentBlock.getKey()
        if (entityKey !== null) {
          const entity = content.getEntity(entityKey)
          if (entity.getType() === Entity.LINK) {
            ret = {
              entityKey,
              blockKey,
              url: entity.getData().url
            }
          }
        }
      }
    }
  }
  return ret
}

export const selectBlock = (block) => {
  let selection = SelectionState
    .createEmpty(block.getKey())
    .merge({
      anchorOffset: 0,
      focusOffset: block.getLength()
    })
  return selection
}

export const indentForward = (editorState, tabSize = 2) => {
  const selectedBlockMap = getSelectedBlocksMap(editorState)
  const endBlockSelection = selectBlock(selectedBlockMap.last())
  const newContentState = selectedBlockMap
    .reduce((acc, val) => Modifier.replaceText(
      acc,
      selectBlock(val),
      leftIndent(val.getText(), 'forward', tabSize)
    ), editorState.getCurrentContent())

  let newEditorState = EditorState.push(
    editorState,
    newContentState,
    'insert-characters'
  )
  const nextFocusOffset = endBlockSelection.getFocusOffset() + tabSize
  newEditorState = EditorState.forceSelection(
    newEditorState,
    SelectionState.createEmpty().merge({
      anchorKey: selectedBlockMap.first().getKey(),
      focusKey: selectedBlockMap.last().getKey(),
      focusOffset: nextFocusOffset,
      anchorOffset: 0
    })
  )
  return newEditorState
}

export const indentBackward = (editorState, text, tabSize = 2) => {
  let newEditorState = editorState
  const leftWhitespace = text.match(LEFT_INDENT_RE)[1]
  let newContentState = Modifier.replaceText(
    newEditorState.getCurrentContent(),
    newEditorState.getSelection().merge({
      anchorOffset: 0
    }),
    `${pad(leftWhitespace.length + getDelta(leftWhitespace.length, 'backward', 2))}`
  )
  newEditorState = EditorState.push(
    newEditorState,
    newContentState,
    'remove-range'
  )
  return newEditorState
}

export function getWrappedBlocksAfter (editorState, block) {
  const contentState = editorState.getCurrentContent()
  let blockMap = contentState.getBlockMap()
  return blockMap
    .toSeq()
    .skipUntil((b, k) => k === block.getKey())
    .rest()
    .takeUntil((b, k) => b.getType() !== block.getType())
}

export function getWrappedBlocksBefore (editorState, block) {
  const contentState = editorState.getCurrentContent()
  let blockMap = contentState.getBlockMap()
  return blockMap
    .toSeq()
    .reverse()
    .skipUntil((b, k) => k === block.getKey())
    .takeUntil((b, k) => b.getType() !== block.getType())
    .reverse()
    .butLast()
}

export function getBlockMapText (blockMap) {
  const blocks = OrderedMap.isOrderedMap(blockMap)
    ? blockMap.toSeq()
    : blockMap
  return blocks.reduce((acc, val) => acc + val.getText() + '\n', '')
}

export function getContiguousBlocks (editorState) {
  const block = getCurrentBlock(editorState)
  const blocksBefore = getWrappedBlocksBefore(editorState, block)
  const blocksAfter = getWrappedBlocksAfter(editorState, block)
  const newBlockMap = blocksBefore.concat(
    [[block.getKey(), block]],
    blocksAfter
  ).toOrderedMap()
  return newBlockMap
}

export const removeInlineStyle = (editorState, style, blockMap) => {
  const currentContent = editorState
    .getCurrentContent()
  const blocks = blockMap || currentContent.getBlockMap()
  const selection = editorState.getSelection()
  let newContentState = blocks
    .reduce((acc, block) => {
      let _acc = acc
      block.findStyleRanges(
        char => char.getStyle() !== null,
        (start, end) => {
          _acc = Modifier.removeInlineStyle(
            _acc,
            SelectionState.createEmpty(block.getKey()).merge({
              focusOffset: end,
              anchorOffset: start
            }),
            style
          )
        }
      )
      return _acc
    }, currentContent)
  return EditorState.forceSelection(
    EditorState.push(
      editorState,
      newContentState,
      'change-inline-style'
    ),
    selection
  )
}

export const hasInlineStyle = (
  editorState,
  style,
  blockMap
) => (blockMap || editorState.getCurrentContent().getBlockMap())
  .toSeq()
  .find(block => !!(
    block.getCharacterList().toSeq()
      .find(char => char.hasStyle(style)))
  )

export const removeStyleForBlockType = (editorState, style) => {
  const wrappedBlocks = getContiguousBlocks(editorState)
  return removeInlineStyle(editorState, style, wrappedBlocks)
}

// Lifted from https://github.com/draft-js-plugins/draft-js-plugins/

// Set selection of editor to next/previous block
export const setSelectionToBlock = (
  editorState,
  newActiveBlock
) => {
  // TODO verify that always a key-0-0 exists
  const offsetKey = DraftOffsetKey.encode(newActiveBlock.getKey(), 0, 0)
  const node = document.querySelectorAll(`[data-offset-key="${offsetKey}"]`)[0]
  // set the native selection to the node so the caret is not in the text and
  // the selectionState matches the native selection
  const selection = window.getSelection()
  const range = document.createRange()
  range.setStart(node, 0)
  range.setEnd(node, 0)
  selection.removeAllRanges()
  selection.addRange(range)

  return EditorState.forceSelection(editorState, new SelectionState({
    anchorKey: newActiveBlock.getKey(),
    anchorOffset: 0,
    focusKey: newActiveBlock.getKey(),
    focusOffset: 0,
    isBackward: false
  }))
}

export const getBlockMapKeys = (contentState, startKey, endKey) => {
  const blockMapKeys = contentState.getBlockMap().keySeq()
  return blockMapKeys
    .skipUntil((key) => key === startKey)
    .takeUntil((key) => key === endKey)
    .concat([endKey])
}

export const getSelectedBlocksMapKeys = (editorState) => {
  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()
  return getBlockMapKeys(
    contentState,
    selectionState.getStartKey(),
    selectionState.getEndKey()
  )
}

export const blockInSelection = (editorState, blockKey) => {
  const selectedBlocksKeys = getSelectedBlocksMapKeys(editorState)
  return selectedBlocksKeys.includes(blockKey)
}

export const insertBlocks = (
  editorState,
  blocks
) => {
  const block = getCurrentBlock(editorState)
  const content = editorState.getCurrentContent()
  const blockMap = content.getBlockMap()
  const blocksBefore = blockMap.toSeq().takeUntil((v) => (v === block))
  const blocksAfter = blockMap.toSeq().skipUntil((v) => (v === block)).rest()
  const newBlockMap = blocksBefore.concat(
    [[block.getKey(), block]],
    blocks.map(block => [block.getKey(), block]),
    blocksAfter
  ).toOrderedMap()
  const lastBlockKey = blocks[blocks.length - 1].getKey()
  const selection = editorState.getSelection()
  const newContent = content.merge({
    blockMap: newBlockMap,
    selectionBefore: selection,
    selectionAfter: selection.merge({
      anchorKey: lastBlockKey,
      anchorOffset: 0,
      focusKey: lastBlockKey,
      focusOffset: 0,
      isBackward: false
    })
  })
  return EditorState.push(editorState, newContent, 'split-block')
}
