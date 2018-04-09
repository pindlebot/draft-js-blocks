import { Map, List, OrderedMap } from 'immutable'

import { EditorState, ContentBlock, SelectionState, genKey, Modifier } from 'draft-js'
import adjustBlockDepthForContentState from 'draft-js/lib/adjustBlockDepthForContentState'

import { Block, Entity } from './constants'
import { leftIndent, pad } from 'left-indent'

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

export const indentBackward = (editorState, tabSize = 2) => {
  let newEditorState = editorState
  const block = getCurrentBlock(editorState)
  const text = block.getText()
  const nextText = leftIndent(text, 'backward', tabSize)
  let diff = nextText.length - nextText.trim().length
  let newContentState = Modifier.replaceText(
    newEditorState.getCurrentContent(),
    newEditorState.getSelection().merge({
      anchorOffset: 0
    }),
    pad(diff)
  )
  newEditorState = EditorState.push(
    newEditorState,
    newContentState,
    'remove-range'
  )
  return newEditorState
}

export function getSimilarBlocksBefore (editorState, block) {
  const contentState = editorState.getCurrentContent()
  let blockMap = contentState.getBlockMap()
  return blockMap
    .toSeq()
    .skipUntil((b, k) => k === block.getKey())
    .rest()
    .takeUntil((b, k) => b.getType() !== block.getType())
}

export function getSimilarBlocksAfter (editorState, block) {
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
  return blockMap.reduce((acc, val) => acc + val.getText() + '\n', '')
}

export function getSimilarContiguousBlocks (editorState) {
  const block = getCurrentBlock(editorState)
  const blocksBefore = getSimilarBlocksBefore(editorState, block)
  const blocksAfter = getSimilarBlocksAfter(editorState, block)
  const newBlockMap = blocksBefore.concat(
    [[block.getKey(), block]],
    blocksAfter
  ).toOrderedMap()
  return newBlockMap
}
