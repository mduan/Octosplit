$(document).ready(function() {
  addWordWrapChekbox();
  addCheckbox();
  manageNewComment();
  manageTabs();
  addShowLines();
  $('.inline-comments').addClass('show');
});

var FileState = (function FileStateClosure() {
  function FileState($fileDiff, inlineMode) {
    this.$fileDiff = $fileDiff;
    this.inlineMode = inlineMode;

    var $lineNumber = this.$fileDiff.find('.diff-line-num:first').eq(0);
    this.fileIndex = parseInt($lineNumber.attr('id').match(/^L(\d+)/)[1], 10);

    var $statLines = $fileDiff.find('.file-diff-line.gc');

    var missingRanges = this.missingRanges = [];
    var prevIndicies = { old: null, new: null };
    for (var i = 0; i < $statLines.length; ++i) {
      var $statLine = $statLines.eq(i);
      var $aboveLine = $statLine.prev();
      var $belowLine = $statLine.next();
      if ($aboveLine.length) {
        var aboveIndicies = this.parseLineIndicies($aboveLine);
      }
      if ($belowLine.length) {
        var belowIndicies = this.parseLineIndicies($belowLine);
      }

      if (!belowIndicies) {
        console.error('Did not find lines below comment line');
        continue;
      } else if (!aboveIndicies) {
        var missingRange = {
          old: 0,
          new: 0,
          length: belowIndicies.new
        };
      } else {
        var missingRange = {
          old: aboveIndicies.old + 1,
          new: aboveIndicies.new + 1,
          length: belowIndicies.new - (aboveIndicies.new + 1)
        };
      }

      var $showLinesRow = $(
        '<tr class="show-lines">'
        + '<td colspan="3">'
        + ' <a class="show-above-20" href="#">▲ Show 20 lines</a> • '
        + ' <a class="show-all" href="#">Show all lines</a> • '
        + ' <a class="show-below-20" href="#">▼ Show 20 lines</a>'
        + '</td>'
        + '</tr>'
      );
      $showLinesRow.find('.show-above-20').click(
          this.showAbove20.bind(this, missingRange));
      $showLinesRow.find('.show-all').click(
          this.showAll.bind(this, missingRange));
      $showLinesRow.find('.show-below-20').click(
          this.showBelow20.bind(this, missingRange));
      $statLine.replaceWith($showLinesRow);
      missingRange.$showLinesRow = $showLinesRow;
      missingRanges.push(missingRange);
    }

    // TODO(mack): Merge logic for last row with previous code
    var $showLinesRow = $(
      '<tr class="show-lines">'
      + '<td colspan="3">'
      + ' <a class="show-above-20" href="#">▲ Show 20 lines</a> • '
      + ' <a class="show-all" href="#">Show all lines</a> • '
      + ' <a class="show-below-20" href="#">▼ Show 20 lines</a>'
      + '</td>'
      + '</tr>'
    );
    var $lastLine = this.$fileDiff.find('tbody tr:last');
    var lastLineIndicies = this.parseLineIndicies($lastLine);
    var missingRange = {
      old: lastLineIndicies.old + 1,
      new: lastLineIndicies.new + 1,
      length: -1
    };
    $lastLine.after($showLinesRow);

    $showLinesRow.find('.show-above-20').click(
        this.showAbove20.bind(this, missingRange));
    $showLinesRow.find('.show-all').click(
        this.showAll.bind(this, missingRange));
    $showLinesRow.find('.show-below-20').click(
        this.showBelow20.bind(this, missingRange));
    missingRange.$showLinesRow = $showLinesRow;
    missingRanges.push(missingRange);
  }

  FileState.prototype = {
    showAbove20: function(missingRange) {
      return this.showLines(missingRange, 'above', 20);
    },

    showBelow20: function(missingRange) {
      return this.showLines(missingRange, 'below', 20);
    },

    showAll: function(missingRange) {
      return this.showLines(missingRange, 'all');
    },

    showLines: function(missingRange, mode, numLines) {
      this.fetchFile().then(function(fileLines) {
        if (missingRange.length === -1) {
          missingRange.length = fileLines.length - (missingRange.new + 1);
        }

        var removeShowLinesRow = false;
        var showRange;

        var newRange = missingRange.new;
        if (mode === 'all' || missingRange.length <= numLines) {
          var index = this.missingRanges.indexOf(missingRange);
          this.missingRanges.splice(index, 1);
          showRange = {
            new: missingRange.new,
            old: missingRange.old,
            length: missingRange.length
          };
          removeShowLinesRow = true;
        } else {
          if (mode === 'above') {
            showRange = {
              new: missingRange.new,
              old: missingRange.old,
              length: numLines
            };
            missingRange.old += numLines;
            missingRange.new += numLines;
          } else {
            showRange = {
              new: missingRange.new + missingRange.length - numLines,
              old: missingRange.old + missingRange.length - numLines,
              length: numLines
            };
          }
          showRange.length = numLines;
          missingRange.length -= numLines;
        }

        var $lines = this.getLines(fileLines, showRange);
        if (mode === 'below') {
          $lines.insertAfter(missingRange.$showLinesRow);
        } else {
          $lines.insertBefore(missingRange.$showLinesRow);
        }

        if (removeShowLinesRow) {
          // TODO(mack): unbind event listeners
          missingRange.$showLinesRow.remove();
        }
      }.bind(this));
      return false;
    },

    getLines: function(fileLines, range) {
      var lines = [];
      for (var i = 0; i < range.length; ++i) {
        var currOldLineIndex = range.old + i;
        var currNewLineIndex = range.new + i;
        var fileLine = fileLines[currNewLineIndex];
        var $oldLineNumber = $(
          '<td id="L' + this.fileIndex + 'L' + (currOldLineIndex + 1) + '"'
          + ' class="diff-line-num linkable-line-number"'
          + ' data-line-number="' + (currOldLineIndex + 1) + '">'
          + '  <span class="line-num-content">' + (currOldLineIndex + 1)
          + '  </span>'
          + '</td>');
        var $newLineNumber = $(
          '<td id="L' + this.fileIndex + 'R' + (currNewLineIndex + 1) + '"'
          + ' class="diff-line-num linkable-line-number"'
          + ' data-line-number="' + (currNewLineIndex + 1) + '">'
          + '  <span class="line-num-content">' + (currNewLineIndex + 1)
          + '  </span>'
          + '</td>');

        // TODO(mack): add back
        //<b class="add-line-comment mini-icon mini-icon-add-comment"
        //data-remote="/mduan/pdf.js/commit_comment/form?
        //commit_id=6b4f72a2c3ea96e44568bd82e39efec5ece614a4&amp;
        //path=l10n/ar/viewer.properties&amp;position=9&amp;line=58"></b>
        fileLine = $('<div/>').text(' ' + fileLine).html();
        fileLine = fileLine
          .replace(/ /g, '&nbsp;')
          .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
        var $lineCode = $('<td class="diff-line-code"></td>').html(fileLine);

        var $line =
          $('<tr class="file-diff-line"></tr>')
        if (this.inlineMode) {
          $line.append($oldLineNumber)
            .append($newLineNumber)
            .append($lineCode);
        } else {
          $line.append($oldLineNumber)
            .append($lineCode)
            .append($newLineNumber)
            .append($lineCode.clone());
        }
        lines.push($line.get(0));
      }
      return $(lines);
    },

    fetchFile: function() {
      if (!this.fileDataPromise) {
        var $file = this.$fileDiff.closest('.file');
        var $viewFileButton = $file.find('.meta .actions .minibutton');
        var blobUrl = $viewFileButton.attr('href');
        // TODO(mack): Be careful of '/blob/' as user or repo name
        var rawUrl = blobUrl.replace(/^\/(.*?)\/blob\/(.*)$/,
            'https://github.com/$1/raw/$2');
        this.fileDataPromise = $.get(rawUrl).then(function(data) {
          var fileLines = data.split(/\r?\n/);
          return fileLines;
        });
      }
      return this.fileDataPromise;
    },

    parseLineIndicies: function($row) {
      var $lineNumbers = $row.find('td');
      var oldLineIndex = parseInt($lineNumbers.eq(0).attr('data-line-number'), 10) - 1;
      var newLineIndex = parseInt($lineNumbers.eq(1).attr('data-line-number'), 10) - 1;
      return {
        old: oldLineIndex,
        new: newLineIndex
      };
    },

    parseFileIndex: function() {
      var $lineNumber = this.$file.find('.file-diff-line:first td:first');
      var fileIndex = parseInt($lineNumber.attr('id').match(/^L(\d+)/)[1], 10);
      return fileIndex;
    },

    updateViewMode: function(inlineMode) {
      this.inlineMode = inlineMode;
      var $showLines = this.$fileDiff.find('.show-lines td');
      if (inlineMode) {
        $showLines.attr('colspan', '3');
      } else {
        $showLines.attr('colspan', '4');
      }
    }
  };

  return FileState;
})();

var fileStates = [];
function addShowLines() {
  $('table.file-diff').each(function() {
    fileStates.push(new FileState($(this), true));
  });
}

function updateShowLines(inlineMode) {
  for (var i = 0; i < fileStates.length; ++i) {
    fileStates[i].updateViewMode(inlineMode);
  }
}

function addWordWrapChekbox() {
  var $checkbox = $('<input type="checkbox" id="wordwrap" />');
  var $label    = $('<label id="wordwrap-label" for="wordwrap"><span class="mini-icon mini-icon-reorder"></span>word wrap</label>');

  $('#toc .explain').append($label, $checkbox);

  $checkbox.on('click', function(event) {
    if ($(this).is(':checked')) {
       $('#files').addClass('word-wrap');
    } else {
       $('#files').removeClass('word-wrap');
    }
  });
}

function addCheckbox() {
  var $checkbox = $('<input type="checkbox" id="octosplit" />');
  var $label    = $('<label id="octosplit-label" for="octosplit"><span class="mini-icon mini-icon-public-mirror"></span>side by side</label>');

  $('#toc .explain').append($label, $checkbox);

  $checkbox.on('click', function(event) {
    if ($(this).is(':checked')) {
      enlarge();
      splitDiffs();
      updateShowLines(false);
    } else {
      shrink();
      resetDiffs();
      updateShowLines(true);
    }
  });
}

function manageNewComment() {
  $('#files').on('click', '.add-line-comment', function(evt) {
    var $elmt = $(this);

    if (!$('#octosplit').is(':checked')) {
      window.setTimeout(function() {
        var $inlineComments = $elmt.closest('.file-diff-line').next();
        $inlineComments.addClass('show');
      }, 800);
      return;
    }

    window.setTimeout(function() {
      var $inlineComments = $elmt.closest('.file-diff-line').next();
      $inlineComments.addClass('show');
      splitInlineComment($inlineComments);
    }, 800);
  });
}

function manageTabs() {
  $('.tabnav .tabnav-tab', $('.new-pull-request, .view-pull-request')).on('click', function(event) {
    window.setTimeout(function() {
      if (isFilesBucketTab() && $('#octosplit').is(':checked')) {
        enlarge();
      } else {
        shrink();
      }
    }, 100);
  });
}

function enlarge() {
  $('#wrapper .container').addClass('large');
}

function shrink() {
  $('#wrapper .container.large').removeClass('large');
}

function splitDiffs() {
  $('table.file-diff').each(function() {
    if (isSplittable($(this))) {
      $('tbody tr', $(this)).each(function() {
        if ($(this).hasClass('inline-comments')) {
          splitInlineComment($(this));
        } else {
          splitDiffLine($(this))
        }
      });
    }
  })
}

function resetDiffs() {
  $('table.file-diff').each(function() {
    if (isResettable($(this))) {
      $('tbody tr', $(this)).each(function() {
        if ($(this).hasClass('inline-comments')) {
          resetInlineComment($(this));
        } else {
          resetDiffLine($(this))
        }
      });
    }
  })
}

function splitDiffLine($line) {
  var $children = $line.children();

  var $oldNumber = $($children[0]);
  var $newNumber = $($children[1]);
  var $LOC = $($children[2]);

  var $oldLOC = $('<td class="diff-line-code"></td>');
  var $newLOC = $('<td class="diff-line-code"></td>');

  if ($line.hasClass('gd')) {
    $oldLOC.html($LOC.html());
    $newLOC.addClass('nd');
    $newNumber.addClass('nd');
    $newLOC.html('');
  } else if ($line.hasClass('gi')) {
    $oldLOC.html('');
    $newLOC.html($LOC.html());
    $oldLOC.addClass('nd');
    $oldNumber.addClass('nd');
  } else {
    if ($line.hasClass('gc')) {
      $oldLOC.addClass('gc');
      $newLOC.addClass('gc');
    }
    $oldLOC.html($LOC.html());
    $newLOC.html($LOC.html());
  }

  $newNumber.addClass('new-number');

  if($oldLOC.children().first().hasClass('add-bubble')) {
    $oldLOC.children().first().remove();
  }

  $oldLOC.insertAfter($oldNumber);
  $newLOC.insertAfter($newNumber);
  $LOC.remove();
}

function resetDiffLine($line) {
  var $children = $line.children();

  var $oldNumber = $($children[0]);
  var $oldLOC    = $($children[1]);
  var $newNumber = $($children[2]);
  var $newLOC    = $($children[3]);

  if($line.hasClass('gd')) {
    $newLOC.html($oldLOC.html());
  }

  $oldLOC.remove();

  $oldNumber.removeClass('nd');
  $oldNumber.css('border-right', 'none');
  $newNumber.removeClass('nd');
  $newLOC.removeClass('nd');
}

function splitInlineComment($inlineComments) {
  var insertion = $inlineComments.prev().hasClass('gi');
  $inlineComments.find('.comment-count').attr('colspan', 1);
  if (insertion) {
    $inlineComments.prepend($('<td class="placeholder" colspan="2">'));
  } else {
    $inlineComments.append($('<td class="placeholder" colspan="2">'));
  }
}

function resetInlineComment($inlineComments) {
  $inlineComments.find('.placeholder').remove();
  $inlineComments.find('.comment-count').attr('colspan', 2);
}

function isFilesBucketTab() {
  return ($('.tabnav-tab.selected').attr('href') == '#files_bucket') || ($('.tabnav-tab.selected').data().containerId == 'files_bucket');
}

function isSplittable($table) {
  return ($('tr.gd', $table).length && $('tr.gi', $table).length);
}

function isResettable($table) {
  return ($('.new-number', $table).length > 0)
}
