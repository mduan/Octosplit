function isFileDiffUrl(url) {
  return (
    url.match(/https:\/\/github.com\/.*\/pull\/.*/) ||
    url.match(/https:\/\/github.com\/.*\/commit\/.*/) ||
    url.match(/https:\/\/github.com\/.*\/compare\/.*/)
  );
}

var prevUrlByTab = {};
chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
  var url = details.url;
  var prevUrl = prevUrlByTab[details.tabId];
  if (isFileDiffUrl(url) || prevUrl && isFileDiffUrl(prevUrl)) {
    chrome.tabs.reload(details.tabId);
  }
  prevUrlByTab[details.tabId] = url;
});
