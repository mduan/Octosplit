/** @jsx React.DOM */

var Checkboxes = React.createClass({
  // TODO(mack): Managing state shouldn't be necessary as long as we are only
  // rendering once; verify this is the case
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
    if (this.state.checked) {
      $('#files').addClass('sideBySide');
    } else {
      $('#files').removeClass('sideBySide');
    }

    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'sideBySide'
    };
    if (this.state.checked) {
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
    if (this.state.checked) {
      $('#files').addClass('wordWrap');
    } else {
      $('#files').removeClass('wordWrap');
    }

    var attributes = {
      onClick: this.clickCheckbox,
      type: 'checkbox',
      id: 'wordWrap'
    };
    if (this.state.checked) {
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

var FileDiffView = React.createClass({

  getInitialState: function() {
    return {
      sideBySide: this.props.sideBySide,
      wordWrap: this.props.wordWrap,
      rows: this.props.rows
    };
  },

  render: function() {
    if (!this.state.sideBySide) {
      return this.renderInline();
    } else /* mode === 'sideBySide' */ {
      return this.renderSideBySide();
    }
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

  clickShowLines: React.autoBind(function(missingRange, evt, currTargetId) {
    var numLines = this.props.linesToShow;
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
  }),

  fetchFile: function() {
    if (this.state.fileDataPromise) {
      return this.state.fileDataPromise;
    }

    this.setState({
      fileDataPromise: $.get(this.props.rawUrl).then(function(data) {
        var fileLines = data.split(/\r?\n/);
        return fileLines;
      })
    });
    return this.state.fileDataPromise;
  },

  renderInline: function() {
    var lines = this.state.rows.map(function(row, rowIdx) {
      if (row.type === 'showLines') {
        return this.renderInlineShowLines(row);
      } else if (row.type === 'comments') {
        return this.renderInlineComments(row);
      } else {
        return this.renderInlineCode(row, rowIdx);
      }
    }.bind(this));

    return (
      <tbody>
        {lines}
      </tbody>
    );
  },

  renderInlineShowLines: function(row) {
    var missingRange = row.cells[0];
    return (
      <tr className={'showLines ' + missingRange.pos}>
        <td colSpan="3">
          {this.renderShowLinesLinks(missingRange)}
        </td>
      </tr>
    );
  },

  renderInlineComments: function(row) {
    var commentsView = (
      <tr className="inline-comments">
        <td colSpan={4}></td>
      </tr>
    );
    row.cells[0].newView = commentsView;
    return commentsView;
  },

  componentWillMount: function() {
  },

  componentWillUpdate: function() {
    this.restoreComments();
  },

  restoreComments: function() {
    this.state.rows.forEach(function(row) {
      if (row.type === 'comments') {
        row.cells[0].$element.remove();
      }
    });
  },

  componentDidMount: function(rootNode) {
    this.updateComments(rootNode);
  },

  componentDidUpdate: function(_, _, rootNode) {
    this.updateComments(rootNode);
  },

  updateComments: function(rootNode) {
    this.state.rows.forEach(function(row, rowIdx) {
      if (row.type !== 'comments') {
        return;
      }
      var $element = row.cells[0].$element.clone();
      $element.find('.empty-cell').remove();
      $element.find('.empty-line').remove();
      row.cells[0].$element = $element;

      if (this.state.sideBySide) {
        $element.find('.comment-count').attr('colspan', 1);
        $element.find('.line-comments').attr('colspan', 1);
        var $placeholder = [
          $('<td/>').addClass('empty-cell'),
          $('<td/>').addClass('empty-line')
        ];
        if (row.commentType === 'lineInsertion') {
          $element.prepend($placeholder);
        } else {
          $element.append($placeholder);
        }
        var $prevRow = $(rootNode)
            .find('.diff-line-code[data-row-idx=' + (rowIdx - 1) + ']')
            .closest('.file-diff-line');
      } else {
        $element.find('.comment-count').attr('colspan', 2);
        $element.find('.line-comments').attr('colspan', 1);
        var $prevRow = $(rootNode)
            .find('.diff-line-code[data-row-idx=' + (rowIdx - 1) + ']')
            .closest('.file-diff-line');
      }

      $element.insertAfter($prevRow);
      $element.addClass('show');
    }, this);
  },

  renderSideBySideShowLines: function(row) {
    var missingRange = row.cells[0];
    return (
      <tr className={'showLines ' + missingRange.pos}>
        <td colSpan="4">
          {this.renderShowLinesLinks(missingRange)}
        </td>
      </tr>
    );
  },

  renderShowLinesLinks: function(missingRange) {
    var links = [];
    if (missingRange.pos === 'last' && missingRange.length < 0) {
      var showAllLink = (
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showAll" href="#">
          Show all remaining lines
        </a>
      );
    } else {
      var showAllLink = (
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showAll" href="#">
          Show all {missingRange.length} remaining lines
        </a>
      );
    }

    links.push(showAllLink);

    // TODO(mack): Refactor to remove duplication
    if (missingRange.length >= 0 &&
        missingRange.length < this.props.linesToShow * 2) {
      return links;
    }

    if (missingRange.pos === 'last') {
      var showAboveLink = [
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showAbove" href="#">
          ▲ Show {this.props.linesToShow} lines
        </a>,
        <span class="dot">•</span>
      ];
      var showBelowLink = [
        <span class="dot">•</span>,
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showBelow" href="#">
          Show last {this.props.linesToShow} lines
        </a>
      ];

    } else if (missingRange.new === 0) {
      var showAboveLink = [
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showAbove" href="#">
          Show first {this.props.linesToShow} lines
        </a>,
        <span class="dot">•</span>
      ];
      var showBelowLink = [
        <span class="dot">•</span>,
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showBelow" href="#">
          ▼ Show {this.props.linesToShow} lines
        </a>
      ];
    } else {
      var showAboveLink = [
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showAbove" href="#">
          ▲ Show {this.props.linesToShow} lines
        </a>,
        <span class="dot">•</span>
      ];
      var showBelowLink = [
        <span class="dot">•</span>,
        <a onClick={this.clickShowLines.bind(null, missingRange)}
            class="showBelow" href="#">
          ▼ Show {this.props.linesToShow} lines
        </a>
      ];
    }

    links.unshift(showAboveLink);
    links.push(showBelowLink);

    return links;
  },

  renderInlineCode: function(row, rowIdx) {
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
  },

  renderSideBySideComment: function(row, type) {
    row.commentType = type;
    var commentsView = (
      <tr className={'inline-comments-placeholder'}>
        <td colSpan={4}></td>
      </tr>
    );
    row.cells[0].newView = commentsView;
    return commentsView;
  },

  renderSideBySide: function() {

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
            var rowView = this.renderSideBySideComment(
                rows[deleteRowIdx++], 'lineDeletion');
          } else if (rows[insertRowIdx] &&
                     rows[insertRowIdx].type === 'comments') {
            var rowView = this.renderSideBySideComment(
                rows[insertRowIdx++], 'lineInsertion');
          } else if (rows[deleteRowIdx] &&
                     rows[deleteRowIdx].type === 'lineDeletion') {
            var rowView = (
              <tr className="file-diff-line">
                {this.renderSideBySideCode(rows[deleteRowIdx], deleteRowIdx)}
                {this.renderSideBySideCode(rows[insertRowIdx], insertRowIdx)}
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
            var rowView = this.renderSideBySideComment(
                rows[insertRowIdx++], 'lineInsertion');
          } else if (rows[insertRowIdx] &&
                     rows[insertRowIdx].type === 'lineInsertion') {
            var rowView = (
              <tr className="file-diff-line">
                {this.renderSideBySideCode(null)}
                {this.renderSideBySideCode(rows[insertRowIdx], insertRowIdx)}
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
          <tr className="file-diff-line">
            {this.renderSideBySideCode(rows[rowIdx], rowIdx)}
            {this.renderSideBySideCode(rows[rowIdx], rowIdx)}
          </tr>
        );
        rowViews.push(rowView);
        ++rowIdx;
      } else if (rows[rowIdx].type === 'comments') {
        var rowView = this.renderSideBySideComment(
            rows[rowIdx++], 'lineUnchanged');
        rowViews.push(rowView);
      } else if (rows[rowIdx].type === 'showLines') {
        var rowView = this.renderSideBySideShowLines(rows[rowIdx++]);
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

  renderSideBySideCode: function(row, rowIdx) {
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
      debugger;
      var rowIdx = $target.closest('.diff-line-code').data('row-idx');
      var $row = $target.closest('.file-diff-line').next();
      $row.remove();
      this.state.rows.splice(rowIdx + 1, 0, {
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
    var fileDiffViews = [];
    $('.file-diff').each(function() {
      var $fileDiff = $(this);
      var parsedData = parseFileDiff($fileDiff);
      // TODO(mack): Figure out how to do this cleanly
      $fileDiff.empty();

      var fileDiffView = (
        <FileDiffView
            linesToShow={20}
            rows={parsedData.rows}
            rawUrl={parsedData.rawUrl}
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

//var fileStates = [];
//function addShowLines() {
//  $('table.file-diff').each(function() {
//    // TODO(mack): Uncomment
//    fileStates.push(new FileState($(this), true));
//  });
//}

//function updateShowLines(inlineMode) {
//  for (var i = 0; i < fileStates.length; ++i) {
//    fileStates[i].setInlineMode(inlineMode);
//  }
//}
//
//function addWordWrapCheckbox() {
//  var $checkbox = $('<input type="checkbox" id="wordwrap" />');
//  var $label    = $('<label id="wordwrap-label" for="wordwrap"><span class="mini-icon mini-icon-reorder"></span>word wrap</label>');
//
//  $('#toc .explain').append($label, $checkbox);
//
//  $checkbox.on('click', function(event) {
//    if ($(this).is(':checked')) {
//      saveSetting('wordWrap', true);
//      enableWordWrap();
//    } else {
//      saveSetting('wordWrap', false);
//      disableWordWrap();
//    }
//  });
//}
//
//function enableWordWrap() {
//  $('#files').addClass('word-wrap');
//}
//
//function disableWordWrap() {
//  $('#files').removeClass('word-wrap');
//}
//
//function addSideBySideCheckbox() {
//  var $checkbox = $('<input type="checkbox" id="octosplit" />');
//  var $label    = $('<label id="octosplit-label" for="octosplit"><span class="mini-icon mini-icon-public-mirror"></span>side by side</label>');
//
//  $('#toc .explain').append($label, $checkbox);
//
//  $checkbox.on('click', function(event) {
//    if ($(this).is(':checked')) {
//      saveSetting('sideBySide', true);
//      enableSideBySide();
//    } else {
//      saveSetting('sideBySide', false);
//      disableSideBySide();
//    }
//  });
//}
//
//function enableSideBySide() {
//  $('#files').addClass('side-by-side');
//  enlarge();
//  splitDiffs();
//  updateShowLines(false);
//}
//
//function disableSideBySide() {
//  $('#files').removeClass('side-by-side');
//  shrink();
//  resetDiffs();
//  updateShowLines(true);
//}
//
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
