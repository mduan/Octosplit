/** @jsx React.DOM */

var SideBySideCheckbox = React.createClass({
  getInitialState: function() {
    return this.props;
  },

  clickCheckbox: React.autoBind(function(evt) {
    this.setState({ sideBySide: !this.state.sideBySide });
    saveSetting('sideBySide', this.state.sideBySide);
    this.state.observable.fire({ sideBySide: this.state.sideBySide });
  }),

  render: function() {
    if (this.state.sideBySide) {
      $('#files').addClass('sideBySide');
    } else {
      $('#files').removeClass('sideBySide');
    }

    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'sideBySide'
    };
    if (this.state.sideBySide) {
      attributes.checked = 'checked';
    }

    return (
      <span>
        {React.DOM.input(attributes)}
        <label id="sideBySideLabel" htmlFor="sideBySide">
          <span class="mini-icon mini-icon-public-mirror"></span>
          side by side
        </label>
      </span>
    );
  }
});

var WordWrapCheckbox = React.createClass({
  getInitialState: function() {
    return this.props;
  },

  clickCheckbox: React.autoBind(function(evt) {
    this.setState({ wordWrap: !this.state.wordWrap });
    saveSetting('wordWrap', this.state.wordWrap);
    this.state.observable.fire({ wordWrap: wordWrap });
  }),

  render: function() {
    if (this.state.wordWrap) {
      $('#files').addClass('wordWrap');
    } else {
      $('#files').removeClass('wordWrap');
    }

    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'wordWrap'
    };
    if (this.state.wordWrap) {
      attributes.checked = 'checked';
    }

    return (
      <span>
        {React.DOM.input(attributes)}
        <label id="wordWrapLabel" htmlFor="wordWrap">
          <span class="mini-icon mini-icon-reorder"></span>
          word wrap
        </label>
      </span>
    );
  }
});

var FileDiffViewMixin = {
  getDiffView: function(props) {
    if (props.sideBySide) {
      return FileSideBySideDiffView(props);
    } else {
      return FileInlineDiffView(props);
    }
  },

  getInitialState: function() {
    return this.props;
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    window.setTimeout(function() {
      var parentNode = $(this.getDOMNode()).parent().get(0);
      this.state.observable.remove(this.setStateCallback);
      React.unmountAndReleaseReactRootNode(parentNode);

      var diffView = this.getDiffView(this.state);
      React.renderComponent(diffView, parentNode);
    }.bind(this));

    return false;
  },

  componentDidMount: function(rootNode) {
    var rows = this.state.rows;
    $(rootNode).find('.inline-comments').each(function() {
      var $element = $(this);
      var rowIdx = $element.find('.line-comments').data('row-idx');
      var row = rows[rowIdx];
      row.cells[0].$element = $element;
    });
    this.setStateCallback = this.setState.bind(this);
    this.state.observable.add(this.setStateCallback);
  },

  fetchFile: function() {
    if (this.state.fileDataPromise) {
      return this.state.fileDataPromise;
    }

    this.state.fileDataPromise = $.get(this.state.rawUrl).then(function(data) {
      var fileLines = data.split(/\r?\n/);
      return fileLines;
    });
    return this.state.fileDataPromise;
  },

  getShowRows: function(fileLines, showRange) {
    var showRows = [];
    for (var i = 0; i < showRange.length; ++i) {
      var fileLine = fileLines[showRange.new + i];
      fileLine = $('<div/>').text(' ' + fileLine).html();
      fileLine = fileLine
        .replace(/ /g, '&nbsp;')
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

      showRows.push({
        type: 'lineUnchanged',
        cells: [
          { lineNum: showRange.old + i + 1 },
          { lineNum: showRange.new + i + 1 },
          { code: fileLine }
        ]
      });
    }
    return showRows;
  },

  clickShowLines: function(missingRange, evt, currTargetId) {
    var numLines = this.state.linesToShow;
    var $target = $(document.getElementById(currTargetId));
    this.fetchFile().then(function(fileLines) {
      if (missingRange.length === -1) {
        // TODO(mack): For some reason fileLines.length is one too long...
        missingRange.length = fileLines.length - missingRange.new;
      }

      var rowIdx = NaN;
      for (var i = 0; i < this.state.rows.length; ++i) {
        var row = this.state.rows[i];
        if (row.type === 'showLines' && row.cells[0] === missingRange) {
          rowIdx = i;
          break;
        }
      }
      if (isNaN(rowIdx)) {
        console.error('Could not find row for missingRange');
      }

      if ($target.hasClass('showAll') || missingRange.length <= numLines) {
        var showRange = {
          new: missingRange.new,
          old: missingRange.old,
          length: missingRange.length
        };
        var showRows = this.getShowRows(fileLines, showRange);
        Array.prototype.splice.apply(
          this.state.rows, [rowIdx, 1].concat(showRows));
      } else {
        if ($target.hasClass('showAbove')) {
          var showRange = {
            new: missingRange.new,
            old: missingRange.old,
            length: numLines
          };
          missingRange.old += numLines;
          missingRange.new += numLines;

          var showRows = this.getShowRows(fileLines, showRange);
          Array.prototype.splice.apply(
            this.state.rows, [rowIdx, 0].concat(showRows));
        } else /* showBelow */ {
          if (missingRange.pos === 'last') {
            missingRange.pos = 'mid';
          }

          var showRange = {
            new: missingRange.new + missingRange.length - numLines,
            old: missingRange.old + missingRange.length - numLines,
            length: numLines
          };
          var showRows = this.getShowRows(fileLines, showRange);
          Array.prototype.splice.apply(
            this.state.rows, [rowIdx + 1, 0].concat(showRows));
        }

        missingRange.length -= numLines;
      }

      this.setState({ rows: this.state.rows })

    }.bind(this));

    return false;
  },

  renderShowLinesLinks: function(missingRange) {
    var clickShowLines = this.clickShowLines.bind(this, missingRange);
    var links = [];
    if (missingRange.pos === 'last' && missingRange.length < 0) {
      var showAllLink = (
        <a onClick={clickShowLines}
            className="showAll" href="#">
          Show all remaining lines
        </a>
      );
    } else {
      var showAllLink = (
        <a onClick={clickShowLines}
            className="showAll" href="#">
          Show all {missingRange.length} remaining lines
        </a>
      );
    }

    links.push(showAllLink);

    // TODO(mack): Refactor to remove duplication
    if (missingRange.length >= 0 &&
        missingRange.length < this.state.linesToShow * 2) {
      return links;
    }

    if (missingRange.pos === 'last') {
      var showAboveLink = [
        <a onClick={clickShowLines}
            className="showAbove" href="#">
          ▲ Show {this.state.linesToShow} lines
        </a>,
        <span className="dot">•</span>
      ];
      var showBelowLink = [
        <span className="dot">•</span>,
        <a onClick={clickShowLines}
            className="showBelow" href="#">
          Show last {this.state.linesToShow} lines
        </a>
      ];

    } else if (missingRange.new === 0) {
      var showAboveLink = [
        <a onClick={clickShowLines}
            className="showAbove" href="#">
          Show first {this.state.linesToShow} lines
        </a>,
        <span className="dot">•</span>
      ];
      var showBelowLink = [
        <span className="dot">•</span>,
        <a onClick={clickShowLines}
            className="showBelow" href="#">
          ▼ Show {this.state.linesToShow} lines
        </a>
      ];
    } else {
      var showAboveLink = [
        <a onClick={clickShowLines}
            className="showAbove" href="#">
          ▲ Show {this.state.linesToShow} lines
        </a>,
        <span className="dot">•</span>
      ];
      var showBelowLink = [
        <span className="dot">•</span>,
        <a onClick={clickShowLines}
            className="showBelow" href="#">
          ▼ Show {this.state.linesToShow} lines
        </a>
      ];
    }

    links.unshift(showAboveLink);
    links.push(showBelowLink);

    return links;
  }
};

var FileInlineDiffView = React.createClass({

  mixins: [FileDiffViewMixin],

  render: function() {
    var lines = this.state.rows.map(function(row, rowIdx) {
      if (row.type === 'showLines') {
        return this.renderShowLines(row);
      } else if (row.type === 'comments') {
        return this.renderComment(row, rowIdx);
      } else {
        return this.renderCode(row, rowIdx);
      }
    }.bind(this));

    return (
      <tbody>
        {lines}
      </tbody>
    );
  },

  renderShowLines: function(row) {
    var missingRange = row.cells[0];
    return (
      <tr className={'showLines ' + missingRange.pos}>
        <td colSpan={3}>
          {this.renderShowLinesLinks(missingRange)}
        </td>
      </tr>
    );
  },

  renderComment: function(row, rowIdx) {
    var $element = row.cells[0].$element;

    $element.addClass('show');
    $element.find('.empty-cell').remove();
    $element.find('.empty-line').remove();
    $element.find('.comment-count').attr('colspan', 2);
    $element.find('.line-comments')
        .attr('colspan', 1)
        .attr('data-row-idx', rowIdx);

    var commentsView = (
      <tr className={$element.attr('class')}
          dangerouslySetInnerHTML={{ __html: $element.html() }}>
      </tr>
    );
    row.cells[0].view = commentsView;
    return commentsView;
  },

  renderCode: function(row, rowIdx) {
    if (row.type === 'lineInsertion') {
      var rowClass = 'gi';
    } else if (row.type === 'lineDeletion') {
      var rowClass = 'gd';
    } else if (row.type === 'lineUnchanged') {
      var rowClass = '';
    } else {
      console.error('Unexpected row type: ' + row.type);
      return <tr></tr>
    }

    var cells = row.cells;

    if (cells[2].commentUrl) {
      // TODO(mack): see if there's some way to use React to generate markup
      var commentIcon = (
        <b onClick={this.clickAddComment}
            className="add-line-comment octicon octicon-comment-add"
            data-remote={row.cells[2].commentUrl}></b>
      );
    } else {
      var commentIcon = '';
    }

    return (
      <tr className={'file-diff-line ' + rowClass}>
        <td id={cells[0].id || ''}
            className={'diff-line-num linkable-line-number '
              + (cells[0].lineNum ? '' : 'empty-cell')}
            data-line-number={cells[0].dataLineNum || ''}>
          <span className="line-num-content">
            {cells[0].lineNum || ''}
          </span>
        </td>

        <td id={cells[1].id || ''}
            className={'diff-line-num linkable-line-number '
              + (cells[1].lineNum ? '' : 'empty-cell')}
            data-line-number={cells[1].dataLineNum || ''}>
          <span className="line-num-content">
            {cells[1].lineNum || ''}
          </span>
        </td>

        <td className="diff-line-code" data-row-idx={rowIdx}>
          {commentIcon}
          <span dangerouslySetInnerHTML={{ __html: cells[2].code }}>
          </span>
        </td>
      </tr>
    );
  }
});

var FileSideBySideDiffView = React.createClass({

  mixins: [FileDiffViewMixin],

  render: function() {

    function nextMatch(predicate, rows, beginIdx) {
      if (beginIdx >= rows.length) {
        console.error('No next match');
        return NaN;
      }
      var row = rows[beginIdx];
      while (!predicate(row)) {
        ++beginIdx;
        if (beginIdx >= rows.length) {
          console.error('No next match');
          return NaN;
        }
        row = rows[beginIdx];
      }
      return beginIdx;
    }

    var rowViews = [];
    var rows = this.state.rows;
    var rowIdx = 0;
    while (true) {
      if (isNaN(rowIdx) || rowIdx >= rows.length) {
        break;
      }
      var row = rows[rowIdx];

      if (row.type === 'lineInsertion' || row.type === 'lineDeletion') {
        if (row.type === 'lineDeletion') {
          var deleteRowIdx = rowIdx;
          var insertRowIdx = nextMatch(function(row) {
            return row.type !== 'lineDeletion' && row.type !== 'comments';
          }, rows, rowIdx + 1);
          if (rows[insertRowIdx].type !== 'lineInsertion') {
            insertRowIdx = NaN;
          }
        } else {
          var insertRowIdx = rowIdx;
          var deleteRowIdx = NaN;
        }

        rowIdx = nextMatch(function(row) {
          return row.type !== 'lineInsertion' &&
                 row.type !== 'lineDeletion' &&
                 row.type !== 'comments';
        }, rows, rowIdx + 1);

        // Process .gd and associated .gi
        while (true) {
          if (rows[deleteRowIdx] &&
              rows[deleteRowIdx].type === 'comments') {
            var rowView = this.renderComment(
                rows[deleteRowIdx], deleteRowIdx, 'lineDeletion');
            ++deleteRowIdx;
          } else if (rows[insertRowIdx] &&
                     rows[insertRowIdx].type === 'comments') {
            var rowView = this.renderComment(
                rows[insertRowIdx], insertRowIdx, 'lineInsertion');
            ++insertRowIdx;
          } else if (rows[deleteRowIdx] &&
                     rows[deleteRowIdx].type === 'lineDeletion') {
            var rowView = (
              <tr className="file-diff-line" onMouseDown={this.onMouseDown}>
                {this.renderCode(rows[deleteRowIdx], deleteRowIdx)}
                {this.renderCode(rows[insertRowIdx], insertRowIdx)}
              </tr>
            );
            ++deleteRowIdx;
            ++insertRowIdx;
          } else {
            deleteRowIdx = NaN;
            break;
          }

          if (!rows[insertRowIdx] ||
              rows[insertRowIdx].type !== 'lineInsertion' &&
              rows[insertRowIdx].type !== 'comments') {
            insertRowIdx = NaN;
          }

          rowViews.push(rowView);
        }

        // Process remaining .gi
        while (true) {
          if (rows[insertRowIdx] &&
              rows[insertRowIdx].type === 'comments') {
            var rowView = this.renderComment(
                rows[insertRowIdx], insertRowIdx, 'lineInsertion');
            ++insertRowIdx;
          } else if (rows[insertRowIdx] &&
                     rows[insertRowIdx].type === 'lineInsertion') {
            var rowView = (
              <tr className="file-diff-line" onMouseDown={this.onMouseDown}>
                {this.renderCode(null)}
                {this.renderCode(rows[insertRowIdx], insertRowIdx)}
              </tr>
            );
            ++insertRowIdx;
          } else {
            insertRowIdx = NaN;
            break;
          }

          rowViews.push(rowView);
        }

      } else if (rows[rowIdx].type === 'lineUnchanged') {
        var rowView = (
          <tr className="file-diff-line" onMouseDown={this.onMouseDown}>
            {this.renderCode(rows[rowIdx], rowIdx)}
            {this.renderCode(rows[rowIdx], rowIdx)}
          </tr>
        );
        rowViews.push(rowView);
        ++rowIdx;
      } else if (rows[rowIdx].type === 'comments') {
        var rowView = this.renderComment(
            rows[rowIdx], rowIdx, 'lineUnchanged');
        ++rowIdx;
        rowViews.push(rowView);
      } else if (rows[rowIdx].type === 'showLines') {
        var rowView = this.renderShowLines(rows[rowIdx++]);
        rowViews.push(rowView);
      } else {
        console.error('There should not be any row types except the above');
      }
    }

    return (
      <tbody>
        {rowViews}
      </tbody>
    );
  },

  onMouseDown: React.autoBind(function(evt) {
    var selection = window.getSelection();
    if (selection.rangeCount > 0) {
      selection.removeAllRanges();
    }

    var $target = $(evt.target);
    if (!$target.hasClass('diff-line-code')) {
      $target = $target.closest('.diff-line-code');
    }

    if (!$target.hasClass('diff-line-code')) {
      $(evt.target).closest('.file-diff')
        .removeClass('unselectableInsertion')
        .removeClass('unselectableDeletion');
      return;
    }

    if ($target.index() === 1) {
      $target.closest('.file-diff')
        .addClass('unselectableInsertion')
        .removeClass('unselectableDeletion');
    } else /* index == 3 */ {
      $target.closest('.file-diff')
        .addClass('unselectableDeletion')
        .removeClass('unselectableInsertion');
    }
  }),

  renderShowLines: function(row) {
    var missingRange = row.cells[0];
    return (
      <tr className={'showLines ' + missingRange.pos}>
        <td colSpan={4}>
          {this.renderShowLinesLinks(missingRange)}
        </td>
      </tr>
    );
  },

  renderComment: function(row, rowIdx, type) {
    var $element = row.cells[0].$element;

    $element.addClass('show');
    $element.find('.empty-cell').remove();
    $element.find('.empty-line').remove();
    $element.find('.comment-count').attr('colspan', 1);
    $element.find('.line-comments')
        .attr('colspan', 1)
        .attr('data-row-idx', rowIdx);

    var $placeholder = [
      $('<td/>').addClass('empty-cell'),
      $('<td/>').addClass('empty-line')
    ];
    if (type === 'lineInsertion') {
      $element.prepend($placeholder);
    } else {
      $element.append($placeholder);
    }

    var commentsView = (
      <tr className={$element.attr('class')} onMouseDown={this.onMouseDown}
          dangerouslySetInnerHTML={{ __html: $element.html() }}>
      </tr>
    );
    return commentsView;
  },

  renderCode: function(row, rowIdx) {
    if (!row) {
      var rowClass = 'empty-line';
      var lineNumCell = {};
      var code = '';
      var commentIcon = '';
    } else {
      if (row.type === 'lineInsertion') {
        var rowClass = 'gi';
        var lineNumCell = row.cells[1];
      } else if (row.type === 'lineDeletion') {
        var rowClass = 'gd';
        var lineNumCell = row.cells[0];
      } else if (row.type === 'lineUnchanged') {
        var rowClass = '';
        var lineNumCell = row.cells[0];
      } else {
        console.error('Unexpected row type: ' + row.type);
      }

      // TODO(mack): see if there's some way to use React to generate markup
      var code = row.cells[2].code;
      var commentIcon = (
        <b onClick={this.clickAddComment}
            className="add-line-comment octicon octicon-comment-add"
            data-remote={row.cells[2].commentUrl}></b>
      );
    }

    var ret = [
      <td id={lineNumCell.id}
          className={'diff-line-num linkable-line-number '
            + (lineNumCell.lineNum ? '' : 'empty-cell')}
          data-line-number={lineNumCell.dataLineNum || ''}>
        <span className="line-num-content">
          {lineNumCell.lineNum || ''}
        </span>
      </td>,

      <td className={'diff-line-code ' + rowClass} data-row-idx={rowIdx}>
        {commentIcon}
        <span dangerouslySetInnerHTML={{ __html: code }}>
        </span>
      </td>
    ];
    return ret;
  },

  clickAddComment: React.autoBind(function(evt) {
    $target = $(evt.target);
    window.setTimeout(function() {
      var rows = this.state.rows;

      var $thisLine = $target.closest('.diff-line-code');
      var thisRowIdx = $thisLine.data('row-idx');
      var thisRow = rows[thisRowIdx];

      if (thisRow.type === 'lineInsertion') {
        var $otherLine = $target.closest('.diff-line-code').prev().prev();
      } else {
        var $otherLine = $target.closest('.diff-line-code').next().next();
      }
      var otherRowIdx = $otherLine.data('row-idx');
      var otherRow = rows[otherRowIdx];

      var $row = $target.closest('.file-diff-line').next();

      // TODO(mack): Handle side by side view where comment added to existing
      // list of comments which could be on wrong side
      var thisNextRow = rows[thisRowIdx + 1];
      var otherNextRow = rows[otherRowIdx + 1];
      if (thisNextRow && thisNextRow.type === 'comments') {
        $row.removeClass('show-inline-comment-form');
        var $element = thisNextRow.cells[0].$element;
        $element.addClass('show-inline-comment-form');
        $element.find('.js-comment-field').focus();
        return;
      } else if (otherNextRow && otherNextRow.type === 'comments') {
        // TODO(mack): Give focus to textarea after re-render
        $row.removeClass('show-inline-comment-form');
        $row = $row.clone();
        $row.addClass('show-inline-comment-form');
        $row.find('.comment-holder').empty();
        $row.find('input[name="position"]').val(thisRow.position)
        if (thisRow.type === 'lineInsertion') {
          $row.find('input[name="line"]').val(thisRow.cells[1].dataLineNum)
        } else {
          $row.find('input[name="line"]').val(thisRow.cells[0].dataLineNum)
        }
      }

      $row.remove();
      this.state.rows.splice(thisRowIdx + 1, 0, {
        type: 'comments',
        cells: [{ $element: $row }]
      });
      this.setState({ rows: this.state.rows });
    }.bind(this), 800);
  })
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

  function parseLineIndex($row, rowIndex) {
    return parseInt(
        $row.find('td').eq(rowIndex).attr('data-line-number'), 10) - 1;
  }

  function processMissingRanges(rows) {
    var prevMissingRange;
    var isFirstMissingRange = true;
    for (var i = 0; i < rows.length; ++i) {
      var row = rows[i];
      if (row.type !== 'missingRange') {
        continue;
      }

      var $statLine = row.$row;
      // TODO(mack): This logic assumes that if there are any unchanged lines
      // above/below, at least one unchanged line will be shown; otherwise
      // it might be necessary to search in the opposite direction to get line
      // index
      var aboveOldIndex = parseLineIndex(
          $statLine.prevAll(':not(.gi)').first(), 0);
      var aboveNewIndex = parseLineIndex(
          $statLine.prevAll(':not(.gd)').first(), 1);
      var belowOldIndex = parseLineIndex(
          $statLine.nextAll(':not(.gi)').first(), 0);
      var belowNewIndex = parseLineIndex(
          $statLine.nextAll(':not(.gd)').first(), 1);

      if (isFirstMissingRange) {
        isFirstMissingRange = false;
        var length = belowNewIndex || belowOldIndex;
        if (!length) {
          rows.splice(i--, 1);
          continue;
        }
        var missingRange = {
          old: 0,
          new: 0,
          length: length,
          pos: 'first'
        };
      } else {
        if (prevMissingRange) {
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
          pos: 'middle'
        };
      }

      rows[i] = {
        type: 'showLines',
        cells: [missingRange]
      };
      prevMissingRange = missingRange;
    }

    var $lastLine = $fileDiff.find('tr:last');
    var missingRange = {
      old: parseLineIndex($lastLine, 0) + 1,
      new: parseLineIndex($lastLine, 1) + 1,
      length: -1,
      pos: 'last'
    };
    rows.push({
      type: 'showLines',
      cells: [missingRange]
    });
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
      } else if ($row.hasClass('gc')) {
        row.type = 'missingRange';
        row.$row = $row;
      } else {
        row.type = 'lineUnchanged';
      }

      var $cells = $row.find('td');
      row.position = $row.data('position');
      row.cells.push(parseLineNumberCell($cells.eq(0)));
      row.cells.push(parseLineNumberCell($cells.eq(1)));
      row.cells.push(parseCodeCell($cells.eq(2)));

    } else if ($row.hasClass('inline-comments')) {
      // TODO(mack): Consider creating JSX representing element rather than
      // cloning
      row.type = 'comments';
      row.cells.push({
        $element: $row
      });
    } else {
      console.error('Encountered unexpected row type');
    }
    rows.push(row);
  });

  processMissingRanges(rows);

  var $file = $fileDiff.closest('.file');
  var $viewFileButton = $file.find('.meta .actions .minibutton');
  var blobUrl = $viewFileButton.attr('href');
  // TODO(mack): Be careful of '/blob/' as user or repo name
  var rawUrl = blobUrl.replace(/^\/(.*?)\/blob\/(.*)$/,
      'https://github.com/$1/raw/$2');

  //var $lineNumber = $fileDiff.find('.diff-line-num:first').eq(0);
  //rows.fileIndex = parseInt($lineNumber.attr('id').match(/^L(\d+)/)[1], 10);

  return {
    rawUrl: rawUrl,
    rows: rows
  };
}

$(document).ready(function() {
  getSettings(['sideBySide', 'wordWrap']).then(function(settings) {
    var wordWrap = settings.wordWrap || false;
    var sideBySide = settings.sideBySide || false;
    var observable = $.Callbacks();

    var fileDiffViews = [];
    $('.file-diff').each(function() {
      var $fileDiff = $(this);
      var parsedData = parseFileDiff($fileDiff);
      // TODO(mack): Figure out how to do this cleanly
      $fileDiff.empty();

      var fileDiffView = FileDiffViewMixin.getDiffView({
        observable: observable,
        linesToShow: 20,
        rows: parsedData.rows,
        rawUrl: parsedData.rawUrl,
        sideBySide: sideBySide,
        wordWrap: wordWrap
      });
      React.renderComponent(fileDiffView, $fileDiff.get(0));

      fileDiffViews.push(fileDiffView);
    });

    var checkboxesView = (
      <span>
        <SideBySideCheckbox sideBySide={sideBySide} observable={observable} />
        <WordWrapCheckbox wordWrap={wordWrap} observable={observable} />
      </span>
    );
    var $checkboxesContainer = $('<span />').appendTo($('#toc .explain'));
    React.renderComponent(checkboxesView, $checkboxesContainer.get(0));
  });
});

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
