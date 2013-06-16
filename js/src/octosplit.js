/** @jsx React.DOM */

var Checkboxes = React.createClass({
  // TODO(mack): Managing state shouldn't be necessary as long as we are only
  // rendering once; verify this is the case
  //getInitialState: function() {
  //  return {
  //    sideBySide: this.props.sideBySide,
  //    wordWrap: this.props.wordWrap,
  //    fileDiffViews: this.props.fileDiffViews
  //  };
  //},

  render: function() {
    return (
      <span>
        <SideBySideCheckbox
            checked={this.props.sideBySide}
            onSideBySideChange={this.onSideBySideChange} />
        <WordWrapCheckbox
            checked={this.props.wordWrap}
            onWordWrapChange={this.onWordWrapChange} />
      </span>
    );
  },

  onSideBySideChange: React.autoBind(function(sideBySide) {
    this.props.fileDiffViews.forEach(function(fileDiffView) {
      fileDiffView.setState({ sideBySide: sideBySide });
    });
  }),

  onWordWrapChange: React.autoBind(function(wordWrap) {
    this.props.fileDiffViews.forEach(function(fileDiffView) {
      fileDiffView.setState({ wordWrap: wordWrap });
    });
  })
});

var SideBySideCheckbox = React.createClass({
  getInitialState: function() {
    return {
      checked: this.props.checked
    };
  },

  clickCheckbox: React.autoBind(function(evt) {
    this.setState({ checked: !this.state.checked });
    saveSetting('sideBySide', this.state.checked);
    this.props.onSideBySideChange(this.state.checked);
  }),

  render: function() {
    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'octosplit'
    };
    if (this.state.checked) {
      attributes.checked = 'checked';
    }

    return (
      <span>
        {React.DOM.input(attributes)}
        <label id="octosplit-label" htmlFor="octosplit">
          <span class="mini-icon mini-icon-public-mirror"></span>
          side by side
        </label>
      </span>
    );
  }
});

var WordWrapCheckbox = React.createClass({
  getInitialState: function() {
    return {
      checked: this.props.checked
    };
  },

  clickCheckbox: React.autoBind(function(evt) {
    this.setState({ checked: !this.state.checked });
    saveSetting('wordWrap', this.state.checked);
    this.props.onWordWrapChange(this.state.checked);
  }),

  render: function() {
    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'wordwrap'
    };
    if (this.state.checked) {
      attributes.checked = 'checked';
    }

    return (
      <span>
        {React.DOM.input(attributes)}
        <label id="wordwrap-label" htmlFor="wordwrap">
          <span class="mini-icon mini-icon-reorder"></span>
          word wrap
        </label>
      </span>
    );
  }
});

var FileDiffView = React.createClass({
  getInitialState: function() {
    return {
      sideBySide: this.props.sideBySide,
      wordWrap: this.props.wordWrap
    };
  },

  render: function() {
    if (!this.state.sideBySide) {
      return this.renderInline();
    } else /* mode === 'sideBySide' */ {
      return this.renderSideBySide();
    }
  },

  renderInline: function() {
    var lines = this.props.rows.map(function(row) {
      return this.renderInlineCode(row);
    }.bind(this));

    return (
      <tbody>
        {lines}
      </tbody>
    );
  },

  renderInlineCode: function(row) {
    if (row.type === 'lineInsertion') {
      var rowClass = 'gi';
    } else if (row.type === 'lineDeletion') {
      var rowClass = 'gd';
    } else if (row.type === 'lineUnchanged') {
      var rowClass = '';
    } else {
      console.error('Unexpected row type: ' + row.type);
    }

    var cells = row.cells;

    // TODO(mack): see if there's some way to use React to generate markup
    var $commentIconHtml = $('<div/>').append($('<b/>')
        .addClass('add-line-comment octicon octicon-comment-add')
        .attr('data-remote', cells[2].commentUrl)).html();

    return (
      <tr className={'file-diff-line ' + rowClass}
          /*id="js-octosplit-js-P48"*/
          /*data-position="48"*/>
        <td id={cells[0].id}
            className={'diff-line-num linkable-line-number '
              + (cells[0].lineNum ? '' : 'empty-cell')}
            data-line-number={cells[0].dataLineNum}>
          <span className="line-num-content">
            {cells[0].lineNum || ''}
          </span>
        </td>

        <td id={ cells[1].id }
            className={'diff-line-num linkable-line-number '
              + (cells[1].lineNum ? '' : 'empty-cell')}
            data-line-number={cells[1].dataLinNum}>
          <span className="line-num-content">
            {cells[1].lineNum || ''}
          </span>
        </td>

        <td className="diff-line-code"
            dangerouslySetInnerHTML={{
              __html: $commentIconHtml + cells[2].code}}>
        </td>
      </tr>
    );
  },

  renderSideBySide: function() {
    return <div></div>
  }
});

function parseFileDiff($fileDiff) {
  function parseLineNumberCell($cell) {
    return {
      id: $cell.attr('id'),
      dataLineNum: parseInt($cell.attr('data-line-number'), 10),
      lineNum: parseInt($cell.text(), 10)
    };
  }

  function parseCodeCell($cell) {
    var $clone = $cell.clone();
    $clone.find('.add-line-comment').remove();
    var textContnetk
    return {
      commentUrl: $cell.find('.add-line-comment').attr('data-remote'),
      code: $clone.html()
    };
  }

  var rows = [];

  $fileDiff.find('tr').each(function() {
    var $row = $(this);
    var row = { cells: [] };
    if ($row.hasClass('file-diff-line')) {
      if ($row.hasClass('gi')) {
        row.type = 'lineInsertion';
      } else if ($row.hasClass('gd')) {
        row.type = 'lineDeletion';
      } else {
        row.type = 'lineUnchanged';
      }

      var $cells = $row.find('td');
      row.cells.push(parseLineNumberCell($cells.eq(0)));
      row.cells.push(parseLineNumberCell($cells.eq(1)));
      row.cells.push(parseCodeCell($cells.eq(2)));

    } else if ($row.hasClass('inline-comments')) {
      row.type = 'comments';
      row.cells.push($row);
    } else {
      console.error('Encountered unexpected row type');
    }
    rows.push(row);
  });

  return rows;
}

$(document).ready(function() {
  getSettings(['sideBySide', 'wordWrap']).then(function(settings) {
    var fileDiffViews = [];
    $('.file-diff').each(function() {
      var $fileDiff = $(this);
      var rows = parseFileDiff($fileDiff);
      // TODO(mack): Figure out how to do this cleanly
      $fileDiff.empty();

      var fileDiffView = (
        <FileDiffView
            rows={rows}
            sideBySide={settings.sideBySide || false}
            wordWrap={settings.wordWrap || false} />
      );
      React.renderComponent(fileDiffView, $fileDiff.get(0));

      fileDiffViews.push(fileDiffView);
    });


    var $checkboxesContainer = $('<span />').appendTo($('#toc .explain'));
    React.renderComponent(
      <Checkboxes
          fileDiffViews={fileDiffViews}
          sideBySide={settings.sideBySide}
          wordWrap={settings.wordWrap} />, $checkboxesContainer.get(0));
  });
});

//$(document).ready(function() {
  //addWordWrapCheckbox();
  //addSideBySideCheckbox();
  //manageNewComment();

  //manageTabs();
  //addShowLines();
  //$('.inline-comments').addClass('show');
  //getSettings(['sideBySide', 'wordWrap']).then(function(settings) {
  //  var sideBySide = settings['sideBySide'];
  //  if (sideBySide) {
  //    $('#octosplit').click();
  //  }

  //  var wordWrap = settings['wordWrap'];
  //  if (wordWrap) {
  //    $('#wordwrap').click();
  //  }
  //});
//});

//var FileState = (function FileStateClosure() {
//  function FileState($fileDiff, inlineMode) {
//    this.$fileDiff = $fileDiff;
//    this.inlineMode = inlineMode;
//
//    var $lineNumber = this.$fileDiff.find('.diff-line-num:first').eq(0);
//    this.fileIndex = parseInt($lineNumber.attr('id').match(/^L(\d+)/)[1], 10);
//
//    var $statLines = $fileDiff.find('.file-diff-line.gc');
//
//    var missingRanges = this.missingRanges = [];
//    var prevIndicies = { old: null, new: null };
//    for (var i = 0; i < $statLines.length; ++i) {
//      var $statLine = $statLines.eq(i);
//
//      // TODO(mack): This logic assumes that if there are any unchanged lines
//      // above/below, at least one unchanged line will be shown; otherwise
//      // it might be necessary to search in the opposite direction to get line
//      // index
//      var aboveOldIndex = this.parseLineIndex(
//          $statLine.prevAll(':not(.gi)').first(), 0);
//      var aboveNewIndex = this.parseLineIndex(
//          $statLine.prevAll(':not(.gd)').first(), 1);
//      var belowOldIndex = this.parseLineIndex(
//          $statLine.nextAll(':not(.gi)').first(), 0);
//      var belowNewIndex = this.parseLineIndex(
//          $statLine.nextAll(':not(.gd)').first(), 1);
//
//      if (i === 0) {
//        var length = belowNewIndex || belowOldIndex;
//        if (!length) {
//          $statLine.remove();
//          continue;
//        }
//        var missingRange = {
//          old: 0,
//          new: 0,
//          length: length,
//          isEnd: false
//        };
//      } else {
//        if (missingRanges.length) {
//          var prevMissingRange = missingRanges[missingRanges.length - 1];
//          if (isNaN(aboveNewIndex)) {
//            aboveNewIndex = prevMissingRange.new + prevMissingRange.length - 1;
//          }
//          if (isNaN(aboveOldIndex)) {
//            aboveOldIndex = prevMissingRange.old + prevMissingRange.length - 1;
//          }
//        } else {
//          if (isNaN(aboveNewIndex)) {
//            aboveNewIndex = -1;
//          }
//          if (isNaN(aboveOldIndex)) {
//            aboveOldIndex = -1;
//          }
//        }
//
//        if (!isNaN(belowNewIndex)) {
//          var length = belowNewIndex - (aboveNewIndex + 1);
//        } else if (!isNaN(belowOldIndex)) {
//          var length = belowOldIndex - (aboveOldIndex + 1);
//        } else {
//          console.error('Unexpected condition');
//          continue;
//        }
//
//        var missingRange = {
//          old: aboveOldIndex + 1,
//          new: aboveNewIndex + 1,
//          length: length,
//          isEnd: false
//        };
//      }
//
//      missingRange.$statLine = $statLine;
//      missingRanges.push(missingRange);
//    }
//
//    var $lastLine = this.$fileDiff.find('tbody tr:last');
//    var missingRange = {
//      old: this.parseLineIndex($lastLine, 0) + 1,
//      new: this.parseLineIndex($lastLine, 1) + 1,
//      length: -1,
//      isEnd: true
//    };
//    missingRange.$lastLine = $lastLine;
//    missingRanges.push(missingRange);
//
//    for (var i = 0; i < missingRanges.length; ++i) {
//      var missingRange = missingRanges[i];
//      var $showLinesRow = $(
//        '<tr class="show-lines">'
//        + '<td colspan="3">'
//        + ' <a class="show-above-20" href="#"></a>'
//        + ' <span class="dot">•</span>'
//        + ' <a class="show-all" href="#"></a>'
//        + ' <span class="dot">•</span>'
//        + ' <a class="show-below-20" href="#"></a>'
//        + '</td>'
//        + '</tr>'
//      );
//      $showLinesRow.find('.show-above-20').click(
//          this.showAbove20.bind(this, missingRange));
//      $showLinesRow.find('.show-all').click(
//          this.showAll.bind(this, missingRange));
//      $showLinesRow.find('.show-below-20').click(
//          this.showBelow20.bind(this, missingRange));
//
//      this.updateShowLinesRow($showLinesRow, missingRange);
//      if (missingRange.$lastLine) {
//        missingRange.$lastLine.after($showLinesRow);
//        $showLinesRow.addClass('last');
//      } else {
//        missingRange.$statLine.replaceWith($showLinesRow);
//        if (missingRange.new === 0) {
//          $showLinesRow.addClass('first');
//        }
//      }
//
//      missingRange.$showLinesRow = $showLinesRow;
//    }
//  }
//
//  FileState.prototype = {
//
//    updateShowLinesRow: function($showLinesRow, missingRange) {
//
//      if (missingRange.isEnd && missingRange.length < 0) {
//          $showLinesRow.find('.show-all').text('Show all remaining lines');
//      } else {
//        $showLinesRow.find('.show-all').text(
//            'Show all ' + missingRange.length + ' lines');
//      }
//
//      if (missingRange.length >= 0 && missingRange.length < 40) {
//        $showLinesRow.find('.show-above-20').remove();
//        $showLinesRow.find('.show-below-20').remove();
//        $showLinesRow.find('.dot').remove();
//      } else {
//        if (missingRange.isEnd) {
//          $showLinesRow.find('.show-above-20').text('▲ Show 20 lines');
//          $showLinesRow.find('.show-below-20').text('Show last 20 lines');
//        } else if (missingRange.new === 0) {
//          $showLinesRow.find('.show-above-20').text('Show first 20 lines');
//          $showLinesRow.find('.show-below-20').text('▼ Show 20 lines');
//        } else {
//          $showLinesRow.find('.show-above-20').text('▲ Show 20 lines');
//          $showLinesRow.find('.show-below-20').text('▼ Show 20 lines');
//        }
//      }
//    },
//
//    showAbove20: function(missingRange) {
//      return this.showLines(missingRange, 'above', 20);
//    },
//
//    showBelow20: function(missingRange) {
//      return this.showLines(missingRange, 'below', 20);
//    },
//
//    showAll: function(missingRange) {
//      return this.showLines(missingRange, 'all');
//    },
//
//    showLines: function(missingRange, mode, numLines) {
//      this.fetchFile().then(function(fileLines) {
//        if (missingRange.length === -1) {
//          missingRange.length = fileLines.length - missingRange.new;
//        }
//
//        var removeShowLinesRow = false;
//        var showRange;
//
//        var newRange = missingRange.new;
//        if (mode === 'all' || missingRange.length <= numLines) {
//          var index = this.missingRanges.indexOf(missingRange);
//          this.missingRanges.splice(index, 1);
//          showRange = {
//            new: missingRange.new,
//            old: missingRange.old,
//            length: missingRange.length
//          };
//          removeShowLinesRow = true;
//        } else {
//          if (mode === 'above') {
//            showRange = {
//              new: missingRange.new,
//              old: missingRange.old,
//              length: numLines
//            };
//            missingRange.old += numLines;
//            missingRange.new += numLines;
//          } else {
//            showRange = {
//              new: missingRange.new + missingRange.length - numLines,
//              old: missingRange.old + missingRange.length - numLines,
//              length: numLines
//            };
//            missingRange.isEnd = false;
//          }
//          showRange.length = numLines;
//          missingRange.length -= numLines;
//        }
//
//        var $showLinesRow = missingRange.$showLinesRow;
//
//        var $lines = this.getLines(fileLines, showRange);
//        if (mode === 'below') {
//          $lines.insertAfter($showLinesRow);
//        } else {
//          $lines.insertBefore($showLinesRow);
//        }
//
//        if (removeShowLinesRow) {
//          // TODO(mack): unbind event listeners
//          $showLinesRow.remove();
//        } else {
//          this.updateShowLinesRow($showLinesRow, missingRange);
//        }
//
//      }.bind(this));
//      return false;
//    },
//
//    getLines: function(fileLines, range) {
//      var lines = [];
//      for (var i = 0; i < range.length; ++i) {
//        var currOldLineIndex = range.old + i;
//        var currNewLineIndex = range.new + i;
//        var fileLine = fileLines[currNewLineIndex];
//        var $oldLineNumber = $(
//          '<td id="L' + this.fileIndex + 'L' + (currOldLineIndex + 1) + '"'
//          + ' class="diff-line-num linkable-line-number"'
//          + ' data-line-number="' + (currOldLineIndex + 1) + '">'
//          + '  <span class="line-num-content">' + (currOldLineIndex + 1)
//          + '  </span>'
//          + '</td>');
//        var $newLineNumber = $(
//          '<td id="L' + this.fileIndex + 'R' + (currNewLineIndex + 1) + '"'
//          + ' class="diff-line-num linkable-line-number"'
//          + ' data-line-number="' + (currNewLineIndex + 1) + '">'
//          + '  <span class="line-num-content">' + (currNewLineIndex + 1)
//          + '  </span>'
//          + '</td>');
//
//        // TODO(mack): add back
//        //<b class="add-line-comment mini-icon mini-icon-add-comment"
//        //data-remote="/mduan/pdf.js/commit_comment/form?
//        //commit_id=6b4f72a2c3ea96e44568bd82e39efec5ece614a4&amp;
//        //path=l10n/ar/viewer.properties&amp;position=9&amp;line=58"></b>
//        fileLine = $('<div/>').text(' ' + fileLine).html();
//        fileLine = fileLine
//          .replace(/ /g, '&nbsp;')
//          .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
//        var $lineCode = $('<td class="diff-line-code"></td>').html(fileLine);
//
//        var $line =
//          $('<tr class="file-diff-line"></tr>')
//        if (this.inlineMode) {
//          $line.append($oldLineNumber)
//            .append($newLineNumber)
//            .append($lineCode);
//        } else {
//          $line.append($oldLineNumber)
//            .append($lineCode)
//            .append($newLineNumber)
//            .append($lineCode.clone());
//        }
//        lines.push($line.get(0));
//      }
//      return $(lines);
//    },
//
//    fetchFile: function() {
//      if (!this.fileDataPromise) {
//        var $file = this.$fileDiff.closest('.file');
//        var $viewFileButton = $file.find('.meta .actions .minibutton');
//        var blobUrl = $viewFileButton.attr('href');
//        // TODO(mack): Be careful of '/blob/' as user or repo name
//        var rawUrl = blobUrl.replace(/^\/(.*?)\/blob\/(.*)$/,
//            'https://github.com/$1/raw/$2');
//        this.fileDataPromise = $.get(rawUrl).then(function(data) {
//          var fileLines = data.split(/\r?\n/);
//          return fileLines;
//        });
//      }
//      return this.fileDataPromise;
//    },
//
//    parseLineIndex: function($row, rowIndex) {
//      return parseInt(
//          $row.find('td').eq(rowIndex).attr('data-line-number'), 10) - 1;
//    },
//
//    parseFileIndex: function() {
//      var $lineNumber = this.$file.find('.file-diff-line:first td:first');
//      var fileIndex = parseInt($lineNumber.attr('id').match(/^L(\d+)/)[1], 10);
//      return fileIndex;
//    },
//
//    setInlineMode: function(inlineMode) {
//      this.inlineMode = inlineMode;
//    }
//  };
//
//  return FileState;
//})();

function getSetting(key) {
  return getSettings([key]).then(function(settings) {
    return settings[key];
  });
}

function getSettings(keys) {
  var deferred = new $.Deferred();
  chrome.storage.sync.get(keys, function(settings) {
    deferred.resolve(settings);
  });
  return deferred.promise();
}

function saveSetting(key, value) {
  var settings = {};
  settings[key] = value;
  return saveSettings(settings);
}

function saveSettings(settings) {
  var deferred = new $.Deferred();
  chrome.storage.sync.set(settings, function() {
    deferred.resolve();
  });
  return deferred.promise();
}


//var fileStates = [];
//function addShowLines() {
//  $('table.file-diff').each(function() {
//    // TODO(mack): Uncomment
//    fileStates.push(new FileState($(this), true));
//  });
//}

function updateShowLines(inlineMode) {
  for (var i = 0; i < fileStates.length; ++i) {
    fileStates[i].setInlineMode(inlineMode);
  }
}

function addWordWrapCheckbox() {
  var $checkbox = $('<input type="checkbox" id="wordwrap" />');
  var $label    = $('<label id="wordwrap-label" for="wordwrap"><span class="mini-icon mini-icon-reorder"></span>word wrap</label>');

  $('#toc .explain').append($label, $checkbox);

  $checkbox.on('click', function(event) {
    if ($(this).is(':checked')) {
      saveSetting('wordWrap', true);
      enableWordWrap();
    } else {
      saveSetting('wordWrap', false);
      disableWordWrap();
    }
  });
}

function enableWordWrap() {
  $('#files').addClass('word-wrap');
}

function disableWordWrap() {
  $('#files').removeClass('word-wrap');
}

function addSideBySideCheckbox() {
  var $checkbox = $('<input type="checkbox" id="octosplit" />');
  var $label    = $('<label id="octosplit-label" for="octosplit"><span class="mini-icon mini-icon-public-mirror"></span>side by side</label>');

  $('#toc .explain').append($label, $checkbox);

  $checkbox.on('click', function(event) {
    if ($(this).is(':checked')) {
      saveSetting('sideBySide', true);
      enableSideBySide();
    } else {
      saveSetting('sideBySide', false);
      disableSideBySide();
    }
  });
}

function enableSideBySide() {
  $('#files').addClass('side-by-side');
  enlarge();
  splitDiffs();
  updateShowLines(false);
}

function disableSideBySide() {
  $('#files').removeClass('side-by-side');
  shrink();
  resetDiffs();
  updateShowLines(true);
}

//function manageNewComment() {
//  $('#files').on('click', '.add-line-comment', function(evt) {
//    var $elmt = $(this);
//
//    if (!$('#octosplit').is(':checked')) {
//      window.setTimeout(function() {
//        var $inlineComments = $elmt.closest('.file-diff-line').next();
//        $inlineComments.addClass('show');
//      }, 800);
//      return;
//    }
//
//    window.setTimeout(function() {
//      var $inlineComments = $elmt.closest('.file-diff-line').next();
//      $inlineComments.addClass('show');
//      var $lineCode = $elmt.closest('.diff-line-code');
//      // TODO(mack): For non-changed lines, should have comment form shown in
//      // column where the comment icon was clicked
//      if (!$lineCode.hasClass('gi')) {
//        // Left column
//        $inlineComments.find('td').eq(0).attr('colspan', 1);
//        $inlineComments.find('td').eq(1).attr('colspan', 1);
//        $inlineComments.append($('<td class="empty-num" colspan="1"></td>'))
//            .append($('<td class="empty-line" colspan="1"></td>'));
//      } else {
//        // Right column
//        $inlineComments.find('td').eq(0).attr('colspan', 1);
//        $inlineComments.find('td').eq(1).attr('colspan', 1);
//        $inlineComments
//            .prepend($('<td class="empty-line" colspan="1"></td>'))
//            .prepend($('<td class="empty-num" colspan="1"></td>'));
//      }
//    }, 800);
//  });
//}

//function manageTabs() {
//  $('.tabnav .tabnav-tab', $('.new-pull-request, .view-pull-request')).on('click', function(event) {
//    window.setTimeout(function() {
//      if (isFilesBucketTab() && $('#octosplit').is(':checked')) {
//        enlarge();
//      } else {
//        shrink();
//      }
//    }, 100);
//  });
//}

//function enlarge() {
//  $('#wrapper .container').addClass('large');
//}
//
//function shrink() {
//  $('#wrapper .container.large').removeClass('large');
//}
//
//function splitDiffs() {
//  $('table.file-diff').each(function() {
//    var $this = $(this);
//
//    if (!isSplittable($this)) {
//      return;
//    }
//
//    var $row = $this.find('tr:first');
//    while (true) {
//
//      if ($row.hasClass('gd') || $row.hasClass('gi')) {
//
//        var $nextCommonRow = $row.nextAll(
//            ':not(.gi, .gd, .inline-comments)').first();
//        if ($row.hasClass('gd')) {
//          var $deleteRow = $row;
//          var $insertRow = $deleteRow.nextAll(
//              ':not(.gd, .inline-comments)').first();
//          if (!$insertRow.hasClass('gi')) {
//            $insertRow = $();
//          }
//        } else {
//          $insertRow = $row;
//          $deleteRow = $();
//        }
//
//        var $newRows = $('<div/>');
//
//        // Process .gd and associated .gi
//        while (true) {
//          // Do something
//          if ($deleteRow.hasClass('inline-comments')) {
//            var $newRow = $('<tr />').addClass($deleteRow[0].className);
//            if ($insertRow.hasClass('inline-comments')) {
//              $insertRow = $insertRow.next();
//              $deleteRow = $deleteRow.next();
//              splitRow($newRow, $deleteRow.prev(), $insertRow.prev());
//            } else {
//              $deleteRow = $deleteRow.next();
//              splitRow($newRow, $deleteRow.prev(), $());
//            }
//          } else if ($insertRow.hasClass('inline-comments')) {
//            var $newRow = $('<tr />').addClass($insertRow[0].className);
//            $insertRow = $insertRow.next();
//            splitRow($newRow, $(), $insertRow.prev());
//          } else if ($deleteRow.hasClass('gd')) {
//            var $newRow = $('<tr class="file-diff-line"></tr>');
//            $deleteRow = $deleteRow.next();
//            $insertRow = $insertRow.next();
//            splitRow($newRow, $deleteRow.prev(), $insertRow.prev());
//          } else {
//            break;
//          }
//
//          $newRows.append($newRow);
//
//          if (!$insertRow.hasClass('gi') &&
//              !$insertRow.hasClass('inline-comments')) {
//            $insertRow = $();
//          }
//        }
//
//        // Process remaining .gi
//        while (true) {
//          if ($insertRow.hasClass('inline-comments')) {
//            var $newRow = $('<tr />').addClass($insertRow[0].className);
//            $insertRow = $insertRow.next();
//            splitRow($newRow, $(), $insertRow.prev());
//          } else if ($insertRow.hasClass('gi')) {
//            var $newRow = $('<tr class="file-diff-line"></tr>');
//            $insertRow = $insertRow.next();
//            splitRow($newRow, $(), $insertRow.prev());
//          } else {
//            $insertRow = $();
//            break;
//          }
//
//          $newRows.append($newRow);
//        }
//
//        $row.prev().nextUntil($nextCommonRow).remove();
//        $nextCommonRow.before($newRows.children());
//        $row = $nextCommonRow;
//      } else if ($row.hasClass('file-diff-line')) {
//        var $lineNumOld = $row.find('td').eq(0).attr('colspan', 1);
//        var $lineNumNew = $row.find('td').eq(1).attr('colspan', 1);
//        var $lineCodeOld = $row.find('td').eq(2).attr('colspan', 1);
//        var $lineCodeNew = $lineCodeOld.clone().attr('colspan', 1);
//        $row.append($lineNumOld).append($lineCodeOld)
//            .append($lineNumNew).append($lineCodeNew);
//        $row = $row.next();
//      } else if ($row.hasClass('inline-comments')) {
//        $row.find('td').eq(0).attr('colspan', 1);
//        $row.find('td').eq(1).attr('colspan', 1);
//        $row.append($('<td class="empty-num" colspan="1"></td>'))
//            .append($('<td class="empty-line" colspan="1"></td>'));
//        $row = $row.next();
//      } else if ($row.hasClass('show-lines')) {
//        $row.find('td').attr('colspan', 4);
//        $row = $row.next();
//      } else {
//        if ($row.length) {
//          console.error('There should not be any row types except the above');
//        }
//        break;
//      }
//    }
//  });
//}
//
//function resetDiffs() {
//  $('table.file-diff').each(function() {
//    var $this = $(this);
//    // TODO(mack): Add check for isResettable
//    // if (!isResettable($(this))) {
//    //   return;
//    // }
//
//    var $row = $this.find('tr:first');
//    while ($row.length) {
//      if ($row.hasClass('show-lines')) {
//        $row.find('td').attr('colspan', 3);
//        $row = $row.next();
//      } else if ($row.hasClass('inline-comments')) {
//        // TODO(mack): line-comments each colspan
//        $row.find('td:eq(2), td:eq(3)').remove();
//        $row.find('td').eq(0).attr('colspan', 2);
//        $row.find('td').eq(1).attr('colspan', 1);
//        $row = $row.next();
//      } else if ($row.find('td.gd, td.gi').length) {
//        var $newRows = $('<div/>');
//        var $prevRow = $row.prev();
//        while ($row.find('.line-comments, td.gd, td.gi').length) {
//          $row = $row.next();
//        }
//        var $delRows = $('<div/>');
//        var $insRows = $('<div/>');
//        var $delInsRows = $prevRow.nextUntil($row);
//        $delInsRows.each(function() {
//          var $this = $(this);
//
//          var $delNum = $this.find('td:eq(0)');
//          var $delCol = $this.find('td:eq(1)');
//          var $insNum = $this.find('td:eq(2)');
//          var $insCol = $this.find('td:eq(3)');
//
//          if ($delCol.hasClass('gd')) {
//            var $delRow = $('<tr class="file-diff-line gd" />')
//              .append($delNum.attr('colspan', 1))
//              .append($('<td class="diff-line-num linkable-line-number" empty-cell" />'))
//              .append($delCol.removeClass('gd').attr('colspan', 1));
//            $delRows.append($delRow);
//          } else if ($delCol.hasClass('line-comments')) {
//            var $delRow = $('<tr />')
//              .addClass($delCol.closest('.inline-comments')[0].className)
//              .append($delNum.attr('colspan', 2))
//              .append($delCol.attr('colspan', 1));
//            $delRows.append($delRow);
//          } else /* empty line */ {
//          }
//
//          if ($insCol.hasClass('gi')) {
//            var $insRow = $('<tr class="file-diff-line gi" />')
//              .append($('<td class="diff-line-num linkable-line-number" empty-cell" />'))
//              .append($insNum.attr('colspan', 1))
//              .append($insCol.removeClass('gi').attr('colspan', 1));
//            $insRows.append($insRow);
//          } else if ($insCol.hasClass('line-comments')) {
//            var $insRow = $('<tr />')
//              .addClass($insCol.closest('.inline-comments')[0].className)
//              .append($insNum.attr('colspan', 2))
//              .append($insCol.attr('colspan', 1));
//            $insRows.append($insRow);
//          } else /* empty line */ {
//          }
//        });
//
//        $delInsRows.remove();
//        $row.before($delRows.children());
//        $row.before($insRows.children());
//      } else /* unchanged line */ {
//        $row.find('td').eq(1).remove();
//        $row.find('td').attr('colspan', 1);
//        $row = $row.next();
//      }
//    }
//  });
//}
//
//function splitRow($row, $left, $right) {
//  if ($left.hasClass('inline-comments')) {
//    $left.find('td').eq(0).attr('colspan', 1);
//    $left.find('td').eq(1).attr('colspan', 1);
//    $row.append($left.find('td'));
//  } else if ($left.hasClass('gd')) {
//    var $lineNum = $left.find('td').eq(0).attr('colspan', 1).addClass('gd');
//    var $lineCode = $left.find('td').eq(2).attr('colspan', 1).addClass('gd');
//    $row.append($lineNum).append($lineCode);
//  } else /* empty line */ {
//    $row.append($('<td class="empty-num" colspan="1"></td>'))
//        .append($('<td class="empty-line" colspan="1"></td>'));
//  }
//
//  if ($right.hasClass('inline-comments')) {
//    $right.find('td').eq(0).attr('colspan', 1);
//    $right.find('td').eq(1).attr('colspan', 1);
//    $row.append($right.find('td'));
//  } else if ($right.hasClass('gi')) {
//    var $lineNum = $right.find('td').eq(1).attr('colspan', 1).addClass('gi');
//    var $lineCode = $right.find('td').eq(2).attr('colspan', 1).addClass('gi');
//    $row.append($lineNum).append($lineCode);
//  } else /* empty line */ {
//    $row.append($('<td class="empty-num" colspan="1"></td>'))
//        .append($('<td class="empty-line" colspan="1"></td>'));
//  }
//}
//
//function isFilesBucketTab() {
//  return ($('.tabnav-tab.selected').attr('href') == '#files_bucket') || ($('.tabnav-tab.selected').data().containerId == 'files_bucket');
//}
//
//function isSplittable($table) {
//  return ($('tr.gd', $table).length && $('tr.gi', $table).length);
//}
//
//function isResettable($table) {
//  return ($('.new-number', $table).length > 0)
//}
