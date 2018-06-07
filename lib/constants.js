"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.KEY_COMMANDS = exports.NOT_HANDLED = exports.HANDLED = exports.HYPERLINK = exports.Entity = exports.Inline = exports.Block = void 0;
// copied verbatum from https://github.com/brijeshb42/medium-draft/blob/master/src/util/constants.js

/*
Some of the constants which are used throughout this project instead of
directly using string.
*/
var Block = {
  UNSTYLED: 'unstyled',
  PARAGRAPH: 'unstyled',
  OL: 'ordered-list-item',
  UL: 'unordered-list-item',
  H1: 'header-one',
  H2: 'header-two',
  H3: 'header-three',
  H4: 'header-four',
  H5: 'header-five',
  H6: 'header-six',
  CODE: 'code-block',
  BLOCKQUOTE: 'blockquote',
  PULLQUOTE: 'pullquote',
  ATOMIC: 'atomic',
  BLOCKQUOTE_CAPTION: 'block-quote-caption',
  CAPTION: 'caption',
  TODO: 'todo',
  IMAGE: 'atomic:image',
  BREAK: 'atomic:break'
};
exports.Block = Block;
var Inline = {
  BOLD: 'BOLD',
  CODE: 'CODE',
  ITALIC: 'ITALIC',
  STRIKETHROUGH: 'STRIKETHROUGH',
  UNDERLINE: 'UNDERLINE',
  HIGHLIGHT: 'HIGHLIGHT'
};
exports.Inline = Inline;
var Entity = {
  LINK: 'LINK'
};
exports.Entity = Entity;
var HYPERLINK = 'hyperlink';
exports.HYPERLINK = HYPERLINK;
var HANDLED = 'handled';
exports.HANDLED = HANDLED;
var NOT_HANDLED = 'not-handled';
exports.NOT_HANDLED = NOT_HANDLED;
var KEY_COMMANDS = {
  addNewBlock: function addNewBlock() {
    return 'add-new-block';
  },
  changeType: function changeType() {
    var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return "changetype:".concat(type);
  },
  showLinkInput: function showLinkInput() {
    return 'showlinkinput';
  },
  unlink: function unlink() {
    return 'unlink';
  },
  toggleInline: function toggleInline() {
    var type = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return "toggleinline:".concat(type);
  },
  deleteBlock: function deleteBlock() {
    return 'delete-block';
  }
};
exports.KEY_COMMANDS = KEY_COMMANDS;
var _default = {
  Block: Block,
  Inline: Inline,
  Entity: Entity
};
exports.default = _default;