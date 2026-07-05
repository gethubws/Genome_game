(function () {
  var STORAGE_KEY = 'gene-current-image-api-key';
  var SETTINGS = {
    baseUrl: 'https://zmzai.cn/v1',
    model: 'gpt-image-2'
  };

  function getApiKey() {
    return Utils.storageGet(STORAGE_KEY, '');
  }

  function hasApiKey() {
    return !!getApiKey();
  }

  function setApiKey(value) {
    var key = String(value || '').trim();
    if (!key) return clearApiKey();
    return Utils.storageSet(STORAGE_KEY, key);
  }

  function clearApiKey() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return Utils.storageSet(STORAGE_KEY, '');
    }
  }

  function maskedKey() {
    var key = getApiKey();
    if (!key) return '';
    return 'saved locally';
  }

  window.ImageSystem = {
    settings: SETTINGS,
    getApiKey: getApiKey,
    hasApiKey: hasApiKey,
    setApiKey: setApiKey,
    clearApiKey: clearApiKey,
    maskedKey: maskedKey
  };
})();
