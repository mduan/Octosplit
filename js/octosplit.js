$(document).ready(function() {
  addWordWrapCheckbox();
  addSideBySideCheckbox();
  manageNewComment();
  manageTabs();
  addShowLines();
  $('.inline-comments').addClass('show');
  getSettings(['side_by_side', 'word_wrap']).then(function(settings) {
    var sideBySide = settings['side_by_side'];
    if (sideBySide) {
      $('#octosplit').click();
    }

    var wordWrap = settings['word_wrap'];
    if (wordWrap) {
      $('#wordwrap').click();
    }
  });
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

      // TODO(mack): This logic assumes that if there are any unchanged lines
      // above/below, at least one unchanged line will be shown; otherwise
      // it might be necessary to search in the opposite direction to get line
      // index
      var aboveOldIndex = this.parseLineIndex(
          $statLine.prevAll(':not(.gi)').first(), 0);
      var aboveNewIndex = this.parseLineIndex(
          $statLine.prevAll(':not(.gd)').first(), 1);
      var belowOldIndex = this.parseLineIndex(
          $statLine.nextAll(':not(.gi)').first(), 0);
      var belowNewIndex = this.parseLineIndex(
          $statLine.nextAll(':not(.gd)').first(), 1);

      if (i === 0) {
        var length = belowNewIndex || belowOldIndex;
        if (!length) {
          $statLine.remove();
          continue;
        }
        var missingRange = {
          old: 0,
          new: 0,
          length: length,
          isEnd: false
        };
      } else {
        if (missingRanges.length) {
          var prevMissingRange = missingRanges[missingRanges.length - 1];
          if (isNaN(aboveNewIndex)) {
            aboveNewIndex = prevMissingRange.new + prevMissingRange.length - 1;
          }
          if (isNaN(aboveOldIndex)) {
            aboveOldIndex = prevMissingRange.old + prevMissingRange.length - 1;
          }
        } else {
          if (isNaN(aboveNewIndex)) {
            aboveNewIndex = -1;
          }
          if (isNaN(aboveOldIndex)) {
            aboveOldIndex = -1;
          }
        }

        if (!isNaN(belowNewIndex)) {
          var length = belowNewIndex - (aboveNewIndex + 1);
        } else if (!isNaN(belowOldIndex)) {
          var length = belowOldIndex - (aboveOldIndex + 1);
        } else {
          console.error('Unexpected condition');
          continue;
        }

        var missingRange = {
          old: aboveOldIndex + 1,
          new: aboveNewIndex + 1,
          length: length,
          isEnd: false
        };
      }

      missingRange.$statLine = $statLine;
      missingRanges.push(missingRange);
    }

    var $lastLine = this.$fileDiff.find('tbody tr:last');
    var lastLineIndicies = this.parseLineIndex($lastLine);
    var missingRange = {
      old: lastLineIndicies.old + 1,
      new: lastLineIndicies.new + 1,
      length: -1,
      isEnd: true
    };
    missingRange.$lastLine = $lastLine;
    missingRanges.push(missingRange);

    for (var i = 0; i < missingRanges.length; ++i) {
      var missingRange = missingRanges[i];
      var $showLinesRow = $(
        '<tr class="show-lines">'
        + '<td colspan="3">'
        + ' <a class="show-above-20" href="#"></a> • '
        + ' <a class="show-all" href="#"></a> • '
        + ' <a class="show-below-20" href="#"></a>'
        + '</td>'
        + '</tr>'
      );
      $showLinesRow.find('.show-above-20').click(
          this.showAbove20.bind(this, missingRange));
      $showLinesRow.find('.show-all').click(
          this.showAll.bind(this, missingRange));
      $showLinesRow.find('.show-below-20').click(
          this.showBelow20.bind(this, missingRange));

      this.updateShowLinesRow($showLinesRow, missingRange);
      if (missingRange.$lastLine) {
        missingRange.$lastLine.after($showLinesRow);
      } else {
        missingRange.$statLine.replaceWith($showLinesRow);
      }
      missingRange.$showLinesRow = $showLinesRow;
    }
  }

  FileState.prototype = {

    updateShowLinesRow: function($showLinesRow, missingRange) {

      if (missingRange.isEnd && missingRange.length < 0) {
          $showLinesRow.find('.show-all').text('Show all remaining lines');
      } else {
        $showLinesRow.find('.show-all').text(
            'Show all ' + missingRange.length + ' lines');
      }

      if (missingRange.length >= 0 && missingRange.length < 40) {
        $showLinesRow.find('.show-above-20').remove();
        $showLinesRow.find('.show-below-20').remove();
      } else {
        if (missingRange.isEnd) {
          $showLinesRow.find('.show-above-20').text('▲ Show 20 lines');
          $showLinesRow.find('.show-below-20').text('Show last 20 lines');
        } else if (missingRange.new === 0) {
          $showLinesRow.find('.show-above-20').text('Show first 20 lines');
          $showLinesRow.find('.show-below-20').text('▼ Show 20 lines');
        } else {
          $showLinesRow.find('.show-above-20').text('▲ Show 20 lines');
          $showLinesRow.find('.show-below-20').text('▼ Show 20 lines');
        }
      }
    },

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
            missingRange.isEnd = false;
          }
          showRange.length = numLines;
          missingRange.length -= numLines;
        }

        var $showLinesRow = missingRange.$showLinesRow;

        var $lines = this.getLines(fileLines, showRange);
        if (mode === 'below') {
          $lines.insertAfter($showLinesRow);
        } else {
          $lines.insertBefore($showLinesRow);
        }

        if (removeShowLinesRow) {
          // TODO(mack): unbind event listeners
          $showLinesRow.remove();
        } else {
          this.updateShowLinesRow($showLinesRow, missingRange);
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

    parseLineIndex: function($row, rowIndex) {
      return parseInt(
          $row.find('td').eq(rowIndex).attr('data-line-number'), 10) - 1;
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

function addWordWrapCheckbox() {
  var $checkbox = $('<input type="checkbox" id="wordwrap" />');
  var $label    = $('<label id="wordwrap-label" for="wordwrap"><span class="mini-icon mini-icon-reorder"></span>word wrap</label>');

  $('#toc .explain').append($label, $checkbox);

  $checkbox.on('click', function(event) {
    if ($(this).is(':checked')) {
      saveSetting('word_wrap', true);
      enableWordWrap();
    } else {
      saveSetting('word_wrap', false);
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
      saveSetting('side_by_side', true);
      enableSideBySide();
    } else {
      saveSetting('side_by_side', false);
      disableSideBySide();
    }
  });
}

function enableSideBySide() {
  enlarge();
  splitDiffs();
  updateShowLines(false);
}

function disableSideBySide() {
  shrink();
  resetDiffs();
  updateShowLines(true);
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
