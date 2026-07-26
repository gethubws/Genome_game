(function () {
  var messages = {
    'zh-CN': {
      gameTitle: '几何潜游：吞噬与进化', brandShort: '几何潜游', enterGame: '进入游戏', resume: '继续游戏', gallery: '图鉴',
      mode: '模式', fourGates: '四层下潜', archive: '档案', status: '状态', ready: '就绪', records: '条记录',
      imageApi: '图像 API', save: '保存', clear: '清除', notSaved: '未保存', keySavedLocally: '密钥已保存在本机', pasteKeyLocally: '在本机粘贴密钥', savedLocally: '已保存在本机', saveFailed: '保存失败',
      stage: '阶段', depth: '深度', power: '战力', genome: '基因组', expression: '表达倍率', growthPower: '成长战力',
      recommendation: '路线推荐', targetWord: '目标单词', missingLetters: '缺少字母', bestRegion: '最佳区域',
      tailWords: '队尾成词', noTailWords: '暂无可成词', outgoing: '满队列挤出', outgoingHint: '下一字母进入时，从左侧未锁定字母开始挤出', allGenomeLocked: '当前字母均已锁定', eachOccurrence: '每次',
      genomeQueue: '基因队列', incoming: '当前序列', skills: '技能', empty: '空位', locked: '未解锁', active: '激活中',
      settings: '设置', settingsSub: '修改后立即生效', close: '关闭', language: '语言', audio: '声音', masterVolume: '主音量', musicVolume: '音乐音量', sfxVolume: '音效音量', mute: '全部静音', muteBackground: '切到后台时静音',
      visuals: '画面与辅助', screenShake: '屏幕震动', flash: '闪光强度', combatText: '战斗文字', quality: '画面质量', off: '关闭', low: '低', standard: '标准', soft: '柔和', full: '完整', compact: '精简', performance: '性能', high: '高',
      balanceLab: '打开数值调试',
      display: '显示', fullscreen: '全屏', enterFullscreen: '进入全屏', exitFullscreen: '退出全屏', controls: '操作说明', move: '移动', aim: '瞄准', useSkills: '使用技能', openSettings: '打开设置', reset: '恢复默认设置',
      skillBackpack: '技能背包', selectThree: '最多装备三个技能', equipped: '已装备', equip: '装备', emptySlot: '空技能槽', allSlotsFull: '三个技能槽已满', removeSkillFirst: '请先卸下一个已装备技能',
      noneYet: '暂无', routeHint: '路线提示', nextMultiplier: '下一倍率', sequenceMultiplier: '当前序列倍率', skillSnapshotMultiplier: '技能快照倍率', scanChooseDescend: '扫描、选择、下潜', bossCurrent: 'Boss 战区', settingsSaved: '设置已保存',
      scan: '扫描', dash: '冲刺', shot: '基因弹', nova: '新星脉冲', guard: '护盾', freeze: '冻结',
      skill_scan: '显示附近敌人的基因与战力。', skill_dash: '向前爆发冲刺并暂时提升战力。', skill_shot: '发射削弱敌人的基因弹。', skill_nova: '削弱附近的所有敌人。', skill_guard: '抵挡下一次破坏基因的攻击。', skill_freeze: '大范围减慢敌人。',
      wordFormed: '新单词已成形', wordPending: '倍率已计入战力，击败 Boss 后确认技能收录', wordExpressed: '单词已表达',
      bossWordLetter: 'Boss 字母', bossWordLetterBody: '已进入基因队列', genomeExpanded: '基因组扩展', slotsAdded: '容量增加',
      noWordLock: '当前没有可锁定单词', buildWordFirst: '先在当前基因组中形成一个单词', wordLocked: '单词块已锁定', wordLockBody: '将抵抗队列挤压',
      guardImpact: '守护抵挡了冲击', guardAttack: '守护抵挡了攻击', guardBody: '基因组没有受到破坏', growthProtected: '成长战力受到保护',
      lockShattered: '单词锁已破碎', lockShatteredBody: '崩解压力击穿了最早的锁定块', genomeCollapse: '基因组崩解', genomeCollapseBody: '最后的储备耗尽，基因组无法维持形状。',
      runCleared: '完成下潜', runClearedBody: '第四道闸门已经崩塌，这套基因组完成了完整下潜。', genomeExpandedResult: '基因组已扩展', genomeExpandedBody: 'Boss 战力崩解，字母进入队列，容量增加。',
      newRun: '重新开始', diveOn: '继续下潜', finalBossRoom: '最终 Boss 区', bossRoomEntered: '进入 Boss 区', bossBypassed: '已绕过 Boss', bossRestoredBody: '被绕过的 Boss 已恢复完整战力', bossRoomHint: '在这里击败 Boss，或凭速度继续下潜',
      corrodeFailed: '侵蚀未命中', noTarget: '范围内没有可选目标', targetCorroded: '目标已被侵蚀', echoFailed: '回响未启动', noExpressedWord: '没有可回响的已确认单词',
      wordEchoed: '单词回响', growthSurge: '成长涌动', spliceFailed: '剪接未启动', allLocked: '所有基因因子都已锁定', genomeSpliced: '基因组已剪接',
      growthFlash: '成长', growthCatches: '条成长鱼获得强化', echoFlash: '回响', echoAmplifiedFor: '获得强化，持续', corrodeFlash: '侵蚀', spliceFlash: '剪接', movedToTail: '已移至队尾',
      eachSecond: '秒', powerLabel: '战力', totalLabel: '总计', causeLabel: '原因', depthLabel: '深度', wordsLabel: '单词', bossesLabel: '已击败 Boss',
      finalPowerLabel: '最终战力', expressedLabel: '已确认单词', genomeLabel: '基因组', wordLabel: '单词', slotsLabel: '槽位', nextGateLabel: '下一关',
      collapseFlash: '基因组崩解', lockFlash: '锁定',
      damageImpact: '冲击', damagePounce: '突袭', damagePulse: '脉冲', damageBite: '撕咬', damageSpitter: '远程弹命中', damageAttack: '伤害',
      galleryLoading: '正在加载图鉴', galleryReading: '正在读取本地记录', galleryEmptyTitle: '还没有完成记录', galleryEmptyBody: '击败第四个 Boss 后，最终图像会出现在这里。', galleryUnavailableTitle: '图鉴暂时不可用', galleryUnavailableBody: '无法读取本地存储。',
      generatedGenomeAvatar: '生成的基因头像', clearedGenome: '已完成的基因组', savedRun: '已保存的下潜', wordsCount: '个单词',
      finalImageReady: '最终图像已生成', savedToGallery: '已保存到图鉴。', generatedFromClearedGenome: '根据完成下潜的基因组生成。', generatingFinalImage: '正在生成最终图像', clearedGenomeRendering: '正在渲染完成下潜的基因组。', imageKeyNotSaved: '图像密钥未保存', openStartMenuToSave: '请打开开始菜单保存本机密钥，然后再次完成下潜。', imageGenerationFailed: '图像生成失败', imageRequestDidNotComplete: '图像请求未完成。', finalImageQueued: '最终图像已排队', preparingClearedGenome: '正在准备完成下潜的基因组。', finalImageStillRendering: '最终图像仍在生成', waitGallerySave: '请等待图鉴保存完成后再开始新一局。',
      flowedOut: '已被挤出', slot: '槽位', bestRegionNone: '扫描附近区域', pendingConfirmation: '待确认',
      enemyGrowth: '成长鱼', enemyLetter: '字母鱼', enemyHunter: '追击型', enemySpitter: '远程型', enemyDisruptor: '脉冲型', rewardCapacity: '容量奖励', rewardLock: '锁定奖励', rewardLetter: '字母奖励',
      scanGrowthPower: '成长战力', scanLetter: '字母', wordTypePlain: '普通', wordTypeCommon: '常用', wordTypeSkill: '技能', wordTypeVisual: '形态',
      evolutionCurrent: '进化结果', genomeExpandedDefault: '基因组已扩展', newLettersEntered: '新字母已进入当前基因组。', finalImageIdle: '最终图像待生成', waitingForClearData: '等待完成下潜数据。', runArchive: '下潜档案', galleryTitle: '图鉴', closeGallery: '关闭图鉴'
    },
    en: {}
  };
  var englishFallback = {};

  function locale() { return (window.SettingsSystem && SettingsSystem.get().language) || 'zh-CN'; }
  function t(key, fallback) {
    if (locale() === 'en') return fallback || englishFallback[key] || key;
    return (messages['zh-CN'][key] || fallback || key);
  }
  function apply(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      var fallback = el.getAttribute('data-i18n-en') || el.textContent;
      englishFallback[el.dataset.i18n] = fallback;
      el.textContent = t(el.dataset.i18n, fallback);
    });
    document.documentElement.lang = locale();
    document.title = locale() === 'zh-CN' ? '几何潜游：吞噬与进化' : 'Geometric Dive: Consume & Evolve';
  }
  window.I18n = { t: t, apply: apply, locale: locale };
})();
