(function () {
  // Passive skill effects live in a registry instead of being hard-coded into
  // every combat path. The module is intentionally dependency-light so it can
  // be loaded after the existing skill APIs without changing their contracts.
  var definitions = [];
  var byId = Object.create(null);
  var registryRevision = 0;

  var EVENTS = {
    SKILL_PREPARE: 'skill:prepare',
    SKILL_STARTED: 'skill:started',
    SKILL_ENDED: 'skill:ended',
    PROJECTILE_PREPARE: 'projectile:prepare',
    PROJECTILE_HIT: 'projectile:hit',
    AREA_PREPARE: 'area:prepare',
    AREA_RESOLVED: 'area:resolved',
    TARGET_REVEALED: 'target:revealed',
    TARGET_WEAKEN: 'target:weaken',
    TARGET_WEAKENED: 'target:weakened',
    STATUS_APPLIED: 'status:applied',
    GUARD_ABSORBED: 'guard:absorbed',
    GROWTH_GAIN: 'growth:gain',
    ENEMY_CONSUMED: 'enemy:consumed',
    PLAYER_DAMAGE: 'player:damage',
    PLAYER_DAMAGED: 'player:damaged',
    GENOME_CHANGED: 'genome:changed',
    POWER_LOG_MULTIPLIER: 'power:logMultiplier',
    UPDATE: 'update'
  };

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function numberOr(value, fallback) {
    return isFiniteNumber(Number(value)) ? Number(value) : fallback;
  }

  function cloneDefaults(value) {
    var result = {};
    if (!value || typeof value !== 'object') return result;
    Object.keys(value).forEach(function (key) {
      var item = value[key];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        result[key] = cloneDefaults(item);
      } else if (Array.isArray(item)) {
        result[key] = item.slice();
      } else {
        result[key] = item;
      }
    });
    return result;
  }

  function normalizeList(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value.slice() : [value];
  }

  function normalizeTraits(value) {
    var seen = Object.create(null);
    var result = [];
    normalizeList(value).forEach(function (trait) {
      if (trait == null || trait === '') return;
      var id = String(trait);
      if (seen[id]) return;
      seen[id] = true;
      result.push(id);
    });
    return result;
  }

  function normalizeDefinition(definition) {
    if (!definition || !definition.id) throw new Error('Skill effect requires an id');
    var hooks = definition.hooks || {};
    var normalizedHooks = {};
    var requestedTraits = normalizeTraits(definition.traits != null ? definition.traits : definition.trait);
    Object.keys(hooks).forEach(function (eventName) {
      var handlers = normalizeList(hooks[eventName]).filter(function (handler) {
        return typeof handler === 'function';
      });
      if (handlers.length) normalizedHooks[eventName] = handlers;
    });

    // `update` is convenient for effects that only need a frame hook while
    // `hooks.update` remains available for a fully data-driven definition.
    if (typeof definition.update === 'function') {
      normalizedHooks[EVENTS.UPDATE] = normalizedHooks[EVENTS.UPDATE] || [];
      normalizedHooks[EVENTS.UPDATE].push(definition.update);
    }

    return {
      id: String(definition.id),
      family: definition.family == null ? null : String(definition.family),
      // `trait` remains the single-trait compatibility field. Composite
      // definitions use `traits` and match any listed trait per occurrence.
      trait: requestedTraits.length === 1 ? requestedTraits[0] : null,
      traits: requestedTraits,
      name: definition.name || String(definition.id),
      nameZh: definition.nameZh || '',
      description: definition.description || '',
      descriptionZh: definition.descriptionZh || '',
      priority: numberOr(definition.priority, 0),
      requires: definition.requires || {},
      // Trait-bearing effects require at least one matching occurrence by
      // default. Generic family effects can opt out with requireTrait:false.
      requireTrait: definition.requireTrait !== false,
      source: definition.source || 'potential',
      potency: typeof definition.potency === 'function' ? definition.potency : null,
      cleanup: typeof definition.cleanup === 'function' ? definition.cleanup : null,
      defaults: definition.defaults || null,
      hooks: normalizedHooks,
      meta: definition.meta || {}
    };
  }

  function register(definitionOrList) {
    var list = Array.isArray(definitionOrList) ? definitionOrList : [definitionOrList];
    var registered = [];
    list.forEach(function (rawDefinition) {
      var definition = normalizeDefinition(rawDefinition);
      var previous = byId[definition.id];
      if (previous) {
        var index = definitions.indexOf(previous);
        if (index >= 0) definitions[index] = definition;
      } else {
        definitions.push(definition);
      }
      byId[definition.id] = definition;
      registered.push(definition);
    });
    if (registered.length) registryRevision += 1;
    return Array.isArray(definitionOrList) ? registered : registered[0];
  }

  function unregister(id) {
    var definition = byId[id];
    if (!definition) return false;
    var index = definitions.indexOf(definition);
    if (index >= 0) definitions.splice(index, 1);
    delete byId[id];
    registryRevision += 1;
    return true;
  }

  function clearRegistry() {
    definitions.length = 0;
    Object.keys(byId).forEach(function (id) { delete byId[id]; });
    registryRevision += 1;
  }

  function occurrences(state, source) {
    var words = state && state.words ? state.words : {};
    var mode = source || 'potential';
    if (mode === 'settled' || mode === 'expressed') return words.occurrences || [];
    if (mode === 'discovered' || mode === 'global') return words.found || [];
    if (mode === 'potential' || mode === 'live') return words.potentialOccurrences || [];
    if (typeof mode === 'function') return mode(state) || [];
    return words.potentialOccurrences || words.occurrences || [];
  }

  function familyOf(word) {
    return word && (word.family || word.skill) ? (word.family || word.skill) : null;
  }

  function singleTraitWeight(word, trait) {
    var weights = word && word.traitWeights;
    if (weights && isFiniteNumber(Number(weights[trait]))) return Math.max(0, Number(weights[trait]));
    var traits = word && word.traits;
    if (Array.isArray(traits) && traits.indexOf(trait) !== -1) return 1;
    if (traits && typeof traits === 'object' && isFiniteNumber(Number(traits[trait]))) {
      return Math.max(0, Number(traits[trait]));
    }
    // Keep current saves/data useful before the trait-list migration lands.
    if (trait !== 'base' && word && word.variant === trait) return 1;
    if (trait === 'core' && word && word.coreSkillWord) return 1;
    if (trait === 'base') {
      // Runtime dictionary words may carry one deterministic specialization
      // while still contributing to the family-wide base current.
      if (word && word.baseFamilyWord) return 1;
      var baseTraits = word && word.traits;
      var baseWeights = word && word.traitWeights;
      var baseVariant = word && word.variant;
      var hasConcreteTraits = Array.isArray(baseTraits)
        ? baseTraits.length > 0
        : !!(baseTraits && typeof baseTraits === 'object' && Object.keys(baseTraits).length);
      var hasConcreteWeights = !!(baseWeights && typeof baseWeights === 'object' && Object.keys(baseWeights).some(function (key) {
        return key !== 'base' && numberOr(baseWeights[key], 0) > 0;
      }));
      // Base is the catch-all branch for ordinary family words. Core and
      // explicitly tagged variants stay out of it, even on old saves without
      // a `traits` array.
      if (!hasConcreteTraits && !hasConcreteWeights &&
          (!baseVariant || baseVariant === 'base')) return 1;
    }
    return 0;
  }

  function traitWeight(word, trait) {
    var requested = normalizeTraits(trait);
    if (!requested.length) return 1;
    // Composite traits are an OR match. Use the strongest matching weight so
    // a single occurrence never contributes twice when it carries two tags.
    return requested.reduce(function (best, item) {
      return Math.max(best, singleTraitWeight(word, item));
    }, 0);
  }

  function rawPotency(state, family, trait, source) {
    if (!family) return 0;
    var total = 0;
    occurrences(state, source).forEach(function (entry) {
      // `found` contains words rather than occurrence records. Treat each
      // discovered word as one occurrence for the explicit global source.
      var word = entry && entry.word ? entry.word : entry;
      if (!word || familyOf(word) !== family) return;
      var weight = traitWeight(word, trait);
      if (weight <= 0) return;
      total += Math.max(0.5, numberOr(word.affinity, 1)) * weight;
    });
    return total;
  }

  function transformPotency(raw) {
    var value = Number(raw);
    return value > 0 ? Math.log2(1 + value) * 2 : 0;
  }

  function familyPotency(state, family, source) {
    return transformPotency(rawPotency(state, family, null, source));
  }

  function traitPotency(state, family, trait, source) {
    return transformPotency(rawPotency(state, family, trait, source));
  }

  function activeSlots(state) {
    return state && state.player && Array.isArray(state.player.activeSlots)
      ? state.player.activeSlots
      : [];
  }

  function isSupported(state, id) {
    if (window.SkillSystem && typeof SkillSystem.isSupported === 'function') {
      return SkillSystem.isSupported(state, id);
    }
    return occurrences(state, 'potential').some(function (entry) {
      var word = entry && entry.word ? entry.word : entry;
      return familyOf(word) === id;
    });
  }

  function isEquipped(state, id) {
    return activeSlots(state).indexOf(id) !== -1;
  }

  function isPowered(state, id) {
    return isEquipped(state, id) && isSupported(state, id);
  }

  function allEquipped(state, ids) {
    return normalizeList(ids).every(function (id) { return isPowered(state, id); });
  }

  function anyEquipped(state, ids) {
    return normalizeList(ids).some(function (id) { return isPowered(state, id); });
  }

  function requirementTraitValue(state, requirement, definition) {
    var family = requirement.family || (definition && definition.family);
    var trait = requirement.traits != null ? requirement.traits : requirement.trait;
    var source = requirement.source || (definition && definition.source) || 'potential';
    if (normalizeTraits(trait).length) return traitPotency(state, family, trait, source);
    return familyPotency(state, family, source);
  }

  function requirementsPass(state, definition) {
    var requirements = definition.requires || {};
    var requiredEquipment = normalizeList(requirements.equipped).concat(normalizeList(requirements.skills));
    if (!allEquipped(state, requiredEquipment)) return false;
    if (requirements.equippedAny && !anyEquipped(state, requirements.equippedAny)) return false;

    var traitRequirements = normalizeList(requirements.traits);
    for (var i = 0; i < traitRequirements.length; i += 1) {
      var item = traitRequirements[i];
      if (typeof item === 'string') item = { trait: item };
      item = item || {};
      var value = requirementTraitValue(state, item, definition);
      var minimum = numberOr(item.minPotency, 0);
      if (value < minimum || (item.require !== false && value <= 0)) return false;
      if (item.minRawPotency != null) {
        var rawValue = rawPotency(
          state,
          item.family || definition.family,
          item.traits != null ? item.traits : (item.trait || null),
          item.source || definition.source
        );
        if (rawValue < numberOr(item.minRawPotency, 0)) return false;
      }
    }

    if (requirements.minPotency != null) {
      var ownValue = definition.traits.length
        ? traitPotency(state, definition.family, definition.traits, definition.source)
        : familyPotency(state, definition.family, definition.source);
      if (ownValue < numberOr(requirements.minPotency, 0)) return false;
    }
    if (typeof requirements.test === 'function' && !requirements.test(state, definition)) return false;
    return true;
  }

  function stateSequence(state) {
    var genome = state && state.genome;
    if (genome && Array.isArray(genome.letters)) return genome.letters.join('');
    return '';
  }

  function wordRevision(state) {
    var words = state && state.words ? state.words : {};
    if (words.effectRevision != null) return String(words.effectRevision);
    if (words.revision != null) return String(words.revision);
    return stateSequence(state);
  }

  function runtimeKey(state) {
    return registryRevision + '|' + activeSlots(state).join(',') + '|' + wordRevision(state);
  }

  function ensureRuntimeState(state) {
    if (!state.skillEffectRuntime) {
      state.skillEffectRuntime = {
        key: '',
        dirty: true,
        active: [],
        byId: Object.create(null),
        hooks: Object.create(null),
        updates: [],
        clock: null,
        scheduleSerial: 0,
        scheduled: [],
        executingScheduled: []
      };
    }
    if (!Array.isArray(state.skillEffectRuntime.scheduled)) state.skillEffectRuntime.scheduled = [];
    if (!Array.isArray(state.skillEffectRuntime.executingScheduled)) state.skillEffectRuntime.executingScheduled = [];
    if (!isFiniteNumber(Number(state.skillEffectRuntime.scheduleSerial))) state.skillEffectRuntime.scheduleSerial = 0;
    return state.skillEffectRuntime;
  }

  function scheduleOwner(options) {
    if (typeof options === 'string') return options;
    if (!options || typeof options !== 'object') return null;
    return options.ownerId || options.effectId || options.id || null;
  }

  function schedule(state, delay, callback, options) {
    if (!state || typeof callback !== 'function') return null;
    var runtime = ensureRuntimeState(state);
    if (runtime.clock == null) runtime.clock = numberOr(state.time, 0);
    var ownerId = scheduleOwner(options);
    var config = options && typeof options === 'object' ? options : {};
    runtime.scheduleSerial += 1;
    var handle = 'skill-effect-' + runtime.scheduleSerial;
    runtime.scheduled.push({
      id: handle,
      dueAt: runtime.clock + Math.max(0, numberOr(delay, 0)),
      order: runtime.scheduleSerial,
      ownerId: ownerId,
      cancelWhenInactive: ownerId ? config.cancelWhenInactive !== false : false,
      callback: callback,
      cancelled: false
    });
    return handle;
  }

  function scheduledId(handle) {
    if (typeof handle === 'string') return handle;
    return handle && handle.id ? String(handle.id) : null;
  }

  function scheduledOwnerMatches(item, ownerId) {
    if (!item || !ownerId || !item.ownerId) return false;
    if (item.ownerId === ownerId) return true;
    var ownerDefinition = byId[item.ownerId];
    return !!(ownerDefinition && ownerDefinition.family === ownerId);
  }

  function cancelScheduled(state, handle) {
    if (!state || !state.skillEffectRuntime) return false;
    var id = scheduledId(handle);
    if (!id) return false;
    var cancelled = false;
    var items = state.skillEffectRuntime.scheduled.concat(state.skillEffectRuntime.executingScheduled || []);
    var exactMatch = items.some(function (item) { return item && item.id === id && !item.cancelled; });
    items.forEach(function (item) {
      if (item.cancelled) return;
      if (exactMatch ? item.id !== id : !scheduledOwnerMatches(item, id)) return;
      item.cancelled = true;
      cancelled = true;
    });
    return cancelled;
  }

  function deactivateDefinition(state, definition, entry) {
    if (!state || !definition) return false;
    var id = definition.id;
    var storedState = state.skillEffectState && state.skillEffectState[id];
    var wasActive = !!entry;
    var hadState = !!storedState;
    if (definition.cleanup && (wasActive || hadState)) {
      definition.cleanup(state, entry || {
        definition: definition,
        id: id,
        family: definition.family,
        trait: definition.trait,
        traits: definition.traits.slice(),
        state: storedState || {}
      });
    }
    if (state.skillEffectState) delete state.skillEffectState[id];
    return wasActive || hadState;
  }

  function pruneScheduled(runtime) {
    runtime.scheduled = runtime.scheduled.filter(function (item) {
      if (!item || item.cancelled) return false;
      if (!item.cancelWhenInactive || !item.ownerId) return true;
      return !!runtime.byId[item.ownerId];
    });
  }

  function runScheduled(state, runtime) {
    var due = [];
    var pending = [];
    runtime.scheduled.forEach(function (item) {
      if (!item || item.cancelled) return;
      if (item.dueAt <= runtime.clock) due.push(item);
      else pending.push(item);
    });
    runtime.scheduled = pending;
    due.sort(function (a, b) {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      return a.order - b.order;
    });
    runtime.executingScheduled = due;
    due.forEach(function (item) {
      if (item.cancelled) return;
      // Re-check ownership at execution time in case an earlier callback
      // changed equipment and invalidated the compiled effect set.
      if (item.cancelWhenInactive && item.ownerId && !compile(state).byId[item.ownerId]) return;
      item.callback(state, item);
    });
    runtime.executingScheduled = [];
  }

  function attachScheduling(state, entry) {
    entry.schedule = function (delay, callback, options) {
      var config = {};
      if (options && typeof options === 'object') {
        Object.keys(options).forEach(function (key) { config[key] = options[key]; });
      }
      if (!config.ownerId) config.ownerId = entry.id;
      return schedule(state, delay, callback, config);
    };
    entry.cancelScheduled = function (handle) { return cancelScheduled(state, handle); };
  }

  function compareEntries(a, b) {
    if (a.definition.priority !== b.definition.priority) {
      return a.definition.priority - b.definition.priority;
    }
    return a.definition.id.localeCompare(b.definition.id);
  }

  function compile(state, force) {
    if (!state) return { active: [], byId: Object.create(null), hooks: Object.create(null), updates: [] };
    var runtime = ensureRuntimeState(state);
    var key = runtimeKey(state);
    if (!force && !runtime.dirty && runtime.key === key) return runtime;

    var previousActive = runtime.active ? runtime.active.slice() : [];

    runtime.key = key;
    runtime.dirty = false;
    runtime.active = [];
    runtime.byId = Object.create(null);
    runtime.hooks = Object.create(null);
    runtime.updates = [];

    definitions.forEach(function (definition) {
      if (definition.family && !isPowered(state, definition.family)) return;
      if (definition.requireTrait && definition.traits.length && traitPotency(state, definition.family, definition.traits, definition.source) <= 0) return;
      if (!requirementsPass(state, definition)) return;

      var familyValue = definition.family ? familyPotency(state, definition.family, definition.source) : 0;
      var traitValue = definition.family && definition.traits.length
        ? traitPotency(state, definition.family, definition.traits, definition.source)
        : familyValue;
      var entry = {
        definition: definition,
        id: definition.id,
        family: definition.family,
        trait: definition.trait,
        traits: definition.traits.slice(),
        familyPotency: familyValue,
        traitPotency: traitValue,
        rawFamilyPotency: definition.family ? rawPotency(state, definition.family, null, definition.source) : 0,
        rawTraitPotency: definition.family && definition.traits.length ? rawPotency(state, definition.family, definition.traits, definition.source) : 0,
        state: effectState(state, definition.id, definition.defaults)
      };
      attachScheduling(state, entry);
      if (definition.potency) {
        entry.traitPotency = numberOr(definition.potency(state, entry), entry.traitPotency);
      }
      runtime.active.push(entry);
      runtime.byId[entry.id] = entry;

      Object.keys(definition.hooks).forEach(function (eventName) {
        var handlers = definition.hooks[eventName];
        handlers.forEach(function (handler) {
          var list = runtime.hooks[eventName] || (runtime.hooks[eventName] = []);
          list.push({ entry: entry, handler: handler });
        });
        if (eventName === EVENTS.UPDATE) runtime.updates.push({ entry: entry, handlers: handlers });
      });
    });

    runtime.active.sort(compareEntries);
    Object.keys(runtime.hooks).forEach(function (eventName) {
      runtime.hooks[eventName].sort(function (a, b) { return compareEntries(a.entry, b.entry); });
    });
    runtime.updates.sort(function (a, b) { return compareEntries(a.entry, b.entry); });
    previousActive.forEach(function (entry) {
      if (!runtime.byId[entry.id]) deactivateDefinition(state, entry.definition, entry);
    });
    pruneScheduled(runtime);
    return runtime;
  }

  function invalidate(state) {
    if (!state) return;
    var runtime = ensureRuntimeState(state);
    runtime.dirty = true;
    runtime.key = '';
  }

  function resetEffectState(state, id) {
    if (!state) return;
    if (id == null) {
      var runtime = ensureRuntimeState(state);
      definitions.forEach(function (definition) {
        var entry = runtime.byId[definition.id] || null;
        if (entry || (state.skillEffectState && state.skillEffectState[definition.id])) {
          deactivateDefinition(state, definition, entry);
        }
      });
      state.skillEffectState = Object.create(null);
      invalidate(state);
      return;
    }
    var definition = byId[id];
    if (definition) {
      var activeEntry = ensureRuntimeState(state).byId[id] || null;
      deactivateDefinition(state, definition, activeEntry);
    } else {
      cancelScheduled(state, id);
      if (state.skillEffectState) delete state.skillEffectState[id];
    }
    invalidate(state);
  }

  function resetFamilyState(state, family) {
    if (!state || !family) return 0;
    var removed = 0;
    var runtime = ensureRuntimeState(state);
    definitions.forEach(function (definition) {
      if (definition.family !== family) return;
      var entry = runtime.byId[definition.id] || null;
      if (deactivateDefinition(state, definition, entry)) removed += 1;
    });
    if (removed) invalidate(state);
    return removed;
  }

  function effectState(state, id, defaults) {
    if (!state) return cloneDefaults(defaults);
    if (!state.skillEffectState) state.skillEffectState = Object.create(null);
    if (!state.skillEffectState[id]) state.skillEffectState[id] = cloneDefaults(defaults);
    return state.skillEffectState[id];
  }

  function active(state) {
    return compile(state).active.slice();
  }

  function get(state, id) {
    return compile(state).byId[id] || null;
  }

  function has(state, id) {
    return !!get(state, id);
  }

  function potency(state, id) {
    var entry = get(state, id);
    return entry ? entry.traitPotency : 0;
  }

  function mergeResult(context, result) {
    if (!result || typeof result !== 'object') return;
    Object.keys(result).forEach(function (key) { context[key] = result[key]; });
  }

  // Multi-phase actions may mutate the genome between phases. Capture keeps
  // the build that started the action authoritative until that action ends.
  function capture(state, eventName) {
    var runtime = compile(state);
    return {
      state: state,
      eventName: String(eventName || ''),
      handlers: (runtime.hooks[eventName] || []).slice()
    };
  }

  function capturedHandlers(snapshot, state, eventName) {
    if (!snapshot || snapshot.state !== state || snapshot.eventName !== String(eventName || '') || !Array.isArray(snapshot.handlers)) return null;
    return snapshot.handlers;
  }

  function emitHandlers(state, eventName, context, handlers) {
    var ctx = context && typeof context === 'object' ? context : {};
    ctx.state = state;
    ctx.event = eventName;
    if (ctx.cancelled == null) ctx.cancelled = false;
    handlers.forEach(function (item) {
      // A cancelled event still runs later hooks. This lets a higher-priority
      // effect cancel a default action while a lower-priority effect records a
      // cue or refunds a resource deterministically.
      var result = item.handler(ctx, item.entry);
      mergeResult(ctx, result);
    });
    return ctx;
  }

  function emit(state, eventName, context) {
    var runtime = compile(state);
    return emitHandlers(state, eventName, context, runtime.hooks[eventName] || []);
  }

  function emitCaptured(state, eventName, context, snapshot) {
    var handlers = capturedHandlers(snapshot, state, eventName);
    if (!handlers) return emit(state, eventName, context);
    return emitHandlers(state, eventName, context, handlers);
  }

  function update(state, dt, extra) {
    var runtime = compile(state);
    var context = extra && typeof extra === 'object' ? extra : {};
    context.state = state;
    context.event = EVENTS.UPDATE;
    context.dt = numberOr(dt, state && state.dt != null ? state.dt : 0);
    if (runtime.clock == null) runtime.clock = numberOr(state && state.time, 0);
    runtime.clock += Math.max(0, context.dt);
    pruneScheduled(runtime);
    runScheduled(state, runtime);
    runtime.updates.forEach(function (item) {
      item.handlers.forEach(function (handler) {
        var result = handler(context, item.entry);
        mergeResult(context, result);
      });
    });
    // An update hook may invalidate its family or change equipment. Rebuild
    // once at the end so owned delayed work is cancelled before the next tick.
    pruneScheduled(compile(state));
    return context;
  }

  function rawPotencyApi(state, family, trait, source) {
    return rawPotency(state, family, trait, source);
  }

  var api = {
    EVENTS: EVENTS,
    definitions: definitions,
    byId: byId,
    register: register,
    registerEffects: register,
    unregister: unregister,
    clearRegistry: clearRegistry,
    compile: compile,
    invalidate: invalidate,
    schedule: schedule,
    cancelScheduled: cancelScheduled,
    resetEffectState: resetEffectState,
    resetFamilyState: resetFamilyState,
    effectState: effectState,
    active: active,
    get: get,
    has: has,
    potency: potency,
    rawPotency: rawPotencyApi,
    familyPotency: familyPotency,
    traitPotency: traitPotency,
    occurrences: occurrences,
    isEquipped: isEquipped,
    isPowered: isPowered,
    capture: capture,
    emit: emit,
    emitCaptured: emitCaptured,
    update: update,
    revision: function () { return registryRevision; }
  };

  window.SkillEffects = api;

  // The existing SkillSystem is loaded immediately before this module in the
  // browser. Expose the same registry there as a bridge, while keeping this
  // file usable by tests and future builds that load it independently.
  if (window.SkillSystem) {
    window.SkillSystem.effects = api;
    window.SkillSystem.registerEffect = register;
    window.SkillSystem.registerEffects = register;
  }
})();
